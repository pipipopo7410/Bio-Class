
async function loadData(){
  const res=await fetch('./assets/apps.json');
  return await res.json();
}
const grid=document.getElementById('grid');
const bar=document.getElementById('section-bar');
const barTitle=document.getElementById('section-name');
const backBtn=document.getElementById('back-button');
const installDialog=document.getElementById('install-dialog');
const installBtn=document.getElementById('install-help');
const closeInstall=document.getElementById('close-install');
const doneInstall=document.getElementById('done-install');
const colorMap={rose:'rose',beige:'beige',lavender:'lavender',mint:'mint',blue:'blue',pink:'pink',sand:'sand',violet:'violet',sage:'sage'};
let data=[];
function cardEl(item, color, href){
  const a=document.createElement('a');
  a.className=`card ${colorMap[color]||'rose'}`;
  a.href=href||'#';
  a.innerHTML=`<div class="name ${item.name.length>=6?'small':''}">${item.name}</div>`;
  return a;
}
function renderHome(){
  bar.hidden=true; grid.innerHTML='';
  data.forEach((item)=>{
    if(item.children){
      const btn=cardEl(item,item.color,'#'+encodeURIComponent(item.name));
      grid.appendChild(btn);
    }else{
      const a=cardEl(item,item.color,item.url); a.target='_self'; grid.appendChild(a);
    }
  });
}
function renderSection(name){
  const item=data.find(x=>x.name===name);
  if(!item||!item.children){ renderHome(); return; }
  bar.hidden=false; barTitle.textContent=name; grid.innerHTML='';
  item.children.forEach((child,idx)=>{
    const colors=['rose','beige','lavender','mint','blue','pink','sand','violet','sage'];
    const a=cardEl(child, colors[idx%colors.length], child.url); a.target='_self'; grid.appendChild(a);
  });
}
function syncFromHash(){
  const hash=decodeURIComponent(location.hash.replace(/^#/,''));
  if(hash){ renderSection(hash); } else { renderHome(); }
}
backBtn?.addEventListener('click',()=>{ history.pushState('',document.title,window.location.pathname); syncFromHash(); });
window.addEventListener('hashchange', syncFromHash);
installBtn?.addEventListener('click',()=>installDialog.showModal());
closeInstall?.addEventListener('click',()=>installDialog.close());
doneInstall?.addEventListener('click',()=>installDialog.close());
installDialog?.addEventListener('click',(e)=>{ const rect=installDialog.getBoundingClientRect(); if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom) installDialog.close(); });
loadData().then(r=>{data=r; syncFromHash();}).catch(()=>{grid.innerHTML='<p class="loading">載入失敗，請重新整理。</p>';});
if('serviceWorker' in navigator){ window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{})); }
