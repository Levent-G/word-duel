# Word Duel — App Store'a yayın adımları

Komutların hepsi `Desktop\WordDuel` klasöründe, PowerShell'de çalıştırılır.

## 0. Destek e-postasını yaz
Şu üç dosyada `levent_gulsum@outlook.com` geçen her yeri kendi destek e-postanla değiştir:
`store/site/index.html`, `store/site/privacy.html`, `store/REVIEW_NOTES.md`.

## 1. Firebase kurallarını güncelle
Firebase konsolu → Realtime Database → **Rules** → içini sil → `database.rules.json` dosyasının tamamını yapıştır → **Publish**.

## 2. Destek ve gizlilik sayfalarını yayınla
```
npm run site
```
İlk seferde alt alan adı sorarsa **word-duel** yaz. Bittiğinde tarayıcıda aç ve kontrol et:
- https://word-duel.expo.app
- https://word-duel.expo.app/privacy

Farklı bir adres verirse onu Claude'a söyle; uygulamadaki bağlantılar (`src/config.js`) ve metinler güncellenmeli.

## 3. iOS derlemesi
```
npm run build:ios
```
Sorulara cevaplar:
- Apple ID ile giriş → **Evet**, Apple geliştirici hesabının e-postası ve şifresi, sonra iki adımlı doğrulama kodu
- Team → QORVEX'i yayınladığın ekip
- Bundle identifier `com.leventgulsum.wordduel` kaydedilsin mi → **Evet**
- Distribution certificate / Provisioning profile oluşturulsun mu → **Evet** (QORVEX'in sertifikasını yeniden kullanmayı önerirse onu seç)
- Push notifications kurulsun mu → **Hayır** (uygulama sadece yerel bildirim kullanıyor)

Derleme bulutta 15–25 dakika sürer.

## 4. TestFlight'a gönder
```
npm run submit:ios
```
- App Store Connect'te uygulama yoksa oluşturmayı önerir → **Evet**
- Uygulama adı: **Word Duel: İngilizce Kelime** (alınmışsa `store/APP_STORE.md` içindeki alternatifler)
- Dil: **Turkish**, SKU: **WORDDUEL001**

Apple işlemeyi bitirince (10–30 dk) iPhone'daki **TestFlight** uygulamasında görünür.

## 5. TestFlight'ta dene
Özellikle şunları kontrol et: online düello (iki cihaz), arkadaş odası, sesler, titreşim, hatırlatma izni, hesabı silme.

## 6. Ekran görüntüleri
TestFlight sürümünde iPhone'dan şu 6 ekranın görüntüsünü al (yan tuş + ses açma):
1. Ana Sayfa
2. Karşılaşma (rakip bulununca)
3. Oyun ekranı (soru açıkken, tercihen rakip tepkisi görünürken)
4. Maç Sonucu (karşılaştırma tablosu)
5. Sıralama → Online → Bu Hafta (lig tablosu)
6. Kelime Detayı ya da Kelimelerim

Bilgisayara at, `store/screenshots/raw` klasörüne koy (01.png, 02.png… sırasıyla), sonra:
```
npm run screenshots
```
App Store Connect'e `store/screenshots/6.9-inch-1320x2868` klasöründekileri yükle. Ayrıca 6.5 inç isterse `6.5-inch-1284x2778` klasörünü kullan.

## 7. App Store Connect'i doldur
https://appstoreconnect.apple.com → Uygulamalar → Word Duel

| Nerede | Ne yapacaksın |
|---|---|
| **App Information** | Alt başlık, kategoriler, telif hakkı (`APP_STORE.md` bölüm 1) |
| **Pricing and Availability** | Ücretsiz, tüm ülkeler |
| **App Privacy** | Gizlilik politikası URL'si + veri türleri (`APP_STORE.md` bölüm 5) |
| **Age Rating** (App Information içinde) | `APP_STORE.md` bölüm 4 |
| **iOS App → 1.0** | Ekran görüntüleri, tanıtım metni, açıklama, anahtar kelimeler, destek URL'si (`APP_STORE.md` bölüm 2) |
| **Build** | "+" → TestFlight'a gönderdiğin derlemeyi seç |
| **App Review Information** | Oturum açma: Hayır, iletişim bilgilerin, notlara `REVIEW_NOTES.md` |
| **Version Release** | "Manually release" (onaydan sonra sen yayınlarsın) |

İstersen **English (U.S.)** dilini ekleyip `APP_STORE.md`'nin İngilizce bölümünü de gir.

## 8. İncelemeye gönder
Sağ üstte **Add for Review** → **Submit to App Review**. İnceleme genellikle 1–3 gün sürer.

## Sonraki sürümler
`app.json` içindeki `"version"` değerini artır (örn. 1.0.1), sonra 3. ve 4. adımları tekrarla. Derleme numarası kendiliğinden artar.
