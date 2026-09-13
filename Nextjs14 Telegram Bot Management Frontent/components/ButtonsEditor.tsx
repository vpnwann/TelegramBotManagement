"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import type { Button as InlineButton } from "@/lib/types";

export function ButtonsEditor({
  buttons,
  onChange,
}: {
  buttons: InlineButton[];
  onChange: (buttons: InlineButton[]) => void;
}) {
  function update(i: number, field: keyof InlineButton, value: string) {
    onChange(buttons.map((b, idx) => (idx === i ? { ...b, [field]: value } : b)));
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <Label>Inline buttons</Label>
        <button
          type="button"
          onClick={() => onChange([...buttons, { text: "", url: "" }])}
          className="flex items-center gap-1 text-xs text-accent hover:text-accent-deep"
        >
          <Plus size={12} /> Add button
        </button>
      </div>
      {buttons.length === 0 ? (
        <p className="text-xs text-ink-muted">No buttons attached.</p>
      ) : (
        <div className="space-y-2">
          {buttons.map((b, i) => (
            <div key={i} className="flex gap-2">
              <Input
                placeholder="Button text"
                value={b.text}
                onChange={(e) => update(i, "text", e.target.value)}
              />
              <Input
                placeholder="https://example.com"
                value={b.url}
                onChange={(e) => update(i, "url", e.target.value)}
              />
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => onChange(buttons.filter((_, idx) => idx !== i))}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
