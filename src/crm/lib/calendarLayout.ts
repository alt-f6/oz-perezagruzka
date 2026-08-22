export interface LayoutInput {
  id: string;
  scheduledAt: Date | string;
  durationMinutes: number;
}

export interface PositionedSession<T extends LayoutInput> {
  session: T;
  column: number;
  columnCount: number;
}

function endOf(session: LayoutInput): Date {
  return new Date(new Date(session.scheduledAt).getTime() + session.durationMinutes * 60_000);
}

/**
 * Greedy interval-graph column assignment: sessions sorted by start time,
 * each placed in the lowest-numbered column whose previous occupant already
 * ended. Sessions are grouped into overlap "clusters" (runs of sessions with
 * no clean break between them) so a cluster's columnCount only reflects the
 * columns *that cluster* actually used, not the whole day's max.
 */
export function assignOverlapColumns<T extends LayoutInput>(
  sessions: T[],
): PositionedSession<T>[] {
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );

  const placements = new Map<string, number>();
  const clusterOf = new Map<string, { maxColumn: number }>();

  let columnEnds: Date[] = [];
  let clusterEnd = new Date(0);
  let currentCluster = { maxColumn: 0 };

  for (const session of sorted) {
    const start = new Date(session.scheduledAt);
    const end = endOf(session);

    if (start >= clusterEnd) {
      currentCluster = { maxColumn: 0 };
      columnEnds = [];
      clusterEnd = end;
    } else if (end > clusterEnd) {
      clusterEnd = end;
    }

    let column = columnEnds.findIndex((occupiedUntil) => occupiedUntil <= start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = end;

    placements.set(session.id, column);
    currentCluster.maxColumn = Math.max(currentCluster.maxColumn, column + 1);
    clusterOf.set(session.id, currentCluster);
  }

  return sorted.map((session) => ({
    session,
    column: placements.get(session.id) ?? 0,
    columnCount: clusterOf.get(session.id)?.maxColumn ?? 1,
  }));
}
