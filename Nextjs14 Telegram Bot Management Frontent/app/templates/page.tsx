"use client";

import { useEffect, useState } from "react";
import { api, ApiError, normalizeList } from "@/lib/api";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { ButtonsEditor } from "@/components/ButtonsEditor";
import { useToast } from "@/components/Toast";
import type { Button as InlineButton, Template } from "@/lib/types";
import { Pencil, Plus, Trash2 } from "lucide-react";

const emptyForm = { name: "", text: "", parseMode: "HTML" as string, buttons: [] as InlineButton[] };

export default function TemplatesPage() {
  const { notify } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Template | null | "new">(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get("/templates");
      setTemplates(normalizeList<Template>(data as never).items);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    load();
  }, []);

  async function remove(t: Template) {
    if (!confirm(`Delete template "${t.name}"?`)) return;
    try {
      await api.del(`/templates/${t.id}`);
      notify("Template deleted");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not delete template", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Reusable message text you can drop into new messages."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus size={15} /> New template
          </Button>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-ink-muted">Loading…</div>
        ) : templates.length === 0 ? (
          <EmptyState
            title="No templates yet"
            hint="Save frequently used message text as a template."
            action={
              <Button className="mt-2" size="sm" onClick={() => setEditing("new")}>
                <Plus size={14} /> New template
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{t.name}</p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">{t.text.replace(/<[^>]+>/g, "")}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setEditing(t)}>
                    <Pencil size={13} /> Edit
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(t)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && (
        <TemplateModal
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: Template | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [form, setForm] = useState(
    template
      ? { name: template.name, text: template.text, parseMode: template.parse_mode || "HTML", buttons: template.buttons || [] }
      : emptyForm
  );
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, buttons: form.buttons.filter((b) => b.text && b.url) };
      if (template) {
        await api.put(`/templates/${template.id}`, payload);
        notify("Template updated");
      } else {
        await api.post("/templates", payload);
        notify("Template created");
      }
      onSaved();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not save template", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={template ? "Edit template" : "New template"} onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name">
          <Input
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Text">
            <Textarea
              required
              rows={4}
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
            />
          </Field>
          <Field label="Parse mode">
            <Select value={form.parseMode} onChange={(e) => setForm({ ...form, parseMode: e.target.value })}>
              <option value="HTML">HTML</option>
              <option value="Markdown">Markdown</option>
              <option value="MarkdownV2">MarkdownV2</option>
            </Select>
          </Field>
        </div>
        <ButtonsEditor buttons={form.buttons} onChange={(buttons) => setForm({ ...form, buttons })} />
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save template"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
