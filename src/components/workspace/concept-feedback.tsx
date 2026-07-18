"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { Feedback } from "@/lib/types";

interface ConceptFeedbackProps {
  feedback: Feedback[];
  onSubmit: (comment: string) => void;
}

export function ConceptFeedback({ feedback, onSubmit }: ConceptFeedbackProps) {
  const [comment, setComment] = useState("");

  function handleSubmit() {
    const trimmed = comment.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setComment("");
  }

  return (
    <div className="mt-3 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Оставьте комментарий к этой концепции…"
          className="min-h-24 resize-y rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6 text-ink outline-none placeholder:text-ink-secondary focus:border-ink/30"
        />
        <Button type="button" size="sm" disabled={!comment.trim()} onClick={handleSubmit} className="self-start">
          Отправить отзыв
        </Button>
      </div>

      {feedback.length === 0 ? (
        <p className="text-sm text-ink-secondary">Пока нет отзывов по этой концепции.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border border-t border-border">
          {[...feedback].reverse().map((item) => (
            <div key={item.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink">{item.author}</p>
                <p className="text-xs text-ink-secondary">{formatDateTime(item.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-ink-secondary">{item.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
