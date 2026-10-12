import {createHash, randomUUID} from 'node:crypto';
import {existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync, fsyncSync} from 'node:fs';
import {dirname} from 'node:path';

const ENDPOINT = 'https://api.tokenfactory.nebius.com/v1/chat/completions';
const MODELS = 'https://api.tokenfactory.nebius.com/v1/models';
const BODY_MAX = 64000;
const RESPONSE_MAX = 1024 * 1024;
export const OUTPUT_MAX = 8192;
const FINISH_REASONS = ['stop','length','tool_calls','content_filter','function_call'];
const gateErrors = new WeakSet();
const digest = body => createHash('sha256').update(body).digest('hex');
function fail(message, status=503) { const error=Object.assign(new Error(message),{status});gateErrors.add(error);throw error; }
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function nonnegative(value) { return typeof value === 'number' && Number.isFinite(value) && value >= 0; }
function positive(value) { return nonnegative(value) && value > 0; }
function terminalDiagnostics(body,config,started) {
  const choice=Array.isArray(body.choices)&&body.choices.length===1?body.choices[0]:null;
  const message=choice?.message && typeof choice.message==='object' && !Array.isArray(choice.message)?choice.message:null;
  const content=message?.content;const tools=message?.tool_calls;const usage=body.usage;
  const validUsage=usage && Number.isSafeInteger(usage.prompt_tokens)&&usage.prompt_tokens>=0&&Number.isSafeInteger(usage.completion_tokens)&&usage.completion_tokens>=0;
  const estimate=validUsage?(usage.prompt_tokens*config.inputUsdPerMillion+usage.completion_tokens*config.outputUsdPerMillion)/1000000:null;
  // Only model-validated terminal data enters this bounded diagnostic projection.
  return freeze({finishReason:FINISH_REASONS.includes(choice?.finish_reason)?choice.finish_reason:'unknown',toolCallCount:message?(tools==null?0:Array.isArray(tools)?tools.length:null):null,contentType:content===null?'null':Array.isArray(content)?'array':typeof content,contentLength:typeof content==='string'?content.length:null,inputTokens:validUsage?usage.prompt_tokens:null,outputTokens:validUsage?usage.completion_tokens:null,estimatedUsd:nonnegative(estimate)?estimate:null,requestId:typeof body.id==='string'&&/^[A-Za-z0-9._:-]{1,200}$/.test(body.id)&&!body.id.includes(config.apiKey)?body.id:null,latencyMs:performance.now()-started,shapeFailure:null});
}
function resultShapeFailure(result) {
  const fields=(value,allowed,required=allowed)=>value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).every(key=>allowed.includes(key)) && required.every(key=>Object.hasOwn(value,key));
  const text=value=>typeof value==='string' && value.trim().length>0 && value.length<=2000;
  const evidence=value=>Array.isArray(value) && value.length<=20 && value.every(item=>fields(item,['sourceId','quote']) && typeof item.sourceId==='string' && item.sourceId.length>0 && item.sourceId.length<=200 && typeof item.quote==='string' && item.quote.trim().length>0 && item.quote.length<=20000);
  if(!fields(result,['answer','memories','actions']))return 'root_fields';
  if(!fields(result.answer,['text','evidence']))return 'answer_fields';
  if(typeof result.answer.text!=='string'||result.answer.text.length>2000)return 'answer_text';
  if(!evidence(result.answer.evidence))return 'answer_evidence';
  if(!Array.isArray(result.memories)||result.memories.length>20)return 'memories_array';
  if(!Array.isArray(result.actions)||result.actions.length>20)return 'actions_array';
  for(const item of result.memories) {
    if(!fields(item,['key','kind','text','evidence','supersedesId'],['key','kind','text','evidence']))return 'memory_fields';
    if(typeof item.key!=='string'||item.key.length===0||item.key.length>200)return 'memory_key';
    if(!['commitment','preference','recipe'].includes(item.kind))return 'memory_kind';
    if(!text(item.text))return 'memory_text';
    if(!evidence(item.evidence)||item.evidence.length===0)return 'memory_evidence';
    if(Object.hasOwn(item,'supersedesId')&&!(typeof item.supersedesId==='string'&&item.supersedesId.length>0&&item.supersedesId.length<=200))return 'memory_supersedes_id';
  }
  for(const item of result.actions) {
    if(!fields(item,['text','memoryKey','memoryId','evidence'],['text','evidence']))return 'action_fields';
    if(!text(item.text))return 'action_text';
    if(!evidence(item.evidence)||item.evidence.length===0)return 'action_evidence';
    const reference=item.memoryKey??item.memoryId;
    if(Object.hasOwn(item,'memoryKey')===Object.hasOwn(item,'memoryId')||typeof reference!=='string'||reference.length===0||reference.length>200)return 'action_reference';
  }
  return null;
}

async function readBounded(response) {
  if (!response || typeof response.status !== 'number' || !response.headers || !response.body || typeof response.body.getReader !== 'function') fail('Invalid provider response.');
  const length=response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length)>RESPONSE_MAX)) { await response.body.cancel(); fail('Provider response exceeds body bound.'); }
  const reader=response.body.getReader(); const parts=[]; let bytes=0;
  try {
    while (true) {
      const {done,value}=await reader.read(); if (done) break;
      bytes+=value.byteLength; if (bytes>RESPONSE_MAX) { await reader.cancel(); fail('Provider response exceeds body bound.'); }
      parts.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { fail('Provider response is not valid JSON.'); }
}

export class ProviderGate {
  #config;
  #transport;
  #seenLedger = false;
  #failure = null;
  constructor(config = {}) {
    this.#config = {...config};
    if (config.transport !== undefined && typeof config.transport !== 'function') fail('Invalid test transport.');
    this.#transport = config.transport || (request => fetch(request.url,{method:request.method || 'POST',body:request.body,headers:request.headers,signal:request.signal,redirect:'error'}));
    if (typeof config.ledgerPath === 'string') this.#seenLedger=existsSync(config.ledgerPath) || existsSync(`${config.ledgerPath}.initialized`);
  }
  #reason() {
    const c=this.#config;
    if (typeof c.apiKey !== 'string' || !c.apiKey.trim() || /[\r\n]/.test(c.apiKey)) return 'Provider key missing or invalid.';
    if (typeof c.model !== 'string' || !/^nvidia\/[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$/.test(c.model)) return 'Exact NVIDIA model required.';
    if (c.accessConfirmed !== true) return 'Provider access, model and license confirmation required.';
    if (c.billingBoundsConfirmed !== true) return 'Complete provider billing bounds confirmation required.';
    if (!positive(c.capUsd) || !positive(c.inputUsdPerMillion) || !positive(c.outputUsdPerMillion)) return 'Positive human cap and verified prices required.';
    if (!Number.isSafeInteger(c.maxInputTokens) || c.maxInputTokens <= 0) return 'Verified positive safe-integer input token bound required.';
    if (typeof c.ledgerPath !== 'string' || !c.ledgerPath.trim()) return 'Persistent budget ledger required.';
    return null;
  }
  #read() {
    const path=this.#config.ledgerPath;
    if (!existsSync(path)) {
      if (this.#seenLedger || existsSync(`${path}.initialized`)) fail('Existing budget ledger is missing.');
      return {version:1,spentUsd:0,reservations:[],frozen:false};
    }
    this.#seenLedger=true;
    let ledger;
    try { ledger=JSON.parse(readFileSync(path,'utf8')); }
    catch { fail('Budget ledger unreadable or corrupt.'); }
    if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger) || Object.keys(ledger).sort().join(',') !== 'frozen,reservations,spentUsd,version' || ledger.version!==1 || !nonnegative(ledger.spentUsd) || typeof ledger.frozen !== 'boolean' || !Array.isArray(ledger.reservations)) fail('Budget ledger schema is invalid.');
    const ids=new Set();
    for (const item of ledger.reservations) {
      if (!item || Object.keys(item).sort().join(',') !== 'id,usd' || typeof item.id !== 'string' || !item.id || ids.has(item.id) || !positive(item.usd)) fail('Budget ledger reservation is invalid.');
      ids.add(item.id);
    }
    if (!Number.isFinite(ledger.spentUsd+ledger.reservations.reduce((sum,item)=>sum+item.usd,0))) fail('Budget ledger accounting is invalid.');
    return ledger;
  }
  #write(ledger) {
    const path=this.#config.ledgerPath; const temporary=`${path}.${randomUUID()}.tmp`;
    let fd;
    try {
      // Mark initialization first: interrupted creation must not become fresh zero-spend state.
      if (!existsSync(`${path}.initialized`)) {
        fd=openSync(`${path}.initialized`,'wx',0o600); writeFileSync(fd,'1'); fsyncSync(fd); closeSync(fd); fd=undefined;
      }
      this.#seenLedger=true;
      fd=openSync(temporary,'wx',0o600); writeFileSync(fd,JSON.stringify(ledger)); fsyncSync(fd); closeSync(fd); fd=undefined;
      renameSync(temporary,path);
      fd=openSync(dirname(path),'r'); fsyncSync(fd); closeSync(fd); fd=undefined;
    } finally {
      if (fd !== undefined) closeSync(fd);
      if (existsSync(temporary)) unlinkSync(temporary);
    }
  }
  #locked(operation) {
    const path=this.#config.ledgerPath;
    mkdirSync(dirname(path),{recursive:true,mode:0o700});
    let fd;
    try { fd=openSync(`${path}.lock`,'wx',0o600); }
    catch { fail('Budget ledger is locked or unavailable.'); }
    try { return operation(); }
    finally { closeSync(fd); unlinkSync(`${path}.lock`); }
  }
  status() {
    const c=this.#config; let reason=this.#failure || this.#reason(); let ledger={spentUsd:0,reservations:[],frozen:false};
    if (typeof c.ledgerPath === 'string' && c.ledgerPath.trim()) {
      try { ledger=this.#read(); }
      catch (error) { reason=error.message; this.#failure=reason; }
    }
    const reservedUsd=ledger.reservations.reduce((sum,item)=>sum+item.usd,0);
    if (ledger.frozen) reason='Unverified accounting: budget ledger frozen.';
    if (!reason && ledger.spentUsd+reservedUsd>=c.capUsd) reason='Human budget cap exhausted.';
    return {enabled:!reason,reason,model:typeof c.model==='string'?c.model:null,capUsd:positive(c.capUsd)?c.capUsd:null,spentUsd:ledger.spentUsd,reservedUsd};
  }
  prepare(preview) {
    if (!preview || !preview.payload || typeof preview.payload.instructions !== 'string' || typeof preview.payload.query !== 'string' || !Array.isArray(preview.payload.sources) || !Array.isArray(preview.payload.memories)) fail('Invalid preview.',400);
    const body=JSON.stringify({model:this.#config.model ?? null,messages:[{role:'system',content:preview.payload.instructions},{role:'user',content:JSON.stringify({query:preview.payload.query,sources:preview.payload.sources,memories:preview.payload.memories})}],max_completion_tokens:OUTPUT_MAX,response_format:{type:'json_object'}});
    if (Buffer.byteLength(body,'utf8')>BODY_MAX) fail('Final provider body exceeds 64000 bytes.',413);
    return freeze({endpoint:ENDPOINT,model:this.#config.model ?? null,body,hash:digest(body)});
  }
  #envelope(envelope) {
    if (!envelope || Object.keys(envelope).sort().join(',') !== 'body,endpoint,hash,model' || envelope.endpoint !== ENDPOINT || envelope.model !== this.#config.model || typeof envelope.body !== 'string' || envelope.hash !== digest(envelope.body)) fail('Provider envelope changed. Preview again.',409);
    let parsed; let selected;
    try {
      parsed=JSON.parse(envelope.body); selected=JSON.parse(parsed.messages[1].content);
    } catch { fail('Provider envelope is invalid.',400); }
    if (!selected || Object.keys(selected).sort().join(',') !== 'memories,query,sources') fail('Provider envelope is invalid.',400);
    const rebuilt=this.prepare({payload:{instructions:parsed.messages?.[0]?.content,...selected}});
    if (rebuilt.body !== envelope.body || rebuilt.hash !== envelope.hash) fail('Provider request does not match the fixed request format.',409);
  }
  #reserve() {
    return this.#locked(() => {
      const state=this.status(); if (!state.enabled) fail(state.reason);
      const ledger=this.#read();
      const usd=(this.#config.maxInputTokens*this.#config.inputUsdPerMillion+OUTPUT_MAX*this.#config.outputUsdPerMillion)/1000000;
      if (!positive(usd) || ledger.spentUsd+state.reservedUsd+usd>this.#config.capUsd) fail('Request exceeds remaining human budget cap.');
      const reservation={id:randomUUID(),usd}; ledger.reservations.push(reservation); this.#write(ledger); return reservation;
    });
  }
  #settle(reservation, usd, frozen=false) {
    this.#locked(() => {
      const ledger=this.#read(); const index=ledger.reservations.findIndex(item=>item.id===reservation.id);
      if (index<0) fail('Budget reservation disappeared. Accounting unverified.');
      ledger.reservations.splice(index,1); ledger.spentUsd+=usd; ledger.frozen ||= frozen; this.#write(ledger);
    });
  }
  async listModels() {
    const key=this.#config.apiKey;
    if (typeof key !== 'string' || !key.trim() || /[\r\n]/.test(key)) fail('Provider key missing or invalid.');
    try {
      const response=await this.#transport({url:MODELS,method:'GET',headers:{Authorization:`Bearer ${key}`,Accept:'application/json'},signal:AbortSignal.timeout(30000)});
      if (response.status<200 || response.status>=300 || response.redirected) { if (response.body) await response.body.cancel(); fail('Provider model listing failed.'); }
      const body=await readBounded(response);
      if (!Array.isArray(body.data)) fail('Provider model listing shape is invalid.');
      return body.data.filter(item=>item && typeof item.id==='string' && item.id.length>0 && item.id.length<=200).map(item=>({id:item.id}));
    } catch (error) {
      if (error.status) throw error;
      fail('Provider model listing failed or timed out.');
    }
  }
  async infer(envelope) {
    const state=this.status(); if (!state.enabled) fail(state.reason);
    this.#envelope(envelope); const reservation=this.#reserve(); let settled=false;let failureDiagnostics=null;
    const started=performance.now();
    try {
      const response=await this.#transport({url:ENDPOINT,body:envelope.body,headers:{Authorization:`Bearer ${this.#config.apiKey}`,'Content-Type':'application/json',Accept:'application/json'},signal:AbortSignal.timeout(30000)});
      if (response.status<200 || response.status>=300 || response.redirected) { if (response.body) await response.body.cancel(); fail('Provider request failed. No automatic retry.'); }
      const body=await readBounded(response);
      if (body.model!==this.#config.model) fail('Provider returned a different model.');
      failureDiagnostics=terminalDiagnostics(body,this.#config,started);
      const usage=body.usage;
      if (!usage || !Number.isSafeInteger(usage.prompt_tokens) || usage.prompt_tokens<0 || !Number.isSafeInteger(usage.completion_tokens) || usage.completion_tokens<0) fail('Provider usage proof is missing or invalid.');
      const inputTokens=usage.prompt_tokens; const outputTokens=usage.completion_tokens;
      const estimatedUsd=(inputTokens*this.#config.inputUsdPerMillion+outputTokens*this.#config.outputUsdPerMillion)/1000000;
      if (!nonnegative(estimatedUsd)) fail('Provider cost is invalid.');
      if (inputTokens>this.#config.maxInputTokens || outputTokens>OUTPUT_MAX || estimatedUsd>reservation.usd) {
        this.#settle(reservation,Math.max(estimatedUsd,reservation.usd),true); settled=true;
        fail('Unverified accounting: provider usage exceeded reservation; further inference frozen.');
      }
      const message=body.choices?.[0]?.message;const tools=message?.tool_calls;
      if (!Array.isArray(body.choices) || body.choices.length!==1 || !message || (tools!=null&&(!Array.isArray(tools)||tools.length!==0)) || message.function_call!=null || body.choices[0].finish_reason!=='stop' || typeof message.content!=='string') fail('Provider output is incomplete or contains unsupported tool calls.');
      let result;
      try { result=JSON.parse(body.choices[0].message.content); } catch { fail('Provider result is not JSON.'); }
      const shapeFailure=resultShapeFailure(result);
      if (shapeFailure) {failureDiagnostics=freeze({...failureDiagnostics,shapeFailure});fail('Provider result has an invalid constrained JSON shape.');}
      if (typeof body.id !== 'string' || !body.id || body.id.length>200) fail('Provider request ID proof is missing.');
      this.#settle(reservation,estimatedUsd); settled=true;
      return {result,metadata:{provider:'nebius',model:body.model,latencyMs:performance.now()-started,inputTokens,outputTokens,requestId:body.id,estimatedUsd}};
    } catch (error) {
      if (!settled) {
        try { this.#settle(reservation,reservation.usd); }
        catch { this.#failure='Budget settlement failed. Accounting unverified.'; fail(this.#failure); }
      }
      if (gateErrors.has(error)) {if(failureDiagnostics)error.failureDiagnostics=failureDiagnostics;throw error;}
      fail('Provider request failed or timed out. No automatic retry.');
    }
  }
}
