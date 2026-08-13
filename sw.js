/**
 * sw.js
 * ------
 * Purpose: The Service Worker for the Trellis PWA.
 */

const CACHE_NAME = 'trellis-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './main.css',
    './app.js',
    './storage.js',
    './nudge.js',
    './session-generator.js',
    './poses.json',
    './icon-192.png',
    './icon-512.png',
    './manifest.json'
];

// Install event - cache all necessary files
self.addEventListener('install', event => {
    self.skipWaiting(); // 1.11: Force new SW to take over immediately
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('✅ Service Worker: Caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.map(key => {
                    if (key !== CACHE_NAME) {
                        console.log('🧹 Service Worker: Removing old cache', key);
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => clients.claim()) // 1.11: Activate immediately for all pages
    );
});

// Fetch event - serve from cache first, fallback to network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});