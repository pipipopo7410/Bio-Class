import json, hashlib, subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1]
mods=json.loads((root/'scripts/sources.json').read_text())['modules']
assert len(mods)==12 and len({m['id'] for m in mods})==12
assert any(m['repo']=='-Circulation-3D' for m in mods)
data=json.loads((root/'apps.json').read_text())
assert len(data['topics'])==9
assert [t['name'] for t in data['topics']]==['植物','酵素','循環','神經','血糖','排氨','生殖','遺傳','分類']
assert len(data['topics'][0]['children'])==3
assert len(data['topics'][2]['children'])==2
assert len(data['topics'][8]['children'])==4
required=['index.html','app.js','apps.json','style.css','offline.html','offline.js','offline.css','offline-catalog.json','sw.js','taxonomy.html','scripts/build_offline.py','.github/workflows/build-offline.yml']
assert all((root/f).exists() for f in required)
for f in ['app.js','sw.js','offline.js','home-button.js']:
 p=subprocess.run(['node','--check',str(root/f)],capture_output=True,text=True)
 assert p.returncode==0,(f,p.stderr)
output=Path('/mnt/data/gg-offline-v51-local-test')
info=json.loads((output/'offline-catalog.json').read_text())
assert info['buildReady'] is True
assert len(info['modules'])==12
for m in info['modules']:
 if m['status']=='candidate':
  assert m['files']
  for f in m['files']:
   path=output/f['path']
   assert path.is_file()
   assert hashlib.sha256(path.read_bytes()).hexdigest()==f['hash']
print('PASS: 9 topics, 12 modules, source paths, syntax, fixture build SHA256 and file existence')
