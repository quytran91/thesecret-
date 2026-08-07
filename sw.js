// Service worker: cho app chạy offline và MỞ NGAY, không phải chờ tải lại.
//
// Bản v1 dùng network-first: mỗi lần mở app là tải lại nguyên file index.html ~10,5 MB
// qua 4G rồi mới hiện gì lên → đó chính là cái "hơi lag" khi vào app.
// Bản này đổi sang cache-first + cập nhật ngầm (stale-while-revalidate):
//   • mở app  → lấy ngay từ bộ nhớ máy, hiện tức thì, không tốn 4G
//   • song song → tải bản mới ở chế độ nền, lưu lại
//   • lần mở sau → đã là bản mới
// Từ v3 ảnh/video được tách ra file rời. Chỉ tải sẵn những thứ cần để VẼ ĐƯỢC màn hình đầu
// (~0,8 MB); mưa tiền, GIF nhảy múa, GIF hộp quà (~6,5 MB) đợi lúc ăn mừng đầu tiên mới tải,
// tải xong nằm lại trong máy nên chỉ tốn đúng một lần.
const CACHE = 'secret-v3';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './assets/logo-seal.png', './assets/counter.gif', './assets/emoji-sheet.png', './assets/kaching.mp3'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  // đổi tên CACHE ở trên là tự động dọn sạch bản cũ, khỏi lo máy giữ bản cũ mãi
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(e.request, { ignoreSearch: true }).then(hit => {
        // tải bản mới ở nền — không chặn màn hình
        const fresh = fetch(e.request)
          .then(res => {
            if (res && res.ok) cache.put(e.request, res.clone());
            return res;
          })
          .catch(() => null);
        // có trong máy thì dùng luôn; chưa có thì đành chờ mạng
        return hit || fresh.then(r => r || cache.match('./index.html'));
      })
    )
  );
});

// cho phép trang bảo service worker nhảy sang bản mới ngay lập tức
self.addEventListener('message', e => { if (e.data === 'skip-waiting') self.skipWaiting(); });
