import { query } from "../config/db.js";

// GET /api/admin/dashboard
export async function getDashboard(req, res) {
  try {
    const [
      groupsCount,
      sentCount,
      scheduledCount,
      failedCount,
      templatesCount,
    ] = await Promise.all([
      query(`SELECT COUNT(*)::int AS count FROM groups`),
      query(`SELECT COUNT(*)::int AS count FROM messages WHERE status = 'sent'`),
      query(
        `SELECT COUNT(*)::int AS count FROM scheduled_messages WHERE status = 'scheduled'`
      ),
      query(
        `SELECT
           (SELECT COUNT(*)::int FROM messages WHERE status = 'failed') +
           (SELECT COUNT(*)::int FROM scheduled_messages WHERE status = 'failed')
           AS count`
      ),
      query(`SELECT COUNT(*)::int AS count FROM templates`),
    ]);

    return res.success({
      groups: groupsCount.rows[0].count,
      sentMessages: sentCount.rows[0].count,
      scheduledMessages: scheduledCount.rows[0].count,
      failedMessages: failedCount.rows[0].count,
      templates: templatesCount.rows[0].count,
    });
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// GET /api/admin/recent-messages
export async function getRecentMessages(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const result = await query(
      `SELECT m.*, g.name AS group_name, g.chat_id
       FROM messages m
       LEFT JOIN groups g ON g.id = m.group_id
       ORDER BY m.created_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.success(result.rows);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// GET /api/admin/recent-scheduled
export async function getRecentScheduled(req, res) {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);

    const result = await query(
      `SELECT s.*, g.name AS group_name, g.chat_id
       FROM scheduled_messages s
       LEFT JOIN groups g ON g.id = s.group_id
       ORDER BY s.scheduled_at DESC
       LIMIT $1`,
      [limit]
    );

    return res.success(result.rows);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

export default {
  getDashboard,
  getRecentMessages,
  getRecentScheduled,
};
