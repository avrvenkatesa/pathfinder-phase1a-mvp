# DB Runbook

## Common issues

- **ENOTFOUND base / invalid URL**: your `DATABASE_URL` contains quotes or banner text. Ensure `.env` has no quotes and no extra lines.
- **psql channel binding**: remove `&channel_binding=require` for CLI tools if needed.
- **Search path surprises**: set it once:
  ```sql
  ALTER ROLE neondb_owner IN DATABASE neondb SET search_path = public;
  Drizzle config: use server/drizzle.config.ts; run from repo root:
  ```

bash
Copy code
npm run db:push
perl
Copy code

# 2) (Optional but nice) PR template

Create `.github/pull_request_template.md`:

````md
## Summary

- [ ] Seed/Schema changes explained
- [ ] CI DB Smoke passes locally and on this PR

## How to test

```bash
npm ci
npm run db:push
npm run db:seed
npm run db:verify
Notes
 Updated README / .env.example

 Secrets (NEON_DIRECT_URL / NEON_POOLED_URL) verified
```
````
