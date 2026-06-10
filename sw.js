/* 环境百词斩 service worker — 离线缓存 */
var CACHE = "hj-cache-v12";
var ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./config.js",
  "./codes.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./data/meta.js",
  "./data/directions.js",
  "./data/simple.js",
  "./data/advanced.js"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 逐个添加, 单个失败不影响整体安装
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () { });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 缓存优先, 回退网络并写入缓存
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(e.request, copy).catch(function () { }); });
        return res;
      }).catch(function () { return caches.match("./index.html"); });
    })
  );
});
