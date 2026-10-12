# Commitment Desk Implementation Plan

## Continued live runner task

Dependency: SPEC live continuation tests L01–L06 above. Ownership: Sol high backend_build exclusively evaluation/live.mjs and tests/live.test.mjs; main owns manifests/SPEC/PLAN/TASKS/docs and actual execution. No provider/domain/UI edits. Preserve other workers.

1. Write meaningful rejection/approval/evidence/repeat-apply tests, observe missing runner failure. Use real SQLite and controlled transport,0 Nebius calls.
2. Implement nonbillable prepare and immutable fixed-fixture exact-envelope plans, executable/config hashes and durable case journals.
3. Implement explicit hash-approved serial execution with existing provider ledger; fail/unknown outcomes stop without retry. Fresh previews remove TTL hazard.
4. Implement separately approved saved-result local NW apply with durable proposal IDs and idempotent recovery. Add separate declared semantic judgments/cost reconciliation reporting.
5. Run targeted runner tests and CLI dry prepare with no credentials. Main commissions independent Sol JS/security review after runnable artifact. Fix material findings,rerun affected checks.
6. Main updates README/evidence,commits local candidate. Real model/cost evaluation awaits secure scoped key+cap; public push awaits authorized remote. Retain previous release tag rather than rewrite it.

October9 outcome: steps1–6 local work complete.14/14 affected tests,exact crash/TTL/receipt/kind regressions fixed,both scoped reviews approve. Current and updated clean clone prepare55 non-executable cases. No browser/live calls. New local candidate frozen;steps requiring actual provider/access/publication remain blocked,not counted complete.

> For agentic workers: use superpowers:subagent-driven-development. User explicitly authorizes parallel independent ownership and reuse of idle agents; this overrides skill fresh-worker/sequential defaults. Main owns commits. No worker spending.

Goal: runnable inspectable local commitment workflow plus gated Nebius adapter and truthful evaluation/submission artifacts.
Architecture: loopback service, SQLite, plain UI. No cloud call until scoped access and human cap. Synthetic replay demonstrates state flow, never model reasoning.
Tech stack: Node standard library, node:sqlite, plain JS/CSS/HTML, self-hosted Geist font assets.

## Global constraints

SPEC.md is exact interface contract. Node >=25.8.1. Accent #006bff, Geist Sans, no orange/emoji. No third-party code APIs, Context7 unavailable. Main owns package/lock/env/server/docs. Workers edit only owned files, preserve concurrent changes. Tests freeze before app implementation. No publish/deploy/register/spend. Root commit on branch; push requires known authorized remote.

## Task 1: Frozen synthetic packs (Luna medium)

Files fixtures/scenarios.json, fixtures/demo.json. No app code yet.
- [x] Write 20 CR, 10 CF pairs, 10 IN, 3 AM, 3 PR, 3 DL, 10 TW attempt IDs, 5 NW and 20 CO inputs.
- [x] Freeze result JSON shape from SPEC. Each sourced claim quotes exact selected source. Include reusable preferences/recipes, explicit uncertainty cases.
- [x] Validate ID counts, source uniqueness, expected quotes and result keys with Node script saved in work/.
- [x] Main commits frozen fixtures before application workers dispatch.

## Task 2: Store and provider (Sol high backend)

Files src/domain.mjs, src/provider.mjs, tests/domain.test.mjs, tests/provider.test.mjs. Consumes/produces exact Store/ProviderGate signatures in SPEC.
- [x] Test actual SQLite restart, supersession/provenance, deletion closure/late response, invalid citations and ten applies producing one task.
- [x] Implement prepared statements, revision invalidation, atomic writes/receipts and bounded validations.
- [x] Provider tests use real local HTTP test server for transport parsing only, no Nebius call. Production endpoint fixed; injectable test transport isolated explicitly from production config.
- [x] Implement disabled-by-default gate, persistent conservative budget reservations, timeout/body/model checks, no redirects/retries.
- [x] Main runs node --test tests/domain.test.mjs tests/provider.test.mjs; independent Sol task review, resolve material findings. 0 real-provider claim.

## Task 3: Interface (Luna medium frontend, after fixture freeze)

Files public/index.html, public/app.js, public/style.css. Exact HTTP API from SPEC, no server/store changes.
- [x] Build import/source selection, complete payload preview, fixture/live mode badge, cited proposals, explicit apply, memory/history/correction/deletion and committed-task queue.
- [x] Render only textContent; no content HTML, remote loads or generated URL authority. Token read fragment then removed.
- [x] Handle failed/pending writes explicitly. Loopback auth header on every call.
- [x] Main screenshot verifies desktop and narrow viewport, controls and empty/error states.

## Task 4: Integrate guarded HTTP (main)

Files src/server.mjs, tests/server.test.mjs, package.json/lock, .env.example, .gitignore.
- [x] Implement bounded JSON body, exact Origin/Host/session token checks, fixed static paths and CSP; API routes per SPEC.
- [x] Wire immutable previews and labeled fixtures; reject mismatched fixture selection or provider failure rather than fallback.
- [x] Test hostile origins/hosts/token/content types, stale previews, scripts and successful full local workflow using actual listening server.
- [x] Start app and browser verify import, preview, replay and apply. Deletion dialog inspected/cancelled; destructive closure verified in disposable SQLite/HTTP checks.

## Task 5: Evaluation and submission drafts (Luna medium, then independent Sol reviews)

Files evaluation/run.mjs, reports/evaluation.json/md, README.md, submission/description.md, demo-script.md, feedback.md, checklist.md. Main writes LICENSE/PROVENANCE/COMPLIANCE/diagram.
- [x] Evaluate local invariant targets, show per-case outcomes and separate blocked T01/T05/T06/provider injection results.
- [x] Never populate genuine-provider results without actual calls; output measured numerators/denominators and reasons.
- [x] Independent typescript-reviewer and security-reviewer inspect integrated runnable code and diff. Fix material findings and rerun affected tests.
- [x] Fresh-checkout setup verification, artifact checks, local screenshots, reproducible commit. Save logs in work/.
- [ ] Main pushes only to authorized remote if supplied; public deployment/video/submission await concrete artifacts and explicit approval. No remote supplied, no external action performed.

## Local test skeleton to guide workers

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../src/domain.mjs';
test('same approved proposal applied ten times yields exactly one task', () => {
  const s = new Store(':memory:');
  const source = s.importSource({title:'Synthetic promise',text:'I will send the prototype on Friday.'});
  const p = s.preview({sourceIds:[source.id],memoryIds:[],query:'What next?'});
  const evidence = [{sourceId:source.id,quote:'I will send the prototype on Friday.'}];
  const staged = s.stage(p,{answer:{text:'Send prototype.',evidence},memories:[{key:'prototype',kind:'commitment',text:'Send prototype on Friday.',evidence}],actions:[{text:'Send prototype.',memoryKey:'prototype',evidence}]},{provider:'fixture',model:null});
  for(let n=0;n<10;n++) s.applyProposal(staged.id);
  assert.equal(s.state().tasks.length,1);
  s.close();
});
```

No-gaps self-review: SPEC behavior maps to Tasks 1–5. Genuine inference and publication explicitly gated, not omitted or counted complete. No costly vendor or deployment added. Task graph maintained separately in TASKS.md.

## October10 output-budget continuation

Test plan: SPEC B01–B04, exact2048 visible+reasoning cap,0 transport calls for legacy envelope,provider/live/HTTP affected tests pass,55 cases prepared;first NW5 worst-case reservation fits$0.75,then shared-ledger admission governs subsequent packs.

Implementation: backend owns src/provider.mjs and tests/provider.test.mjs, reviews SPEC then demonstrates B01/B02 red on old field, changes fixed request to max_completion_tokens, verifies affected suites. Main owns config,source contracts,reports,actual approval-bound calls and commits. Separate JS/security review before generation. New prepare after executable change invalidates old approvals. No UI/dependency/retry/cap expansion.

## October11 input reservation correction

Test plan: SPEC B05–B07 first. Missing/invalid maxInputTokens gives0 calls;changed bound invalidates approval;reservation uses full configured input cap;overruns freeze acrossrestart;unknown requests retain full reservation;affectedprovider/live/server tests pass.

Implementation: backend owns src/provider.mjs,src/server.mjs,evaluation/live.mjs and their provider/live/server tests. Add NEBIUS_MAX_INPUT_TOKENS to app/live parsing and canonical plan;require safepositiveinteger;reserve configured full prompt cap rather than bytes+1024. Main owns .env.example,SPEC,PLAN,reports and secure config. Native/served context sources justify conservative300000 Nano bound,with cap$0.75 retained. IndependentJS/security review before NW5;then separate CR/IN/CO packs use sharedledger. No dependencies/retries/ledger resets/cap increase.

## October11 failed-response diagnosis

Test plan SPEC D01–D03: validemptytool-list accepted,nonempty/malformedtoolcalls rejected;whitelisted bounded failurediagnostics only;0 rawtext/key;firstfailedcase haltsremaining4;replay0newcalls.

Implementation: backendowns provider/live andtheirtests. Check schema-validemptytool-list handling,add sanitizedterminal diagnostics andrunner separatefailureDiagnostic field. Mainpreservesoriginal genuinefailure,cap/ledger;newcode requiresreviews andfreshNW5approval. No outputboundincrease untilfailureproof,no automaticretry.

## October11 explicit output contract

Test plan first: SPEC E01–E03. Canonical linked proposal stages with0commits;16 deterministic invalid-shape codes,strict optional/reference checks;runner enum-only projection,halt/replay unchanged.

Implementation: backend owns src/domain.mjs,src/provider.mjs,evaluation/live.mjs and their domain/provider/live tests. Clarify instruction types/limits/optional omissions using canonical examples;preserve strict predicates and expose fixed first-failure enum. Main preserves original attempts/shared ledger, owns evidence/docs/config/commits and approves fresh NW5 exact body after both reviews. Affected suites once; no full unchanged HTTP/UI rerun.

## October11 measured truncation correction

Test plan SPEC F01–F02 first:8192 output accepted,8193 freezes;legacy2048 envelope0calls;single shared bound,NW5 maximum$0.0998304;old approval0calls.

Backend owns provider/live and theirtests. Export sharedOUTPUT_MAX=8192,use runner reservation,adjust all affected boundary assertions,show new regressions red first,runprovider/live once. Main preserves attempt003,unchangedledger/cap,ownsdocs/config/commit and fresh body approval. Both independent reviews beforecalls. No domain/UI/dependency/timeout change.

## October11 measured injection hardening

Test plan SPEC G01–G02 first:existingdomain suite;fixed genuineIN10 repeat,10/10 safe andemptyproposals,0tools/writes;independent semanticreview,no cannedfixturefilters.

Main owns single domain prompt clarification after currentCO20 finishes;both scoped reviewers inspect authority/predicate preservation. Preserve baseline9/10 failure and all budgets/evidence. New exact-body approval/code digest before re-evaluation. No unrelated passed-suite reruns. Demo remains isolated replay,with genuine evidence presented separately and revision/limitations labeled.

## October11 exact quotation clarification

Test plan SPEC H01–H02 first:28 existing domain checks;fresh frozen IN10,10/10 validated/behaviorally safe,0 proposals/tools/writes. Original punctuation rejection remains visible.

Main owns two generic instruction sentences only. Independent JavaScript and security review before commit and fresh exact-body approval. Preserve exact citation predicates and source fixtures. No new dependency,automatic retry,budget expansion or unrelated code change.

## October11 attack-only abstention

SPEC I01–I02 first:28 domain checks,one fresh IN10 with10 validated/safe and0 proposals/tools/writes. Main replaces optional attack summary with canonical abstention;independent JS/security review before fresh approved code/body. Earlier partial6/7 behavioral outcome and timeout remain visible. No predicate,fixture,budget or timeout change.

## Isolated demo recording

Test plan before capture: desktop1280x720 and narrow390x844 screenshots show no clipping;actual fixture import/preview/replay/review/apply/update/history/deletion flow verified;provider disabled and0extra inference requests;original database untouched. Separate evidence scene uses actual saved hashes/reports with agent-review/revision/billing limits. MP4<=180seconds,<=50MB,English captions,1280x720. No credentials/session tokens visible.

Main owns ignored replay-only server and evidence HTML;Luna owns ignored PythonPlaywright capture plus local outputMP4. Python script review beforelaunch;existing installed runtime only,no new dependencies. No upload/deploy/account interaction. Non-goals: fabricated live UI,changing product UI,test fixtures or original data,unlabeled replay,extra inference or narration sent to external services.
