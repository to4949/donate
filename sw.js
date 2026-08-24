/* 벽지 생성기 서비스워커
   - 페이지는 네트워크 우선(새 버전이 바로 반영됨), 실패하면 캐시
   - 아이콘·이미지 등 같은 출처 정적 파일은 캐시 우선
   - 웹폰트(CDN)는 캐시 우선 — 한 번 방문하면 오프라인에서도 글꼴이 유지된다
   본체 index.html 의 VERSION 을 올릴 때 아래 CACHE 도 같이 올려주세요. */
const CACHE = 'wallpaper-maker-v1.5';

const CORE = [
    './',
    './index.html',
    './manifest.webmanifest',
    './icon-192.png',
    './icon-512.png',
    './og-image.png'
];

const FONT_HOSTS = [
    'https://cdn.jsdelivr.net',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            // 일부 파일이 없어도 설치가 통째로 실패하지 않도록 개별 처리
            .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => { }))))
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

/* 페이지에서 "지금 새 버전 적용" 을 눌렀을 때 */
self.addEventListener('message', e => {
    if (e.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;

    const url = new URL(req.url);
    const sameOrigin = url.origin === self.location.origin;
    const isFont = FONT_HOSTS.some(h => req.url.startsWith(h));

    if (!sameOrigin && !isFont) return;   // 그 밖의 외부 요청은 건드리지 않는다

    // 페이지 이동: 네트워크 우선
    if (req.mode === 'navigate') {
        e.respondWith(
            fetch(req)
                .then(res => {
                    const copy = res.clone();
                    caches.open(CACHE).then(c => c.put('./index.html', copy));
                    return res;
                })
                .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
        );
        return;
    }

    // 그 외(아이콘·글꼴 등): 캐시 우선
    e.respondWith(
        caches.match(req).then(hit => hit || fetch(req).then(res => {
            if (res && (res.ok || res.type === 'opaque')) {
                const copy = res.clone();
                caches.open(CACHE).then(c => c.put(req, copy));
            }
            return res;
        }).catch(() => new Response('', { status: 504, statusText: 'offline' })))
    );
});
