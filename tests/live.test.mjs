import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {prepareLive,executeLive,applyLive,summarizeLive} from '../evaluation/live.mjs';
import {Store} from '../src/domain.mjs';

const rootUrl=new URL('..',import.meta.url);
const frozen=JSON.parse(readFileSync(new URL('../fixtures/scenarios.json',import.meta.url),'utf8')).packs;
const env={NEBIUS_API_KEY:'synthetic-not-an-account-key',NEBIUS_MODEL:'nvidia/synthetic-test',NEBIUS_CAP_USD:'2',NEBIUS_INPUT_USD_PER_MILLION:'1',NEBIUS_OUTPUT_USD_PER_MILLION:'1',NEBIUS_MAX_INPUT_TOKENS:'8000',NEBIUS_ACCESS_CONFIRMED:'true',NEBIUS_BILLING_BOUNDS_CONFIRMED:'true'};
function workspace(t) {
  const root=mkdtempSync(join(tmpdir(),'commitment-live-')); t.after(()=>rmSync(root,{recursive:true,force:true}));
  for (const relative of ['fixtures/scenarios.json','src/domain.mjs','src/provider.mjs','evaluation/live.mjs']) {
    mkdirSync(join(root,relative,'..'),{recursive:true}); copyFileSync(new URL(relative,rootUrl),join(root,relative));
  }
  return root;
}
async function server(t,handler) {
  let calls=0; const bodies=[];
  const http=createServer((req,res)=>{const chunks=[];req.on('data',chunk=>chunks.push(chunk));req.on('end',()=>{
    calls++; const body=Buffer.concat(chunks).toString(); bodies.push(body); const request=JSON.parse(body);
    const selected=JSON.parse(request.messages[1].content); const id=selected.sources[0].id.replace(/-S\d+$/,'');
    const item=Object.values(frozen).flat().find(item=>item.id===id);
    if(handler) return handler(req,res,item,calls);
    res.end(JSON.stringify({id:`synthetic-${calls}`,model:request.model,usage:{prompt_tokens:30,completion_tokens:40},choices:[{finish_reason:'stop',message:{content:JSON.stringify(item.expected)}}]}));
  });});
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{http.closeAllConnections();await new Promise(resolve=>http.close(resolve));});
  const transport=request=>{assert.equal(request.url,'https://api.tokenfactory.nebius.com/v1/chat/completions');return fetch(`http://127.0.0.1:${http.address().port}`,{method:'POST',body:request.body,headers:request.headers,signal:request.signal,redirect:'error'});};
  return {transport,bodies,get calls(){return calls;}};
}

test('L01 prepares exactly CR20/IN10/NW5/CO20, 55 unique envelopes, zero writes/calls',t=>{
  const root=workspace(t); const plan=prepareLive({root,config:env});
  assert.deepEqual(plan.packs,['CR','IN','NW','CO']); assert.equal(plan.cases.length,55); assert.equal(new Set(plan.cases.map(item=>item.id)).size,55);
  for(const [pack,count] of [['CR',20],['IN',10],['NW',5],['CO',20]]) assert.equal(plan.cases.filter(item=>item.pack===pack).length,count);
  for(const item of plan.cases) {
    const selected=JSON.parse(JSON.parse(item.envelope.body).messages[1].content); const fixture=frozen[item.pack].find(candidate=>candidate.id===item.id);
    assert.deepEqual(selected.sources,fixture.sources); assert.equal(selected.query,fixture.query); assert.deepEqual(selected.memories,[]); assert.deepEqual(Object.keys(selected).sort(),['memories','query','sources']);
  }
  assert.equal(JSON.stringify(plan).includes(env.NEBIUS_API_KEY),false); assert.throws(()=>prepareLive({root,config:env,packs:['UNKNOWN']}));
  assert.equal(prepareLive({root,config:{}}).executable,false);
});

test('L02 wrong approval, altered body/model/config/code/fixtures and missing gates produce zero calls',async t=>{
  const root=workspace(t); let calls=0; const transport=()=>{calls++;throw new Error('Unexpected inference');};
  const plan=prepareLive({root,config:env,packs:['NW']});
  await assert.rejects(executeLive({root,config:env,plan,approvalHash:'wrong',transport}));
  const changed=structuredClone(plan); changed.cases[0].envelope.body+=' ';
  await assert.rejects(executeLive({root,config:env,plan:changed,approvalHash:plan.hash,transport}));
  for(const config of [{...env,NEBIUS_MODEL:'nvidia/other'},{...env,NEBIUS_CAP_USD:'3'},{...env,NEBIUS_API_KEY:'different-synthetic-key'}]) await assert.rejects(executeLive({root,config,plan,approvalHash:plan.hash,transport}));
  for(const patch of [{NEBIUS_API_KEY:''},{NEBIUS_ACCESS_CONFIRMED:'false'},{NEBIUS_BILLING_BOUNDS_CONFIRMED:'false'},{NEBIUS_CAP_USD:'0'}]) {
    const config={...env,...patch}; const disabled=prepareLive({root,config,packs:['NW']}); await assert.rejects(executeLive({root,config,plan:disabled,approvalHash:disabled.hash,transport}));
  }
  writeFileSync(join(root,'src/provider.mjs'),readFileSync(join(root,'src/provider.mjs'),'utf8')+'\n// changed executable');
  await assert.rejects(executeLive({root,config:env,plan,approvalHash:plan.hash,transport}));
  copyFileSync(new URL('../src/provider.mjs',import.meta.url),join(root,'src/provider.mjs'));
  const fixtures=JSON.parse(readFileSync(join(root,'fixtures/scenarios.json'))); fixtures.packs.NW[0].query+=' changed'; writeFileSync(join(root,'fixtures/scenarios.json'),JSON.stringify(fixtures));
  await assert.rejects(executeLive({root,config:env,plan,approvalHash:plan.hash,transport})); assert.equal(calls,0);
});

test('explicit input bound enters canonical hash/reservations; changed or invalid bound permits zero calls',async t=>{
  const root=workspace(t);let calls=0;const transport=()=>{calls++;throw new Error('Unexpected call');};
  const plan=prepareLive({root,config:env,packs:['NW']});assert.equal(plan.config.maxInputTokens,8000);
  plan.cases.forEach(item=>assert.equal(item.reservationUsd,(8000+8192)/1000000));
  const changed={...env,NEBIUS_MAX_INPUT_TOKENS:'9000'};const replacement=prepareLive({root,config:changed,packs:['NW']});assert.notEqual(replacement.hash,plan.hash);
  await assert.rejects(executeLive({root,config:changed,plan,approvalHash:plan.hash,transport}));
  for(const bound of [undefined,'','0','-1','1.5','NaN','Infinity','9007199254740992']) {
    const config={...env,NEBIUS_MAX_INPUT_TOKENS:bound};const disabled=prepareLive({root,config,packs:['NW']});assert.equal(disabled.executable,false);
    await assert.rejects(executeLive({root,config,plan:disabled,approvalHash:disabled.hash,transport}));assert.equal(disabled.cases.every(item=>item.reservationUsd===null),true);
  }
  assert.equal(calls,0);
});

test('F02 shared8192 bound yields exact NW5 reservations and rejects hash-consistent old2048 approval without calls',async t=>{
  const root=workspace(t);const config={...env,NEBIUS_MAX_INPUT_TOKENS:'300000',NEBIUS_INPUT_USD_PER_MILLION:'0.06',NEBIUS_OUTPUT_USD_PER_MILLION:'0.24',NEBIUS_CAP_USD:'0.75'};
  const plan=prepareLive({root,config,packs:['NW']});assert.equal(plan.cases.length,5);
  for(const item of plan.cases){assert.equal(JSON.parse(item.envelope.body).max_completion_tokens,8192);assert.equal(item.reservationUsd,0.01996608);}
  assert.ok(Math.abs(plan.cases.reduce((sum,item)=>sum+item.reservationUsd,0)-0.0998304)<1e-12);
  const legacy=structuredClone(plan);delete legacy.hash;
  for(const item of legacy.cases){const request=JSON.parse(item.envelope.body);request.max_completion_tokens=2048;item.envelope.body=JSON.stringify(request);item.envelope.hash=createHash('sha256').update(item.envelope.body).digest('hex');item.reservationUsd=(300000*0.06+2048*0.24)/1000000;}
  legacy.hash=createHash('sha256').update(JSON.stringify(legacy)).digest('hex');assert.notEqual(legacy.hash,plan.hash);let calls=0;
  await assert.rejects(executeLive({root,config,plan:legacy,approvalHash:legacy.hash,transport:()=>{calls++;throw new Error('Unexpected call');}}),/Approved plan\/config\/fixture\/executable changed/);assert.equal(calls,0);
});

test('L03/L04 actual loopback transport sends five exact bodies, durable markers, synthetic metadata, zero committed writes',async t=>{
  const root=workspace(t); const http=await server(t); const plan=prepareLive({root,config:env,packs:['NW']});
  const transport=request=>{
    const journal=JSON.parse(readFileSync(join(root,'work/live',plan.hash,'journal.json'))); assert.equal(journal.cases[http.calls].status,'started');
    return http.transport(request);
  };
  const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport});
  assert.equal(evidence.kind,'synthetic'); assert.equal(evidence.cases.length,5); assert.equal(http.calls,5); assert.deepEqual(http.bodies,plan.cases.map(item=>item.envelope.body));
  for(const item of evidence.cases) {
    assert.equal(item.status,'validated'); assert.equal(item.metadata.model,env.NEBIUS_MODEL); assert.equal(item.metadata.inputTokens,30); assert.equal(item.metadata.outputTokens,40); assert.equal(item.metadata.estimatedUsd,0.00007); assert.ok(item.metadata.requestId); assert.equal(item.validation,'valid');
    const store=new Store(join(root,'work/live',plan.hash,`${item.id}.sqlite`)); assert.equal(store.state().tasks.length,0); assert.equal(store.state().memories.length,0); store.close();
  }
  assert.equal(JSON.stringify(evidence).includes(env.NEBIUS_API_KEY),false); assert.equal(JSON.stringify(evidence).includes('Bearer '),false);
});

test('L03 three process restarts do not duplicate completed plan requests',async t=>{
  const root=workspace(t); const http=await server(t); const plan=prepareLive({root,config:env,packs:['NW']}); const first=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});
  for(let i=0;i<3;i++) {
    const code=`import {executeLive} from ${JSON.stringify(new URL('../evaluation/live.mjs',import.meta.url).href)};const args=JSON.parse(process.argv[1]);args.transport=()=>{throw new Error('Duplicate transport');};const result=await executeLive(args);process.stdout.write(result.evidenceHash);`;
    const child=spawnSync(process.execPath,['--input-type=module','-e',code,JSON.stringify({root,config:env,plan,approvalHash:plan.hash})],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr); assert.equal(child.stdout,first.evidenceHash);
  }
  assert.equal(http.calls,5);
});

test('L03 started/unknown journal and corrupted journal cannot automatically restart inference',async t=>{
  const root=workspace(t); const plan=prepareLive({root,config:env,packs:['NW']}); let calls=0;
  const journalPath=join(root,'work/live',plan.hash,'journal.json');
  writeFileSync(journalPath,JSON.stringify({schemaVersion:1,planHash:plan.hash,kind:'synthetic',status:'running',cases:plan.cases.map((item,index)=>({id:item.id,pack:item.pack,status:index===0?'started':'not_run'}))}));
  for(let i=0;i<3;i++) await assert.rejects(executeLive({root,config:env,plan,approvalHash:plan.hash,transport:()=>{calls++;}}));
  writeFileSync(journalPath,'{broken'); await assert.rejects(executeLive({root,config:env,plan,approvalHash:plan.hash,transport:()=>{calls++;}})); assert.equal(calls,0);
});

test('D03 failed terminal evidence stays separate, halts four NW calls, redacts raw fields and replays without inference',async t=>{
  const root=workspace(t);const raw='PRIVATE-FAILED-CONTENT';const reasoning='PRIVATE-FAILED-REASONING';
  const http=await server(t,(_req,res)=>res.end(JSON.stringify({id:'synthetic-failed-request',model:env.NEBIUS_MODEL,usage:{prompt_tokens:30,completion_tokens:8192},choices:[{finish_reason:'length',message:{content:raw,tool_calls:[],reasoning_content:reasoning,key:env.NEBIUS_API_KEY}}]})));
  const plan=prepareLive({root,config:env,packs:['NW']});const args={root,config:env,plan,approvalHash:plan.hash,transport:http.transport};const evidence=await executeLive(args);
  assert.equal(http.calls,1);assert.equal(evidence.status,'halted');assert.deepEqual(evidence.cases.map(row=>row.status),['failed','not_run','not_run','not_run','not_run']);
  const row=evidence.cases[0];assert.equal(row.result,null);assert.equal(row.metadata,null);assert.equal(row.failureDiagnostics.finishReason,'length');assert.equal(row.failureDiagnostics.outputTokens,8192);assert.equal(row.failureDiagnostics.contentLength,raw.length);assert.equal(row.ledgerAfter.spentUsd,plan.cases[0].reservationUsd);
  for(const item of evidence.cases.slice(1))assert.equal(item.failureDiagnostics,null);
  for(const filename of ['journal.json','evidence.json']) {
    const artifact=readFileSync(join(root,'work/live',plan.hash,filename),'utf8');for(const excluded of [raw,reasoning,env.NEBIUS_API_KEY])assert.equal(artifact.includes(excluded),false);
  }
  assert.deepEqual(await executeLive(args),evidence);assert.equal(http.calls,1);
});

test('E03 shape failure remains enum-only, halts four cases and replays zero calls',async t=>{
  const root=workspace(t);const privateValue='PRIVATE-SHAPE-VALUE';
  const http=await server(t,(_req,res)=>res.end(JSON.stringify({id:'synthetic-shape-request',model:env.NEBIUS_MODEL,usage:{prompt_tokens:30,completion_tokens:40},shapeFailure:privateValue,choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:privateValue,memories:[],actions:[]})}}]})));
  const plan=prepareLive({root,config:env,packs:['NW']});const args={root,config:env,plan,approvalHash:plan.hash,transport:http.transport};const evidence=await executeLive(args);
  assert.equal(evidence.cases[0].failureDiagnostics.shapeFailure,'answer_fields');assert.equal(evidence.cases[0].metadata,null);assert.equal(evidence.cases[0].result,null);
  assert.deepEqual(evidence.cases.map(x=>x.status),['failed','not_run','not_run','not_run','not_run']);assert.equal(JSON.stringify(evidence).includes(privateValue),false);
  assert.deepEqual(await executeLive(args),evidence);assert.equal(http.calls,1);
});

test('L04 first failed real HTTP call halts, retains all denominator rows and never retries',async t=>{
  const root=workspace(t); const http=await server(t,(_req,res)=>{res.writeHead(500);res.end('{}');}); const plan=prepareLive({root,config:env,packs:['NW']});
  const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});
  assert.equal(http.calls,1); assert.equal(evidence.status,'halted');assert.equal(evidence.cases.length,5);
  assert.equal(evidence.cases[0].status,'failed');assert.equal(evidence.cases[0].result,null);assert.equal(evidence.cases[0].metadata,null);assert.ok(evidence.cases[0].ledgerAfter.spentUsd>=evidence.cases[0].ledgerBefore.spentUsd);
  assert.equal(evidence.cases.filter(item=>item.status==='not_run').length,4);
  await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport}); assert.equal(http.calls,1);
  assert.throws(()=>applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash}));
});

test('L05 NW five approved cases replayed ten times return five identical receipts, zero new inference',async t=>{
  const root=workspace(t); const http=await server(t); const plan=prepareLive({root,config:env,packs:['NW']}); const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});
  assert.throws(()=>applyLive({root,planHash:plan.hash,evidenceHash:'wrong'}));
  const first=applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash}); assert.equal(first.receipts.length,5);
  for(let i=0;i<10;i++) assert.deepEqual(applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash}),first);
  for(const receipt of first.receipts) {const store=new Store(join(root,'work/live',plan.hash,`${receipt.caseId}.sqlite`)); assert.equal(store.state().tasks.length,1); assert.equal(store.state().memories.length,1); store.close();}
  assert.equal(http.calls,5);
});

test('L05 expired validation proposals renew locally; interrupted approval recovers persisted receipt without inference',async t=>{
  const root=workspace(t); const http=await server(t); const plan=prepareLive({root,config:env,packs:['NW']}); const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});
  const now=Date.now; Date.now=()=>now()+600001; let applied;
  try { applied=applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash}); } finally {Date.now=now;}
  const path=join(root,'work/live',plan.hash,'apply.json'); const saved=JSON.parse(readFileSync(path)); saved.receipts=[]; writeFileSync(path,JSON.stringify(saved));
  const recovered=applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash}); assert.deepEqual(recovered,applied); assert.equal(http.calls,5);
});

function interruptedApply(root,plan,evidence,afterCommit) {
  const code=`import {Store} from ${JSON.stringify(new URL('../src/domain.mjs',import.meta.url).href)};import {applyLive} from ${JSON.stringify(new URL('../evaluation/live.mjs',import.meta.url).href)};const original=Store.prototype.applyProposal;Store.prototype.applyProposal=function(id){${afterCommit?'original.call(this,id);':''}process.exit(73);};applyLive(JSON.parse(process.argv[1]));`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code,JSON.stringify({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash})],{encoding:'utf8'});
  assert.equal(child.status,73,child.stderr);
}

test('review TTL: process exits after authority persistence; >10-minute retry renews locally with zero calls',async t=>{
  const root=workspace(t);const http=await server(t);const plan=prepareLive({root,config:env,packs:['NW']});const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});
  interruptedApply(root,plan,evidence,false);
  const path=join(root,'work/live',plan.hash,'apply.json');const previous=JSON.parse(readFileSync(path));assert.equal(previous.proposals.length,1);assert.equal(previous.receipts.length,0);
  const now=Date.now;Date.now=()=>now()+600001;let applied;
  try {applied=applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash});}finally {Date.now=now;}
  assert.equal(applied.receipts.length,5);assert.notEqual(applied.receipts[0].proposalId,previous.proposals[0].proposalId);assert.equal(http.calls,5);
  for(const receipt of applied.receipts) {const store=new Store(join(root,'work/live',plan.hash,`${receipt.caseId}.sqlite`));assert.equal(store.state().tasks.length,1);assert.equal(store.state().memories.length,1);store.close();}
});

test('review crash: child exits after commit, kernel releases apply guard and exact receipt recovers',async t=>{
  const root=workspace(t);const http=await server(t);const plan=prepareLive({root,config:env,packs:['NW']});const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});
  interruptedApply(root,plan,evidence,true);
  const directory=join(root,'work/live',plan.hash);const saved=JSON.parse(readFileSync(join(directory,'apply.json')));assert.equal(saved.proposals.length,1);assert.equal(saved.receipts.length,0);
  const readonlyReport=summarizeLive({root,planHash:plan.hash});assert.equal(readonlyReport.targets.T05.approved,1);
  const now=Date.now;Date.now=()=>now()+600001;let applied;
  try {applied=applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash});}finally {Date.now=now;}
  assert.equal(applied.receipts.length,5);assert.equal(applied.receipts[0].proposalId,saved.proposals[0].proposalId);
  for(let i=0;i<10;i++)assert.deepEqual(applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash}),applied);
  assert.equal(http.calls,5);for(const receipt of applied.receipts){const store=new Store(join(directory,`${receipt.caseId}.sqlite`));assert.equal(store.state().tasks.length,1);store.close();}
});

test('review receipts: fabricated unissued empty-ID receipts cannot approve workflows or mutate SQLite',async t=>{
  const root=workspace(t);const http=await server(t);const plan=prepareLive({root,config:env,packs:['NW']});const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});const directory=join(root,'work/live',plan.hash);
  const proposals=evidence.cases.map(row=>({caseId:row.id,proposalId:`unissued-${row.id}`}));
  writeFileSync(join(directory,'apply.json'),JSON.stringify({schemaVersion:1,planHash:plan.hash,evidenceHash:evidence.evidenceHash,proposals,receipts:proposals.map(row=>({...row,memoryIds:[],taskIds:[],outcome:'applied'}))}));
  const snapshots=evidence.cases.map(row=>readFileSync(join(directory,`${row.id}.sqlite`)));
  assert.throws(()=>summarizeLive({root,planHash:plan.hash}));assert.throws(()=>applyLive({root,planHash:plan.hash,evidenceHash:evidence.evidenceHash}));
  evidence.cases.forEach((row,index)=>assert.deepEqual(readFileSync(join(directory,`${row.id}.sqlite`)),snapshots[index]));assert.equal(http.calls,5);
});

test('review evidence: rehashed kind/response changes reject against durable synthetic execution journal',async t=>{
  const root=workspace(t);const http=await server(t);const plan=prepareLive({root,config:env,packs:['NW']});const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport});const path=join(root,'work/live',plan.hash,'evidence.json');
  for(const mutate of [value=>value.kind='genuine',value=>value.cases[0].result.answer.text='Tampered outcome']) {
    const changed=structuredClone(evidence);mutate(changed);delete changed.evidenceHash;changed.evidenceHash=createHash('sha256').update(JSON.stringify(changed)).digest('hex');writeFileSync(path,JSON.stringify(changed));
    assert.throws(()=>summarizeLive({root,planHash:plan.hash}));assert.throws(()=>applyLive({root,planHash:plan.hash,evidenceHash:changed.evidenceHash}));
  }
  assert.equal(http.calls,5);
});

test('L06 55 synthetic results never pass real targets; reviewer decisions remain explicit/hash-bound',async t=>{
  const root=workspace(t); const http=await server(t); const plan=prepareLive({root,config:env}); const evidence=await executeLive({root,config:env,plan,approvalHash:plan.hash,transport:http.transport}); const report=summarizeLive({root,planHash:plan.hash});
  assert.equal(http.calls,55); assert.equal(report.targets.T01.status,'pending_review'); assert.equal(report.targets.T01.passed,null); assert.equal(report.targets.T05.status,'synthetic_only'); assert.equal(report.targets.T06.actualBilledUsd,null); assert.equal(report.targets.T06.completed,20);
  assert.ok(report.limitations.some(item=>item.includes('NW-03'))); assert.ok(report.limitations.some(item=>item.includes('CO')));
  const decisions=evidence.cases.filter(item=>item.pack==='CR').map(item=>({caseId:item.id,factualCorrect:true,supported:true,reason:'Synthetic test reviewer decision.'}));
  const adjudication={evidenceHash:evidence.evidenceHash,reviewer:{kind:'agent',identity:'controlled-test-reviewer'},decisions};
  const reviewed=summarizeLive({root,planHash:plan.hash,adjudication}); assert.equal(reviewed.targets.T01.passed,20); assert.equal(reviewed.targets.T01.status,'synthetic_only'); assert.equal(reviewed.reviewer.kind,'agent');
  assert.throws(()=>summarizeLive({root,planHash:plan.hash,adjudication:{...adjudication,evidenceHash:'wrong'}}));
  assert.throws(()=>summarizeLive({root,planHash:plan.hash,adjudication:{...adjudication,decisions:decisions.map(item=>({...item,reason:''}))}}));
});

test('strict CLI unknown/transport flags reject without inference',()=>{
  const cli=new URL('../evaluation/live.mjs',import.meta.url);
  for(const args of [['prepare','--unknown','x'],['execute','--transport','http://127.0.0.1'],['prepare','--packs','NOT-A-PACK']]) {const child=spawnSync(process.execPath,[cli.pathname,...args],{encoding:'utf8'});assert.notEqual(child.status,0);}
});
