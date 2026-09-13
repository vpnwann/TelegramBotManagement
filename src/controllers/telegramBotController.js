
import { query } from "../config/db.js";
import * as telegramService from "../services/telegramService.js";

// Never expose the full bot token in API responses.
function maskBot(bot) {
  if (!bot) return null;

  const { bot_token, ...rest } = bot;

  return {
    ...rest,
    bot_token_preview: bot_token
      ? `${bot_token.slice(0, 6)}...${bot_token.slice(-4)}`
      : null,
  };
}

// Safely extract an error message.
// Prevents {"error": ""} when the thrown value is unusual/empty.
function getErrorMessage(err, fallback = "Unknown error") {
  if (!err) return fallback;

  if (err.telegram?.description) {
    return err.telegram.description;
  }

  if (err.message) {
    return err.message;
  }

  if (typeof err === "string") {
    return err;
  }

  try {
    const serialized = JSON.stringify(err);
    return serialized && serialized !== "{}" ? serialized : fallback;
  } catch {
    return fallback;
  }
}

// POST /api/telegram
export async function createBot(req, res) {
  try {
    const { botToken } = req.body || {};

    if (!botToken) {
      return res.fail("botToken is required", 422);
    }

    // Validate token against Telegram before saving.
    const me = await telegramService.getMe(botToken);

    if (!me?.id) {
      return res.fail("Telegram returned an invalid bot response", 422);
    }

    const result = await query(
      `INSERT INTO telegram_bots
        (bot_token, bot_id, username, first_name, status)
       VALUES ($1, $2, $3, $4, 'active')
       RETURNING *`,
      [botToken, me.id, me.username, me.first_name]
    );

    return res.success(maskBot(result.rows[0]), 201);
  } catch (err) {
    console.error("POST /api/telegram error:", err);

    return res.fail(getErrorMessage(err, "Failed to create Telegram bot"), 422);
  }
}

// GET /api/telegram
export async function listBots(req, res) {
  try {
    const result = await query(
      `SELECT *
       FROM telegram_bots
       ORDER BY created_at DESC`
    );

    return res.success(result.rows.map(maskBot));
  } catch (err) {
    console.error("GET /api/telegram error:", err);

    return res.fail(
      getErrorMessage(err, "Failed to load Telegram bots"),
      500
    );
  }
}

// PUT /api/telegram/:id
export async function updateBot(req, res) {
  try {
    const { id } = req.params;
    const { botToken, status } = req.body || {};

    const existing = await query(
      `SELECT *
       FROM telegram_bots
       WHERE id = $1`,
      [id]
    );

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

      if (!me?.id) {
        return res.fail("Telegram returned an invalid bot response", 422);
      }

      botId = me.id;
      username = me.username;
      firstName = me.first_name;
      tokenToSave = botToken;
    }

    const result = await query(
      `UPDATE telegram_bots
       SET bot_token = $1,
           bot_id = $2,
           username = $3,
           first_name = $4,
           status = COALESCE($5, status),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [tokenToSave, botId, username, firstName, status, id]
    );

    return res.success(maskBot(result.rows[0]));
  } catch (err) {
    console.error("PUT /api/telegram/:id error:", err);

    return res.fail(
      getErrorMessage(err, "Failed to update Telegram bot"),
      422
    );
  }
}

// DELETE /api/telegram/:id
export async function deleteBot(req, res) {
  try {
    const { id } = req.params;

    const result = await query(
      `DELETE FROM telegram_bots
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.fail("Bot not found", 404);
    }

    return res.success({
      id: result.rows[0].id,
      deleted: true,
    });
  } catch (err) {
    console.error("DELETE /api/telegram/:id error:", err);

    return res.fail(
      getErrorMessage(err, "Failed to delete Telegram bot"),
      500
    );
  }
}

// GET /api/telegram/status
export async function getBotStatus(req, res) {
  try {
    console.log("GET /api/telegram/status: querying active bot");

    const result = await query(
      `SELECT *
       FROM telegram_bots
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`
    );

    console.log(
      "GET /api/telegram/status: database OK, rows:",
      result.rows.length
    );

    // No active bot configured.
    if (result.rows.length === 0) {
      return res.success({
        connected: false,
        bot: null,
        error: "No active Telegram bot configured",
      });
    }

    const bot = result.rows[0];

    // Check Telegram separately.
    try {
      console.log(
        "GET /api/telegram/status: checking Telegram bot:",
        bot.username
      );

      const me = await telegramService.getMe(bot.bot_token);

      console.log("GET /api/telegram/status: Telegram OK");

      return res.success({
        connected: true,
        bot: maskBot(bot),
        live: me,
      });
    } catch (err) {
      // Telegram being unavailable should NOT make the API itself fail.
      console.error(
        "GET /api/telegram/status: Telegram check failed:",
        err
      );

      return res.success({
        connected: false,
        bot: maskBot(bot),
        error: getErrorMessage(
          err,
          "Unable to connect to Telegram"
        ),
      });
    }
  } catch (err) {
    // Database/application error.
    console.error("GET /api/telegram/status: DATABASE ERROR");
    console.error("Error:", err);
    console.error("Stack:", err?.stack);

    return res.fail(
      getErrorMessage(err, "Failed to retrieve Telegram bot status"),
      500
    );
  }
}

/**
 * Shared helper used by other controllers
 * (groups, messages, scheduler) to fetch
 * the currently active bot's raw token.
 */
export async function getActiveBotToken() {
  try {
    const result = await query(
      `SELECT bot_token
       FROM telegram_bots
       WHERE status = 'active'
       ORDER BY created_at DESC
       LIMIT 1`
    );

    if (result.rows.length === 0) {
      const error = new Error(
        "No active Telegram bot configured. Add one via POST /api/telegram"
      );

      error.statusCode = 422;
      throw error;
    }

    return result.rows[0].bot_token;
  } catch (err) {
    console.error("getActiveBotToken error:", err);
    throw err;
  }
}

export default {
  createBot,
  listBots,
  updateBot,
  deleteBot,
  getBotStatus,
  getActiveBotToken,
};


