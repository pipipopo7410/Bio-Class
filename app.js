'use strict';

// 網站資料以 apps.json 為準。僅在直接用電腦開啟 HTML 或讀取失敗時，使用基本清單預覽。
const previewApps = [
  ['plant','植物','plant-all'],['enzyme','酵素','ipad-test-enzyme'],
  ['circulation','循環','ipad-test-blood'],['nervous','神經','ipad-test-neuron'],
  ['sugar','血糖','ipad-test-sugar'],['ammonia','排氨','ipad-test-anomi'],
  ['reproduction','生殖','chromosome'],['genetics','遺傳','Bio---genetics'],
  ['classification','分類','5kingdoms']
].map(([id,name,repo])=>({id,name,url:`https://pipipopo7410.github.io/${repo}/`,offline:{mode:'external'}}));

const palette = ['#FBE8EC','#FCEADA','#F2E5F8','#E1F0E9','#E5EBFA','#F9E5EF','#FFF0DD','#E8E8F9','#E0F3F0'];
const grid = document.getElementById('grid');
const summaryText = document.getElementById('summary-text');
const summaryLight = document.querySelector('.summary-light');
const note = document.getElementById('note');
const recheck = document.getElementById('recheck');
const prepare = document.getElementById('prepare');
let apps = [];

const symbols = {
  ready:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  pending:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3"/></svg>',
  online:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 17v3h14v-3"/></svg>',
  unset:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg>'
};

function internalURL(relativePath) {
  const url = new URL(relativePath, new URL('./',location.href));
  const base = new URL('./', location.href);
  return url.origin === base.origin && url.pathname.startsWith(base.pathname) ? url : null;
}
function cleanApps(data) {
  if (!data || !Array.isArray(data.apps)) throw new Error('apps.json 格式不正確');
  const seen = new Set();
  return data.apps.filter(app => {
    if (!app || typeof app.id!=='string' || typeof app.name!=='string' || typeof app.url!=='string') return false;
    if (seen.has(app.id)) return false;
    seen.add(app.id);return true;
  });
}
async function loadApps() {
  if(location.protocol === 'file:') {
    note.textContent='目前是本機排版預覽；正式新增單元請修改 apps.json 並上傳到 GitHub Pages。';
    return previewApps;
  }
  try {
    const response=await fetch('./apps.json',{cache:'no-cache'});
    if(!response.ok) throw new Error('無法讀取單元清單');
    return cleanApps(await response.json());
  }catch(error) {
    // 離線時 service worker 可能尚未接管，直接使用 Cache Storage 的備份。
    if('caches' in window){
      try{const response=await caches.match(new URL('./apps.json',location.href));if(response) return cleanApps(await response.json());}catch(_){ /* ignore */ }
    }
    note.textContent='無法載入最新單元設定；目前顯示預設清單。';
    return previewApps;
  }
}
async function statusFor(app) {
  if(!app.url) return {kind:'unset',label:'尚未設定'};
  const offline=app.offline || {};
  if(offline.mode!=='local') return {kind:'online',label:'需連線'};
  const target=internalURL(app.url);
  const files=[app.url,...(Array.isArray(offline.files)?offline.files:[])];
  const paths=files.map(internalURL);
  if(!target || paths.some(url=>!url)) return {kind:'unset',label:'離線設定異常'};
  if(!('caches' in window) || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return {kind:'pending',label:'尚未預載'};
  try{
    const cache=await caches.open(cacheName(app));
    const responses=await Promise.all(paths.map(url=>cache.match(url.href)));
    if(responses.some(res=>!res || !res.ok))return {kind:'pending',label:'尚未預載'};
    // verified=true 只在教師完整斷網實測後手動設定；避免假陽性。
    return offline.verified===true ? {kind:'ready',label:'離線可用'} : {kind:'pending',label:'已快取・待驗證'};
  }catch(_){return {kind:'pending',label:'尚未預載'};}
}
function cacheName(app){return `gg-room-module-${app.id}-${String((app.offline||{}).version||'v1')}`;}
function colorAt(i){return palette[i%palette.length];}
function render() {
  grid.replaceChildren();
  for(let i=0;i<apps.length;i++){
    const app=apps[i];const tile=document.createElement('a');
    tile.className='tile';tile.style.backgroundColor=colorAt(i);
    try{const u=new URL(app.url,location.href);if(['http:','https:'].includes(u.protocol))tile.href=u.href;}catch(_){ /* unset */ }
    if(!tile.href){tile.href='#';tile.addEventListener('click',e=>e.preventDefault());}
    // 保留 Safari 原生上一頁；不使用 iframe、不開新分頁、不添加工具頂部欄。
    const title=document.createElement('span');title.className='tile-title';title.textContent=app.name;
    const status=document.createElement('span');status.className='tile-status online';status.innerHTML=symbols.online+'<span>檢查中</span>';
    tile.append(title,status);grid.appendChild(tile);
    app._statusElement=status;
  }
}
async function refreshStatus() {
  const results=await Promise.all(apps.map(statusFor));
  results.forEach((result,i)=>{
    const el=apps[i]._statusElement;if(!el)return;
    el.className=`tile-status ${result.kind}`;
    el.innerHTML=symbols[result.kind];
    const label=document.createElement('span');label.textContent=result.label;el.appendChild(label);
  });
  const good=results.filter(result=>result.kind==='ready').length;
  summaryText.textContent=`${good} / ${apps.length} 個單元離線可用`;
  summaryLight.classList.toggle('good',good>0);
  summaryLight.classList.toggle('warn',good===0);
}

// 此功能供日後已搬入同一平台的模組預載使用；外部網址不會被宣稱已快取。
async function prepareLocalApp(app) {
  const offline=app.offline||{};
  if(offline.mode!=='local') throw new Error('尚未搬入同一平台');
  const paths=[app.url,...(Array.isArray(offline.files)?offline.files:[])].map(internalURL);
  if(paths.some(url=>!url)) throw new Error('所有離線資源都必須位於平台資料夾內');
  const cache=await caches.open(cacheName(app));
  for(const path of paths){
    const response=await fetch(path.href,{cache:'reload'});
    if(!response.ok) throw new Error(`資源下載失敗：${path.pathname}`);
    await cache.put(path.href,response);
  }
  // 新版本完整下載後，才移除相同單元的舊版，避免更新途中無法離線使用。
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith(`gg-room-module-${app.id}-`) && key!==cacheName(app)).map(key=>caches.delete(key)));
}
// 提供給日後工具整合時調用，現在沒有綁定到外部網站按鈕。
window.GangGangOffline = {prepareLocalApp};

recheck.addEventListener('click',refreshStatus);
prepare.addEventListener('click',async()=>{
  const local=apps.filter(app=>(app.offline||{}).mode==='local');
  if(!local.length)return;
  prepare.disabled=true;prepare.textContent='正在預載…';
  let success=0;
  for(const app of local){try{await prepareLocalApp(app);success++;}catch(err){console.warn('預載失敗',app.name,err);}}
  prepare.disabled=false;prepare.textContent='預載工具';
  await refreshStatus();
  note.textContent=`已完成 ${success} / ${local.length} 個本機單元預載；未實際斷網測試前仍不會顯示「離線可用」。`;
});
window.addEventListener('pageshow',refreshStatus);
(async()=>{
  apps=await loadApps();
  prepare.hidden=!apps.some(app=>(app.offline||{}).mode==='local');
  render();
  if('serviceWorker' in navigator && location.protocol==='https:'){
    navigator.serviceWorker.register('./sw.js').then(()=>refreshStatus()).catch(()=>refreshStatus());
  }
  await refreshStatus();
})();
