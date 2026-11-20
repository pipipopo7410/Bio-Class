'use strict';
// All cache operations happen in this device; no external tracking or student account.
const ROOT=new URL('./',location.href);
const STATE_URL=new URL('./__gg_offline_state__',ROOT).href;
const INDEX_PREFIX=new URL('./__gg_index__/',ROOT).href;
const META_CACHE='gg-room-offline-meta-v1';
const PREFIX='gg-module-v1-';
const el=id=>document.getElementById(id);
let catalog=null, state={modules:{}}, busy=false, progressDone=0, progressTotal=0;
const $list=el('list');
const getModule=id=>catalog?.modules.find(m=>m.id===id);
function keyFor(id,version){return PREFIX+id+'-'+version;}
function resourceURL(path){const url=new URL(path,ROOT);if(url.origin!==ROOT.origin||!url.pathname.startsWith(ROOT.pathname))throw new Error('非法資源路徑');return url.href;}
async function getJSON(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}
async function getMeta(){return caches.open(META_CACHE);}
async function loadState(){try{const r=await (await getMeta()).match(STATE_URL);const v=r?await r.json():null;return v?.modules&&typeof v.modules==='object'?v:{modules:{}};}catch{return {modules:{}};}}
async function saveState(){await (await getMeta()).put(STATE_URL,new Response(JSON.stringify(state),{headers:{'Content-Type':'application/json'}}));}
async function oldManifest(id){try{const r=await(await getMeta()).match(INDEX_PREFIX+id);return r?await r.json():null;}catch{return null;}}
async function saveManifest(id,mod){await(await getMeta()).put(INDEX_PREFIX+id,new Response(JSON.stringify(mod),{headers:{'Content-Type':'application/json'}}));}
function humanSize(bytes){return bytes>=1e9?(bytes/1e9).toFixed(2)+' GB':bytes>=1e6?(bytes/1e6).toFixed(1)+' MB':Math.max(1,Math.ceil(bytes/1024))+' KB';}
function safeText(str){return String(str??'');}
function reportError(msg){el('error').textContent=msg;}
function setProgress(text,done,total){el('progress-area').hidden=false;el('progress-text').textContent=text;el('progress-percent').textContent=total?Math.round(done*100/total)+'%':'—';el('progress-bar').value=total?done*100/total:0;}
async function isComplete(mod){if(mod?.status!=='candidate'||state.modules[mod.id]?.version!==mod.version)return false;
 const c=await caches.open(keyFor(mod.id,mod.version));
 const keys=new Set((await c.keys()).map(req=>req.url));
 return mod.files.every(file=>keys.has(resourceURL(file.path)));
}
async function getStatus(mod){
 if(mod.status!=='candidate')return {name:'來源未同步',cls:'bad'};
 const active=state.modules[mod.id];
 if(!active)return {name:'尚未下載',cls:'wait'};
 if(active.version!==mod.version)return {name:'有更新可下載',cls:'wait'};
 const ok=await isComplete(mod);
 return ok?{name:'已快取・待斷網驗收',cls:'ok'}:{name:'檔案缺失・請重新下載',cls:'bad'};
}
async function paint(){
 if(!catalog)return;
 const ready=await Promise.all(catalog.modules.map(getStatus));
 const count=ready.filter(s=>s.name==='已快取・待斷網驗收').length;
 el('counter').textContent=count+' / '+catalog.modules.length+' 已快取';
 $list.replaceChildren();
 for(let i=0;i<catalog.modules.length;i++){
   const m=catalog.modules[i], status=ready[i];
   const article=document.createElement('article');article.className='item';
   const details=document.createElement('div');details.className='details';
   const title=document.createElement('div');title.className='name';title.textContent=m.name;
   const meta=document.createElement('div');meta.className='meta';meta.textContent=m.status==='candidate'?`${m.files.length} 個檔案 · ${humanSize(m.totalBytes)}${m.externals?.length?' · 有外部依賴需確認':''}`:'GitHub 來源尚未成功整合';
   const stat=document.createElement('div');stat.className='status '+status.cls;stat.textContent=status.name;
   details.append(title,meta,stat);
   const buttons=document.createElement('div');buttons.className='buttons';
   const down=document.createElement('button');down.className='download-one';down.textContent=status.cls==='ok'?'重新檢查／下載':'下載';down.disabled=busy||m.status!=='candidate';down.addEventListener('click',()=>startOne(m.id));
   const del=document.createElement('button');del.className='remove';del.textContent='移除';del.disabled=busy||!state.modules[m.id];del.addEventListener('click',()=>removeOne(m.id));
   buttons.append(down,del);article.append(details,buttons);$list.append(article);
 }
 el('download-all').disabled=busy||!catalog.modules.some(m=>m.status==='candidate');
 el('check-all').disabled=busy;
}
async function applyModule(m){
 const key=keyFor(m.id,m.version), cache=await caches.open(key);
 const previous=state.modules[m.id], index=previous?await oldManifest(m.id):null;
 const oldCache=previous?await caches.open(keyFor(m.id,previous.version)):null;
 const lookup=new Map(index?.files?.map(f=>[f.path,f.hash]));
 for(const f of m.files){
   const path=resourceURL(f.path);
   let done=!!(await cache.match(path));
   if(!done&&oldCache&&lookup.get(f.path)===f.hash){const prev=await oldCache.match(path);if(prev?.ok){await cache.put(path,prev.clone());done=true;}}
   if(!done){
     const request=resourceURL(f.path)+'?__gg_download='+encodeURIComponent(m.version);
     // This explicit query forces our Service Worker to fetch the new file from the server.
     const r=await fetch(request,{cache:'no-store'});
     if(!r.ok||r.type==='opaque')throw new Error(`${m.name}: ${f.path} (${r.status})`);
     // Check length if the origin provides an uncompressed body length; CDN/encoding may differ.
     await cache.put(path,r.clone());
   }
   progressDone++;
   setProgress(`${m.name} · ${progressDone}/${progressTotal} 個檔案`,progressDone,progressTotal);
 }
 const cachedPaths=new Set((await cache.keys()).map(req=>req.url));
 for(const f of m.files){if(!cachedPaths.has(resourceURL(f.path)))throw new Error(`${m.name} 有檔案尚未存入快取`);}
 // Commit point: new cache version is fully staged; only now change active version.
 state.modules[m.id]={version:m.version, downloadedAt:new Date().toISOString(), reviewed:false};
 await saveState();await saveManifest(m.id,m);
 const keys=await caches.keys();
 for(const k of keys){if(k.startsWith(PREFIX+m.id+'-')&&k!==key)await caches.delete(k);}
}
async function startDownload(ids){
 if(busy)return;busy=true;reportError('');
 const selected=ids.map(getModule).filter(m=>m&&m.status==='candidate');
 progressTotal=selected.reduce((n,m)=>n+m.files.length,0);progressDone=0;
 setProgress('準備下載…',0,progressTotal);
 await paint();
 const errors=[];
 try{
   for(const m of selected){
     try{await applyModule(m);}catch(e){errors.push(e.message||String(e));}
   }
 }finally{busy=false;await paint();}
 setProgress(errors.length?`完成 ${selected.length-errors.length} 個；${errors.length} 個未完成`:'已下載完成，請關閉 Wi-Fi 測試',progressDone,progressTotal);
 if(errors.length)reportError(errors.slice(0,5).join('\n'));
}
async function startOne(id){await startDownload([id]);}
async function removeOne(id){if(busy)return;busy=true;reportError('');
 try{delete state.modules[id];await saveState();const keys=await caches.keys();for(const k of keys)if(k.startsWith(PREFIX+id+'-'))await caches.delete(k);}catch(e){reportError(String(e));}
 finally{busy=false;await paint();}}
async function init(){
 try{
   if(location.protocol==='file:')throw new Error('下載功能需要先發布到 HTTPS／GitHub Pages，不能只用 file:// 測試');
   if(!('caches' in window))throw new Error('此瀏覽器不支援 Cache Storage');
   state=await loadState();
   try{catalog=await getJSON('./offline-catalog.json');}
   catch{const cached=await caches.match(new URL('./offline-catalog.json',ROOT));if(cached)catalog=await cached.json();}
   if(!catalog||!Array.isArray(catalog.modules))throw new Error('無法取得教材清單');
   if(!catalog.buildReady)reportError('目前尚未執行 GitHub Actions「Build offline classroom」；請先完成首次同步，才有可下載的教材。');
   if('serviceWorker' in navigator){try{await navigator.serviceWorker.register('./sw.js');}catch(e){reportError('Service Worker 未啟用：'+e.message);}}
   await paint();
 }catch(e){reportError(e.message||String(e));el('counter').textContent='尚未就緒';$list.replaceChildren();}
}
el('download-all').addEventListener('click',()=>{if(!catalog)return;
 const targets=catalog.modules.filter(x=>x.status==='candidate');
 const allBytes=targets.reduce((n,m)=>n+m.totalBytes,0);
 if(confirm(`準備在這台 iPad 下載 ${targets.length} 個教材，約 ${humanSize(allBytes)}。請保持 Wi-Fi 與畫面開啟，是否開始？`))startDownload(targets.map(m=>m.id));
});
el('check-all').addEventListener('click',async()=>{if(busy)return;state=await loadState();await paint();});
init();
