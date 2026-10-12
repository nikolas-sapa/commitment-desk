import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Store } from './domain.mjs';
import { ProviderGate } from './provider.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BODY = 64000;
const staticFiles = new Map([
  ['/', ['public/index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['public/app.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['public/style.css', 'text/css; charset=utf-8']],
  ['/fonts/geist-400.woff2', ['node_modules/@fontsource/geist-sans/files/geist-sans-latin-400-normal.woff2', 'font/woff2']],
  ['/fonts/geist-500.woff2', ['node_modules/@fontsource/geist-sans/files/geist-sans-latin-500-normal.woff2', 'font/woff2']],
]);

function failure(message, status = 400) { return Object.assign(new Error(message), { status }); }
function send(response, status, value) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}
function exactKeys(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !keys.includes(key))) throw failure('Invalid request fields');
}
async function jsonBody(request) {
  if (request.headers['content-type'] !== 'application/json') throw failure('JSON content type required', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY) throw failure('Request too large', 413);
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw failure('Invalid JSON'); }
}
function matchingFixture(preview, fixture) {
  const selected = preview.payload.sources;
  const requiredIds = new Set(fixture.sources.map(source => source.id));
  for (const memory of preview.payload.memories) for (const evidence of memory.evidence) requiredIds.add(evidence.sourceId);
  if (selected.length !== requiredIds.size || selected.some(source => !requiredIds.has(source.id))) throw failure('Fixture replay requires exactly its notes and selected-memory evidence');
  for (const source of fixture.sources) {
    const current = selected.find(candidate => candidate.id === source.id);
    if (!current || current.text !== source.text || current.title !== source.title || current.eventTime !== source.eventTime) throw failure('Fixture notes differ from frozen replay');
  }
}
function replayResult(preview, fixture) {
  matchingFixture(preview, fixture);
  const result = structuredClone(fixture.expected);
  if (fixture.evaluation?.expectedSupersedesKey) {
    const target = preview.payload.memories.find(memory => memory.key === fixture.evaluation.expectedSupersedesKey && memory.status === 'active');
    if (!target) throw failure('Select the earlier active memory and its sources before replaying update');
    for (const memory of result.memories) if (memory.key === target.key) memory.supersedesId = target.id;
  }
  return result;
}

export async function createApp({ store, provider, fixtures = [], port = 0 }) {
  const token = randomBytes(32).toString('hex');
  const previews = new Map();
  let origin;
  const server = http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'none'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try {
      if (request.headers.host !== new URL(origin).host) throw failure('Invalid host', 403);
      if (request.headers.origin && request.headers.origin !== origin) throw failure('Invalid origin', 403);
      const url = new URL(request.url, origin);
      if (!url.pathname.startsWith('/api/')) {
        if (request.method !== 'GET' || url.search) throw failure('Not found', 404);
        const file = staticFiles.get(url.pathname);
        if (!file) throw failure('Not found', 404);
        const content = await readFile(resolve(ROOT, file[0]));
        response.writeHead(200, { 'Content-Type': file[1] });
        response.end(content);
        return;
      }
      if (request.headers['x-session-token'] !== token) throw failure('Session authorization required', 401);
      if (url.search) throw failure('Query parameters not supported');
      if (request.method === 'GET') {
        if (url.pathname === '/api/state') return send(response, 200, { ...store.state(), provider: provider.status() });
        if (url.pathname === '/api/fixtures') return send(response, 200, fixtures.map(fixture => ({ ...fixture, result: fixture.expected })));
        throw failure('Not found', 404);
      }
      if (request.method !== 'POST') throw failure('Method not supported', 405);
      if (request.headers.origin !== origin) throw failure('Same-origin mutation required', 403);
      const body = await jsonBody(request);
      if (url.pathname === '/api/import') {
        exactKeys(body, ['id', 'title', 'text', 'eventTime']);
        const imported = store.importSource(body);
        previews.clear();
        return send(response, 200, imported);
      }
      if (url.pathname === '/api/preview') {
        exactKeys(body, ['sourceIds', 'memoryIds', 'query', 'mode', 'fixtureId']);
        const mode = body.mode ?? 'fixture';
        if (!['fixture', 'nebius'].includes(mode)) throw failure('Invalid mode');
        const fixture = fixtures.find(candidate => candidate.id === body.fixtureId);
        if (mode === 'fixture' && !fixture) throw failure('Choose a frozen replay scenario');
        if (mode === 'nebius' && body.fixtureId) throw failure('Live mode cannot use replay selection');
        if (mode === 'nebius' && !provider.status().enabled) throw failure(provider.status().reason || 'Live inference disabled', 409);
        for (const [id, entry] of previews) if (entry.expires <= Date.now()) previews.delete(id);
        if (previews.size >= 20) throw failure('Too many pending previews; wait for expiry', 429);
        if (mode === 'fixture') {
          const current = store.state();
          if (!Array.isArray(body.sourceIds) || !Array.isArray(body.memoryIds ?? [])) throw failure('Invalid selection');
          matchingFixture({ payload: {
            sources: current.sources.filter(source => body.sourceIds.includes(source.id)),
            memories: current.memories.filter(memory => (body.memoryIds ?? []).includes(memory.id) && memory.status === 'active'),
          } }, fixture);
        }
        const domain = store.preview({ sourceIds: body.sourceIds, memoryIds: body.memoryIds ?? [], query: body.query });
        const envelope = mode === 'nebius' ? provider.prepare(domain) : { endpoint: null, model: null, body: JSON.stringify(domain.payload), hash: domain.hash };
        previews.set(domain.id, { domain, mode, fixture, envelope, expires: Date.now() + 600000, run: null });
        return send(response, 200, { ...domain, mode, fixtureId: fixture?.id ?? null, envelope });
      }
      if (url.pathname === '/api/run') {
        exactKeys(body, ['previewId', 'mode', 'fixtureId']);
        const entry = previews.get(body.previewId);
        if (!entry || entry.expires < Date.now()) throw failure('Preview missing or expired', 409);
        if (body.mode !== entry.mode || (body.fixtureId ?? null) !== (entry.fixture?.id ?? null)) throw failure('Preview approval does not match requested mode/scenario', 409);
        if (store.state().revision !== entry.domain.revision) throw failure('State changed; create a new preview', 409);
        store.validatePreview(entry.domain);
        if (!entry.run) {
          entry.run = (async () => {
            if (entry.mode === 'fixture') return store.stage(entry.domain, replayResult(entry.domain, entry.fixture), { provider: 'fixture', model: null });
            const result = await provider.infer(entry.envelope);
            return store.stage(entry.domain, result.result, result.metadata);
          })();
        }
        return send(response, 200, await entry.run);
      }
      if (url.pathname === '/api/apply') {
        exactKeys(body, ['proposalId']);
        const applied = store.applyProposal(body.proposalId);
        previews.clear();
        return send(response, 200, applied);
      }
      if (url.pathname === '/api/correct') {
        exactKeys(body, ['memoryId', 'text']);
        const corrected = store.correctMemory(body.memoryId, body.text);
        previews.clear();
        return send(response, 200, corrected);
      }
      if (url.pathname === '/api/delete') {
        exactKeys(body, ['memoryId']);
        const deleted = store.deleteMemory(body.memoryId);
        previews.clear();
        return send(response, 200, deleted);
      }
      throw failure('Not found', 404);
    } catch (error) {
      if (!response.headersSent) send(response, Number.isInteger(error.status) && error.status >= 400 && error.status < 600 ? error.status : 400, { error: error.message?.slice(0, 300) || 'Request failed' });
      else response.destroy();
    }
  });
  server.requestTimeout = 35000;
  server.headersTimeout = 10000;
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolveListen);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  const sweep = setInterval(() => {
    for (const [id, entry] of previews) if (entry.expires <= Date.now()) previews.delete(id);
  }, 60000);
  sweep.unref();
  return {
    server, url: origin, token,
    previewCount: () => previews.size,
    close: () => {
      clearInterval(sweep);
      previews.clear();
      return new Promise((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose()));
    },
  };
}

async function main() {
  await mkdir(resolve(ROOT, 'data'), { recursive: true });
  const store = new Store(resolve(ROOT, 'data/commitments.sqlite'));
  const provider = new ProviderGate({
    apiKey: process.env.NEBIUS_API_KEY || '', model: process.env.NEBIUS_MODEL || '',
    capUsd: Number(process.env.NEBIUS_CAP_USD || 0),
    inputUsdPerMillion: Number(process.env.NEBIUS_INPUT_USD_PER_MILLION || 0),
    outputUsdPerMillion: Number(process.env.NEBIUS_OUTPUT_USD_PER_MILLION || 0),
    maxInputTokens: Number(process.env.NEBIUS_MAX_INPUT_TOKENS || 0),
    accessConfirmed: process.env.NEBIUS_ACCESS_CONFIRMED === 'true',
    billingBoundsConfirmed: process.env.NEBIUS_BILLING_BOUNDS_CONFIRMED === 'true',
    ledgerPath: resolve(ROOT, 'data/provider-ledger.json'),
  });
  const fixtures = JSON.parse(await readFile(resolve(ROOT, 'fixtures/demo.json'), 'utf8'));
  const port = Number(process.env.PORT || 4317);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw failure('Invalid application port');
  const app = await createApp({ store, provider, fixtures, port });
  console.log(`Commitment Desk: ${app.url}/#session=${app.token}`);
  console.log(`Inference ${provider.status().enabled ? 'enabled by explicit local configuration' : 'disabled'}. Fixture replay never calls a model.`);
  const shutdown = async () => { await app.close(); store.close(); process.exit(0); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
