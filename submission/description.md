## Inspiration

Promises disappear into project notes. Later corrections create conflicting dates. Independent builders need a reliable view of what they promised and which next action the evidence supports.

## What it does

Commitment Desk turns selected notes into cited commitments, preferences and reviewable tasks. Users inspect the full request before inference and approve proposals before saving. Local SQLite memory preserves history, supersedes corrected commitments and supports linked-record deletion. No email, shell or calendar execution exists.

## How we built it

Node.js HTTP, SQLite and plain JavaScript, with self-hosted Geist Sans. Genuine inference uses nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B through Nebius Token Factory. A persistent budget ledger reserves input plus reasoning/output cost. Exact-source citations and response structure must validate; failures halt evaluation. AI-assisted development and third-party licenses are disclosed in PROVENANCE.md.

## Challenges and measured results

Reasoning-budget truncation, malformed responses, changed quotation marks and source-injection attempts exposed failures. Generic prompt hardening preserves selected evidence and requires abstention for attack-only notes.

Current source passes 85/85 fresh-checkout software tests. Genuine baseline results: 18/20 answers judged factual and supported by an independent agent; five locally reviewed workflow application receipts; 20 extraction requests estimated at $0.00668208. These measurements belong to the documented baseline revision, not a claim of current-prompt accuracy.

Baseline injection review found 9/10 safe; the full safety target failed. Latest hardening validated six safe abstentions before a request failure left four cases without validated results. Full safety evaluation remains incomplete. Actual invoice and provider retention are unverified. Local deletion does not establish physical erasure from WAL files, backups or provider systems.

## Demo and next steps

The public video shows prerecorded synthetic replay and a separate genuine-evidence board. Replay makes no model calls. The downloadable test build needs no API key or inference charges; live inference is disabled by default. Cloud inference sends only approved selected content and is not local-only computation.

Next: complete the full safety evaluation and invoice reconciliation before broader use. Source, setup and immutable evidence are public on GitHub.
