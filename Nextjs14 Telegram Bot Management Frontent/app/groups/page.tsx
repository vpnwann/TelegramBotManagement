"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, buildQuery, normalizeList } from "@/lib/api";
import {
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  StatusBadge,
} from "@/components/ui";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { useToast } from "@/components/Toast";
import type { Group } from "@/lib/types";
import { Plug, Plus, Search, Trash2 } from "lucide-react";

export default function GroupsPage() {
  const { notify } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const qs = buildQuery({ page, limit: 20, search, status });
      const data = await api.get(`/groups${qs}`);
      const { items, totalPages: tp } = normalizeList<Group>(data as never);
      setGroups(items);
      setTotalPages(tp);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Failed to load groups", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    load();
  }, [page, status]);

  function onSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load();
  }

  async function testConnection(group: Group) {
    setTestingId(group.id);
    try {
      await api.post(`/groups/${group.id}/test`);
      notify(`Test message sent to ${group.name}`);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Test failed", "error");
    } finally {
      setTestingId(null);
    }
  }

  async function removeGroup(group: Group) {
    if (!confirm(`Delete group "${group.name}"?`)) return;
    try {
      await api.del(`/groups/${group.id}`);
      notify("Group deleted");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not delete group", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Groups"
        description="Telegram groups, supergroups and channels the bot can post to."
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Add group
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <form onSubmit={onSearchSubmit} className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <Input
              placeholder="Search groups…"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </form>
        <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-ink-muted">Loading…</div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="No groups found"
            hint="Add a Telegram group, supergroup or channel by its chat ID."
            action={
              <Button className="mt-2" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Add group
              </Button>
            }
          />
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-ink-muted">
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Chat ID</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-3">
                    <Link href={`/groups/${g.id}`} className="font-medium text-ink hover:text-accent">
                      {g.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{g.chat_id}</td>
                  <td className="px-4 py-3 capitalize text-ink-muted">{g.type}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={g.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={testingId === g.id}
                        onClick={() => testConnection(g)}
                      >
                        <Plug size={13} /> {testingId === g.id ? "Testing…" : "Test"}
                      </Button>
                      <Button variant="danger" size="sm" onClick={() => removeGroup(g)}>
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </Card>

      {showCreate && (
        <CreateGroupModal
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

interface TelegramChat {
  chat_id: string;
  name: string;
  type: string;
}

function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { notify } = useToast();
  const [chatId, setChatId] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("supergroup");
  const [saving, setSaving] = useState(false);
  const [chats, setChats] = useState<TelegramChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);

  async function loadChats() {
    setLoadingChats(true);
    try {
      const data = await api.get<TelegramChat[] | { items: TelegramChat[] }>("/groups/telegram/chats");
      setChats(Array.isArray(data) ? data : data.items || []);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not fetch chats from Telegram", "error");
    } finally {
      setLoadingChats(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/groups", { chatId, name, type });
      notify("Group added");
      onCreated();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not add group", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add group" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-muted">Know the chat ID? Enter it below.</span>
          <Button type="button" variant="ghost" size="sm" onClick={loadChats} disabled={loadingChats}>
            {loadingChats ? "Fetching…" : "Fetch from Telegram"}
          </Button>
        </div>
        {chats.length > 0 && (
          <Select
            onChange={(e) => {
              const chat = chats.find((c) => c.chat_id === e.target.value);
              if (chat) {
                setChatId(chat.chat_id);
                setName(chat.name);
                setType(chat.type);
              }
            }}
            defaultValue=""
          >
            <option value="" disabled>
              Select a chat the bot is in…
            </option>
            {chats.map((c) => (
              <option key={c.chat_id} value={c.chat_id}>
                {c.name} ({c.chat_id})
              </option>
            ))}
          </Select>
        )}
        <Field label="Chat ID">
          <Input
            required
            autoFocus
            placeholder="-100123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
          />
        </Field>
        <Field label="Name">
          <Input required placeholder="Marketing Group" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="group">Group</option>
            <option value="supergroup">Supergroup</option>
            <option value="channel">Channel</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add group"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
