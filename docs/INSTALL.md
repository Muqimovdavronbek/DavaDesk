# DavaDesk 1.5.0 — o‘rnatish qo‘llanmasi

## Windows 10/11 x64

1. Releases bo‘limidan `DavaDesk_Windows_x64_v1.5.0.zip` faylini yuklang.
2. ZIP ustida o‘ng tugma → **Extract All / Hammasini chiqarish**.
3. Chiqarilgan `DavaDesk` papkasidagi **DavaDesk.exe** faylini oching. ZIP ichidan ishga tushirmang.
4. Ismingizni kiriting → **Boshlash**.
5. **AI xizmatlari** bo‘limidan xizmatni tanlang va o‘z akkauntingizga kiring.
6. Ixtiyoriy: `Create-Desktop-Shortcut.cmd` ish stolida yorliq yaratadi.

**Node.js, npm yoki WSL alohida kerak emas.** EXE, DLL va `resources` papkasi birga turishi kerak. Bu portable paket: papkani boshqa joyga ko‘chirsangiz, yorliqni qayta yarating. ARM va 32-bit Windows uchun ushbu paket mo‘ljallanmagan.

### Barcha virtual ish stollari

DavaDesk panelini oching. **Win+Tab** → DavaDesk oynasi ustida o‘ng tugma → **Show this window on all desktops**. Ilovada **Sozlamalar → Doim tepada turish** ni yoqing. Windows tiliga qarab menyu nomi farq qiladi.

### Yangilash / olib tashlash

Sozlamalardan **DavaDesk’dan chiqish** ni bosing. Yangi ZIPni alohida papkaga chiqaring, yangi EXEni oching va eski yorliqni yangilang. Faqat × tugmasi dasturni tugatmaydi, panelni yig‘adi. Olib tashlash uchun dasturni tugating, portable papka va yorliqni o‘chiring. Foydalanuvchi profili va ish fayllari alohida saqlanishi mumkin.

## Linux: Kali / Debian / Ubuntu oilasi

Grafik ish stoli, internet, Node.js **22+**, npm va wmctrl kerak. Sof Wayland oyna joylashishini cheklashi mumkin; X11 yoki XWayland tavsiya qilinadi.

### 1. Tizim paketlari

```bash
sudo apt update
sudo apt install nodejs npm wmctrl unzip
node -v
npm -v
```

`node -v` natijasi **v22 yoki yangiroq** bo‘lishi shart. Agar distributiv eski versiya bersa, [Node.js rasmiy yuklash sahifasi](https://nodejs.org/en/download) orqali Linux uchun qo‘llab-quvvatlanadigan versiyani o‘rnating, terminalni qayta oching va versiyani yana tekshiring. DavaDesk o‘rnatuvchisi eski Node.js bilan davom etmaydi.

### 2. Paketni ochish

Releases bo‘limidan `DavaDesk_Linux_v1.5.0.zip` ni Downloads papkasiga yuklang:

```bash
cd ~/Downloads
unzip DavaDesk_Linux_v1.5.0.zip -d DavaDesk_1.5.0
cd DavaDesk_1.5.0/DavaDesk
bash install.sh
```

Downloads papkangiz boshqa nomda bo‘lsa, `cd` yo‘lini moslang. `install.sh` va dasturni **sudo bilan ishlatmang**. O‘rnatuvchi Electron va Codex’ni internetdan yuklaydi. Paket ichida Linux runtime yo‘q.

### 3. Ishga tushirish

Ilovalar menyusidan **DavaDesk** ni tanlang yoki:

```bash
~/.local/share/davadesk/launch.sh
```

Agar `XDG_DATA_HOME` maxsus o‘zgartirilgan bo‘lsa, o‘rnatuvchi oxirida ko‘rsatgan yo‘lni ishlating. Ismingizni saqlang va AI xizmatiga kiring.

### Yangilash

Eski DavaDesk’da **Sozlamalar → DavaDesk’dan chiqish**. Yangi paketni alohida papkaga chiqaring va `bash install.sh` ni qayta bajaring. O‘rnatuvchi dastur fayllarini yangilaydi; ish papkasi va akkaunt sessiyalarini o‘chirmaydi.

### Olib tashlash

```bash
bash ~/.local/share/davadesk/uninstall.sh
```

Tasdiqlash uchun `y` kiriting. Ish papkasi va profil saqlanadi.

## Kundalik foydalanish

| Amal | Qanday bajariladi |
| --- | --- |
| Panelni ochish | Qahramonni bir marta bosing |
| Joyini o‘zgartirish | Qahramonni bosib suring |
| Panelni yig‘ish | Kursorni tashqariga olib chiqing, taxminan 0,6 soniya kuting |
| Tezkor ochish | Ctrl+Alt+Space, tizimda bo‘sh bo‘lsa |
| Ismni o‘zgartirish | Sozlamalar → Profil |
| Fayl biriktirish | AI’ni tanlang, faylni qahramon ustiga tashlang |
| Mahalliy vazifa | Vazifalar → ChatGPT bilan kirish → ish papkasi va ruxsatni tanlash |
| To‘liq chiqish | Sozlamalar → DavaDesk’dan chiqish |

Fayl tanlash dialogi, surish va birinchi ism kiritish paytida avtomatik yig‘ilish vaqtincha to‘xtaydi. Bir safar 20 tagacha, har biri 100 MB gacha fayl olinadi; provayderning chegarasi pastroq bo‘lishi mumkin. ZIP ochilmaydi. Xabar avtomatik yuborilmaydi.

## Muammolarni hal qilish

| Muammo | Tekshirish |
| --- | --- |
| Eski versiya ochildi | Eski jarayondan to‘liq chiqing; yangi papkadagi EXE/launch.sh’ni oching; eski yorliqni yangilang |
| Windows DLL topilmadi | ZIPni to‘liq qayta chiqaring; EXEni yolg‘iz ko‘chirmang |
| Windows himoya ogohlantirishi | Paket imzolanmagan bo‘lishi mumkin; manba va SHA256’ni tekshiring. Tizim himoyasini o‘chirmang |
| Linux Electron yuklanmadi | Quyidagi repair buyruqlarini bajaring |
| Linux ish stollarida yo‘q | wmctrl borligini, X11/XWayland sessiyasini va Doim tepada turish sozlamasini tekshiring |
| Login ishlamadi | Xizmatning Brauzerda tugmasini ishlating; tashqi brauzer sessiyasi alohida |
| Fayl yuklanmadi | Akkauntga kiring, saytning biriktirish menyusini oching va Qayta urinish; kerak bo‘lsa qo‘lda biriktiring |
| Kursor chiqqanda yig‘ilmadi | Ismni saqlang, fayl dialogini yoping; OS va ish stoli nomi bilan xato haqida yozing |

```bash
cd ~/.local/share/davadesk
bash repair-electron.sh
bash launch.sh
```

## Yuklamani tekshirish

Release’dagi `SHA256SUMS.txt` bilan natijani solishtiring.

Windows PowerShell:
```powershell
Get-FileHash .\DavaDesk_Windows_x64_v1.5.0.zip -Algorithm SHA256
```

Linux:
```bash
sha256sum DavaDesk_Linux_v1.5.0.zip
```

Avtomatik testlar haqiqiy Windows/Wayland yoki jonli AI fayl yuklash sinovlarining o‘rnini bosmaydi. Ushbu platforma sinovlari hali bajarilmagan.
