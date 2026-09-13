"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Card, EmptyState, PageHeader, StatNumber, StatusBadge } from "@/components/ui";
import type { DashboardStats, Message, ScheduledMessage } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { ArrowUpRight } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentMessages, setRecentMessages] = useState<Message[]>([]);
  const [recentScheduled, setRecentScheduled] = useState<ScheduledMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [statsData, messagesData, scheduledData] = await Promise.all([
        api.get<DashboardStats>("/admin/dashboard"),
        api.get<Message[] | { items: Message[] }>("/admin/recent-messages"),
        api.get<ScheduledMessage[] | { items: ScheduledMessage[] }>("/admin/recent-scheduled"),
      ]);
      setStats(statsData);
      setRecentMessages(Array.isArray(messagesData) ? messagesData : messagesData.items || []);
      setRecentScheduled(Array.isArray(scheduledData) ? scheduledData : scheduledData.items || []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    load();
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your bot, groups and message activity."
      />

      {error && (
        <Card className="mb-6 border-danger/30 bg-danger-soft p-4 text-sm text-danger">
          {error} — check <code className="font-mono">NEXT_PUBLIC_API_URL</code> and that the
          backend is running.
        </Card>
      )}

      {!error && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatNumber label="Groups" value={stats?.total_groups ?? (loading ? "—" : 0)} />
          <StatNumber label="Active groups" value={stats?.active_groups ?? (loading ? "—" : 0)} />
          <StatNumber label="Messages" value={stats?.total_messages ?? (loading ? "—" : 0)} />
          <StatNumber label="Sent" value={stats?.messages_sent ?? (loading ? "—" : 0)} />
          <StatNumber label="Templates" value={stats?.total_templates ?? (loading ? "—" : 0)} />
          <StatNumber label="Scheduled" value={stats?.scheduled_pending ?? (loading ? "—" : 0)} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Recent messages</h2>
            <Link href="/messages" className="flex items-center gap-1 text-xs text-accent hover:text-accent-deep">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          {recentMessages.length === 0 ? (
            <EmptyState title="No messages yet" hint="Messages you send will show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {recentMessages.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{stripHtml(m.text)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {m.group_name || `Group #${m.group_id}`} ·{" "}
                      {timeAgo(m.created_at)}
                    </p>
                  </div>
                  <StatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">Upcoming scheduled</h2>
            <Link href="/scheduled" className="flex items-center gap-1 text-xs text-accent hover:text-accent-deep">
              View all <ArrowUpRight size={12} />
            </Link>
          </div>
          {recentScheduled.length === 0 ? (
            <EmptyState title="Nothing scheduled" hint="Scheduled messages will show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {recentScheduled.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{stripHtml(s.text)}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {s.group_name || `Group #${s.group_id}`} ·{" "}
                      {new Date(s.scheduled_at).toLocaleString()}
                    </p>
                  </div>
                  <StatusBadge status={s.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function stripHtml(text: string) {
  return text.replace(/<[^>]+>/g, "");
}

function timeAgo(date: string) {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return date;
  }
}
