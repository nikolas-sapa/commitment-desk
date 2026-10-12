# Live runner verification

October9,2026. Executable revision ef29124b045110454d9a8f56a683250a0359464c. Local candidate only;0 genuine Nebius calls,0 inference spending.

## Actual checks

Final affected runner suite:14/14 pass,0 failed,0 skipped,5.85s. Evidence: ignored work/live-final-tests.log. Tests use actual SQLite, controlled loopback HTTP and actual child-process exits. Controlled transports always produce synthetic evidence. Existing55-test app verification remains historical baseline; app/domain/provider code unchanged, unchanged suites not repeated. No combined69-test-run claim.

Four exact review regressions failed on initial implementation, then4/4 passed after fixes. Affected recovery/failed-run checks7/7 passed. Logs: work/live-review-regressions-red.log,live-review-regressions-fixed.log,live-review-affected.log.

CLI dry prepare on current repo and prior clean clone updated to executable revision:55 frozen cases,non-executable,provider key missing. No network inference or memory/task commits. Evidence: work/live-final-prepare.log and session work/build/fresh-live-prepare.log. No dependency changes or additional install required; Node/npm prerequisites and lockfile unchanged.

## Independent review

Separate gpt-6.1-sol high JS and security reviewers approved scoped fixes, no material residual findings. Neither reran passing suites or made external calls.

| Finding | Fix | Regression evidence |
|---|---|---|
| Persisted unapplied proposal expired after interruption | Read authoritative receipt first; renew expired unapplied result locally | Actual child exit before apply, retry after>10min,0 new inference |
| Process death left permanent file lock | SQLite BEGIN IMMEDIATE apply guard released by kernel | Actual child exit after first commit; prior receipt recovered unchanged |
| Forged empty-ID receipts counted as five applications | Existing DB opened read-only; exact issued receipt/count/content verification | Forged unissued receipts reject;0 report-induced writes |
| Synthetic evidence relabeled genuine by recomputing self-hash | Require evidence agreement with durable execution journal | Rehashed kind/output changes reject |

First provider/validation failure now halts batch; remaining rows stay not_run and retain denominators. Completed evidence can be replayed without inference. Unknown/interrupted execution journals never automatically retry. Approved saved-result application repeated ten times yields identical five NW receipts without duplicate writes.

## Limits and next gates

Local hashes/journals detect inconsistency; owner editing every local artifact could still fabricate records. They are not independent provider attestation. Genuine requests/model IDs/usage must be checked against actual authorized provider/account evidence before report promotion. Actual billing remains unreconciled even when token estimates fit target.

T01 semantic accuracy requires separately declared source-support/factual judgments. Reviewer identity/kind human|agent remains explicit. T04 model behavior separate from structural boundary checks. T05 needs5 genuine responses and approved local applications. T06 needs20 cost cases and actual billing reconciliation. Frozen NW-03 reference and one-note CO workload limitations remain disclosed.

Scoped credentials, explicit aggregate cap, exact model/license/rates/billing bounds/retention verification still absent. Authorized remote/publication, judge demo/video and ownership/conflict confirmation remain pending. Browser work routed exclusively to gpt-6-luna per human instruction; this continuation used no browser actions. Requested Luna source lookup failed on usage limit, no substitute worker used.

Release local-candidate-v0.1.1 retains prior local-candidate-v0.1.0 unchanged. New bundle alongside repository contains complete committed history and tags. No public push possible without authorized remote.
