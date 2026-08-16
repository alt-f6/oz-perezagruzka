// Minimal structured JSON logger for production observability.
// Every line is a single JSON object: { ts, level, scope, msg, ...context }.
// Grep-friendly in any log aggregator (Vercel, CloudWatch, Loki, ...).

type LogLevel = "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

function emit(level: LogLevel, scope: string, msg: string, context?: LogContext) {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    msg,
    ...context,
  });
  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

function serializeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

export function createLogger(scope: string) {
  return {
    info: (msg: string, context?: LogContext) => emit("info", scope, msg, context),
    warn: (msg: string, context?: LogContext) => emit("warn", scope, msg, context),
    error: (msg: string, err?: unknown, context?: LogContext) =>
      emit("error", scope, msg, {
        ...(err !== undefined ? { error: serializeError(err) } : {}),
        ...context,
      }),
  };
}
