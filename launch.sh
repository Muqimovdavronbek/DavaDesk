#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${EUID}" -eq 0 ]]; then
  printf '%s\n' 'DavaDesk oddiy foydalanuvchi sifatida ochiladi. sudo ishlatmang.'
  exit 1
fi
TASK_ELECTRON="$TASK_ROOT/node_modules/.bin/electron"
if [[ ! -x "$TASK_ELECTRON" ]]; then
  printf '%s\n' 'Avval bash install.sh ni bajaring.'
  exit 1
fi
TASK_ARGS=()
# GNOME native Wayland cannot reliably position arbitrary floating windows.
# Use its normal XWayland compatibility surface when DISPLAY is available.
if [[ -n "${DISPLAY:-}" ]]; then
  TASK_ARGS+=(--ozone-platform=x11)
fi
cd -- "$TASK_ROOT"
exec "$TASK_ELECTRON" "${TASK_ARGS[@]}" "$TASK_ROOT" "$@"
