#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/backend/logs"

mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR"/*.log

echo "Cleared backend debug logs in $LOG_DIR"
