#!/usr/bin/env bash
#
# Repeating sender: every N seconds, checks if a Telegram bot is already
# registered in the database. If yes, skips registration and just sends
# a test message to the group and/or channel IDs you specify manually.
# If no bot is registered yet, registers one first (requires BOT_TOKEN).
#
# Usage:
#   BASE_URL="http://localhost:4000/api" \
#   BOT_TOKEN="123:ABC" \
#   GROUP_ID=1 \
#   CHANNEL_ID=2 \
#   ./watch-and-send.sh
#
# GROUP_ID and CHANNEL_ID are the DATABASE row ids (from GET /api/groups),
# NOT the Telegram chat_id. Leave either one blank to skip sending to it.
#
# Press Ctrl+C to stop.
#
# Requires: curl, jq
#
# SECURITY NOTE: Never hardcode your BOT_TOKEN into this file. Always pass
# it as an environment variable at runtime, and never paste a real token
# into a chat, ticket, or shared doc.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api}"
BOT_TOKEN="${BOT_TOKEN:-}"
INTERVAL="${INTERVAL:-5}"

# Manually specify which targets to send to, by their DATABASE id
# (the "id" field from GET /api/groups, not the Telegram chat_id).
GROUP_ID="${GROUP_ID:-}"
CHANNEL_ID="${CHANNEL_ID:-}"

if [ -z "$GROUP_ID" ] && [ -z "$CHANNEL_ID" ]; then
  echo "❌ You must set at least one of GROUP_ID or CHANNEL_ID."
  echo "   Example: GROUP_ID=1 CHANNEL_ID=2 ./watch-and-send.sh"
  echo "   Run 'curl -s \$BASE_URL/groups | jq' to find the right ids."
  exit 1
fi

echo "Watching $BASE_URL every ${INTERVAL}s."
[ -n "$GROUP_ID" ] && echo "  → sending to group id: $GROUP_ID"
[ -n "$CHANNEL_ID" ] && echo "  → sending to channel id: $CHANNEL_ID"
echo "Press Ctrl+C to stop."
echo ""

send_to() {
  local id="$1"
  local label="$2"
  local resp
  resp=$(curl -s -X POST "$BASE_URL/groups/$id/test")
  local ok
  ok=$(echo "$resp" | jq -r '.success // false' 2>/dev/null)

  if [ "$ok" = "true" ]; then
    echo "  ✅ Sent to $label (id $id)"
  else
    echo "  ❌ Send to $label (id $id) failed: $resp"
  fi
}

while true; do
  timestamp=$(date "+%Y-%m-%d %H:%M:%S")
  echo "[$timestamp]"

  # 1. Check whether a bot is already registered and active.
  status_resp=$(curl -s "$BASE_URL/telegram/status")
  connected=$(echo "$status_resp" | jq -r '.data.connected // false' 2>/dev/null)

  if [ "$connected" = "true" ]; then
    echo "  Bot already registered and connected — skipping registration."
  else
    echo "  No active bot found."

    if [ -z "$BOT_TOKEN" ]; then
      echo "  BOT_TOKEN not set — cannot register. Set BOT_TOKEN env var to auto-register. Skipping this cycle."
      echo ""
      sleep "$INTERVAL"
      continue
    fi

    echo "  Registering bot..."
    register_resp=$(curl -s -X POST "$BASE_URL/telegram" \
      -H "Content-Type: application/json" \
      -d "{ \"botToken\": \"$BOT_TOKEN\" }")
    ok=$(echo "$register_resp" | jq -r '.success // false' 2>/dev/null)

    if [ "$ok" != "true" ]; then
      echo "  ❌ Registration failed: $register_resp"
      echo ""
      sleep "$INTERVAL"
      continue
    fi

    echo "  ✅ Bot registered."
  fi

  # 2. Send to the manually specified group and/or channel.
  if [ -n "$GROUP_ID" ]; then
    send_to "$GROUP_ID" "group"
  fi

  if [ -n "$CHANNEL_ID" ]; then
    send_to "$CHANNEL_ID" "channel"
  fi

  echo ""
  sleep "$INTERVAL"
done
