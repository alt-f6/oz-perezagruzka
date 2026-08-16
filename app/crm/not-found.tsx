import { NotFoundState } from "@/crm/components/boundaries/NotFoundState";

export default function CrmNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <NotFoundState />
    </div>
  );
}
