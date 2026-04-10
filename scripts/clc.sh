#!/bin/bash

clc() {
  local STATE_DIR=".claude_state"
  mkdir -p "$STATE_DIR"

  local LABEL="${1:-default}"
  local SESSION_FILE="$STATE_DIR/$LABEL"
  local TEMP_LOG
  TEMP_LOG=$(mktemp)

  # 1. Run Claude and record the output to a temp file
  if [[ -f "$SESSION_FILE" ]]; then
    local SESSION_ID
    SESSION_ID=$(cat "$SESSION_FILE")
    echo "--- Resuming Claude Session: [$LABEL] ---"
    # 'script' records the session while staying interactive
    script -q -c "claude --resume $SESSION_ID" "$TEMP_LOG"
  else
    echo "--- Starting New Claude Session: [$LABEL] ---"
    script -q -c "claude" "$TEMP_LOG"
  fi

  # 2. Extract the ID from the recorded exit message
  echo "Linking session ID..."

  # This looks for the UUID in the text 'script' just saved
  local LATEST_ID
  LATEST_ID=$(grep -oaE '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}' "$TEMP_LOG" | tail -n 1)

  if [[ -n "$LATEST_ID" ]]; then
    echo "$LATEST_ID" > "$SESSION_FILE"
    echo "--- Linked [$LABEL] -> $LATEST_ID ---"
  else
    echo "--- Note: No new session ID found (did you just enter and exit?) ---"
  fi

  # Clean up the temp file
  rm -f "$TEMP_LOG"
}
