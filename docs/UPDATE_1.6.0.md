# DavaDesk 1.6.0 — oyna va clipboard tuzatishlari

## Linux’da yangilash

1. Eski DavaDesk’da Sozlamalar → DavaDesk’dan chiqish. × faqat panelni yig‘adi.
2. Terminalda quyidagilarni bajaring (Node.js 22+, npm, git va wmctrl kerak):

```bash
cd ~/Downloads
git clone https://github.com/Muqimovdavronbek/DavaDesk.git DavaDesk-1.6.0
cd DavaDesk-1.6.0
bash install.sh
~/.local/share/davadesk/launch.sh
```

Agar DavaDesk-1.6.0 papkasi oldindan mavjud bo‘lsa, yangi bo‘sh papka nomini tanlang. Sudo bilan ishga tushirmang. Sozlamalarda v1.6.0 yozuvini tekshiring. Profil va ish papkasi saqlanadi.

## Oynani kengaytirish

- Yuqoridagi □ tugmasi panelni ekran ish maydonigacha kengaytiradi; qayta bosish oldingi o‘lchamga qaytaradi.
- Pastki o‘ng burchakdagi ◢ tutqichni bosib suring. Tutqich fokusda bo‘lsa strelka tugmalari ham ishlaydi.
- Kengaytirish paytida avtomatik yig‘ilish vaqtincha to‘xtaydi. Qo‘yib yuborgandan keyin odatiy yig‘ilish qaytadi.
- Oyna chetidagi 12 piksel resize hududi himoyalangan. Kursor undan tashqarida qolsa 0,6 soniyadan keyin panel yig‘iladi.
- Oxirgi panel o‘lchami keyingi ishga tushishda tiklanadi. Qahramonning joyi alohida saqlanadi.

## Copy / paste

1. Skrinshot yoki rasmni nusxalang; yoki fayl menejerida rasm, video, ZIP va boshqa fayllarni Ctrl+C qiling.
2. DavaDesk’da kerakli AI’ga kiring, suhbatni oching.
3. Suhbatda Ctrl+V (yoki Shift+Insert) bosing. AI panelidagi 📋 Qo‘yish tugmasi ham ishlaydi.
4. Saytda biriktirish tugashini tekshirib, xabaringizni yuboring.

Oddiy matnning Ctrl+V amali saqlanadi. AI oynasida o‘ng tugma menyusidan matn yoki rasm nusxalash va qo‘yish ham mavjud. Clipboard faqat foydalanuvchi qo‘yish amalini bajarganda o‘qiladi; fonda kuzatilmaydi. Nusxalangan fayllar ko‘chirilmaydi yoki o‘chirilmaydi: ish papkasida nusxa yaratiladi.

Linux: GNOME/Nautilus va URI-list fayl clipboard formatlari. Windows: CF_HDROP va FileNameW. Videoning o‘zini fayl menejerida nusxalang; saytdagi “video havolasini nusxalash” faqat matnli URL bo‘ladi. Video formatlari va fayl hajmini AI xizmatining o‘zi belgilaydi. DavaDesk qabul qilinmaydigan formatni majburan yuklamaydi. Har bir fayl 100 MB gacha, bir safar 20 tagacha. Sayt interfeysi o‘zgarsa avtomatik biriktirish ishlamasligi mumkin.

## Tekshiruv va paket holati

54 avtomatik test va Chromium’da haqiqiy renderer tekshiruvi o‘tdi: kattalashtirish, resize tutqichi, Qo‘yish tugmasi va kichik panel tartibi. Native GNOME/Windows clipboard hamda jonli AI xizmatlaridagi yuklashlar bu muhitda sinovdan o‘tkazilmagan.

GitHub main manba kodi 1.6.0. Avvalgi v1.5.0 Release paketlari avtomatik yangilanmaydi. Windows uchun avvalgi portable EXE ushbu tuzatishlarni hali o‘z ichiga olmaydi; ushbu yangilash yo‘riqnomasi Linux uchun.
