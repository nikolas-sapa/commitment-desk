# Local verification

October 8, 2026. Local candidate only. No public deployment or genuine model use.

## Reproducibility

Application/test revision: `dc1c0c544d81234997614aaa003c649829427654`.
Final executable revision: `08231c40db1bec1959e0e30890d72e71fc47bca0`, adding only awaited scratch-directory creation to evaluation. Independent JS reviewer approved that change. Evaluation ran from the clean local clone at this revision. Later candidate changes contain documentation, reports and screenshots only.

Runtime: Node 25.8.1, npm 11.11.0. Local branch: `hackathon/commitment-desk`. Release tag: `local-candidate-v0.1.0`. Git bundle alongside repository preserves committed source/history/tag; clone it, then follow README. Dependencies remain fetched through the committed lockfile.

## Checks actually run

| Check | Result | Evidence |
|---|---|---|
| Final integrated npm test |55/55,0 failures,0 skipped|work/final-tests.log|
| Clean local clone, npm ci --ignore-scripts|Exit0,1 package installed|Session work/build/fresh-install.log|
| Clean clone npm test|55/55,0 failures,0 skipped|Session work/build/fresh-tests.log|
| Clean clone npm start, PORT4318|HTML HTTP200; actual Geist font HTTP200,33400 bytes|Session work/build/fresh-start.log; lead curl check|
| Clean clone npm run evaluate|Exit0;8 explicitly scoped target rows|reports/evaluation.json and evaluation.md|
| git diff --check|No whitespace errors|Lead final check|
| Independent code/security review|No unresolved material findings within local scope|reports/review.md|

Fresh-clone evaluation initially failed ENOENT because ignored work/ did not exist. Added awaited recursive mkdir, confirmed failure-to-success on the clone, committed fix, pulled that commit and evaluated again successfully. Full app tests were not repeated for this isolated evaluation setup change.

Tests exercise real SQLite, child-process persistence and actual loopback HTTP. Provider transport tests use controlled local servers/test injection, never Nebius. A real installed font distribution is served by the application. No ESLint configuration/toolchain exists; no lint pass claimed. Plain JS project, no TypeScript compilation claimed.

## Browser evidence

Actual in-app browser verified synthetic import → full payload preview → clearly labeled fixture replay → cited proposal → explicit apply (1 memory,1 task). A second fixture superseded October18 with October20 while History retained the earlier value. Editing query invalidated the apply control. Correction created a new source/memory for October21 and removed the obsolete linked task. Source controls remained usable after writes. Console error/warning query returned no entries.

Desktop and390×844 viewport inspected. Temporary viewport reset. Screenshots: memory-desktop.jpg, memory-mobile.jpg, history-desktop.jpg. Mobile capture predates final correction; it records layout, not the final active date.

Deletion warning inspected then cancelled in browser. Permanent deletion was exercised only on disposable synthetic SQLite/HTTP test records:3/3 deletion/restart trials plus closure/late-response checks. No browser deletion claim. Physical WAL/backups/OS/provider erasure untested.

## Remaining acceptance

T02:10/10 local supersessions. T03:3/3 restarts plus3/3 deletion trials. T07:10 repeated applies create exactly1 task. T01 model accuracy, T05 five genuine calls and T06 twenty-run cost remain blocked. T04 structural validation passed10/10; genuine-model injection resistance remains unverified. No real provider calls or inference spending occurred.

No remote configured, so push could not occur. Public repository, hosted judge access, video recording/upload and submission remain pending authorized destinations/actions. Scoped Nebius credentials, exact model/license/access/rate/billing/retention verification and explicit aggregate spend cap are required before live evaluation. Ownership/conflict declarations remain required before submission.
