#!/usr/bin/env python3
"""Create an offline-ready *candidate* site from public source repositories.

No remote-source code is executed in this script. A successful static copy is not
an assurance that a particular app works offline. See build audit.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SOURCES = json.loads((BASE / 'scripts' / 'sources.json').read_text(encoding='utf-8'))
OWNER = SOURCES['owner']
# Only publicly hosted, versioned front-end static libraries may be vendored here.
ALLOW_CDNS = {'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com', 'cdn.tailwindcss.com'}
EXCLUDE_DIRS = {'.git', '.github', 'node_modules', '.next', '.cache', '__pycache__', 'coverage', '.vercel'}
EXCLUDE_FILES = {'.DS_Store', '.env', '.env.local', 'Thumbs.db'}
TEXT_EXTENSIONS = {'.html', '.htm', '.css', '.js', '.mjs', '.json', '.svg', '.webmanifest'}
ENTRY_RE = re.compile(r'(<(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*)([\'\"])(https://[^\'\"]+)\2', re.I)
EXTERNAL_RE = re.compile(r'(?:(?:https?:)?//)([^\s\'\"<>`\\)]+)', re.I)
MAX_DOWNLOAD = 24 * 1024 * 1024
SITE_FILES = ['index.html','style.css','app.js','apps.json','taxonomy.html', 'sw.js',
              'manifest.webmanifest','home-button.js','offline.html','offline.js',
              'offline.css','refresh.html','README.md','完整交接說明.md']


def sha256_file(p: Path) -> str:
    h = hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda: f.read(1024*1024), b''):
            h.update(b)
    return h.hexdigest()


def clone_repo(repo: str, to: Path, fixture: Path | None) -> str:
    if fixture:
        src = fixture / repo
        if not src.is_dir():
            raise RuntimeError(f'沒有測試來源: {src}')
        shutil.copytree(src, to)
        return 'fixture'
    cmd=['git','-c','http.lowSpeedLimit=200','-c','http.lowSpeedTime=60',
         'clone','--depth','1','--single-branch',
         f'https://github.com/{OWNER}/{repo}.git',str(to)]
    env={**os.environ, 'GIT_LFS_SKIP_SMUDGE':'1', 'GIT_TERMINAL_PROMPT':'0'}
    p=subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                     text=True, timeout=180, env=env)
    if p.returncode:
        raise RuntimeError(p.stderr.strip()[-450:] or 'Git clone 失敗')
    rev=subprocess.run(['git','-C',str(to),'rev-parse','--short=10','HEAD'],
                       text=True, capture_output=True)
    return rev.stdout.strip() or 'unknown'


def root_dir(src: Path) -> Path:
    for sub in ('', 'docs', 'dist', 'build', 'public'):
        p = src / sub
        if (p/'index.html').is_file():
            return p
    raise RuntimeError('找不到網站 index.html，可能需從另一個部署分支取得')


def copy_source(src: Path, dest: Path) -> list[str]:
    warnings=[]
    for item in src.rglob('*'):
        rel=item.relative_to(src)
        if any(x in EXCLUDE_DIRS for x in rel.parts):
            continue
        if item.is_symlink():
            warnings.append(f'未收錄符號連結: {rel.as_posix()}')
            continue
        if not item.is_file() or item.name in EXCLUDE_FILES or item.name.startswith('.env'):
            continue
        if item.stat().st_size > 99_000_000:
            raise RuntimeError(f'單一檔案過大（99MB 以上）：{rel}')
        target=dest/rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(item, target)
    return warnings


def vendor_static_urls(module_path: Path, owner: str, repo: str, module: str, siteprefix: str, enable: bool) -> tuple[list[dict],list[str]]:
    vendored=[]; errors=[]
    # CDN replacement is limited to explicit script src / link href references in HTML.
    for p in list(module_path.rglob('*.html')):
        try:
            contents=p.read_text('utf-8')
        except UnicodeDecodeError:
            continue
        rel_dir=p.parent.relative_to(module_path)
        def transform(m):
            url=m.group(3); u=urllib.parse.urlsplit(url)
            if u.hostname not in ALLOW_CDNS:
                return m.group(0)
            tag=m.group(1).lower()
            if 'href' in tag and 'stylesheet' not in contents[max(0,m.start()-120):m.end()+120].lower():
                return m.group(0)
            if not enable:
                return m.group(0)
            digest=hashlib.sha256(url.encode()).hexdigest()[:16]
            leaf=re.sub(r'[^A-Za-z0-9._-]', '-', Path(u.path).name or 'library')[:55]
            if not Path(leaf).suffix:
                leaf += '.js' if 'src' in tag else '.css'
            dest=module_path/'_vendor'/f'{digest}-{leaf}'
            if not dest.exists():
                try:
                    req=urllib.request.Request(url, headers={'User-Agent':'GangGang-classroom-offline-build/1.0'})
                    with urllib.request.urlopen(req, timeout=30) as response:
                        clen=int(response.headers.get('Content-Length') or 0)
                        if clen>MAX_DOWNLOAD: raise RuntimeError('CDN 文件超過限制')
                        data=response.read(MAX_DOWNLOAD + 1)
                    if len(data)>MAX_DOWNLOAD: raise RuntimeError('CDN 文件超過限制')
                    dest.parent.mkdir(exist_ok=True)
                    dest.write_bytes(data)
                except Exception as ex:
                    errors.append(f'無法本地化 {url}: {str(ex)[:90]}')
                    return m.group(0)
            vendored.append({'original':url,'local':dest.relative_to(module_path).as_posix()})
            rel = os.path.relpath(dest,p.parent).replace('\\','/')
            return m.group(1)+m.group(2)+rel+m.group(2)
        new=ENTRY_RE.sub(transform,contents)
        if new!=contents:
            p.write_text(new,encoding='utf-8')
    return vendored,errors


def rewrite_self_references(src: Path, repo: str, module: str, siteprefix: str) -> int:
    """Rewrite full or root-absolute references to this specific site's old base.
    Relative paths are preserved. Other website links are left untouched and audited.
    """
    old='https://'+OWNER+'.github.io/'+repo+'/'
    new='https://'+OWNER+'.github.io/'+siteprefix+'/apps/'+module+'/'
    oldroot='/'+repo+'/'
    newroot='/'+siteprefix+'/apps/'+module+'/'
    n=0
    for p in src.rglob('*'):
        if not p.is_file() or p.suffix.lower() not in TEXT_EXTENSIONS or p.stat().st_size>4_000_000:
            continue
        try: body=p.read_text('utf-8')
        except UnicodeDecodeError: continue
        replaced=body.replace(old,new).replace(oldroot,newroot)
        if replaced!=body:
            p.write_text(replaced,encoding='utf-8');n+=1
    return n


def audit_externals(mod_dir: Path, site_prefix: str) -> list[str]:
    urls=set()
    for p in mod_dir.rglob('*'):
        if not p.is_file() or p.suffix.lower() not in TEXT_EXTENSIONS or p.stat().st_size>4_000_000:
            continue
        try: s=p.read_text('utf-8')
        except UnicodeDecodeError: continue
        for m in EXTERNAL_RE.finditer(s):
            url=m.group(0)
            host=m.group(1).split('/')[0].lower()
            # self-hosted absolute references pointing to the mirrored project's base are okay.
            if host==f'{OWNER}.github.io' and f'/{site_prefix}/apps/{mod_dir.name}/' in url:
                continue
            if host in ('www.w3.org','www.mozilla.org','www.apple.com','schema.org'):
                continue
            urls.add(url[:200])
    return sorted(urls)[:60]



def file_info(mod_dir: Path, out: Path) -> list[dict]:
    files=[]
    for p in sorted(mod_dir.rglob('*')):
        if not p.is_file(): continue
        rel=p.relative_to(out).as_posix()
        files.append({'path':rel,'bytes':p.stat().st_size,'hash':sha256_file(p)})
    return files


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',default=str(BASE/'_site'))
    parser.add_argument('--fixture',help='Use local fake repositories for deterministic tests')
    parser.add_argument('--no-vendor',action='store_true')
    parser.add_argument('--site-prefix',default=os.environ.get('GITHUB_REPOSITORY','pipipopo7410/Bio-Class').split('/')[-1])
    args=parser.parse_args()
    out=Path(args.output).resolve()
    if out.exists(): shutil.rmtree(out)
    out.mkdir(parents=True)
    for f in SITE_FILES:
        if (BASE/f).is_file():
            (out/f).parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(BASE/f,out/f)
    shutil.copytree(BASE/'assets',out/'assets',dirs_exist_ok=True)
    (out/'.nojekyll').write_text('',encoding='utf-8')
    manifest={'schema':1,'buildReady':True,'siteVersion':'5.2.2', 'modules':[],
              'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
    with tempfile.TemporaryDirectory(prefix='gg-repos-') as tmp:
      for source in SOURCES['modules']:
        mid=source['id']; repo=source['repo']; name=source['name']
        result={'id':mid,'name':name,'repository':repo,'status':'unavailable',
                'version':None,'files':[],'totalBytes':0,'warnings':[],'externals':[]}
        try:
            clone=Path(tmp)/mid
            sha=clone_repo(repo,clone,Path(args.fixture) if args.fixture else None)
            src=root_dir(clone)
            dest=out/'apps'/mid
            warnings=copy_source(src,dest)
            vendored, failures=vendor_static_urls(dest,OWNER,repo,mid,args.site_prefix,not args.no_vendor)
            rewritten=rewrite_self_references(dest,repo,mid,args.site_prefix)
            external=audit_externals(dest,args.site_prefix)
            files=file_info(dest,out)
            if not any(x['path']==f'apps/{mid}/index.html' for x in files):
                raise RuntimeError('資料夾內沒有可開啟的 index.html')
            contents='\n'.join(x['path']+':'+x['hash'] for x in files)
            version=hashlib.sha256(contents.encode()).hexdigest()[:16]
            result.update(status='candidate',version=version,files=files,
                          totalBytes=sum(x['bytes'] for x in files),warnings=warnings+failures,
                          externals=external,sourceCommit=sha,vendoredCount=len(vendored),
                          rewrittenFiles=rewritten)
            print(f'[{mid}] OK files={len(files)} size={result["totalBytes"]//1024}KB external={len(external)}')
        except Exception as ex:
            result['warnings'].append(str(ex)[:300]);print(f'[{mid}] ERROR {ex}',file=sys.stderr)
            shutil.rmtree(out/'apps'/mid,ignore_errors=True)
        manifest['modules'].append(result)
    (out/'offline-catalog.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    (out/'offline-build-report.md').write_text(render_report(manifest),encoding='utf-8')
    candidates=sum(x['status']=='candidate' for x in manifest['modules'])
    print(f'Build finished; copied {candidates}/12 modules. This is NOT offline certification.')
    # If all source repositories failed to download, publish nothing that would mislead pupils.
    if candidates==0 and not args.fixture:
        raise RuntimeError('所有教材下載失敗；停止部署，避免覆蓋目前可用的網站')


def render_report(m):
    s=['# 離線教材整合稽核','',f'建立日期：{m["generatedAt"]}',
       '','**注意：已鏡像／已下載 ≠ 完全離線驗收。** 各個教材必須在 iPad 斷開 Wi-Fi 後測試所有互動、分頁與模型。','',
       '| 教材 | 原始專案 | 狀態 | 檔案數 | MB | 需審查外部網址數 |','|---|---|---|---:|---:|---:|']
    for x in m['modules']:
        s.append(f'|{x["name"]}|`{x["repository"]}`|{x["status"]}|{len(x["files"])}|{x["totalBytes"]/1e6:.1f}|{len(x["externals"])}|')
    for x in m['modules']:
        s+=['',f'## {x["name"]} · {x["id"]}']
        if x['warnings']: s+=['### 建置警告'] + ['- '+w for w in x['warnings']]
        if x['externals']: s+=['### 尚未排除的外部網址']+['- `'+u+'`' for u in x['externals']]
    return '\n'.join(s)+'\n'

if __name__=='__main__':
    main()
