'use strict';
const CACHE='gg-room-shell-v3';
const CORE=['./','./index.html','./style.css','./app.js','./apps.json'];
const base=new URL('./',self.location.href);
const sameScope=url=>url.origin===base.origin && url.pathname.startsWith(base.pathname);
const isCore=url=>CORE.some(path=>new URL(path,base).href===url.href);
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith('gg-room-shell-') && key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(!sameScope(url)) return; // 絕不宣稱能替其他 GitHub Pages 專案快取
  if(url.pathname.endsWith('/apps.json')){
    event.respondWith(fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,copy)));}
      return res;
    }).catch(()=>caches.match(req)));
    return;
  }
  if(isCore(url)){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
    return;
  }
  // 本機模組：快取優先，減少 30 台 iPad 在低速網路下反覆下載。
  // 當教師選擇「預載工具」更新版本時，cache:'reload' 一律直接下載新檔。
  if(req.cache==='reload'){event.respondWith(fetch(req));return;}
  event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
});
