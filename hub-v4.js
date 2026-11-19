'use strict';
// 剛剛數位小教室 v4.0.0：所有單元與子單元均由 apps.json 管理。
const fallbackTopics=[
  {id:'plant',name:'植物',children:[
    {id:'plant-classification',name:'分類',url:'https://pipipopo7410.github.io/Plant-Classification/'},
    {id:'plant-physiology',name:'運輸與光合',url:'https://pipipopo7410.github.io/Plant-2-Physiology/'},
    {id:'plant-reproduction',name:'生殖與遺傳',url:'https://pipipopo7410.github.io/Plant-Reproduction/'}]},
  {id:'enzyme',name:'酵素',url:'https://pipipopo7410.github.io/Enzyme-PhET/'},
  {id:'circulation',name:'循環',children:[
    {id:'circulation-2d',name:'2D 血液循環',url:'https://pipipopo7410.github.io/Circulation-2D/'},
    {id:'circulation-3d',name:'3D 血液循環',url:'https://pipipopo7410.github.io/-Circulation-3D/'}]},
  {id:'nervous',name:'神經',url:'https://pipipopo7410.github.io/Nervous-WordCards/'},
  {id:'glucose',name:'血糖',url:'https://pipipopo7410.github.io/Glucose-WordCards/'},
  {id:'ammonia',name:'排氨',url:'https://pipipopo7410.github.io/Ammonia-WordCards/'},
  {id:'reproduction',name:'生殖',url:'https://pipipopo7410.github.io/Chromosome-Counting/'},
  {id:'genetics',name:'遺傳',url:'https://pipipopo7410.github.io/Genetics-Monsters/'},
  {id:'taxonomy',name:'分類',children:[
    ...[1,2,3,4].map((n)=>({id:`taxonomy-${n}`,name:['整體複習','單一生物特徵','分類判斷','檢索表練習'][n-1],url:'https://pipipopo7410.github.io/Taxonomy-Key/',entry:{type:'taxonomy',stage:n},checkFiles:[`https://pipipopo7410.github.io/Taxonomy-Key/stage${n}.html`]}))]}
];
const colors=['#FBE6EA','#FCEBD9','#F0E3F7','#E1F0E9','#E5EAFB','#F9E3EF','#FFF0D9','#E6E2F5','#DFF2F1'];
const icons={
  ready:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  cached:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  unknown:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg>'
};
const $=id=>document.getElementById(id);
const grid=$('grid'),heading=$('section-title'),count=$('section-count');
const summaryText=$('status-summary-text'),summaryDot=$('status-dot');
const offlineDialog=$('offline-dialog'),offlineList=$('offline-list');
let topics=[],checks=new Map(),allLeaves=[],checkRun=0;

function safeURL(url){try{const u=new URL(url,location.href);return u.protocol==='https:'||u.protocol==='http:'?u.href:null;}catch(_){return null;}}
function cleanTopics(raw){
  if(!raw||!Array.isArray(raw.topics))throw new Error('單元清單格式錯誤');
  const seen=new Set();
  function clean(entry){
    if(!entry||typeof entry.id!=='string'||typeof entry.name!=='string'||seen.has(entry.id))return null;
    seen.add(entry.id);
    const item={id:entry.id,name:entry.name};
    if(Array.isArray(entry.children)&&entry.children.length){item.children=entry.children.map(clean).filter(Boolean);}
    else item.url=safeURL(entry.url);
    if(entry.entry&&entry.entry.type==='taxonomy'&&[1,2,3,4].includes(entry.entry.stage))item.entry={type:'taxonomy',stage:entry.entry.stage};
    if(Array.isArray(entry.checkFiles))item.checkFiles=entry.checkFiles.map(safeURL).filter(Boolean);
    return item;
  }
  return raw.topics.map(clean).filter(Boolean);
}
async function loadTopics(){
  if(location.protocol==='file:')return fallbackTopics;
  try{const response=await fetch('./apps.json',{cache:'no-cache'});if(!response.ok)throw new Error('清單下載失敗');return cleanTopics(await response.json());}
  catch(_){
    try{const response=await caches.match(new URL('./apps.json',location.href));if(response)return cleanTopics(await response.json());}catch(_){/* ignore */}
    return fallbackTopics;
  }
}
function leafList(){return topics.flatMap(t=>Array.isArray(t.children)?t.children.map(c=>({...c,group:t.name})): [{...t,group:''}]);}
function currentTopic(){
  const m=location.hash.match(/^#\/([a-zA-Z0-9_-]+)$/);
  return m?topics.find(t=>t.id===m[1]&&Array.isArray(t.children)):null;
}
function destination(app){
  if(app.entry?.type==='taxonomy')return `./taxonomy.html?stage=${app.entry.stage}`;
  return safeURL(app.url)||'#';
}
function statusMarkup(state,label){const span=document.createElement('span');span.className=`tile-status ${state}`;span.innerHTML=icons[state]||icons.unknown;const text=document.createElement('span');text.textContent=label;span.appendChild(text);return span;}
function tileFor(app,index,offset=0){
  const a=document.createElement('a');a.className='tile';a.style.backgroundColor=colors[(index+offset)%colors.length];
  if(Array.isArray(app.children)){
    a.href=`#/${app.id}`;
    a.addEventListener('click',e=>{e.preventDefault();history.pushState({topic:app.id},'',a.getAttribute('href'));renderRoute();});
  }else{
    a.href=destination(app);
    if(a.getAttribute('href')==='#')a.addEventListener('click',e=>e.preventDefault());
  }
  const title=document.createElement('span');title.className='tile-title';title.textContent=app.name;
  const status=statusMarkup('unknown','檢查中');status.dataset.statusId=app.id;
  a.append(title,status);return a;
}
function statusForTopic(topic){
  const children=topic.children||[topic];
  const statuses=children.map(c=>checks.get(c.id)||{state:'unknown',label:'尚未確認'});
  const ready=statuses.filter(s=>s.state==='ready').length;
  const cached=statuses.filter(s=>s.state==='cached').length;
  if(ready===children.length)return{state:'ready',label:'離線已驗證'};
  if(ready||cached)return{state:'cached',label:`${ready}/${children.length} 已驗證`};
  return{state:'unknown',label:'離線待確認'};
}
function updateTileStates(){
  document.querySelectorAll('[data-status-id]').forEach(el=>{
    const topic=topics.find(t=>t.id===el.dataset.statusId);
    const item=topic||allLeaves.find(a=>a.id===el.dataset.statusId);
    if(!item)return;
    const st=topic?statusForTopic(topic):checks.get(item.id)||{state:'unknown',label:'尚未確認'};
    const updated=statusMarkup(st.state,st.label);updated.dataset.statusId=el.dataset.statusId;el.replaceWith(updated);
  });
}
function renderRoute(){
  const topic=currentTopic();
  const entries=topic?topic.children:topics;
  heading.textContent=topic?topic.name:'選擇單元';
  count.textContent=topic?`${entries.length} 個選項`:`${entries.length} 個主題`;
  grid.replaceChildren();
  const offset=topic?Math.max(0,topics.findIndex(t=>t.id===topic.id)*2):0;
  entries.forEach((app,i)=>grid.appendChild(tileFor(app,i,offset)));
  updateTileStates();
}
function verifiedKey(app){return `gg-room-offline-v4:${app.id}:${app.url||''}:${(app.checkFiles||[]).join('|')}`;}
function wasVerified(app){try{return localStorage.getItem(verifiedKey(app))==='yes';}catch(_){return false;}}
function setVerified(app,yes){try{if(yes)localStorage.setItem(verifiedKey(app),'yes');else localStorage.removeItem(verifiedKey(app));}catch(_){/* private browsing may block storage */}}
function scopeMatches(reg,url){return !!(reg.active&&url.href.startsWith(reg.scope));}
async function checkOne(app,regs){
  // 只看同源 Service Worker 與 Cache Storage；不能用 navigator.onLine 冒充離線能力。
  if(location.protocol!=='https:'||!('caches' in window)||!('serviceWorker' in navigator))return{state:'unknown',label:'尚未確認',canMark:false};
  const urls=[app.url,...(app.checkFiles||[])].map(x=>{try{return new URL(x);}catch(_){return null;}});
  if(urls.some(u=>!u||u.origin!==location.origin))return{state:'unknown',label:'尚未確認',canMark:false};
  if(!regs.some(reg=>scopeMatches(reg,urls[0])))return{state:'unknown',label:'尚未偵測到離線快取',canMark:false};
  try{
    const cached=await Promise.all(urls.map(async u=>{
      const candidates=[u.href];
      if(u.pathname.endsWith('/'))candidates.push(new URL('index.html',u).href);
      for(const href of candidates){const r=await caches.match(href,{ignoreSearch:true});if(r&&r.ok)return true;}
      return false;
    }));
    if(cached.some(ok=>!ok))return{state:'unknown',label:'必要頁面尚未快取',canMark:false};
    if(wasVerified(app))return{state:'ready',label:'已斷網測試（仍需定期抽查）',canMark:true};
    return{state:'cached',label:'已偵測快取・待斷網測試',canMark:true};
  }catch(_){return{state:'unknown',label:'快取檢查失敗',canMark:false};}
}
async function refreshStatuses(){
  const token=++checkRun;
  let regs=[];
  try{if('serviceWorker' in navigator)regs=await navigator.serviceWorker.getRegistrations();}catch(_){/* ignore */}
  const pairs=await Promise.all(allLeaves.map(async app=>[app.id,await checkOne(app,regs)]));
  if(token!==checkRun)return;
  checks=new Map(pairs);
  const ready=pairs.filter(([,s])=>s.state==='ready').length;
  const cached=pairs.filter(([,s])=>s.state==='cached').length;
  summaryText.textContent=`${ready}/${allLeaves.length} 已驗證離線`;
  summaryDot.className=`status-dot ${ready===allLeaves.length?'good':cached||ready?'partial':''}`;
  updateTileStates();
  if(offlineDialog.open)renderOfflineList();
}
function renderOfflineList(){
  offlineList.replaceChildren();
  for(const app of allLeaves){
    const st=checks.get(app.id)||{state:'unknown',label:'尚未確認',canMark:false};
    const row=document.createElement('div');row.className='offline-row';
    const info=document.createElement('div');
    const name=document.createElement('div');name.className='offline-name';name.textContent=(app.group?app.group+' · ':'')+app.name;
    const state=document.createElement('div');state.className=`offline-state ${st.state}`;state.textContent=st.label;
    info.append(name,state);
    const actions=document.createElement('div');actions.className='offline-actions';
    const visit=document.createElement('button');visit.type='button';visit.textContent='開啟工具';visit.addEventListener('click',()=>{location.href=destination(app);});
    const confirm=document.createElement('button');confirm.type='button';confirm.disabled=!st.canMark;
    confirm.textContent=st.state==='ready'?'取消驗證':'已斷網實測';
    confirm.title=st.canMark?'請只在實際關閉 Wi-Fi 並確認該工具功能正常後使用':'請先連線開啟工具，讓其安裝離線資源';
    confirm.addEventListener('click',async()=>{setVerified(app,st.state!=='ready');await refreshStatuses();});
    actions.append(visit,confirm);row.append(info,actions);offlineList.appendChild(row);
  }
}
function openOfflineDialog(){if(!offlineDialog.open)offlineDialog.showModal();renderOfflineList();refreshStatuses();}
$('status-summary').addEventListener('click',openOfflineDialog);
$('close-dialog').addEventListener('click',()=>offlineDialog.close());
$('dialog-done').addEventListener('click',()=>offlineDialog.close());
$('refresh-status').addEventListener('click',refreshStatuses);
offlineDialog.addEventListener('click',e=>{if(e.target===offlineDialog)offlineDialog.close();});
window.addEventListener('popstate',renderRoute);
window.addEventListener('pageshow',()=>refreshStatuses());
window.addEventListener('online',refreshStatuses);
(async()=>{
  topics=await loadTopics();allLeaves=leafList();
  renderRoute();
  if(location.protocol==='https:'&&'serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('首頁離線快取尚未啟用',err));
  }
  await refreshStatuses();
})();
