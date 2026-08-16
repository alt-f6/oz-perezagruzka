// In-process failure counters for notification delivery. Resets on deploy/
// restart -- this is visibility for the admin health endpoint, not a
// durable metrics store (no Prometheus/Sentry in this repo yet).

interface ChannelStats {
  failures: number;
  lastFailureAt: string;
  lastReason: string;
}

let channels: Record<string, ChannelStats> = {};

export function recordFailure(channel: string, reason: string): void {
  const existing = channels[channel];
  channels[channel] = {
    failures: (existing?.failures ?? 0) + 1,
    lastFailureAt: new Date().toISOString(),
    lastReason: reason,
  };
}

export function getStats(): { channels: Record<string, ChannelStats> } {
  return { channels };
}

// Test-only: clears all recorded counters between test cases.
export function resetMetrics(): void {
  channels = {};
}
