import { NotFoundState } from "@/crm/components/boundaries/NotFoundState";

export default function StudentNotFound() {
  return (
    <NotFoundState
      title="Ученик не найден"
      description="Этот ученик не существует или был удалён."
      backHref="/students"
      backLabel="К списку учеников"
    />
  );
}
