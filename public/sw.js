// Service Worker do Sistema TUIG
// Combina cache offline + OneSignal Push Notifications

const CACHE_NAME = 'tuig-cache-v14';
const ASSETS_TO_CACHE = [
    '/sistema/',
    '/sistema/index.html'
];

// Instalação: Cacheia os assets críticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('tuig-cache-') && name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Estratégia Network-First: Tenta a rede, cai no cache se offline
self.addEventListener('fetch', (event) => {
    // Ignora requests que não são GET
    if (event.request.method !== 'GET') return;
    // Não guardar dados pessoais, tokens ou respostas da API no cache offline.
    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin || url.searchParams.has('action')) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // Cacheia as respostas bem-sucedidas para uso offline
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Sem rede? Tenta o cache
                return caches.match(event.request);
            })
    );
});

// Importa o motor do OneSignal para gerenciar Push Notifications
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');
