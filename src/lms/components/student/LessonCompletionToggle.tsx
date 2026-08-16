"use client";

import { useOptimistic, useTransition } from "react";
import { CheckCircle2, Circle } from "lucide-react";

import { Button } from "@/shared/components/ui/button";
import { setLessonCompletion } from "../../../../app/lms/student/lessons/[id]/actions";

type Props = {
  lessonId: string;
  initialCompleted: boolean;
};

export function LessonCompletionToggle({ lessonId, initialCompleted }: Props) {
  const [optimisticCompleted, setOptimisticCompleted] = useOptimistic(initialCompleted);
  const [isPending, startTransition] = useTransition();

  function onClick() {
    const next = !optimisticCompleted;

    startTransition(async () => {
      setOptimisticCompleted(next);
      await setLessonCompletion(lessonId, next);
    });
  }

  return (
    <Button
      type="button"
      variant={optimisticCompleted ? "default" : "outline"}
      onClick={onClick}
      disabled={isPending}
      aria-pressed={optimisticCompleted}
    >
      {optimisticCompleted ? <CheckCircle2 /> : <Circle />}
      {optimisticCompleted ? "Урок пройден" : "Отметить как пройденный"}
    </Button>
  );
}
