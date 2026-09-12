import { query, pool } from "../config/db.js";
import * as telegramService from "../services/telegramService.js";
import { getActiveBotToken } from "./telegramBotController.js";

async function attachButtons(messageId, message) {
  const buttonsResult = await query(
    `SELECT id, button_text, button_url, sort_order
     FROM message_buttons
     WHERE message_id = $1
     ORDER BY sort_order ASC`,
    [messageId]
  );
  return { ...message, buttons: buttonsResult.rows };
}

// GET /api/messages?page=1&limit=20&status=sent&groupId=1
export async function listMessages(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { status, groupId } = req.query;

    const conditions = [];
    const params = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    if (groupId) {
      params.push(groupId);
      conditions.push(`group_id = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM messages ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await query(
      `SELECT * FROM messages ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.success({
      items: dataResult.rows,
      pagination: {
        page,
        limit,
        total: countResult.rows[0].total,
        totalPages: Math.ceil(countResult.rows[0].total / limit),
      },
    });
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// POST /api/messages
export async function createMessage(req, res) {
  const client = await pool.connect();
  try {
    const { groupId, text, parseMode, buttons } = req.body;

    if (!groupId || !text) {
      return res.fail("groupId and text are required", 422);
    }

    await client.query("BEGIN");

    const messageResult = await client.query(
      `INSERT INTO messages (group_id, text, parse_mode, status)
       VALUES ($1, $2, COALESCE($3, 'HTML'), 'draft')
       RETURNING *`,
      [groupId, text, parseMode]
    );

    const message = messageResult.rows[0];

    if (Array.isArray(buttons) && buttons.length > 0) {
      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        await client.query(
          `INSERT INTO message_buttons (message_id, button_text, button_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [message.id, b.text ?? b.button_text, b.url ?? b.button_url, i]
        );
      }
    }

    await client.query("COMMIT");

    const fullMessage = await attachButtons(message.id, message);
    return res.success(fullMessage, 201);
  } catch (err) {
    await client.query("ROLLBACK");
    return res.fail(err.message, 500);
  } finally {
    client.release();
  }
}

// GET /api/messages/:id
export async function getMessage(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM messages WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.fail("Message not found", 404);
    }

    const fullMessage = await attachButtons(id, result.rows[0]);
    return res.success(fullMessage);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// PUT /api/messages/:id
export async function updateMessage(req, res) {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { groupId, text, parseMode, buttons } = req.body;

    const existing = await client.query(`SELECT * FROM messages WHERE id = $1`, [
      id,
    ]);

    if (existing.rows.length === 0) {
      return res.fail("Message not found", 404);
    }

    const current = existing.rows[0];

    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE messages
       SET group_id = $1, text = $2, parse_mode = $3
       WHERE id = $4
       RETURNING *`,
      [
        groupId ?? current.group_id,
        text ?? current.text,
        parseMode ?? current.parse_mode,
        id,
      ]
    );

    if (Array.isArray(buttons)) {
      await client.query(`DELETE FROM message_buttons WHERE message_id = $1`, [
        id,
      ]);

      for (let i = 0; i < buttons.length; i++) {
        const b = buttons[i];
        await client.query(
          `INSERT INTO message_buttons (message_id, button_text, button_url, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [id, b.text ?? b.button_text, b.url ?? b.button_url, i]
        );
      }
    }

    await client.query("COMMIT");

    const fullMessage = await attachButtons(id, result.rows[0]);
    return res.success(fullMessage);
  } catch (err) {
    await client.query("ROLLBACK");
    return res.fail(err.message, 500);
  } finally {
    client.release();
  }
}

// DELETE /api/messages/:id
export async function deleteMessage(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM messages WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.fail("Message not found", 404);
    }

    return res.success({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

async function getGroupChatId(groupId) {
  const groupResult = await query(`SELECT * FROM groups WHERE id = $1`, [
    groupId,
  ]);
  if (groupResult.rows.length === 0) {
    const error = new Error("Group not found for this message");
    error.statusCode = 404;
    throw error;
  }
  return groupResult.rows[0].chat_id;
}

async function getMessageButtons(messageId) {
  const result = await query(
    `SELECT button_text, button_url, sort_order FROM message_buttons
     WHERE message_id = $1 ORDER BY sort_order ASC`,
    [messageId]
  );
  return result.rows;
}

async function markMessageSending(id) {
  await query(`UPDATE messages SET status = 'sending' WHERE id = $1`, [id]);
}

async function markMessageSent(id, telegramMessageId) {
  const result = await query(
    `UPDATE messages
     SET status = 'sent', telegram_message_id = $1, sent_at = NOW(), error_message = NULL
     WHERE id = $2
     RETURNING *`,
    [telegramMessageId, id]
  );
  return result.rows[0];
}

async function markMessageFailed(id, errorMessage) {
  const result = await query(
    `UPDATE messages SET status = 'failed', error_message = $1 WHERE id = $2 RETURNING *`,
    [errorMessage, id]
  );
  return result.rows[0];
}

// POST /api/messages/:id/send
export async function sendMessage(req, res) {
  try {
    const { id } = req.params;
    const messageResult = await query(`SELECT * FROM messages WHERE id = $1`, [
      id,
    ]);

    if (messageResult.rows.length === 0) {
      return res.fail("Message not found", 404);
    }

    const message = messageResult.rows[0];
    const chatId = await getGroupChatId(message.group_id);
    const buttons = await getMessageButtons(id);
    const botToken = await getActiveBotToken();

    await markMessageSending(id);

    try {
      const sent = await telegramService.sendMessage(botToken, chatId, message.text, {
        parseMode: message.parse_mode,
        buttons,
      });
      const updated = await markMessageSent(id, sent.message_id);
      return res.success(await attachButtons(id, updated));
    } catch (err) {
      const updated = await markMessageFailed(
        id,
        err.telegram?.description || err.message
      );
      return res.fail(updated.error_message, 422);
    }
  } catch (err) {
    return res.fail(err.message, err.statusCode || 500);
  }
}

// POST /api/messages/:id/resend
export async function resendMessage(req, res) {
  // Resend behaves the same as send, but is explicitly meant for
  // previously failed/sent messages.
  return sendMessage(req, res);
}

// POST /api/messages/:id/send-photo  (multipart/form-data, field name: "photo")
export async function sendPhotoMessage(req, res) {
  try {
    const { id } = req.params;
    const { caption, parseMode } = req.body;

    if (!req.file) {
      return res.fail("photo file is required (multipart/form-data field 'photo')", 422);
    }

    const messageResult = await query(`SELECT * FROM messages WHERE id = $1`, [
      id,
    ]);

    if (messageResult.rows.length === 0) {
      return res.fail("Message not found", 404);
    }

    const message = messageResult.rows[0];
    const chatId = await getGroupChatId(message.group_id);
    const buttons = await getMessageButtons(id);
    const botToken = await getActiveBotToken();

    await markMessageSending(id);
    await query(
      `UPDATE messages SET media_type = 'photo', media_url = $1 WHERE id = $2`,
      [req.file.path, id]
    );

    try {
      const sent = await telegramService.sendPhoto(botToken, chatId, req.file.path, {
        caption: caption ?? message.text,
        parseMode: parseMode ?? message.parse_mode,
        buttons,
      });
      const updated = await markMessageSent(id, sent.message_id);
      return res.success(await attachButtons(id, updated));
    } catch (err) {
      const updated = await markMessageFailed(
        id,
        err.telegram?.description || err.message
      );
      return res.fail(updated.error_message, 422);
    }
  } catch (err) {
    return res.fail(err.message, err.statusCode || 500);
  }
}

// POST /api/messages/:id/send-document  (multipart/form-data, field name: "document")
export async function sendDocumentMessage(req, res) {
  try {
    const { id } = req.params;
    const { caption, parseMode } = req.body;

    if (!req.file) {
      return res.fail(
        "document file is required (multipart/form-data field 'document')",
        422
      );
    }

    const messageResult = await query(`SELECT * FROM messages WHERE id = $1`, [
      id,
    ]);

    if (messageResult.rows.length === 0) {
      return res.fail("Message not found", 404);
    }

    const message = messageResult.rows[0];
    const chatId = await getGroupChatId(message.group_id);
    const buttons = await getMessageButtons(id);
    const botToken = await getActiveBotToken();

    await markMessageSending(id);
    await query(
      `UPDATE messages SET media_type = 'document', media_url = $1 WHERE id = $2`,
      [req.file.path, id]
    );

    try {
      const sent = await telegramService.sendDocument(botToken, chatId, req.file.path, {
        caption: caption ?? message.text,
        parseMode: parseMode ?? message.parse_mode,
        buttons,
      });
      const updated = await markMessageSent(id, sent.message_id);
      return res.success(await attachButtons(id, updated));
    } catch (err) {
      const updated = await markMessageFailed(
        id,
        err.telegram?.description || err.message
      );
      return res.fail(updated.error_message, 422);
    }
  } catch (err) {
    return res.fail(err.message, err.statusCode || 500);
  }
}

export default {
  listMessages,
  createMessage,
  getMessage,
  updateMessage,
  deleteMessage,
  sendMessage,
  resendMessage,
  sendPhotoMessage,
  sendDocumentMessage,
};
