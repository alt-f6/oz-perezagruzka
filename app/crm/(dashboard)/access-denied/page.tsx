export default function AccessDeniedPage() {
  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Доступ запрещён</h1>
      <p className="mt-2 text-sm text-slate-500">
        У вашей учётной записи нет прав для просмотра этого раздела. Если это
        ошибка, обратитесь к администратору.
      </p>
    </div>
  );
}
