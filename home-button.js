/* 共用「返回首頁」懸浮按鈕模板｜尚未安裝到其他 12 個網站。需在各原站加入 script 標籤才生效。 */
(()=>{
  'use strict';
  if(document.getElementById('gang-home-button-host'))return;
  const myScript=document.currentScript;
  let target='https://pipipopo7410.github.io/biology-hub/';
  if(myScript?.dataset?.hubUrl){try{const u=new URL(myScript.dataset.hubUrl,location.href);if(u.protocol==='https:')target=u.href;}catch{}}
  const host=document.createElement('div');host.id='gang-home-button-host';
  host.style.cssText='position:fixed;right:calc(12px + env(safe-area-inset-right));bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483640;width:46px;height:46px;touch-action:none;';
  const shadow=host.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>
  button{box-sizing:border-box;display:grid;place-items:center;width:46px;height:46px;padding:0;border:1px solid rgba(255,255,255,.8);border-radius:16px;background:rgba(251,246,251,.86);color:#45516d;box-shadow:0 3px 12px rgba(18,26,45,.2);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);cursor:pointer;opacity:.82;transition:opacity .25s}
  button:hover,button:focus-visible,button:active{opacity:1}svg{width:23px;height:23px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
  </style><button type="button" aria-label="返回剛剛數位小教室" title="返回首頁"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/></svg></button>`;
  const btn=shadow.querySelector('button');let start=null, moved=false;
  btn.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY,right:parseFloat(getComputedStyle(host).right)||12,bottom:parseFloat(getComputedStyle(host).bottom)||12};moved=false;btn.setPointerCapture(e.pointerId);});
  btn.addEventListener('pointermove',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;if(Math.abs(dx)+Math.abs(dy)>8)moved=true;if(!moved)return;const right=Math.max(0,Math.min(innerWidth-48,start.right-dx));const bottom=Math.max(0,Math.min(innerHeight-48,start.bottom-dy));host.style.right=right+'px';host.style.bottom=bottom+'px';});
  btn.addEventListener('pointerup',()=>{start=null;});
  btn.addEventListener('click',e=>{if(moved){e.preventDefault();moved=false;return;}location.href=target;});
  (document.body||document.documentElement).append(host);
})();
