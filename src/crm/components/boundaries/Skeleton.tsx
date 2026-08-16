function Block({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200/70 ${className}`} />;
}

export function SkeletonStatCard() {
  return (
    <div className="card flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-2.5">
        <Block className="h-2.5 w-20" />
        <Block className="h-7 w-16" />
        <Block className="h-3 w-24" />
      </div>
      <Block className="h-12 w-12 shrink-0 rounded-lg" />
    </div>
  );
}

export function SkeletonStatGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonRow({ columns = 4 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="px-4 py-3.5">
          <Block className="h-4 w-full max-w-[10rem]" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonTable({ rows = 6, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <SkeletonRow key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2">
        <Block className="h-7 w-48" />
        <Block className="h-4 w-72" />
      </div>
      <Block className="h-9 w-32 rounded-lg" />
    </div>
  );
}

export function SkeletonCardList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card space-y-2.5">
          <Block className="h-4 w-1/3" />
          <Block className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
