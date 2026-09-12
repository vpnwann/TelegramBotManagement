import { query } from "../config/db.js";
import * as telegramService from "../services/telegramService.js";

// Never expose the full bot token - mask it for API responses.
function maskBot(bot) {
  if (!bot) return bot;
  const { bot_token, ...rest } = bot;
  return {
    ...rest,
    bot_token_preview: bot_token
      ? `${bot_token.slice(0, 6)}...${bot_token.slice(-4)}`
      : null,
  };
}

// POST /api/telegram
export async function createBot(req, res) {
  try {
    const { botToken } = req.body;

    if (!botToken) {
      return res.fail("botToken is required", 422);
    }

    // Validate token against Telegram before saving.
    const me = await telegramService.getMe(botToken);

    const result = await query(
      `INSERT INTO telegram_bots (bot_token, bot_id, username, first_name, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [botToken, me.id, me.username, me.first_name]
    );

    return res.success(maskBot(result.rows[0]), 201);
  } catch (err) {
    return res.fail(err.telegram?.description || err.message, 422);
  }
}

// GET /api/telegram
export async function listBots(req, res) {
  try {
    const result = await query(
      `SELECT * FROM telegram_bots ORDER BY created_at DESC`
    );
    return res.success(result.rows.map(maskBot));
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// PUT /api/telegram/:id
export async function updateBot(req, res) {
  try {
    const { id } = req.params;
    const { botToken, status } = req.body;

    const existing = await query(`SELECT * FROM telegram_bots WHERE id = $1`, [
      id,
    ]);

    if (existing.rows.length === 0) {
      return res.fail("Bot not found", 404);
    }

    let botId = existing.rows[0].bot_id;
    let username = existing.rows[0].username;
    let firstName = existing.rows[0].first_name;
    let tokenToSave = existing.rows[0].bot_token;

    if (botToken) {
      // Re-validate new token before saving.
      const me = await telegramService.getMe(botToken);
      botId = me.id;
      username = me.username;
      firstName = me.first_name;
      tokenToSave = botToken;
    }

    const result = await query(
      `UPDATE telegram_bots
       SET bot_token = $1, bot_id = $2, username = $3, first_name = $4,
           status = COALESCE($5, status), updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [tokenToSave, botId, username, firstName, status, id]
    );

    return res.success(maskBot(result.rows[0]));
  } catch (err) {
    return res.fail(err.telegram?.description || err.message, 422);
  }
}

// DELETE /api/telegram/:id
export async function deleteBot(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM telegram_bots WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.fail("Bot not found", 404);
    }

    return res.success({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// GET /api/telegram/status
export async function getBotStatus(req, res) {
  try {
    const result = await query(
      `SELECT * FROM telegram_bots WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
    );

    if (result.rows.length === 0) {
      return res.success({ connected: false, bot: null });
    }

    const bot = result.rows[0];

    try {
      const me = await telegramService.getMe(bot.bot_token);
      return res.success({ connected: true, bot: maskBot(bot), live: me });
    } catch (err) {
      return res.success({
        connected: false,
        bot: maskBot(bot),
        error: err.telegram?.description || err.message,
      });
    }
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

/**
 * Shared helper used by other controllers (groups, messages, scheduler)
 * to fetch the currently active bot's raw token.
 * Throws if no active bot is configured.
 */
export async function getActiveBotToken() {
  const result = await query(
    `SELECT bot_token FROM telegram_bots WHERE status = 'active' ORDER BY created_at DESC LIMIT 1`
  );

  if (result.rows.length === 0) {
    const error = new Error(
      "No active Telegram bot configured. Add one via POST /api/telegram"
    );
    error.statusCode = 422;
    throw error;
  }

  return result.rows[0].bot_token;
}

export default {
  createBot,
  listBots,
  updateBot,
  deleteBot,
  getBotStatus,
  getActiveBotToken,
};
