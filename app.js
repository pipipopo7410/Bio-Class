'use strict';
// v5：只有入口視覺、導覽與安裝說明。不要將「加入主畫面」誤認為所有教學網頁均可離線。
const palette=['#FBE5E9','#FCEBD9','#E7E3F5','#E1F0E9','#E5EAFB','#F9E3EF','#FFF0D9','#E6F0E9','#DFF2F1'];
const $=id=>document.getElementById(id);
const grid=$('grid'),section=$('section-bar'),sectionName=$('section-name');
const dialog=$('install-dialog');
let catalog=[];
let cachedModules=new Set();
const SITE_ROOT=new URL('./',location.href);
const fallbackData={"version":"5.0.0","title":"剛剛の數位小教室","topics":[{"id":"plant","name":"植物","children":[{"id":"plant-classification","name":"分類","url":"https://pipipopo7410.github.io/Plant-Classification/"},{"id":"plant-physiology","name":"運輸與光合","url":"https://pipipopo7410.github.io/Plant-2-Physiology/"},{"id":"plant-reproduction","name":"生殖與遺傳","url":"https://pipipopo7410.github.io/Plant-Reproduction/"}]},{"id":"enzyme","name":"酵素","url":"https://pipipopo7410.github.io/Enzyme-PhET/"},{"id":"circulation","name":"循環","children":[{"id":"circulation-2d","name":"2D 血液循環","url":"https://pipipopo7410.github.io/Circulation-2D/"},{"id":"circulation-3d","name":"3D 血液循環","url":"https://pipipopo7410.github.io/-Circulation-3D/"}]},{"id":"nervous","name":"神經","url":"https://pipipopo7410.github.io/Nervous-WordCards/"},{"id":"glucose","name":"血糖","url":"https://pipipopo7410.github.io/Glucose-WordCards/"},{"id":"ammonia","name":"排氨","url":"https://pipipopo7410.github.io/Ammonia-WordCards/"},{"id":"reproduction","name":"生殖","url":"https://pipipopo7410.github.io/Chromosome-Counting/"},{"id":"genetics","name":"遺傳","url":"https://pipipopo7410.github.io/Genetics-Monsters/"},{"id":"taxonomy","name":"分類","children":[{"id":"taxonomy-1","name":"整體複習","url":"https://pipipopo7410.github.io/Taxonomy-Key/","entry":{"type":"taxonomy","stage":1},"checkFiles":["https://pipipopo7410.github.io/Taxonomy-Key/stage1.html"]},{"id":"taxonomy-2","name":"單一生物特徵","url":"https://pipipopo7410.github.io/Taxonomy-Key/","entry":{"type":"taxonomy","stage":2},"checkFiles":["https://pipipopo7410.github.io/Taxonomy-Key/stage2.html"]},{"id":"taxonomy-3","name":"分類判斷","url":"https://pipipopo7410.github.io/Taxonomy-Key/","entry":{"type":"taxonomy","stage":3},"checkFiles":["https://pipipopo7410.github.io/Taxonomy-Key/stage3.html"]},{"id":"taxonomy-4","name":"檢索表練習","url":"https://pipipopo7410.github.io/Taxonomy-Key/","entry":{"type":"taxonomy","stage":4},"checkFiles":["https://pipipopo7410.github.io/Taxonomy-Key/stage4.html"]}]}]};
function isSafeUrl(x){try{const u=new URL(x,location.href);return u.protocol==='https:'||u.protocol==='http:';}catch{return false;}}
function normalize(list){
  if(!Array.isArray(list))throw new Error('單元格式錯誤');
  const ids=new Set();
  function norm(e){
    if(!e||typeof e.id!=='string'||typeof e.name!=='string'||ids.has(e.id))return null;
    ids.add(e.id);const t={id:e.id,name:e.name};
    if(Array.isArray(e.children)&&e.children.length)t.children=e.children.map(norm).filter(Boolean);
    else if(isSafeUrl(e.url))t.url=e.url;
    else return null;
    if(e.entry?.type==='taxonomy'&&[1,2,3,4].includes(e.entry.stage))t.entry={type:'taxonomy',stage:e.entry.stage};
    return t;
  }
  return list.map(norm).filter(Boolean);
}
async function getCatalog(){
  if(location.protocol==='file:')return normalize(fallbackData.topics);
  try{const r=await fetch('./apps.json',{cache:'no-cache'});if(!r.ok)throw new Error('讀取失敗');return normalize((await r.json()).topics);}
  catch(err){console.warn('無法取得最新清單，使用本機備援',err);return normalize(fallbackData.topics);}
}
function sectionTopic(){const m=location.hash.match(/^#\/([a-zA-Z0-9_-]+)$/);return m?catalog.find(t=>t.id===m[1]&&t.children):null;}
function destination(e){
  const id=e.entry?.type==='taxonomy'?'taxonomy':e.id;
  const local=cachedModules.has(id);
  if(e.entry?.type==='taxonomy')return `./taxonomy.html?stage=${e.entry.stage}${local?'&local=1':''}`;
  return local?`./apps/${encodeURIComponent(id)}/index.html`:e.url;
}
async function refreshOfflineLocations(){
 try{
  const [meta,cachedCatalog]=await Promise.all([caches.open('gg-room-offline-meta-v1'),caches.match(new URL('./offline-catalog.json',SITE_ROOT).href)]);
  const r=cachedCatalog||(await fetch('./offline-catalog.json',{cache:'no-cache'}));
  if(!r.ok)return;
  const manifest=await r.json();
  const saved=await meta.match(new URL('./__gg_offline_state__',SITE_ROOT).href);
  if(!saved)return;
  const active=(await saved.json()).modules||{};
  const found=new Set();
  for(const mod of (manifest.modules||[])){
    if(!active[mod.id]?.version)continue;
    const appCache=await caches.open('gg-module-v1-'+mod.id+'-'+active[mod.id].version);
    if(await appCache.match(new URL(`./apps/${mod.id}/index.html`,SITE_ROOT).href))found.add(mod.id);
  }
  cachedModules=found;
  render();
 }catch(err){console.warn('目前不使用本機教材入口',err);}
}
function goHome(){if(location.hash){history.pushState(null,'',location.pathname+location.search);render();}}
function render(){
  const current=sectionTopic(),entries=current?current.children:catalog;
  section.hidden=!current;
  if(current)sectionName.textContent=current.name;
  grid.classList.toggle('children',!!current);
  const offset=current?catalog.findIndex(t=>t.id===current.id)*2:0;
  const tiles=entries.map((e,i)=>{
    const a=document.createElement('a');a.className='tile';a.style.backgroundColor=palette[(i+offset)%palette.length];
    const title=document.createElement('span');title.textContent=e.name;a.append(title);
    if(e.children){a.href='#/'+e.id;a.addEventListener('click',evt=>{evt.preventDefault();history.pushState(null,'',a.getAttribute('href'));render();});}
    else a.href=destination(e);
    return a;
  });
  grid.replaceChildren(...tiles);
}
$('back-button').addEventListener('click',goHome);
window.addEventListener('popstate',render);
window.addEventListener('hashchange',render);
$('install-help').addEventListener('click',()=>dialog.showModal());
$('close-install').addEventListener('click',()=>dialog.close());
$('done-install').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
(async()=>{
  catalog=await getCatalog();render();
  if(location.protocol!=='file:'&&'caches' in window)refreshOfflineLocations();
  if(location.protocol==='https:'&&'serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('首頁快取未啟用',err));
  }
})();
