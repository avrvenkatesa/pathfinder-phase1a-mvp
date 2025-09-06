import { z } from "zod";

// Accept "test" so Vitest works
const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  SESSION_SECRET: z.string().optional(),
  SESSION_NAME: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(), // 32-char string recommended in prod
  TRUST_PROXY: z.enum(["true","false"]).optional(),
});

const envRaw = schema.parse(process.env);

// Enforce required secrets only in production
function ensureProdSecrets() {
  if (envRaw.NODE_ENV !== "production") return;
  const missing = ["SESSION_SECRET", "JWT_SECRET", "ENCRYPTION_KEY"].filter(
    (k) => !(envRaw as any)[k]
  );
  if (missing.length) {
    throw new Error(`Missing required env in production: ${missing.join(", ")}`);
  }
}
ensureProdSecrets();

// Named export: raw env with safe defaults for non-prod/test
export const env = {
  NODE_ENV: envRaw.NODE_ENV,
  SESSION_SECRET: envRaw.SESSION_SECRET ?? "test-session-secret",
  SESSION_NAME: envRaw.SESSION_NAME ?? "sid",
  JWT_SECRET: envRaw.JWT_SECRET ?? "test-jwt-secret",
  ENCRYPTION_KEY: envRaw.ENCRYPTION_KEY ?? "0123456789abcdef0123456789abcdef",
  TRUST_PROXY: envRaw.TRUST_PROXY ?? (envRaw.NODE_ENV === "production" ? "true" : "false"),
};

// Back-compat default export: mimic legacy config shape the app expects
export const config = {
  env,
  server: {
    trustProxy: env.TRUST_PROXY === "true",
  },
  performance: {
    // express-compression: undefined is fine or provide an options object
    compression: undefined as any,
  },
  security: {
    // cors() accepts undefined or options
    cors: undefined as any,
    // ✅ session options expected by app.ts
    session: {
      secret: env.SESSION_SECRET,
      name: env.SESSION_NAME,
      cookie: {
        secure: env.NODE_ENV === "production",
        sameSite: "lax" as const,
      },
    },
  },
};

export function validateConfig(): void {
  // Re-run production-only checks (no-op in dev/test)
  ensureProdSecrets();
}

// Default export = compat config
export default config;
