# M1: Instances list tests

## Rationale
- Lock in seek pagination behavior and cursor correctness.

## Scope
- Vitest + Supertest for `/api/instances`:
  - happy path
  - invalid status filter (400)
  - cursor: first page, next page, bad cursor (400), last page

## Acceptance
- Tests green; docs updated with examples + error cases.
