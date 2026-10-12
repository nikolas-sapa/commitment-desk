# Commitment Desk

Local-first prototype for turning selected notes into cited commitments, preferences, and reviewable tasks. Synthetic fixture replay is prerecorded data. It does not call a model or test model reasoning.

## Status

Current source8dc2f42 verified October11,2026: fresh checkout install,85/85 tests,app/font HTTP200 and55-case disabled live preparation. Historical October8 local evaluation retained. Browser checked import, exact preview, labeled replay, apply, supersession, correction, and desktop/mobile layouts. Independent code/security reviews have no unresolved material findings. See [verification evidence](reports/verification.md), [evaluation](reports/evaluation.md), and [review dispositions](reports/review.md).

Genuine NVIDIA/Nebius baseline:18/20 factual/supported answers (agent review),five locally approved workflows,20 extraction requests estimated at$0.00668208. Baseline injection review:9/10 safe;full safety target failed. Current hardening has six safe validated abstentions;request failure left full target incomplete. [Evidence and revision limits](reports/genuine/overview.md). Actual invoice and Devpost submission remain pending. Fixture replay demonstrates state handling only.

## Public test build

[Public source repository](https://github.com/nikolas-sapa/commitment-desk) and [v0.1.4 test-build release](https://github.com/nikolas-sapa/commitment-desk/releases/tag/v0.1.4). Download [source ZIP](https://github.com/nikolas-sapa/commitment-desk/releases/download/v0.1.4/commitment-desk-v0.1.4.zip), extract it, then follow setup below. Default replay is free and requires no API key. The clean public history starts at this snapshot; earlier revision IDs in evidence refer to local development history. Executable source matches the verified source8dc2f42.

Public YouTube upload and Devpost submission are still pending authenticated browser access. Entrant confirmed submission rights and no organizer/sponsor conflicts October12,2026.

## Verified local setup

Requirements: Node.js 25.8.1 or newer, npm. Commands verified using Node 25.8.1 and npm 11.11.0:

```sh
npm ci --ignore-scripts
npm test
npm run evaluate
npm start
```

The local server binds to `127.0.0.1:4317`. Open the URL printed by the server in the same browser. The session token is local to that running app; do not share the token or its URL. Live inference stays disabled by default. The evaluation runner writes `reports/evaluation.json` and `reports/evaluation.md`, creating its scratch directory automatically. It uses disposable synthetic data.

## Replay and live inference

Fixture replay displays prerecorded fixture outputs and never calls an AI model. It demonstrates the proposed review and state flow only. Live inference is a separate mode using Nebius Token Factory and a configured NVIDIA model; it requires verified account/model access, current model-specific license and rates, and an explicit human-authorized aggregate spend cap. Genuine runs were verified separately;this checkout ships no key and defaults to disabled live access. Never enter private commitments until the exact payload, destination, and model have been reviewed and approved.

Configuration variable names documented in `.env.example`: `NEBIUS_API_KEY`, `NEBIUS_MODEL`, `NEBIUS_CAP_USD`, `NEBIUS_INPUT_USD_PER_MILLION`, `NEBIUS_OUTPUT_USD_PER_MILLION`, `NEBIUS_MAX_INPUT_TOKENS`, `NEBIUS_ACCESS_CONFIRMED`, `NEBIUS_BILLING_BOUNDS_CONFIRMED`, and `PORT`. Keep real values in an ignored local `.env`; never commit, screenshot, or share them. Empty/default values keep inference disabled. Synthetic evaluation requires selected account/model/license,prices,conservative full input/output bounds and human cap verification. Retention remains unverified;private input is outside this entry's authorized evaluation scope.

## Live evaluation runner

Verified October9:14/14 affected tests and independent JS/security approvals. Four interrupted-write/evidence-integrity regressions fixed. Fresh-clone dry preparation yields55 cases with live execution disabled. [Verification and limits](reports/live-runner-verification.md). Current fresh-checkout full suite passes85/85;the55-test result is historical.

`npm run evaluate:live -- prepare` creates a nonbillable preview of CR20 accuracy,IN10 injection,NW5 workflow and CO20 cost inputs (55 potential calls). `--packs CR,IN` selects only named frozen packs. Missing credentials/model/rates/input bound/access/cap keep the plan non-executable. Plans and per-case evidence stay ignored under work/live/. [Budget contract](reports/budget-contract.md) records combined reasoning/output cap and full-context input reservations;old configuration or request approvals must be prepared again.

Execution requires the saved plan hash and matching approval hash, unchanged executable/fixtures/config, and enabled ProviderGate. Main performs actual calls only after secure access and explicit aggregate spend authorization. Each request uses the approved exact bytes; durable journals prevent automatic repeated generation. Saved results require separate evidence-hash approval before local NW application. Applying saved results does not invoke a model.

The report command accepts separately declared, evidence-bound factual/support judgments with reviewer identity/kind human or agent. Structural checks do not count as semantic accuracy. Estimated token cost stays separate from actual billing reconciliation. Synthetic transports never count as genuine provider proof. CLI contracts: [evaluation/live.mjs](evaluation/live.mjs). Test plan and fixture limits: [LIVE-EVALUATION-PLAN.md](reports/LIVE-EVALUATION-PLAN.md).

## Data and deletion

The application stores imported notes, memories, tasks, and audit metadata in a local SQLite database under ignored `data/`. User-selected source spans and explicitly selected memories may be sent to Nebius only in live mode after preview approval. The preview binds the query, selected content, fixed instructions, destination, and model. Model output remains a proposal until the user applies it.

Deleting a memory removes linked active sources, memories, tasks, and pending proposals from application storage/retrieval. This does not establish physical erasure from SQLite WAL files, backups, operating-system storage, provider processing, or legal retention systems. No zero-retention claim is made.

## Project scope

No vault/account ingestion, shell execution, email/calendar actions, or hosted storage. Demo fixtures contain synthetic data. Read [SPEC.md](SPEC.md) for contracts and current verification gates. See [submission/checklist.md](submission/checklist.md) for artifact status.

[Judge guide](submission/judge-guide.md) describes the verified replay/setup path and remaining public-access requirements. [Current model preflight](reports/MODEL-PREFLIGHT.md) records advertised candidate rates/license and unresolved account/billing facts. Official event sources refreshed October12; public source and downloadable test-build access are provided above. YouTube and final submission remain pending.
