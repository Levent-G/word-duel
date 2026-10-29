# Online modu açmak — "focus" Firebase projesi

Her şey ücretsiz **Spark** planında çalışır. Plan yükseltme (Blaze) **gerekmez**, kart istenmez.

## 1. Projeyi aç
https://console.firebase.google.com → **focus** projesine tıkla.

## 2. Anonim girişi aç
Sol menü **Build › Authentication** → **Get started** → üstte **Sign-in method** sekmesi →
listeden **Anonymous** → **Enable** anahtarını aç → **Save**.

## 3. Realtime Database oluştur
Sol menü **Build › Realtime Database** → **Create Database** →
konum **Belgium (europe-west1)** → **Next** → **Start in locked mode** → **Enable**.

> Firestore Database değil, **Realtime Database** olmalı.

## 4. Güvenlik kurallarını yapıştır
Realtime Database sayfasında üstte **Rules** sekmesi → kutudaki her şeyi sil →
bu klasördeki `database.rules.json` dosyasının **tamamını** yapıştır → **Publish**.

## 5. Web uygulaması ekle ve ayarları al
Sol üstte dişli ⚙ → **Project settings** → **General** sekmesi → aşağıda **Your apps** →
**</>** (Web) simgesi → takma ad: `Word Duel` → "Firebase Hosting" kutusunu **işaretleme** → **Register app**.

Ekranda şuna benzer bir blok çıkar:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "focus-xxxxx.firebaseapp.com",
  databaseURL: "https://focus-xxxxx-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "focus-xxxxx",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "1:...:web:..."
};
```

Bu bloğu kopyala. `databaseURL` satırı yoksa: Realtime Database › **Data** sekmesinin en üstündeki adresi kullan.

## 6. Ayarları uygulamaya gir
`.env.example` dosyasını `.env` adıyla kopyala ve doldur (ya da bloğu Claude'a gönder, o doldursun):

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=focus-xxxxx.firebaseapp.com
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://focus-xxxxx-default-rtdb.europe-west1.firebasedatabase.app
EXPO_PUBLIC_FIREBASE_PROJECT_ID=focus-xxxxx
EXPO_PUBLIC_FIREBASE_APP_ID=1:...:web:...
```

Sonra Expo'yu yeniden başlat: `npx expo start -c --port 8083`

## 7. Dene
İki telefonda Expo Go ile uygulamayı aç, ikisinde de aynı kelime seviyesini seç (Ayarlar),
ikisinde de **Online Düello**'ya bas. Birkaç saniye içinde eşleşmeleri gerekir.
Arkadaş odasını denemek için birinde **Arkadaşınla › Oda Aç**, diğerinde **Odaya Katıl**.

## Ücretsiz plan sınırları
Aynı anda 100 bağlantı, 1 GB veri, ayda 10 GB indirme. Bu oyun için uzun süre yeter.

## Nasıl çalışıyor
- **Eşleştirme:** `queue/{seviye}` sırasında bekleyenler arasından puanı en yakın olan seçilir.
  İlk anda en fazla 100 puan fark kabul edilir, beklenen her saniye 20 puan genişler.
  Seçim tek bir işlemde yapılır, iki telefon aynı oyuncuyu kapamaz.
- **Puan:** Maç sonu iki telefon da sonucu veritabanındaki ortak cevap kaydından hesaplar (Elo, K=32).
  Kurallar her maçın tek bir kez sayılmasını, maç başına en fazla ±40 puan değişmesini,
  sadece gerçekten oynanan online maçların sayılmasını zorunlu kılar. Arkadaş maçları puansızdır.
- **Sıralama:** Online sıralama `ratings` ve `weekly` düğümlerinden, bot sıralaması telefondaki bot liginden gelir.

## Yerel test (Java gerekir)
```
npm run emulators       # bir terminalde açık kalsın
npm run test:online     # ikinci terminalde
npm test                # ağ gerektirmeyen testler
```
