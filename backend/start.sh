#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"
PYTHON="${PYTHON:-python3}"
VENV_DIR="${VENV_DIR:-.venv}"
VENV_PYTHON="$VENV_DIR/bin/python"

if [ ! -x "$VENV_PYTHON" ]; then
  echo "Creating backend virtual environment..."
  "$PYTHON" -m venv "$VENV_DIR"
  "$VENV_PYTHON" -m pip install --upgrade pip
fi

echo "Installing backend dependencies..."
"$VENV_PYTHON" -m pip install -e ".[dev]"

exec "$VENV_PYTHON" -m uvicorn app.main:app --host "$HOST" --port "$PORT" --reload
