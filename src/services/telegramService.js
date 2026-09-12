import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const TELEGRAM_API_BASE = "https://api.telegram.org/bot";

/**
 * Build inline_keyboard structure from a flat array of buttons.
 * Each button is placed on its own row, ordered by sort_order.
 * @param {Array<{button_text?: string, text?: string, button_url?: string, url?: string, sort_order?: number}>} buttons
 */
export function buildInlineKeyboard(buttons = []) {
  if (!buttons || buttons.length === 0) return undefined;

  const sorted = [...buttons].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  return {
    inline_keyboard: sorted.map((b) => [
      {
        text: b.button_text ?? b.text,
        url: b.button_url ?? b.url,
      },
    ]),
  };
}

async function telegramRequest(botToken, method, body, isForm = false) {
  const url = `${TELEGRAM_API_BASE}${botToken}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: isForm ? undefined : { "Content-Type": "application/json" },
    body: isForm ? body : JSON.stringify(body),
  });

  const data = await response.json();

  if (!data.ok) {
    const error = new Error(data.description || "Telegram API error");
    error.telegram = data;
    throw error;
  }

  return data.result;
}

/**
 * Validate a bot token and fetch bot identity info.
 * @param {string} botToken
 */
export async function getMe(botToken) {
  const url = `${TELEGRAM_API_BASE}${botToken}/getMe`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.ok) {
    const error = new Error(data.description || "Invalid bot token");
    error.telegram = data;
    throw error;
  }

  return data.result; // { id, is_bot, first_name, username, ... }
}

/**
 * Send a text message.
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {string} text
 * @param {object} options - { parseMode, buttons }
 */
export async function sendMessage(botToken, chatId, text, options = {}) {
  const { parseMode, buttons } = options;

  const body = {
    chat_id: chatId,
    text,
  };

  if (parseMode && parseMode !== "plain") {
    body.parse_mode = parseMode;
  }

  const replyMarkup = buildInlineKeyboard(buttons);
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  return telegramRequest(botToken, "sendMessage", body);
}

/**
 * Send a photo (from a local file path).
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {string} filePath - path to file on disk
 * @param {object} options - { caption, parseMode, buttons }
 */
export async function sendPhoto(botToken, chatId, filePath, options = {}) {
  const { caption, parseMode, buttons } = options;

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("photo", fs.createReadStream(filePath));

  if (caption) form.append("caption", caption);
  if (parseMode && parseMode !== "plain") form.append("parse_mode", parseMode);

  const replyMarkup = buildInlineKeyboard(buttons);
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));

  return telegramRequest(botToken, "sendPhoto", form, true);
}

/**
 * Send a document (from a local file path).
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {string} filePath - path to file on disk
 * @param {object} options - { caption, parseMode, buttons }
 */
export async function sendDocument(botToken, chatId, filePath, options = {}) {
  const { caption, parseMode, buttons } = options;

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("document", fs.createReadStream(filePath));

  if (caption) form.append("caption", caption);
  if (parseMode && parseMode !== "plain") form.append("parse_mode", parseMode);

  const replyMarkup = buildInlineKeyboard(buttons);
  if (replyMarkup) form.append("reply_markup", JSON.stringify(replyMarkup));

  return telegramRequest(botToken, "sendDocument", form, true);
}

/**
 * Fetch basic chat info for a given chat id (used for the "test connection" flow
 * and for listing/validating chats the bot knows about).
 * @param {string} botToken
 * @param {string|number} chatId
 */
export async function getChat(botToken, chatId) {
  return telegramRequest(botToken, "getChat", { chat_id: chatId });
}

export default {
  getMe,
  sendMessage,
  sendPhoto,
  sendDocument,
  getChat,
  buildInlineKeyboard,
};
