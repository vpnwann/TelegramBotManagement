import cron from "node-cron";
import { query } from "../config/db.js";
import * as telegramService from "../services/telegramService.js";
import { getActiveBotToken } from "../controllers/telegramBotController.js";

/**
 * Finds scheduled_messages that are due (scheduled_at <= now, status = 'scheduled')
 * and sends them via the Telegram service, updating their status along the way:
 *   scheduled -> sending -> sent
 *   scheduled -> sending -> failed (on Telegram error, with error stored)
 */
async function processDueMessages() {
  let dueMessages;

  try {
    const result = await query(
      `SELECT * FROM scheduled_messages
       WHERE status = 'scheduled' AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC`
    );
    dueMessages = result.rows;
  } catch (err) {
    console.error("[scheduler] Failed to fetch due messages:", err.message);
    return;
  }

  if (dueMessages.length === 0) return;

  console.log(`[scheduler] Found ${dueMessages.length} due message(s) to send.`);

  let botToken;
  try {
    botToken = await getActiveBotToken();
  } catch (err) {
    console.error("[scheduler] No active bot configured, skipping run:", err.message);
    return;
  }

  for (const scheduled of dueMessages) {
    try {
      // Claim the message first so concurrent runs / restarts don't double-send.
      const claim = await query(
        `UPDATE scheduled_messages
         SET status = 'sending'
         WHERE id = $1 AND status = 'scheduled'
         RETURNING *`,
        [scheduled.id]
      );

      if (claim.rows.length === 0) {
        // Already claimed by another run.
        continue;
      }

      const groupResult = await query(`SELECT * FROM groups WHERE id = $1`, [
        scheduled.group_id,
      ]);

      if (groupResult.rows.length === 0) {
        await query(
          `UPDATE scheduled_messages SET status = 'failed', error_message = $1 WHERE id = $2`,
          ["Group not found", scheduled.id]
        );
        continue;
      }

      await telegramService.sendMessage(
        botToken,
        groupResult.rows[0].chat_id,
        scheduled.text,
        { parseMode: scheduled.parse_mode }
      );

      await query(
        `UPDATE scheduled_messages
         SET status = 'sent', sent_at = NOW(), error_message = NULL
         WHERE id = $1`,
        [scheduled.id]
      );

      console.log(`[scheduler] Sent scheduled message #${scheduled.id}`);
    } catch (err) {
      const errorMessage = err.telegram?.description || err.message;
      console.error(
        `[scheduler] Failed to send scheduled message #${scheduled.id}:`,
        errorMessage
      );

      await query(
        `UPDATE scheduled_messages SET status = 'failed', error_message = $1 WHERE id = $2`,
        [errorMessage, scheduled.id]
      );
    }
  }
}

/**
 * Starts the cron job that checks for due scheduled messages every minute.
 */
export function startScheduler() {
  // Runs at the start of every minute.
  cron.schedule("* * * * *", () => {
    processDueMessages().catch((err) => {
      console.error("[scheduler] Unexpected error in scheduler run:", err);
    });
  });

  console.log("[scheduler] Scheduled message cron job started (every minute).");
}

export default { startScheduler };
