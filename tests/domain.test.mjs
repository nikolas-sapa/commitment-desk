import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {Store} from '../src/domain.mjs';

const packs=JSON.parse(readFileSync(new URL('../fixtures/scenarios.json',import.meta.url),'utf8')).packs;
const metadata={provider:'fixture',model:null};
const copy=value=>structuredClone(value);
function fixture(store,scenario,options={}) {
  scenario.sources.forEach(source=>store.importSource(source));
  const preview=store.preview({sourceIds:scenario.sources.map(source=>source.id),memoryIds:options.memoryIds||[],query:scenario.query});
  const proposal=store.stage(preview,options.result||scenario.expected,metadata);
  return {preview,proposal,receipt:store.applyProposal(proposal.id)};
}
function basic(store) {
  const scenario=packs.CR[0]; scenario.sources.forEach(source=>store.importSource(source));
  const preview=store.preview({sourceIds:scenario.sources.map(source=>source.id),memoryIds:[],query:scenario.query});
  return {scenario,preview,result:copy(scenario.expected)};
}
function persisted(t) {
  const dir=mkdtempSync(join(tmpdir(),'commitment-domain-')); t.after(()=>rmSync(dir,{recursive:true,force:true})); return join(dir,'store.sqlite');
}

test('ten exact applies produce one durable task; staging writes zero commitments',t=>{
  const path=persisted(t); let store=new Store(path); const {preview,result}=basic(store);
  const revision=store.state().revision; const proposal=store.stage(preview,result,metadata);
  assert.equal(store.state().memories.length,0); assert.equal(store.state().tasks.length,0); assert.equal(store.state().revision,revision);
  const receipt=store.applyProposal(proposal.id);
  for (let i=1;i<10;i++) assert.deepEqual(store.applyProposal(proposal.id),receipt);
  assert.equal(store.state().tasks.length,1); assert.equal(store.state().memories.length,1);
  store.close(); store=new Store(path); assert.deepEqual(store.applyProposal(proposal.id),receipt); assert.equal(store.state().tasks.length,1); store.close();
});

test('E01 two instruction examples parse and canonical linkage stages with zero commits',()=>{
  const store=new Store(':memory:');try {
    const {preview,scenario}=basic(store);const instructions=preview.payload.instructions;
    const linked=JSON.parse(instructions.match(/Format example:\n([^\n]+)/)?.[1]||'');
    const empty=JSON.parse(instructions.match(/Insufficient evidence example:\n([^\n]+)/)?.[1]||'');
    assert.deepEqual(empty,{answer:{text:'Insufficient evidence',evidence:[]},memories:[],actions:[]});
    const source=scenario.sources[0];for(const item of [linked.answer,...linked.memories,...linked.actions])for(const e of item.evidence){e.sourceId=source.id;e.quote=source.text;}
    store.stage(preview,linked,metadata);assert.equal(store.state().memories.length,0);assert.equal(store.state().tasks.length,0);
    assert.ok(instructions.includes('untrusted data'));assert.ok(instructions.includes('Omit unused optional fields'));assert.ok(instructions.includes('illustrative'));
  }finally{store.close();}
});

test('20 frozen commitment cases accept their exact evidence (fixture validation only)',()=>{
  for (const scenario of packs.CR) { const store=new Store(':memory:'); fixture(store,scenario); assert.equal(store.state().memories.length,scenario.expected.memories.length,scenario.id); store.close(); }
});

test('10 malicious synthetic note fixtures cause zero commitment/task writes (no genuine model claim)',()=>{
  for (const scenario of packs.IN) {
    const store=new Store(':memory:'); const {preview}=fixture(store,scenario);
    assert.equal(store.state().memories.length,0,scenario.id); assert.equal(store.state().tasks.length,0,scenario.id);
    assert.deepEqual(preview.payload.sources,scenario.sources); assert.ok(preview.payload.instructions.includes('untrusted data'));
    store.close();
  }
});

test('10 authoritative updates supersede explicit selected targets, retaining both provenance records',()=>{
  for (const scenario of packs.CF) {
    const store=new Store(':memory:'); const [oldSource,newSource]=scenario.sources;
    store.importSource(oldSource);
    const evidence=[{sourceId:oldSource.id,quote:oldSource.text}];
    const initial={answer:{text:scenario.evaluation.priorText,evidence},memories:[{key:scenario.evaluation.expectedSupersedesKey,kind:'commitment',text:scenario.evaluation.priorText,evidence}],actions:[{text:scenario.evaluation.priorText,memoryKey:scenario.evaluation.expectedSupersedesKey,evidence}]};
    let preview=store.preview({sourceIds:[oldSource.id],memoryIds:[],query:scenario.query});
    const receipt=store.applyProposal(store.stage(preview,initial,metadata).id); const previousId=receipt.memoryIds[0];
    store.importSource(newSource); const result=copy(scenario.expected); result.memories[0].supersedesId=previousId;
    preview=store.preview({sourceIds:scenario.sources.map(item=>item.id),memoryIds:[previousId],query:scenario.query});
    store.applyProposal(store.stage(preview,result,metadata).id);
    const state=store.state(); assert.equal(state.memories.length,2,scenario.id); assert.equal(state.memories.filter(item=>item.status==='active').length,1);
    assert.equal(state.memories.find(item=>item.id===previousId).status,'superseded'); assert.equal(state.tasks.length,1); assert.equal(state.sources.length,2);
    assert.deepEqual(state.memories[0].evidence,evidence); assert.equal(state.memories[1].supersedesId,previousId); store.close();
  }
});

test('preference and open task survive three actual child-process restarts',t=>{
  const path=persisted(t); const store=new Store(path); fixture(store,packs.PR[0]); fixture(store,packs.CR[0]); const expected=store.state(); store.close();
  const moduleUrl=new URL('../src/domain.mjs',import.meta.url).href;
  for (let i=0;i<3;i++) {
    const child=spawnSync(process.execPath,['--input-type=module','-e',`import {Store} from ${JSON.stringify(moduleUrl)};const store=new Store(process.argv[1]);process.stdout.write(JSON.stringify(store.state()));store.close();`,path],{encoding:'utf8'});
    assert.equal(child.status,0,child.stderr); assert.deepEqual(JSON.parse(child.stdout),expected);
  }
});

test('three deletion trials remove shared sources, dependent memories, correction ancestors and late responses across restart',t=>{
  for (const scenario of packs.DL) {
    const path=join(persisted(t),`../${scenario.id}.sqlite`); let store=new Store(path);
    const result=copy(scenario.expected); const original=result.memories[0];
    result.memories.push({...copy(original),key:`${original.key}-shared`});
    result.actions=[{text:'Synthetic next task',memoryKey:original.key,evidence:copy(original.evidence)}];
    const {receipt}=fixture(store,scenario,{result}); const corrected=store.correctMemory(receipt.memoryIds[0],'Explicitly corrected synthetic packet deadline.');
    const before=store.state();
    const late=store.preview({sourceIds:before.sources.map(item=>item.id),memoryIds:before.memories.filter(item=>item.status==='active').map(item=>item.id),query:'What next?'});
    const lateResult={answer:{text:'Selected sources remain.',evidence:copy(original.evidence)},memories:[],actions:[]};
    const pending=store.stage(late,lateResult,metadata);
    const deletion=store.deleteMemory(corrected.id);
    assert.equal(deletion.memoryIds.length,3); assert.equal(deletion.sourceIds.length,2); assert.equal(store.state().sources.length,0); assert.equal(store.state().memories.length,0); assert.equal(store.state().tasks.length,0);
    assert.throws(()=>store.stage(late,lateResult,metadata)); assert.throws(()=>store.applyProposal(pending.id));
    assert.ok(!JSON.stringify(store.state().audit).includes(original.evidence[0].quote));
    store.close(); store=new Store(path); assert.equal(store.state().memories.length,0); assert.equal(store.state().sources.length,0); assert.throws(()=>store.preview({sourceIds:[scenario.sources[0].id],memoryIds:[],query:'Extract deleted text'}));
    assert.equal(store.state().tasks.length,0); store.close();
  }
});

for (const [name,change] of [
  ['incorrect quote',r=>r.memories[0].evidence[0].quote='Never appeared'],
  ['hidden source',r=>r.answer.evidence[0].sourceId='hidden'],
  ['missing evidence',r=>r.answer.evidence=[]],
  ['extra tool field',r=>r.tools=['email']],
  ['forged action memory ID',r=>{delete r.actions[0].memoryKey;r.actions[0].memoryId='forged';}],
  ['both action references',r=>r.actions[0].memoryId='forged'],
  ['neither action reference',r=>delete r.actions[0].memoryKey],
  ['duplicate candidate keys',r=>r.memories.push(copy(r.memories[0]))],
  ['duplicate actions',r=>r.actions.push(copy(r.actions[0]))],
  ['forged supersession target',r=>r.memories[0].supersedesId='forged'],
  ['invalid kind',r=>r.memories[0].kind='tool'],
  ['oversized result text',r=>r.answer.text='a'.repeat(2001)]
]) test(`${name} causes zero domain writes`,()=>{
  const store=new Store(':memory:'); const {preview,result}=basic(store); const before=store.state(); change(result);
  assert.throws(()=>store.stage(preview,result,metadata)); assert.deepEqual(store.state(),before); store.close();
});

test('stale preview and staged proposal cause zero writes after a mutation',()=>{
  const store=new Store(':memory:'); const {preview,result}=basic(store); const proposal=store.stage(preview,result,metadata);
  store.importSource({title:'New selected state',text:'New evidence.'}); const before=store.state();
  assert.throws(()=>store.stage(preview,result,metadata)); assert.throws(()=>store.applyProposal(proposal.id)); assert.deepEqual(store.state(),before); store.close();
});

test('memory dependencies and references must be explicitly selected; mismatched supersession rejects',()=>{
  const store=new Store(':memory:'); const scenario=packs.CR[0]; const {receipt}=fixture(store,scenario); const memoryId=receipt.memoryIds[0];
  const unrelated=store.importSource({title:'Unrelated',text:'Another source.'});
  assert.throws(()=>store.preview({sourceIds:[unrelated.id],memoryIds:[memoryId],query:'Hidden evidence?'}));
  const preview=store.preview({sourceIds:[scenario.sources[0].id],memoryIds:[],query:'Hidden memory?'}); const result=copy(scenario.expected);
  result.memories[0].supersedesId=memoryId; assert.throws(()=>store.stage(preview,result,metadata));
  const selected=store.preview({sourceIds:[scenario.sources[0].id],memoryIds:[memoryId],query:'Update?'}); result.memories[0].key='different-key'; result.actions=[];
  assert.throws(()=>store.stage(selected,result,metadata)); result.memories[0].key=scenario.expected.memories[0].key; result.memories[0].kind='recipe'; assert.throws(()=>store.stage(selected,result,metadata)); store.close();
});

test('explicit insufficient evidence is accepted with zero memories/tasks; otherwise rejected',()=>{
  const store=new Store(':memory:'); const {preview}=basic(store);
  const result={answer:{text:'Insufficient evidence to determine a commitment.',evidence:[]},memories:[],actions:[]};
  store.applyProposal(store.stage(preview,result,metadata).id); assert.equal(store.state().memories.length,0); assert.equal(store.state().tasks.length,0); store.close();
});

test('20 issued previews stay valid when a 21st request rejects 429 without mutation',()=>{
  const store=new Store(':memory:'); const {scenario,preview,result}=basic(store); assert.throws(()=>preview.payload.sources[0].text='changed',TypeError);
  const previews=[preview];
  for(let i=0;i<19;i++) previews.push(store.preview({sourceIds:[scenario.sources[0].id],memoryIds:[],query:'Another preview'}));
  const before=store.state();
  assert.throws(()=>store.preview({sourceIds:[scenario.sources[0].id],memoryIds:[],query:'Overflow preview'}),error=>error.status===429);
  previews.forEach(item=>assert.equal(store.validatePreview(item),true));
  assert.deepEqual(store.state(),before); assert.equal(store.stage(preview,result,metadata).revision,preview.revision); store.close();
});

test('validatePreview rejects unknown, modified, expired and stale previews without mutation',()=>{
  const store=new Store(':memory:'); const {preview}=basic(store); const before=store.state();
  assert.equal(store.validatePreview(preview),true); assert.deepEqual(store.state(),before);
  assert.throws(()=>store.validatePreview({...preview,id:'unknown'}));
  const modified=copy(preview); modified.payload.query='Changed query'; assert.throws(()=>store.validatePreview(modified));
  const original=Date.now; Date.now=()=>original()+600001;
  try { assert.throws(()=>store.validatePreview(preview)); assert.deepEqual(store.state(),before); }
  finally { Date.now=original; }
  store.importSource({title:'Intervening mutation',text:'Additional evidence.'}); const changed=store.state();
  assert.throws(()=>store.validatePreview(preview)); assert.deepEqual(store.state(),changed); store.close();
});

test('preview and proposal expiry cause zero writes; expired entries free capacity',()=>{
  const store=new Store(':memory:'); const {scenario,preview,result}=basic(store); const pending=store.stage(preview,result,metadata);
  const original=Date.now; Date.now=()=>original()+600001;
  try {
    const before=store.state(); assert.throws(()=>store.stage(preview,result,metadata)); assert.throws(()=>store.applyProposal(pending.id)); assert.deepEqual(store.state(),before);
    const fresh=store.preview({sourceIds:[scenario.sources[0].id],memoryIds:[],query:'Fresh preview'}); assert.equal(store.validatePreview(fresh),true);
  }
  finally { Date.now=original; store.close(); }
});

test('failed SQLite task insertion rolls back memories, tasks, receipts and revision',t=>{
  const path=persisted(t); const store=new Store(path); const {preview,result}=basic(store); const pending=store.stage(preview,result,metadata); const before=store.state();
  const db=new DatabaseSync(path); db.exec("CREATE TRIGGER fail_task BEFORE INSERT ON tasks BEGIN SELECT RAISE(ABORT, 'synthetic write failure'); END;"); db.close();
  assert.throws(()=>store.applyProposal(pending.id)); assert.deepEqual(store.state(),before);
  const repair=new DatabaseSync(path); repair.exec('DROP TRIGGER fail_task'); repair.close(); assert.equal(store.applyProposal(pending.id).outcome,'applied'); assert.equal(store.state().tasks.length,1); store.close();
});

test('source uniqueness, length, unknown fields and 64000-byte preview limits reject',()=>{
  const store=new Store(':memory:'); store.importSource({id:'one',title:'One',text:'a'.repeat(20000)});
  assert.throws(()=>store.importSource({id:'one',title:'Overwrite',text:'other'})); assert.throws(()=>store.importSource({title:'a'.repeat(201),text:'bad'})); assert.throws(()=>store.importSource({title:'Bad',text:'b'.repeat(20001)})); assert.throws(()=>store.importSource({title:'Bad',text:'hi',path:'/tmp/file'}));
  for(let i=2;i<=4;i++) store.importSource({id:`${i}`,title:'Large',text:'a'.repeat(20000)});
  assert.throws(()=>store.preview({sourceIds:['one','2','3','4'],memoryIds:[],query:'Oversized'})); store.close();
});

test('deleting a source removes tasks citing it even when their memory has different evidence',()=>{
  const store=new Store(':memory:'); const {scenario,preview,result}=basic(store); const initial=store.applyProposal(store.stage(preview,result,metadata).id);
  const second=store.importSource({id:'second-source',title:'Second commitment',text:'Prepare the synthetic packet.'});
  const evidence=[{sourceId:second.id,quote:second.text}];
  const next={answer:{text:'Prepare packet.',evidence},memories:[{key:'packet',kind:'commitment',text:'Prepare packet.',evidence}],actions:[{text:'Packet helps prototype.',memoryId:initial.memoryIds[0],evidence}]};
  const selected=store.preview({sourceIds:[scenario.sources[0].id,second.id],memoryIds:initial.memoryIds,query:'Follow-up task'});
  const receipt=store.applyProposal(store.stage(selected,next,metadata).id); assert.equal(store.state().tasks.length,2);
  const deletion=store.deleteMemory(receipt.memoryIds[0]); assert.equal(deletion.taskIds.length,1); assert.equal(store.state().tasks.length,1); assert.equal(store.state().tasks[0].id,initial.taskIds[0]); assert.equal(store.state().memories.length,1); store.close();
});
