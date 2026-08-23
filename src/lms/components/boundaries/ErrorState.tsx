"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent } from "@/shared/components/ui/card";

export function ErrorState({
  title = "Что-то пошло не так",
  description = "Не удалось загрузить данные. Попробуйте ещё раз через несколько секунд.",
  digest,
  onRetry,
}: {
  title?: string;
  description?: string;
  digest?: string;
  onRetry: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle size={22} />
        </div>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        {digest ? <p className="font-mono text-xs text-muted-foreground">Код ошибки: {digest}</p> : null}
        <Button type="button" variant="outline" onClick={onRetry} className="mt-2">
          <RotateCcw size={16} />
          Попробовать снова
        </Button>
      </CardContent>
    </Card>
  );
}
