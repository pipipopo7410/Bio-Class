'use strict';
// Scope: this portal only (Bio-Class). Mirrored modules are placed under ./apps/<id>/.
// Never intercept the other original GitHub Pages repositories directly.
const SHELL='gg-room-shell-v5.3.2-3d-menu';
const META='gg-room-offline-meta-v1';
const CACHE_PREFIX='gg-module-v1-';
const ROOT=new URL('./',self.location.href);
const STATE_URL=new URL('./__gg_offline_state__',ROOT).href;
const CORE=['./','./index.html','./style.css','./app.js','./apps.json','./taxonomy.html',
  './manifest.webmanifest','./offline.html','./offline.css','./offline.js',
  './offline-catalog.json','./assets/brand-butterfly.png','./assets/brand-turtle.png','./assets/app-icon-180.png','./assets/app-icon-192.png','./assets/app-icon-512.png'];
const coreURLs=new Set(CORE.map(p=>new URL(p,ROOT).href));
self.addEventListener('install',e=>e.waitUntil((async()=>{
 const cache=await caches.open(SHELL);
 await cache.addAll(CORE);
 await self.skipWaiting();
})()));
self.addEventListener('activate',e=>e.waitUntil((async()=>{
 const keys=await caches.keys();
 await Promise.all(keys.filter(k=>(k.startsWith('gg-room-shell-')&&k!==SHELL)||k.startsWith('gg-classroom-v')).map(k=>caches.delete(k)));
 await self.clients.claim();
})()));
async function activeVersion(id){
 try{
  const cache=await caches.open(META);
  const res=await cache.match(STATE_URL);
  const state=res?await res.json():null;
  return state?.modules?.[id]?.version||null;
 }catch{return null;}
}
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))return;
 if(url.searchParams.has('__gg_download')){event.respondWith(fetch(req));return;}
 const appPart=url.pathname.slice((ROOT.pathname+'apps/').length);
 if(url.pathname.startsWith(ROOT.pathname+'apps/')&&appPart){
  const id=appPart.split('/')[0];
  event.respondWith((async()=>{
   const version=await activeVersion(id);
   if(version){
    const cache=await caches.open(CACHE_PREFIX+id+'-'+version);
    const exact=new URL(url.href);
    if(exact.pathname.endsWith('/'))exact.pathname+='index.html';
    exact.search='';exact.hash='';
    const hit=await cache.match(exact.href);
    if(hit)return hit;
   }
   return fetch(req);
  })());
  return;
 }
 if(url.pathname.endsWith('/apps.json')||url.pathname.endsWith('/offline-catalog.json')){
  event.respondWith(fetch(req).then(resp=>{
   if(resp.ok){const clone=resp.clone();event.waitUntil(caches.open(SHELL).then(c=>c.put(new URL(url.pathname,ROOT.origin).href,clone)));}
   return resp;
  }).catch(()=>caches.match(new URL(url.pathname,ROOT.origin).href)));
  return;
 }
 const core=new URL(req.url);core.search='';
 if(coreURLs.has(core.href)){
  event.respondWith(caches.open(SHELL).then(cache=>cache.match(core.href)).then(hit=>hit||fetch(req)));
 }
});
