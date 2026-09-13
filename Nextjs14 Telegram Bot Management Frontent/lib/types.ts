export interface TelegramBot {
  id: number;
  bot_token_preview: string;
  bot_username?: string | null;
  bot_name?: string | null;
  status: "active" | "inactive" | string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: number;
  chat_id: string;
  name: string;
  type: "group" | "supergroup" | "channel" | string;
  status: "active" | "inactive" | string;
  created_at: string;
  updated_at?: string;
}

export interface Button {
  text: string;
  url: string;
}

export interface Message {
  id: number;
  group_id: number;
  group_name?: string;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2" | null;
  buttons?: Button[] | null;
  media_url?: string | null;
  status: "draft" | "sent" | "failed" | string;
  telegram_message_id?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Template {
  id: number;
  name: string;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2" | null;
  buttons?: Button[] | null;
  created_at: string;
  updated_at?: string;
}

export interface ScheduledMessage {
  id: number;
  group_id: number;
  group_name?: string;
  text: string;
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2" | null;
  buttons?: Button[] | null;
  scheduled_at: string;
  status: "scheduled" | "sending" | "sent" | "failed" | "cancelled" | string;
  error_message?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface DashboardStats {
  total_groups?: number;
  active_groups?: number;
  total_messages?: number;
  messages_sent?: number;
  total_templates?: number;
  scheduled_pending?: number;
  bot_status?: string;
  [key: string]: unknown;
}

export interface Paginated<T> {
  items: T[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
