# M1: OpenAPI validation in CI

## Rationale
- Catch spec drift and schema errors in PRs.

## Scope
- Add GitHub Action to run Spectral (or openapi-cli) on `docs/openapi/openapi.yaml`.
- Fail PR on lint/validation errors; cache deps.

## Acceptance
- CI job green on main; fails on bad fragments.
- Basic ruleset committed; README snippet on “how to run locally”.

## Out of scope
- Full contract tests; SDK generation.
