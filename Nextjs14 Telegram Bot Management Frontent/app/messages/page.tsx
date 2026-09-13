"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, buildQuery, normalizeList } from "@/lib/api";
import { Button, Card, EmptyState, Field, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { ButtonsEditor } from "@/components/ButtonsEditor";
import { useToast } from "@/components/Toast";
import type { Button as InlineButton, Group, Message, Template } from "@/lib/types";
import { Plus, Send } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function MessagesPage() {
  const { notify } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState("");
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [sendingId, setSendingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = buildQuery({ page, limit: 20, status, groupId });
      const data = await api.get(`/messages${qs}`);
      const { items, totalPages: tp } = normalizeList<Message>(data as never);
      setMessages(items);
      setTotalPages(tp);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Failed to load messages", "error");
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
  }, [page, status, groupId]);

  async function sendNow(m: Message) {
    setSendingId(m.id);
    try {
      await api.post(`/messages/${m.id}/send`);
      notify("Message sent");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Send failed", "error");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Draft, send and track messages posted to your groups."
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New message
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select className="w-44" value={groupId} onChange={(e) => { setGroupId(e.target.value); setPage(1); }}>
          <option value="">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </Select>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-ink-muted">Loading…</div>
        ) : messages.length === 0 ? (
          <EmptyState
            title="No messages found"
            hint="Create a message and send it to one of your groups."
            action={
              <Button className="mt-2" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> New message
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {messages.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <Link href={`/messages/${m.id}`} className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink hover:text-accent">
                    {m.text.replace(/<[^>]+>/g, "") || "(empty message)"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {m.group_name || `Group #${m.group_id}`} ·{" "}
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <StatusBadge status={m.status} />
                  {m.status !== "sent" && (
                    <Button size="sm" disabled={sendingId === m.id} onClick={() => sendNow(m)}>
                      <Send size={13} /> {sendingId === m.id ? "Sending…" : "Send"}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      {showCreate && (
        <CreateMessageModal
          groups={groups}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function CreateMessageModal({
  groups,
  onClose,
  onCreated,
}: {
  groups: Group[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const { notify } = useToast();
  const [groupId, setGroupId] = useState(groups[0]?.id ? String(groups[0].id) : "");
  const [text, setText] = useState("");
  const [parseMode, setParseMode] = useState("HTML");
  const [buttons, setButtons] = useState<InlineButton[]>([]);
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
      await api.post("/messages", {
        groupId: Number(groupId),
        text,
        parseMode,
        buttons: buttons.filter((b) => b.text && b.url),
      });
      notify("Message created");
      onCreated();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not create message", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="New message" onClose={onClose} width="max-w-lg">
      <form onSubmit={submit} className="space-y-4">
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
            {saving ? "Creating…" : "Create message"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
