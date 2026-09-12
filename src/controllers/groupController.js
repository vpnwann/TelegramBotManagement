import { query } from "../config/db.js";
import * as telegramService from "../services/telegramService.js";
import { getActiveBotToken } from "./telegramBotController.js";

// GET /api/groups?page=1&limit=20&search=marketing&status=active
export async function listGroups(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { search, status } = req.query;

    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(name ILIKE $${params.length} OR username ILIKE $${params.length})`);
    }

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM groups ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await query(
      `SELECT * FROM groups ${whereClause}
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

// POST /api/groups
export async function createGroup(req, res) {
  try {
    const { chatId, name, type, username, status } = req.body;

    if (!chatId || !name) {
      return res.fail("chatId and name are required", 422);
    }

    const result = await query(
      `INSERT INTO groups (chat_id, name, type, username, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'active'))
       RETURNING *`,
      [chatId, name, type || "group", username || null, status]
    );

    return res.success(result.rows[0], 201);
  } catch (err) {
    if (err.code === "23505") {
      return res.fail("A group with this chatId already exists", 409);
    }
    return res.fail(err.message, 500);
  }
}

// GET /api/groups/:id
export async function getGroup(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM groups WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.fail("Group not found", 404);
    }

    return res.success(result.rows[0]);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// PUT /api/groups/:id
export async function updateGroup(req, res) {
  try {
    const { id } = req.params;
    const { chatId, name, type, username, status } = req.body;

    const existing = await query(`SELECT * FROM groups WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.fail("Group not found", 404);
    }

    const current = existing.rows[0];

    const result = await query(
      `UPDATE groups
       SET chat_id = $1, name = $2, type = $3, username = $4, status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        chatId ?? current.chat_id,
        name ?? current.name,
        type ?? current.type,
        username ?? current.username,
        status ?? current.status,
        id,
      ]
    );

    return res.success(result.rows[0]);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// DELETE /api/groups/:id
export async function deleteGroup(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM groups WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.fail("Group not found", 404);
    }

    return res.success({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// POST /api/groups/:id/test
export async function testGroupConnection(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM groups WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.fail("Group not found", 404);
    }

    const group = result.rows[0];
    const botToken = await getActiveBotToken();

    const sent = await telegramService.sendMessage(
      botToken,
      group.chat_id,
      "Telegram bot connection is working!"
    );

    return res.success({ ok: true, telegramMessageId: sent.message_id });
  } catch (err) {
    return res.fail(err.telegram?.description || err.message, 422);
  }
}

// GET /api/groups/telegram/chats
// Returns the groups already stored locally that Telegram knows about,
// re-validating each chat via getChat using the active bot.
export async function listTelegramChats(req, res) {
  try {
    const botToken = await getActiveBotToken();
    const result = await query(`SELECT * FROM groups ORDER BY created_at DESC`);

    const chats = await Promise.all(
      result.rows.map(async (group) => {
        try {
          const chat = await telegramService.getChat(botToken, group.chat_id);
          return { ...group, telegram: chat, reachable: true };
        } catch (err) {
          return {
            ...group,
            telegram: null,
            reachable: false,
            error: err.telegram?.description || err.message,
          };
        }
      })
    );

    return res.success(chats);
  } catch (err) {
    return res.fail(err.telegram?.description || err.message, 422);
  }
}

export default {
  listGroups,
  createGroup,
  getGroup,
  updateGroup,
  deleteGroup,
  testGroupConnection,
  listTelegramChats,
};
