import rateLimit from "express-rate-limit";

const windowMs =
  Number(process.env.RL_WINDOW_MS ?? (process.env.NODE_ENV === "test" ? 1000 : 60_000));

const mk = (max: number) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
  });

export const rateLimiters = {
  general: mk(Number(process.env.RL_GENERAL_MAX ?? (process.env.NODE_ENV === "test" ? 20 : 300))),
  read:    mk(Number(process.env.RL_READ_MAX    ?? (process.env.NODE_ENV === "test" ? 10 : 200))),
  write:   mk(Number(process.env.RL_WRITE_MAX   ?? (process.env.NODE_ENV === "test" ? 5  : 60))),
};
