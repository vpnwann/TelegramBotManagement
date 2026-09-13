"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, PageHeader, Select, StatusBadge, Textarea } from "@/components/ui";
import { ButtonsEditor } from "@/components/ButtonsEditor";
import { useToast } from "@/components/Toast";
import type { Button as InlineButton, Message } from "@/lib/types";
import { ArrowLeft, ImageIcon, Paperclip, RotateCcw, Send } from "lucide-react";

export default function MessageDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { notify } = useToast();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");

  async function load() {
    try {
      const data = await api.get<Message>(`/messages/${id}`);
      setMessage(data);
      setCaption(data.text?.replace(/<[^>]+>/g, "") || "");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Message not found", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    load();
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!message) return;
    setSaving(true);
    try {
      await api.put(`/messages/${id}`, {
        text: message.text,
        parseMode: message.parse_mode,
        buttons: (message.buttons || []).filter((b) => b.text && b.url),
      });
      notify("Message updated");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not update message", "error");
    } finally {
      setSaving(false);
    }
  }

  async function action(name: string, path: string) {
    setBusy(name);
    try {
      await api.post(`/messages/${id}${path}`);
      notify(name === "send" ? "Message sent" : "Message resent");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : `Could not ${name}`, "error");
    } finally {
      setBusy(null);
    }
  }

  async function uploadFile(kind: "photo" | "document", file: File) {
    setBusy(kind);
    try {
      const fd = new FormData();
      fd.append(kind, file);
      if (kind === "photo" && caption) fd.append("caption", caption);
      await api.post(`/messages/${id}/send-${kind}`, fd);
      notify(`${kind === "photo" ? "Photo" : "Document"} sent`);
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : `Could not send ${kind}`, "error");
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;
  if (!message) return <div className="text-sm text-ink-muted">Message not found.</div>;

  return (
    <div className="max-w-lg">
      <Link href="/messages" className="mb-4 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to messages
      </Link>
      <PageHeader
        title={`Message #${message.id}`}
        description={message.group_name || `Group #${message.group_id}`}
        action={<StatusBadge status={message.status} />}
      />

      {message.error_message && (
        <Card className="mb-4 border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {message.error_message}
        </Card>
      )}

      <Card className="p-5">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Text">
              <Textarea
                rows={4}
                value={message.text}
                onChange={(e) => setMessage({ ...message, text: e.target.value })}
              />
            </Field>
            <Field label="Parse mode">
              <Select
                value={message.parse_mode || "HTML"}
                onChange={(e) => setMessage({ ...message, parse_mode: e.target.value as Message["parse_mode"] })}
              >
                <option value="HTML">HTML</option>
                <option value="Markdown">Markdown</option>
                <option value="MarkdownV2">MarkdownV2</option>
              </Select>
            </Field>
          </div>
          <ButtonsEditor
            buttons={message.buttons || []}
            onChange={(buttons: InlineButton[]) => setMessage({ ...message, buttons })}
          />
          <div className="flex justify-end pt-1">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-ink">Delivery</h3>
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy === "send"} onClick={() => action("send", "/send")}>
            <Send size={14} /> {busy === "send" ? "Sending…" : "Send"}
          </Button>
          <Button
            variant="secondary"
            disabled={busy === "resend"}
            onClick={() => action("resend", "/resend")}
          >
            <RotateCcw size={14} /> {busy === "resend" ? "Resending…" : "Resend"}
          </Button>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="mb-1 text-sm font-semibold text-ink">Attach media</h3>
        <p className="mb-3 text-xs text-ink-muted">
          Sends a new photo or document to this message&apos;s group right away.
        </p>
        <div className="mb-3">
          <Field label="Photo caption (optional)">
            <Textarea rows={2} value={caption} onChange={(e) => setCaption(e.target.value)} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={photoInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadFile("photo", e.target.files[0])}
          />
          <Button variant="secondary" disabled={busy === "photo"} onClick={() => photoInput.current?.click()}>
            <ImageIcon size={14} /> {busy === "photo" ? "Uploading…" : "Send photo"}
          </Button>
          <input
            ref={docInput}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadFile("document", e.target.files[0])}
          />
          <Button variant="secondary" disabled={busy === "document"} onClick={() => docInput.current?.click()}>
            <Paperclip size={14} /> {busy === "document" ? "Uploading…" : "Send document"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
