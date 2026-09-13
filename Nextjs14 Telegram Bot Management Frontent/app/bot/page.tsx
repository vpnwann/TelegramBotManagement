"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { Button, Card, EmptyState, Field, Input, PageHeader, StatusBadge } from "@/components/ui";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import type { TelegramBot } from "@/lib/types";
import { Bot as BotIcon, Plus, Trash2 } from "lucide-react";

export default function BotPage() {
  const { notify } = useToast();
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await api.get<TelegramBot[] | { items: TelegramBot[] }>("/telegram");
      setBots(Array.isArray(data) ? data : data.items || []);
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Failed to load bots", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    load();
  }, []);

  async function registerBot(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/telegram", { botToken: token });
      notify("Bot registered");
      setShowCreate(false);
      setToken("");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not register bot", "error");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(bot: TelegramBot) {
    try {
      await api.put(`/telegram/${bot.id}`, { status: "active" });
      notify(`@${bot.bot_username || bot.id} is now active`);
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not update bot", "error");
    }
  }

  async function removeBot(bot: TelegramBot) {
    if (!confirm(`Remove bot ${bot.bot_username ? "@" + bot.bot_username : "#" + bot.id}?`)) return;
    try {
      await api.del(`/telegram/${bot.id}`);
      notify("Bot removed");
      load();
    } catch (e) {
      notify(e instanceof ApiError ? e.message : "Could not remove bot", "error");
    }
  }

  return (
    <div>
      <PageHeader
        title="Bot"
        description="Register the bot token used to send messages. Only one bot can be active at a time."
        action={
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={15} /> Register bot
          </Button>
        }
      />

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-ink-muted">Loading…</div>
        ) : bots.length === 0 ? (
          <EmptyState
            title="No bot registered"
            hint="Register a bot token from @BotFather to start sending messages."
            action={
              <Button className="mt-2" size="sm" onClick={() => setShowCreate(true)}>
                <Plus size={14} /> Register bot
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {bots.map((bot) => (
              <li key={bot.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded bg-accent-soft text-accent-deep">
                    <BotIcon size={16} />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-ink">
                      {bot.bot_name || bot.bot_username || `Bot #${bot.id}`}
                      {bot.bot_username && (
                        <span className="ml-1.5 font-mono text-xs text-ink-muted">
                          @{bot.bot_username}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 font-mono text-xs text-ink-muted">
                      {bot.bot_token_preview}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={bot.status} />
                  {bot.status !== "active" && (
                    <Button variant="secondary" size="sm" onClick={() => setActive(bot)}>
                      Set active
                    </Button>
                  )}
                  <Button variant="danger" size="sm" onClick={() => removeBot(bot)}>
                    <Trash2 size={13} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {showCreate && (
        <Modal title="Register bot" onClose={() => setShowCreate(false)}>
          <form onSubmit={registerBot} className="space-y-4">
            <Field label="Bot token">
              <Input
                required
                autoFocus
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </Field>
            <p className="text-xs text-ink-muted">
              Get a token from{" "}
              <span className="font-mono">@BotFather</span> on Telegram. The token is validated
              against the Telegram Bot API and only a masked preview is stored for display.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Registering…" : "Register"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
