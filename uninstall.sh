#!/usr/bin/env bash
set -euo pipefail
TASK_INSTALL="${XDG_DATA_HOME:-$HOME/.local/share}/davadesk"
TASK_BIN="${DAVA_BIN_DIR:-$HOME/.local/bin}/davadesk"
TASK_DESKTOP="${XDG_DATA_HOME:-$HOME/.local/share}/applications/davadesk.desktop"
TASK_AUTOSTART="${XDG_CONFIG_HOME:-$HOME/.config}/autostart/davadesk.desktop"
if [[ "$EUID" -eq 0 ]]; then printf '%s\n' 'sudo ishlatmang.'; exit 1; fi
if [[ ! -f "$TASK_INSTALL/package.json" ]]; then printf '%s\n' 'DavaDesk o‘rnatilishi topilmadi.'; exit 1; fi
node -e 'if(require(process.argv[1]).name!=="davadesk")process.exit(1)' "$TASK_INSTALL/package.json"
printf '%s\n' 'DavaDesk dasturini o‘chirish? ChatGPT profili saqlanadi. [y/N]'
read -r TASK_REPLY
if [[ "$TASK_REPLY" != 'y' && "$TASK_REPLY" != 'Y' ]]; then exit 0; fi
rm -f -- "$TASK_DESKTOP" "$TASK_AUTOSTART"
TASK_EXPECTED="$(printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$TASK_INSTALL/launch.sh")"
if [[ -f "$TASK_BIN" && "$(< "$TASK_BIN")" == "$TASK_EXPECTED" ]]; then rm -f -- "$TASK_BIN"; fi
rm -rf -- "$TASK_INSTALL"
printf '%s\n' 'DavaDesk o‘chirildi. ChatGPT profili va ish papkangiz saqlandi.'
