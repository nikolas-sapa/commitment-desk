import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import http from 'node:http';
import { Store } from '../src/domain.mjs';
import { ProviderGate } from '../src/provider.mjs';
import { createApp } from '../src/server.mjs';
import {mkdtemp,mkdir,copyFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';

const fixtures = JSON.parse(await readFile(new URL('../fixtures/demo.json', import.meta.url), 'utf8'));
async function setup(t) {
  const store = new Store(':memory:');
  const provider = new ProviderGate({});
  const app = await createApp({ store, provider, fixtures });
  t.after(async () => { await app.close(); store.close(); });
  const call = async (route, body, overrides = {}) => {
    const options = { headers: { 'X-Session-Token': app.token, ...overrides } };
    if (body !== undefined) { options.method = 'POST'; options.headers['Content-Type'] = 'application/json'; options.headers.Origin = app.url; options.body = JSON.stringify(body); }
    const response = await fetch(app.url + route, options);
    return { status: response.status, data: await response.json() };
  };
  return { store, app, call };
}

test('unauthenticated and hostile-origin API causes zero reads/writes/inference', async t => {
  const { store, app } = await setup(t);
  const before = store.state();
  assert.equal((await fetch(app.url + '/api/state')).status, 401);
  assert.equal((await fetch(app.url + '/api/state', { headers: { Origin: 'https://evil.example', 'X-Session-Token': app.token } })).status, 403);
  assert.equal((await fetch(app.url + '/api/import', { method: 'POST', headers: { 'X-Session-Token': app.token, 'Content-Type': 'application/json' }, body: '{}' })).status, 403);
  assert.deepEqual(store.state(), before);
  const hostile = await new Promise(resolve => {
    const request = http.get(app.url + '/api/state', { headers: { Host: 'evil.example', 'X-Session-Token': app.token } }, response => { response.resume(); response.on('end', () => resolve(response.statusCode)); });
    request.on('error', error => { throw error; });
  });
  assert.equal(hostile, 403);
});

test('actual HTTP fixture flow validates preview, stages, applies once and deletes closure', async t => {
  const { store, app, call } = await setup(t);
  const fixture = fixtures[0];
  for (const source of fixture.sources) assert.equal((await call('/api/import', source)).status, 200);
  const p = await call('/api/preview', { sourceIds: fixture.sources.map(s => s.id), memoryIds: [], query: fixture.query, mode: 'fixture', fixtureId: fixture.id });
  assert.equal(p.status, 200);
  assert.equal(app.previewCount(), 1);
  const run = { previewId: p.data.id, mode: 'fixture', fixtureId: fixture.id };
  assert.equal((await call('/api/run', { ...run, mode: 'nebius' })).status, 409);
  const staged = await call('/api/run', run);
  assert.equal(staged.status, 200);
  assert.equal((await call('/api/run', run)).data.id, staged.data.id);
  assert.equal(store.state().tasks.length, 0);
  for (let n = 0; n < 10; n++) assert.equal((await call('/api/apply', { proposalId: staged.data.id })).status, 200);
  assert.equal(app.previewCount(), 0);
  assert.equal(store.state().tasks.length, 1);
  const memory = store.state().memories.find(m => m.status === 'active');
  const late = await call('/api/preview', { sourceIds: fixture.sources.map(s => s.id), memoryIds: [], query: fixture.query, mode: 'fixture', fixtureId: fixture.id });
  assert.equal(late.status, 200);
  assert.equal(app.previewCount(), 1);
  assert.equal((await call('/api/delete', { memoryId: memory.id })).status, 200);
  assert.equal(app.previewCount(), 0);
  assert.equal(store.state().tasks.length, 0);
  assert.equal(store.state().sources.length, 0);
  assert.equal((await call('/api/run', run)).status, 409);
});

test('mismatched fixture notes, stale preview, extra fields and live disabled fail explicitly', async t => {
  const { store, call } = await setup(t);
  const fixture = fixtures[0];
  for (const source of fixture.sources) store.importSource(source);
  const base = { sourceIds: fixture.sources.map(s => s.id), memoryIds: [], query: fixture.query, mode: 'fixture', fixtureId: fixture.id };
  assert.equal((await call('/api/preview', { ...base, tool: 'send' })).status, 400);
  assert.equal((await call('/api/preview', { ...base, mode: 'nebius', fixtureId: undefined })).status, 409);
  const p = await call('/api/preview', base);
  store.importSource({ title: 'Unrelated', text: 'Unselected private note.' });
  assert.equal((await call('/api/run', { previewId: p.data.id, mode: 'fixture', fixtureId: fixture.id })).status, 409);
  const unknown = await call('/api/apply', { proposalId: 'forged' });
  assert.ok(unknown.status >= 400);
  assert.equal(store.state().tasks.length, 0);
});

test('real font dist asset and restrictive static CSP are served', async t => {
  const { app } = await setup(t);
  const response = await fetch(app.url + '/fonts/geist-400.woff2');
  assert.equal(response.status, 200);
  assert.ok((await response.arrayBuffer()).byteLength > 10000);
  assert.ok(response.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.equal((await fetch(app.url + '/.env')).status, 404);
});

test('twenty previews and rejected invalid/capacity requests preserve approved oldest without extra inference', async t => {
  const store = new Store(':memory:');
  let inferenceCalls = 0;
  const fixture = fixtures[0];
  const provider = { status: () => ({ enabled: true, model: 'nvidia/test' }), prepare: preview => ({ endpoint: 'synthetic-transport', model: 'nvidia/test', body: JSON.stringify(preview.payload), hash: preview.hash }), infer: async () => { inferenceCalls++; return { result: fixture.expected, metadata: { provider: 'nebius', model: 'nvidia/test' } }; } };
  const app = await createApp({ store, provider, fixtures });
  t.after(async () => { await app.close(); store.close(); });
  const post = async (path, body) => { const r = await fetch(app.url + path, { method: 'POST', headers: { Origin: app.url, 'X-Session-Token': app.token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() }; };
  for (const source of fixture.sources) store.importSource(source);
  const body = { sourceIds: fixture.sources.map(s => s.id), memoryIds: [], query: fixture.query, mode: 'nebius' };
  for (let n = 0; n < 21; n++) assert.equal((await post('/api/preview', { ...body, mode: 'fixture', fixtureId: fixtures[1].id })).status, 400);
  let first;
  for (let n = 0; n < 20; n++) { const r = await post('/api/preview', body); assert.equal(r.status, 200); first ??= r.data; }
  assert.equal((await post('/api/preview', body)).status, 429);
  assert.equal(inferenceCalls, 0);
  const run = await post('/api/run', { previewId: first.id, mode: 'nebius' });
  assert.equal(run.status, 200);
  assert.equal(inferenceCalls, 1);
  assert.equal(store.state().tasks.length, 0);
});

test('app CLI parses explicit input bound and disables missing/fractional bounds without inference',async t=>{
  const root=await realpath(await mkdtemp(join(tmpdir(),'commitment-server-config-')));t.after(()=>rm(root,{recursive:true,force:true}));
  for(const relative of ['src/server.mjs','src/provider.mjs','src/domain.mjs','fixtures/demo.json']) {
    await mkdir(join(root,relative,'..'),{recursive:true});await copyFile(new URL(`../${relative}`,import.meta.url),join(root,relative));
  }
  for(const bound of ['8000',undefined,'1.5']) {
    const selector=http.createServer();await new Promise(resolve=>selector.listen(0,'127.0.0.1',resolve));const port=selector.address().port;await new Promise(resolve=>selector.close(resolve));
    const environment={PORT:String(port),NEBIUS_API_KEY:'synthetic-not-a-credential',NEBIUS_MODEL:'nvidia/synthetic-test',NEBIUS_CAP_USD:'1',NEBIUS_INPUT_USD_PER_MILLION:'1',NEBIUS_OUTPUT_USD_PER_MILLION:'1',NEBIUS_ACCESS_CONFIRMED:'true',NEBIUS_BILLING_BOUNDS_CONFIRMED:'true',...(bound===undefined?{}:{NEBIUS_MAX_INPUT_TOKENS:bound})};
    const child=spawn(process.execPath,[join(root,'src/server.mjs')],{env:environment,stdio:['ignore','pipe','pipe']});let diagnostic='';child.stderr.on('data',chunk=>{diagnostic+=chunk;});const exited=new Promise(resolve=>child.once('exit',resolve));
    try {
      const started=await new Promise((resolve,reject)=>{
        let output='';const timer=setTimeout(()=>reject(new Error('Synthetic app startup timed out.')),10000);
        child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Commitment Desk: (http:\/\/127\.0\.0\.1:\d+)\/#session=([a-f0-9]+)/);if(match){clearTimeout(timer);resolve({url:match[1],token:match[2]});}});
        child.once('error',error=>{clearTimeout(timer);reject(error);});child.once('exit',()=>{clearTimeout(timer);reject(new Error(`Synthetic app exited before startup: ${diagnostic.slice(-500)}`));});
      });
      const response=await fetch(`${started.url}/api/state`,{headers:{'X-Session-Token':started.token}});assert.equal(response.status,200);const state=await response.json();
      assert.equal(state.provider.enabled,bound==='8000');assert.equal(state.provider.spentUsd,0);assert.equal(state.provider.reservedUsd,0);
    } finally {if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');await exited;}
  }
});
