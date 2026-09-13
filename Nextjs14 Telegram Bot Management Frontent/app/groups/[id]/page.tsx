"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { useToast } from "@/components/Toast";
import type { Group } from "@/lib/types";
import { ArrowLeft, Plug } from "lucide-react";
import Link from "next/link";

export default function GroupDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { notify } = useToast();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    api
      .get<Group>(`/groups/${id}`)
      .then(setGroup)
      .catch((e) => notify(e instanceof ApiError ? e.message : "Group not found", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!group) return;
    setSaving(true);
    try {
      await api.put(`/groups/${id}`, {
        chatId: group.chat_id,
        name: group.name,
        type: group.type,
        status: group.status,
      });
      notify("Group updated");
      router.push("/groups");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not update group", "error");
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      await api.post(`/groups/${id}/test`);
      notify("Test message sent");
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Test failed", "error");
    } finally {
      setTesting(false);
    }
  }

  if (loading) return <div className="text-sm text-ink-muted">Loading…</div>;
  if (!group) return <div className="text-sm text-ink-muted">Group not found.</div>;

  return (
    <div className="max-w-lg">
      <Link href="/groups" className="mb-4 inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink">
        <ArrowLeft size={13} /> Back to groups
      </Link>
      <PageHeader title={group.name} description={`Chat ID ${group.chat_id}`} />

      <Card className="p-5">
        <form onSubmit={save} className="space-y-4">
          <Field label="Chat ID">
            <Input value={group.chat_id} onChange={(e) => setGroup({ ...group, chat_id: e.target.value })} />
          </Field>
          <Field label="Name">
            <Input value={group.name} onChange={(e) => setGroup({ ...group, name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <Select value={group.type} onChange={(e) => setGroup({ ...group, type: e.target.value })}>
                <option value="group">Group</option>
                <option value="supergroup">Supergroup</option>
                <option value="channel">Channel</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={group.status} onChange={(e) => setGroup({ ...group, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
          </div>
          <div className="flex justify-between pt-2">
            <Button type="button" variant="secondary" onClick={testConnection} disabled={testing}>
              <Plug size={14} /> {testing ? "Testing…" : "Test connection"}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
