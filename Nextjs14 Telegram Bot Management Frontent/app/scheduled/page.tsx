"use client";

import { useEffect, useState } from "react";
import { api, ApiError, buildQuery, normalizeList } from "@/lib/api";
import { Button, Card, EmptyState, Field, Input, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { ButtonsEditor } from "@/components/ButtonsEditor";
import { useToast } from "@/components/Toast";
import type { Button as InlineButton, Group, ScheduledMessage, Template } from "@/lib/types";
import { Ban, Plus, Send, SquarePen } from "lucide-react";

export default function ScheduledPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<ScheduledMessage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | "new" | ScheduledMessage>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = buildQuery({ page, limit: 20, status });
      const data = await api.get(`/scheduled${qs}`);
      const { items: rows, totalPages: tp } = normalizeList<ScheduledMessage>(data as never);
      setItems(rows);
      setTotalPages(tp);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Failed to load scheduled messages", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get("/groups?limit=100")
      .then((d) => setGroups(normalizeList<Group>(d as never).items))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    load();
  }, [page, status]);

  async function cancel(item: ScheduledMessage) {
    if (!confirm("Cancel this scheduled message?")) return;
    setBusyId(item.id);
    try {
      await api.post(`/scheduled/${item.id}/cancel`);
      notify("Scheduled message cancelled");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not cancel", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function sendNow(item: ScheduledMessage) {
    setBusyId(item.id);
    try {
      await api.post(`/scheduled/${item.id}/send-now`);
      notify("Sending now");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not send now", "error");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Scheduled"
        description="Messages queued to send automatically at a future time."
        action={
          <Button onClick={() => setModal("new")}>
            <Plus size={15} /> Schedule message
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-44" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-ink-muted">Loading…</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            hint="Schedule a message to be posted automatically at a future date and time."
            action={
              <Button className="mt-2" size="sm" onClick={() => setModal("new")}>
                <Plus size={14} /> Schedule message
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{item.text.replace(/<[^>]+>/g, "")}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {item.group_name || `Group #${item.group_id}`} ·{" "}
                    {new Date(item.scheduled_at).toLocaleString()}
                  </p>
                  {item.error_message && (
                    <p className="mt-0.5 text-xs text-danger">{item.error_message}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={item.status} />
                  {item.status === "scheduled" && (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => setModal(item)}>
                        <SquarePen size={13} />
                      </Button>
                      <Button
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => sendNow(item)}
                      >
                        <Send size={13} /> Now
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={busyId === item.id}
                        onClick={() => cancel(item)}
                      >
                        <Ban size={13} />
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      {modal && (
        <ScheduleModal
          groups={groups}
          existing={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ScheduleModal({
  groups,
  existing,
  onClose,
  onSaved,
}: {
  groups: Group[];
  existing: ScheduledMessage | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { notify } = useToast();
  const [groupId, setGroupId] = useState(existing ? String(existing.group_id) : groups[0]?.id ? String(groups[0].id) : "");
  const [text, setText] = useState(existing?.text || "");
  const [parseMode, setParseMode] = useState<string>(existing?.parse_mode || "HTML");
  const [buttons, setButtons] = useState<InlineButton[]>(existing?.buttons || []);
  const [scheduledAt, setScheduledAt] = useState(toLocalInputValue(existing?.scheduled_at));
  const [templates, setTemplates] = useState<Template[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get("/templates")
      .then((d) => setTemplates(normalizeList<Template>(d as never).items))
      .catch(() => {});
  }, []);

  function applyTemplate(id: string) {
    const t = templates.find((tpl) => String(tpl.id) === id);
    if (t) {
      setText(t.text);
      setParseMode(t.parse_mode || "HTML");
      setButtons(t.buttons || []);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        groupId: Number(groupId),
        text,
        parseMode,
        buttons: buttons.filter((b) => b.text && b.url),
        scheduledAt: new Date(scheduledAt).toISOString(),
      };
      if (existing) {
        await api.put(`/scheduled/${existing.id}`, payload);
        notify("Scheduled message updated");
      } else {
        await api.post("/scheduled", payload);
        notify("Message scheduled");
      }
      onSaved();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not schedule message", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={existing ? "Edit scheduled message" : "Schedule message"} onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Group">
            <Select required value={groupId} onChange={(e) => setGroupId(e.target.value)}>
              <option value="" disabled>
                Select a group…
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Send at">
            <Input
              required
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </Field>
        </div>

        {templates.length > 0 && (
          <Field label="Start from a template (optional)">
            <Select defaultValue="" onChange={(e) => applyTemplate(e.target.value)}>
              <option value="">None</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Text">
            <Textarea required rows={4} value={text} onChange={(e) => setText(e.target.value)} />
          </Field>
          <Field label="Parse mode">
            <Select value={parseMode} onChange={(e) => setParseMode(e.target.value)}>
              <option value="HTML">HTML</option>
              <option value="Markdown">Markdown</option>
              <option value="MarkdownV2">MarkdownV2</option>
            </Select>
          </Field>
        </div>

        <ButtonsEditor buttons={buttons} onChange={setButtons} />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : existing ? "Save changes" : "Schedule"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
