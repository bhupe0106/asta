# Agent contracts

This directory is reserved for shared, versioned agent contracts (JSON Schema or generated type
definitions) when ASTA needs to expose the registry to clients beyond the web app.

Today the **single source of truth** is the Python registry at
[`services/api/app/orchestration/registry.py`](../../services/api/app/orchestration/registry.py).
The API serialises that registry at `GET /api/v1/agents`, and the web client consumes the response
instead of duplicating role definitions.

Do not add a second hand-maintained copy of the twelve roles here. If a shared contract is needed,
generate it from `AGENT_SPECS` and commit the generated artifact with a version and checksum.
