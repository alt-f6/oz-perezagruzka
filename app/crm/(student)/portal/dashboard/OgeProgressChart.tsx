"use client";

import { Target } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { StudentExamGoal, StudentExamResult } from "@/crm/lib/types";

interface ChartPoint {
  date: string;
  score: number;
  testName: string;
}

export function OgeProgressChart({
  examGoals,
  examResults,
}: {
  examGoals: StudentExamGoal[];
  examResults: StudentExamResult[];
}) {
  if (examGoals.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-accent">
          <Target size={18} className="text-accent/60" />
          Прогресс подготовки к ОГЭ
        </h2>
        <p className="mt-3 text-sm text-accent/40">
          Цели по экзаменам ещё не заданы.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm space-y-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-accent">
        <Target size={18} className="text-accent/60" />
        Прогресс подготовки к ОГЭ
      </h2>

      {examGoals.map((goal) => {
        const results = examResults.filter(
          (r) => r.subject.toLowerCase() === goal.subject.toLowerCase(),
        );
        const points: ChartPoint[] = results.map((r) => ({
          date: new Date(r.testedAt).toLocaleDateString("ru-RU", {
            day: "numeric",
            month: "short",
          }),
          score: r.currentScore,
          testName: r.testName,
        }));

        return (
          <div key={goal.id} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-accent">{goal.subject}</span>
              <span className="text-accent/60">
                Старт: <strong className="text-accent">{goal.startScore}</strong>
                {" · "}
                Цель: <strong className="text-emerald-600">{goal.targetScore}</strong>
              </span>
            </div>

            {points.length === 0 ? (
              <p className="text-xs text-accent/40">
                Результатов пробников пока нет.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={points} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis
                    domain={[
                      Math.min(goal.startScore, goal.targetScore) - 5,
                      Math.max(goal.startScore, goal.targetScore) + 5,
                    ]}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, _name, item) => [
                      `${value} (${item.payload.testName})`,
                      "Балл",
                    ]}
                  />
                  <ReferenceLine
                    y={goal.startScore}
                    stroke="var(--color-accent)"
                    strokeDasharray="4 4"
                    label={{ value: "Старт", fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={goal.targetScore}
                    stroke="#059669"
                    strokeDasharray="4 4"
                    label={{ value: "Цель", fontSize: 11 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#059669"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        );
      })}
    </div>
  );
}
