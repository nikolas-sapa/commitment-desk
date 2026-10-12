# Build ledger

Plan: PLAN.md. Branch hackathon/commitment-desk. User local go-ahead October 8. Scoped synthetic live evaluation authorized within$0.75 shared cap;public actions require final approval. No remote configured. Main plus 3 active children maximum.

| ID | Dependencies | Model/owner | Files | Acceptance | Status |
|---|---|---|---|---|---|
| 1 | Reviewed SPEC | Luna/provider_preflight | fixtures/*.json | Required pack counts;228 exact quotes; frozen commit2ea29ee | Complete |
| 2 | 1 | Sol high/backend_build | src/domain.mjs,src/provider.mjs,tests/domain.test.mjs,tests/provider.test.mjs | SQLite restarts/deletion,10 repeats=1 task,0 unsafe writes; cap/transport local tests | Complete,55/55 integrated tests |
| 3 | 1 | Luna medium/ui_build | public/index.html,app.js,style.css | Exact API/text-only rendering; desktop/narrow screenshots | Complete,browser/screenshots verified |
| 4 | 2/3 | Main/root | src/server.mjs,tests/server.test.mjs,config/manifests | Actual HTTP flow;0 hostile access;0 replay/live confusion | Complete,HTTP tests verified |
| 5 | 2/4 | Luna medium/provider_preflight | evaluation/run.mjs,README.md,submission/*.md | Measured local report,7 original targets plus ambiguity; live targets explicitly blocked;150s script | Complete,local results/drafts |
| 6 | 2/3/4/5 runnable | Sol high/typescript-reviewer,security-reviewer | Read-only integrated repo | 0 unresolved material findings; affected checks rerun | Complete,0 material findings |
| 7 | 6 | Main/root | reports/*,PROVENANCE.md,COMPLIANCE.md,release evidence | Fresh checkout works,screenshots,actual measurements,commit | Complete,clean clone/source bundle |
| 8 | Scoped access+cap | Main/root | Provider evidence/budget reports |5 genuine NVIDIA/Nebius workflows;20 runs <=$5 |Partial:five workflows applied;CO20 measured estimate$0.00668208;actual invoice pending |
| 9 | Repo destination+concrete artifact approvals | Main/root | Authorized external destinations only | Push/public repo/demo/video/submission verified | Blocked on destination/approval |
| 10 | Live SPEC L01–L06 | Sol high/backend_build | evaluation/live.mjs,tests/live.test.mjs |55 frozen cases,0 unauthorized calls/writes,repeat apply idempotent,truthful review/cost evidence | Complete14/14;4 exact regressions fixed |
| 11 | 10 runnable | Sol high/code_review,readiness_review | Read-only live runner |0 unresolved material JS/security findings |Complete;both scoped reviews approve |
| 12 | 10/11 | Main/root | reports/live-runner-verification.md,docs,tag/bundle |Current/clean-clone dry prepare55cases disabled;new immutable local candidate |Complete local-candidate-v0.1.1;real calls/publication still gated |
| 13 | Public primary sources | Luna medium/model_terms | reports/MODEL-PREFLIGHT.md,ignored work/rules-refresh-2026-10-09.md |Verified candidate card/license/rates;all4 event sources refreshed;unknown account/billing explicit |Complete public research;no account/inference proof |
| 14 | 13 and verified local candidate | Main/root | submission/judge-guide.md,COMPLIANCE.md,PROVENANCE.md,submission/feedback.md/checklist.md |Judge instructions and honest research feedback;current dates/source links;no invented use/access |Complete local submission preparation;publication/input gates open |
| 15 | Official endpoint/context evidence,SPEC B01–B07 | Sol high/backend_build,independent Sol JS/security reviewers | provider/server/live and affected tests |47/47 affected checks;0 calls for missing/mutated bounds;NW5 maximum$0.0924576 under$0.75 |Complete code/review;main owns actual execution |
| 16 | Genuine halted attempt,SPEC D01–D03 | Sol high/backend_build,independent JS/security reviewers | provider/live/tests; main evidence/docs |45/45 affected checks;3 red regressions;valid empty tool list;bounded failure diagnostics;halt/replay unchanged |Complete tests and both reviews;main owns fresh approved execution |
| 17 | Second halted attempt,SPEC E01–E03 | Main implementation after backend limit;independent JS/security reviewers | domain/provider/live/tests;main evidence/docs |75/75 affected checks,0skip;3 red regressions;16 isolated shape codes;canonical examples stage0commits |Complete tests and both reviews;main owns fresh approved execution |
| 18 | Observed NW02 truncation,SPEC F01–F02 | Sol high/backend_build,independent JS/security reviewers | provider/live/tests;main evidence/docs |51/51 affected checks,0skip;4red regressions;8192shared bound,NW5max$0.0998304;legacy approval0calls |Complete tests/both reviews;main owns fresh execution |
| 19 | Baseline IN05unsafe proposal,SPEC G01–G02 | Main,independent JS/security reviewers | domainprompt;genuine reports |28/28 domain checks;baseline9/10 preserved;fresh exact-body IN10 repeat required |Reviewed;seven validated before citation rejection;full target incomplete |
| 20 | Unicode citation rejection,SPEC H01–H02 | Main,JS/security reviewers | domainprompt;genuine evidence |28/28 domain checks,predicates unchanged |Reviewed;seven validated before request failure;partial6/7 behaviorally safe |
| 21 | Unsafe summary framing,SPEC I01–I02 | Main,JS/security reviewers | domainprompt;genuine evidence |28/28 domain checks,attack-only abstention,mixed supported facts retained |Reviewed;latest6/10 validated,six safe,one failure,three unrun;full safety incomplete |
| 22 | Isolated capture plan | Luna,Python-reviewer | ignoredwork/video-capture;local MP4 |<180s,<50MB,1280x720,desktop/mobile,0providercalls |Complete72.36s/2343713bytes;frame and isolation verified |
| 23 | Final source8dc2f42 | Main | freshcheckout,reports,source release |85/85tests,HTTP200,font33400bytes,dry55disabled,no secrets |Verified;local-candidate-v0.1.3 source snapshot packaging,public approval pending |

Workers preserve concurrent changes; no manifests/contracts/locks/deploy modifications, no children/commits/spending. Main handles any real provider calls. Luna escalates after1 substantive failure/unclear contract. Task2 and3 independently reviewed after runnable delivery; final reviews read-only. Changed task ownership/contract decisions recorded before execution.
