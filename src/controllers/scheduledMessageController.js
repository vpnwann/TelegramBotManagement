import { query } from "../config/db.js";
import * as telegramService from "../services/telegramService.js";
import { getActiveBotToken } from "./telegramBotController.js";

// GET /api/scheduled?page=1&limit=20&status=scheduled
export async function listScheduled(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = (page - 1) * limit;
    const { status } = req.query;

    const params = [];
    let whereClause = "";

    if (status) {
      params.push(status);
      whereClause = `WHERE status = $1`;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM scheduled_messages ${whereClause}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await query(
      `SELECT * FROM scheduled_messages ${whereClause}
       ORDER BY scheduled_at ASC
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

// POST /api/scheduled
export async function createScheduled(req, res) {
  try {
    const { groupId, text, parseMode, scheduledAt } = req.body;

    if (!groupId || !text || !scheduledAt) {
      return res.fail("groupId, text and scheduledAt are required", 422);
    }

    const result = await query(
      `INSERT INTO scheduled_messages (group_id, text, parse_mode, scheduled_at, status)
       VALUES ($1, $2, COALESCE($3, 'HTML'), $4, 'scheduled')
       RETURNING *`,
      [groupId, text, parseMode, scheduledAt]
    );

    return res.success(result.rows[0], 201);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// GET /api/scheduled/:id
export async function getScheduled(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM scheduled_messages WHERE id = $1`, [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.fail("Scheduled message not found", 404);
    }

    return res.success(result.rows[0]);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// PUT /api/scheduled/:id
export async function updateScheduled(req, res) {
  try {
    const { id } = req.params;
    const { groupId, text, parseMode, scheduledAt } = req.body;

    const existing = await query(
      `SELECT * FROM scheduled_messages WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.fail("Scheduled message not found", 404);
    }

    const current = existing.rows[0];

    if (current.status !== "scheduled") {
      return res.fail(
        `Cannot edit a scheduled message with status '${current.status}'`,
        409
      );
    }

    const result = await query(
      `UPDATE scheduled_messages
       SET group_id = $1, text = $2, parse_mode = $3, scheduled_at = $4
       WHERE id = $5
       RETURNING *`,
      [
        groupId ?? current.group_id,
        text ?? current.text,
        parseMode ?? current.parse_mode,
        scheduledAt ?? current.scheduled_at,
        id,
      ]
    );

    return res.success(result.rows[0]);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// DELETE /api/scheduled/:id
export async function deleteScheduled(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM scheduled_messages WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.fail("Scheduled message not found", 404);
    }

    return res.success({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// POST /api/scheduled/:id/cancel
export async function cancelScheduled(req, res) {
  try {
    const { id } = req.params;
    const existing = await query(
      `SELECT * FROM scheduled_messages WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.fail("Scheduled message not found", 404);
    }

    if (existing.rows[0].status !== "scheduled") {
      return res.fail(
        `Cannot cancel a message with status '${existing.rows[0].status}'`,
        409
      );
    }

    const result = await query(
      `UPDATE scheduled_messages SET status = 'cancelled' WHERE id = $1 RETURNING *`,
      [id]
    );

    return res.success(result.rows[0]);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// POST /api/scheduled/:id/send-now
export async function sendNowScheduled(req, res) {
  try {
    const { id } = req.params;
    const existing = await query(
      `SELECT * FROM scheduled_messages WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.fail("Scheduled message not found", 404);
    }

    const scheduled = existing.rows[0];

    if (!["scheduled", "failed"].includes(scheduled.status)) {
      return res.fail(
        `Cannot send a message with status '${scheduled.status}'`,
        409
      );
    }

    const groupResult = await query(`SELECT * FROM groups WHERE id = $1`, [
      scheduled.group_id,
    ]);

    if (groupResult.rows.length === 0) {
      return res.fail("Group not found for this scheduled message", 404);
    }

    const botToken = await getActiveBotToken();

    await query(`UPDATE scheduled_messages SET status = 'sending' WHERE id = $1`, [
      id,
    ]);

    try {
      await telegramService.sendMessage(
        botToken,
        groupResult.rows[0].chat_id,
        scheduled.text,
        { parseMode: scheduled.parse_mode }
      );

      const updated = await query(
        `UPDATE scheduled_messages
         SET status = 'sent', sent_at = NOW(), error_message = NULL
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      return res.success(updated.rows[0]);
    } catch (err) {
      const failed = await query(
        `UPDATE scheduled_messages SET status = 'failed', error_message = $1 WHERE id = $2 RETURNING *`,
        [err.telegram?.description || err.message, id]
      );
      return res.fail(failed.rows[0].error_message, 422);
    }
  } catch (err) {
    return res.fail(err.message, err.statusCode || 500);
  }
}

export default {
  listScheduled,
  createScheduled,
  getScheduled,
  updateScheduled,
  deleteScheduled,
  cancelScheduled,
  sendNowScheduled,
};
