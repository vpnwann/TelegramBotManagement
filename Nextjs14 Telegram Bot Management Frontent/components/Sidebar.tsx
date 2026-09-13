"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  Users,
  MessageSquare,
  FileText,
  Clock,
  Circle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/bot", label: "Bot", icon: Bot },
  { href: "/groups", label: "Groups", icon: Users },
  { href: "/messages", label: "Messages", icon: MessageSquare },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/scheduled", label: "Scheduled", icon: Clock },
];

interface BotStatus {
  connected?: boolean;
  status?: string;
  bot_username?: string;
  bot_name?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await api.get<BotStatus>("/telegram/status");
        if (!cancelled) {
          setStatus(data);
          setErrored(false);
        }
      } catch {
        if (!cancelled) setErrored(true);
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const connected = status?.connected ?? status?.status === "active";

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-text">
      <div className="flex items-center gap-2.5 border-b border-sidebar-line px-5 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm font-bold text-white">
          T
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Telegram Admin</div>
          <div className="font-mono text-[10px] text-sidebar-text/70">bot control panel</div>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-2.5 py-4">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-white/[0.07] text-white"
                  : "text-sidebar-text hover:bg-white/[0.04] hover:text-white"
              )}
            >
              <Icon size={16} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-line px-4 py-3.5">
        <div className="flex items-center gap-2 text-xs">
          <Circle
            size={8}
            fill={errored ? "#c0392b" : connected ? "#1f9254" : "#9a6b00"}
            strokeWidth={0}
          />
          <span className="text-sidebar-text">
            {errored ? "API unreachable" : connected ? "Bot connected" : "No active bot"}
          </span>
        </div>
        {status?.bot_username && (
          <div className="mt-1 truncate font-mono text-[11px] text-sidebar-text/70">
            @{status.bot_username}
          </div>
        )}
      </div>
    </aside>
  );
}
