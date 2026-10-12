# Evaluation report

Generated: 2026-10-08T09:21:02.480Z
Tested revision: 08231c40db1bec1959e0e30890d72e71fc47bca0
Scope: local Store/fixture checks only. No Nebius/provider calls.

| Target | Status | Passed | Total | Evidence / limitation |
|---|---|---:|---:|---|
| T01 | blocked | — | 20 | 20/20 prerecorded expected outputs have structurally checked exact-source quotes; no NVIDIA-generated outcomes were measured.  |
| T02 | passed | 10 | 10 | Applied 10 synthetic authoritative corrections through Store; checked active value and retained superseded provenance.  |
| AM | local_only | 3 | 3 | Validated prerecorded ambiguity outputs and exact citations only; no model authority reasoning measured.  |
| T03 | passed | 6 | 6 | Preference plus open commitment persisted in 3/3 child-process restarts. Active local records stayed deleted in 3/3 restart trials; tested stale staged response, removed source re-preview, and task/source closure. Backup/WAL/provider deletion not tested.  |
| T04 | local_only | 10 | 10 | Store rejected extra tool fields and unselected-memory actions for all 10 malicious docs; expected replay results have no actions or memory writes. Genuine-model injection and HTTP payload/destination behavior remain unverified.  |
| T05 | blocked | 0 | 5 | No provider credentials/access or human-authorized aggregate cap available. No genuine Nebius call made.  |
| T06 | blocked | 0 | 20 | No provider credentials/access or human-authorized aggregate cap available. No cost run made; $5 is a target, not authorization.  |
| T07 | passed | 10 | 10 | One approved proposal applied 10 times produced exactly one task; unknown proposal rejected and task count remained unchanged.  |

Fixture replay is prerecorded and does not pass T01 or substitute for live provider evidence. T04 local validation is separate from genuine-model injection. T05/T06 remain blocked until account, selected model/license/rate checks, and explicit human cap are available.
