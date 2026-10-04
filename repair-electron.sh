#!/usr/bin/env bash
set -euo pipefail
TASK_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ "${EUID}" -eq 0 ]]; then
  printf '%s\n' 'Oddiy foydalanuvchi sifatida bajaring (sudo ishlatmang).'
  exit 1
fi
cd -- "$TASK_ROOT"
if [[ ! -x node_modules/.bin/install-electron ]]; then
  printf '%s\n' 'Electron paketi topilmadi. Avval bash install.sh ni bajaring.'
  exit 1
fi
if [[ "${1:-}" == '--mirror' ]]; then
  export ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
elif [[ $# -gt 0 ]]; then
  printf '%s\n' 'Foydalanish: bash repair-electron.sh [--mirror]'
  exit 1
fi
printf '%s\n' 'Electron asosiy fayli yuklanmoqda. Yuklash tugashini kuting.'
if ! node_modules/.bin/install-electron --no; then
  printf '%s\n' 'Electron yuklanmadi. Internetni tekshiring yoki boshqa tarmoqda qayta urining.'
  printf '%s\n' 'Muqobil yuklash manbasi: bash repair-electron.sh --mirror'
  exit 1
fi
node <<'JS'
const fs = require('node:fs');
const binary = require('electron');
fs.accessSync(binary, fs.constants.X_OK);
JS
printf '%s\n' 'Electron tayyor.'
