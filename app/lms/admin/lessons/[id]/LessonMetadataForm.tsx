"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";

export type Lesson = {
  id: string;
  title: string;
  description: string;
  content: string;
  is_published: boolean;
  order: number;
  practice_link_url: string | null;
  practice_link_label: string | null;
};

type Props = {
  lesson: Lesson;
  onChange: (lesson: Lesson) => void;
  onSave: () => void;
  onRefresh: () => void;
  saving: boolean;
  error: string | null;
};

export function LessonMetadataForm({ lesson, onChange, onSave, onRefresh, saving, error }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Lesson</CardTitle>
        <CardDescription>Lesson content and video assets stay separate. Video order still matters.</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
          <div className="grid gap-1.5">
            <Label htmlFor="lesson-title">Title</Label>
            <Input
              id="lesson-title"
              value={lesson.title}
              onChange={(e) => onChange({ ...lesson, title: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="lesson-order">Order</Label>
            <Input
              id="lesson-order"
              type="number"
              value={Number(lesson.order ?? 0)}
              onChange={(e) => onChange({ ...lesson, order: Number(e.target.value) })}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-description">Description</Label>
            <Textarea
              id="lesson-description"
              className="min-h-24"
              value={lesson.description}
              onChange={(e) => onChange({ ...lesson, description: e.target.value })}
            />
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-content">Content</Label>
            <Textarea
              id="lesson-content"
              className="min-h-60"
              value={lesson.content}
              onChange={(e) => onChange({ ...lesson, content: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch
              id="lesson-published"
              checked={!!lesson.is_published}
              onCheckedChange={(checked) => onChange({ ...lesson, is_published: checked })}
            />
            <Label htmlFor="lesson-published" className="cursor-pointer normal-case tracking-normal text-foreground">
              Published
            </Label>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-practice-link-url">Practice / workshop link</Label>
            <Input
              id="lesson-practice-link-url"
              type="url"
              placeholder="https://miro.com/app/board/..."
              value={lesson.practice_link_url ?? ""}
              onChange={(e) => onChange({ ...lesson, practice_link_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Separate from video links — for Miro boards, Google Docs, simulators, or external tests.
            </p>
          </div>

          <div className="grid gap-1.5 sm:col-span-2">
            <Label htmlFor="lesson-practice-link-label">Practice link label (optional)</Label>
            <Input
              id="lesson-practice-link-label"
              placeholder="Open interactive practice"
              value={lesson.practice_link_label ?? ""}
              onChange={(e) => onChange({ ...lesson, practice_link_label: e.target.value })}
              disabled={!lesson.practice_link_url}
            />
          </div>
        </div>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive-foreground"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onRefresh} disabled={saving}>
            Refresh
          </Button>
          <Button type="button" onClick={onSave} loading={saving}>
            {saving ? "Saving..." : "Save lesson"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
