# Seed Refresh

**Status:** Shipped via PR #XX (M1)

## What changed
- Introduced a **deterministic, idempotent seed script** for the Pathfinder runtime database.
- The seed covers workflow instances, step instances, and dependencies with realistic transitions and statuses.
- Added a **smoke test** to validate the dataset quickly in CI and local environments.

## Business Rationale
- **Faster developer onboarding:** anyone can now spin up a local database with meaningful demo data in one command.  
- **Stable test runs:** unit and integration tests execute against a predictable, realistic dataset, reducing flakiness.  
- **Better demos:** seeded workflows represent real customer journeys (linear and branched), making it easier to showcase features.  
- **Ops & support efficiency:** reproducible data helps engineers and support staff debug issues in staging environments.  
- **Future-proofing:** as workflows and statuses evolve, seeds can be easily updated to keep test/dev data in sync.
