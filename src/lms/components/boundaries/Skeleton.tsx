function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-white/[0.06] ${className}`} />;
}

export function SkeletonPageHeader() {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="space-y-2">
        <Block className="h-3 w-32" />
        <Block className="h-8 w-56" />
        <Block className="h-4 w-72" />
      </div>
      <Block className="h-9 w-32 rounded-lg" />
    </div>
  );
}

export function SkeletonStatRow({ count = 3 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card/60 p-5">
          <Block className="h-7 w-12" />
          <Block className="mt-2 h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border">
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-b border-border last:border-0">
              {Array.from({ length: columns }, (_, j) => (
                <td key={j} className="px-4 py-3.5">
                  <Block className="h-4 w-full max-w-[10rem]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-40 rounded-2xl border border-border bg-card/60 p-5">
          <Block className="h-4 w-1/3" />
          <Block className="mt-3 h-3 w-2/3" />
          <Block className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}
