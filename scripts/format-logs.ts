// Reformats `docker compose logs` output for readability: this app's own
// logger (src/shared/lib/logger.ts) emits one JSON object per line
// ({ ts, level, scope, msg, ...context }); everything else (Next.js's own
// stdout, docker's own prefixing) isn't JSON and is passed through as-is.
import { createInterface } from "node:readline";

const LEVEL_COLOR: Record<string, string> = {
  error: "\x1b[31m", // red
  warn: "\x1b[33m", // yellow
  info: "\x1b[36m", // cyan
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

function formatLine(line: string): string {
  let entry: unknown;
  try {
    entry = JSON.parse(line);
  } catch {
    return line;
  }

  if (
    typeof entry !== "object" ||
    entry === null ||
    !("msg" in entry) ||
    !("level" in entry)
  ) {
    return line;
  }

  const { ts, level, scope, msg, ...context } = entry as Record<string, unknown>;
  const color = LEVEL_COLOR[String(level)] ?? "";
  const time = typeof ts === "string" ? ts.split("T")[1]?.replace("Z", "") ?? ts : "";
  const levelLabel = String(level).toUpperCase().padEnd(5);
  const scopeLabel = scope ? `[${scope}]` : "";
  const extra = Object.keys(context).length > 0 ? `${DIM} ${JSON.stringify(context)}${RESET}` : "";

  return `${DIM}${time}${RESET} ${color}${levelLabel}${RESET} ${scopeLabel} ${msg}${extra}`;
}

const rl = createInterface({ input: process.stdin });
rl.on("line", (line) => {
  process.stdout.write(formatLine(line) + "\n");
});
