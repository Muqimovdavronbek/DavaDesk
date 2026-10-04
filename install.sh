#!/usr/bin/env bash
set -euo pipefail
TASK_SOURCE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TASK_INSTALL="${XDG_DATA_HOME:-$HOME/.local/share}/davadesk"
TASK_BIN="${DAVA_BIN_DIR:-$HOME/.local/bin}"

if [[ "${EUID}" -eq 0 ]]; then
  printf '%s\n' 'Oddiy foydalanuvchi sifatida bajaring: bash install.sh (sudo ishlatmang).'
  exit 1
fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then
  printf '%s\n' 'Node.js 22+ va npm kerak. Kali/Debian: sudo apt install nodejs npm'
  exit 1
fi
TASK_NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( TASK_NODE_MAJOR < 22 )); then
  printf '%s\n' 'Node.js 22 yoki yangirog‘ini o‘rnating: https://nodejs.org/en/download'
  exit 1
fi
if ! command -v wmctrl >/dev/null; then
  printf '%s\n' 'Barcha ish stollarida ko‘rinish uchun avval: sudo apt install wmctrl'
  exit 1
fi
mkdir -p -- "$TASK_INSTALL" "$TASK_BIN"
if [[ "$TASK_SOURCE" != "$(cd -- "$TASK_INSTALL" && pwd)" ]]; then
  tar -C "$TASK_SOURCE" --exclude='./node_modules' --exclude='./.git' --exclude='./artifacts' -cf - . | tar -C "$TASK_INSTALL" -xf -
fi
cd -- "$TASK_INSTALL"
printf '%s\n' 'DavaDesk, Electron va rasmiy Codex o‘rnatilmoqda. Internet kerak.'
npm install --include=dev --no-audit --no-fund
bash repair-electron.sh
chmod +x launch.sh install.sh uninstall.sh repair-electron.sh
printf '#!/usr/bin/env bash\nexec %q "$@"\n' "$TASK_INSTALL/launch.sh" > "$TASK_BIN/davadesk"
chmod +x "$TASK_BIN/davadesk"
node - "$TASK_INSTALL" <<'JS'
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const root = process.argv[2];
const {desktopQuote} = require(path.join(root, 'lib', 'core.cjs'));
const applications = path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'), 'applications');
fs.mkdirSync(applications, {recursive:true});
fs.writeFileSync(path.join(applications, 'davadesk.desktop'), [
  '[Desktop Entry]', 'Type=Application', 'Version=1.0', 'Name=DavaDesk',
  'Comment=ChatGPT yoningizda — Linux yordamchisi',
  'Exec=' + desktopQuote(path.join(root, 'launch.sh')),
  'Icon=' + path.join(root, 'assets', 'icon.png'), 'Terminal=false',
  'Categories=Utility;Office;', 'StartupWMClass=DavaDesk', ''
].join('\n'));
JS
if command -v update-desktop-database >/dev/null; then
  update-desktop-database "${XDG_DATA_HOME:-$HOME/.local/share}/applications" >/dev/null 2>&1 || true
fi
printf '\n%s\n' 'Tayyor. Ilovalar menyusidan DavaDesk’ni oching yoki quyidagini bajaring:'
printf '%q\n' "$TASK_INSTALL/launch.sh"
printf '%s\n' 'Vazifalar → ChatGPT bilan kirish tugmasidan akkauntingizni ulang.'
