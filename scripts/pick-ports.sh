#!/bin/bash

set -euo pipefail

port_is_open() {
  local port="$1"
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "${port}" >/dev/null 2>&1
    return $?
  fi
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"${port}" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  return 1
}

pick_port() {
  local desired="$1"
  shift
  local candidates=("${desired}" "$@")
  for candidate in "${candidates[@]}"; do
    if [[ -z "${candidate}" ]]; then
      continue
    fi
    if port_is_open "${candidate}"; then
      continue
    fi
    echo "${candidate}"
    return 0
  done
  return 1
}

DEFAULT_WEB_PORT="${WEB_PORT:-3000}"
DEFAULT_API_PORT="${API_PORT:-3001}"

WEB_PORT="$(pick_port "${DEFAULT_WEB_PORT}" 3000 3002 3003 3004 3005 3006)"

API_CANDIDATES=("${DEFAULT_API_PORT}" 3001 3002 3003 3004 3005 3006 3007 3008 3009)
API_PORT=""
for candidate in "${API_CANDIDATES[@]}"; do
  if [[ "${candidate}" == "${WEB_PORT}" ]]; then
    continue
  fi
  if port_is_open "${candidate}"; then
    continue
  fi
  API_PORT="${candidate}"
  break
done

if [[ -z "${API_PORT}" ]]; then
  echo "Error: Unable to find a free API port." >&2
  exit 1
fi

export WEB_PORT API_PORT

echo "Using WEB_PORT=${WEB_PORT} API_PORT=${API_PORT}"

