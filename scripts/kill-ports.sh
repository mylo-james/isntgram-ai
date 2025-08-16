#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "Usage: $0 <port> [<port> ...]" >&2
  exit 1
fi

for port in "$@"; do
  if command -v lsof >/dev/null 2>&1; then
    pids=$(lsof -ti tcp:"$port" || true)
  else
    echo "lsof not found; skipping port $port" >&2
    continue
  fi

  if [ -n "$pids" ]; then
    echo "Stopping processes on port $port: $pids"
    # Try graceful first
    kill $pids 2>/dev/null || true
    sleep 1
    # Force kill any remaining
    still=$(lsof -ti tcp:"$port" || true)
    if [ -n "$still" ]; then
      echo "Force killing processes on port $port: $still"
      kill -9 $still 2>/dev/null || true
    fi
  fi
done

exit 0


