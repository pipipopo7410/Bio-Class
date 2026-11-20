from pathlib import Path
import functools
import http.server
import threading
from playwright.sync_api import sync_playwright

BASE=Path('/mnt/data/gg-offline-v51-local-test')
handler=functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(BASE))
httpd=http.server.ThreadingHTTPServer(('127.0.0.1',8765),handler)
thread=threading.Thread(target=httpd.serve_forever,daemon=True)
thread.start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':1180,'height':820},service_workers='allow')
  page=context.new_page()
  errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://127.0.0.1:8765/',wait_until='networkidle')
  assert page.get_by_text('剛剛數位小教室').count()>0
  assert page.locator('.tile').count()==9
  assert page.locator('.offline-entry').count()==1
  page.screenshot(path='/mnt/data/gg-offline-v51/預覽-入口首頁.png',full_page=True)
  page.locator('.offline-entry').click()
  page.wait_for_url('**/offline.html')
  page.wait_for_function("document.querySelector('#counter').textContent.includes('12')")
  assert page.get_by_text('酵素',exact=True).count()>0
  page.screenshot(path='/mnt/data/gg-offline-v51/預覽-離線管理.png',full_page=True)
  target=page.locator('.item').filter(has=page.get_by_text('酵素',exact=True)).first
  target.get_by_role('button',name='下載').click()
  page.wait_for_function("document.querySelector('#counter').textContent.startsWith('1 /')",timeout=15000)
  assert target.get_by_text('已快取・待斷網驗收').count()>0
  context.set_offline(True)
  page.goto('http://127.0.0.1:8765/',wait_until='domcontentloaded')
  page.wait_for_function("document.querySelectorAll('.tile').length === 9",timeout=10000)
  # refreshOfflineLocations should change direct URL to the mirrored local page
  page.wait_for_function("[...document.querySelectorAll('.tile')].some(x=>x.href.includes('/apps/enzyme/index.html'))",timeout=10000)
  page.locator('a[href="./apps/enzyme/index.html"]').click()
  page.wait_for_url('**/apps/enzyme/index.html')
  assert page.locator('#verified').inner_text()=='酵素功能測試教材'
  page.locator('#run').click()
  assert page.locator('#verified').inner_text()=='互動運算成功'
  assert errors==[],errors
  print('PASS: homepage, manager, download, offline SW routing, interactive local fixture')
  browser.close()
finally:
 httpd.shutdown()
