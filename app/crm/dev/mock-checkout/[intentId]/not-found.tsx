import { NotFoundState } from "@/crm/components/boundaries/NotFoundState";

export default function MockCheckoutNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <NotFoundState
        title="Платёж не найден"
        description="Тестовый платёж с таким идентификатором не существует."
        backHref="/dashboard"
      />
    </div>
  );
}
