import Link from "next/link";
import { SearchX } from "lucide-react";

export function NotFoundState({
  title = "Страница не найдена",
  description = "Похоже, такой страницы не существует или она была удалена.",
  backHref = "/dashboard",
  backLabel = "На главную",
}: {
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <div className="empty-state py-16">
      <div className="icon-tile bg-slate-100 text-slate-500">
        <SearchX size={22} />
      </div>
      <h2 className="section-title mt-2">{title}</h2>
      <p className="max-w-md text-sm text-slate-500">{description}</p>
      <Link href={backHref} className="btn-secondary mt-2">
        {backLabel}
      </Link>
    </div>
  );
}
