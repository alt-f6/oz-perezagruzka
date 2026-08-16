import { NotFoundState } from "@/crm/components/boundaries/NotFoundState";

export default function LessonNotFound() {
  return (
    <NotFoundState
      title="Занятие не найдено"
      description="Это занятие не существует или было удалено."
      backHref="/lessons"
      backLabel="К списку занятий"
    />
  );
}
