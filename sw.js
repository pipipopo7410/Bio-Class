'use strict';
const SHELL='gg-room-shell-v4.0.0';
const CORE=['./','./index.html','./hub-v4.css','./hub-v4.js','./apps.json','./taxonomy.html','./manifest.webmanifest','./icon.svg'];
const root=new URL('./',self.location.href);
const inScope=url=>url.origin===root.origin&&url.pathname.startsWith(root.pathname);
const isCore=url=>CORE.some(path=>new URL(path,root).href===url.href);
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('gg-room-shell-')&&k!==SHELL).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(!inScope(url))return; // 不干涉其他獨立 GitHub Pages 專案的 Service Worker。
  if(url.pathname.endsWith('/apps.json')){
    event.respondWith(fetch(req).then(res=>{
      if(res.ok){const copy=res.clone();event.waitUntil(caches.open(SHELL).then(c=>c.put(req,copy)));}
      return res;
    }).catch(()=>caches.match(req)));
    return;
  }
  if(isCore(url)){
    event.respondWith(caches.match(req).then(cached=>cached||fetch(req)));
    return;
  }
});
