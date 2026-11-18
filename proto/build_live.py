import sys,glob,os,re
root=os.path.dirname(os.path.abspath(__file__))
src=os.path.join(root,'src')
out=os.path.join(root,'..','dist')
os.makedirs(out,exist_ok=True)
css=open(os.path.join(src,'00_style.css'),encoding='utf-8').read()
js=''.join(open(f,encoding='utf-8').read()+'\n' for f in sorted(glob.glob(os.path.join(src,'0[1-7]*_*.js'))))
logo=open(os.path.join(root,'logo_ivory.b64'),encoding='utf-8').read().strip()
if not logo.startswith('data:'): logo='data:image/png;base64,'+logo
js=js.replace('__LOGO_IVORY__',logo)
URL='https://mbhouzjmiglhnukpuyco.supabase.co'
KEY='sb_publishable_AZbWIxWa9CmVVTCAhhuP6A_DsUAljhx'
SBJS='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/dist/umd/supabase.js'
html='''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>ALVO · Plataforma Comercial</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
'''+css+'''
</style>
</head>
<body data-mode="comando">
<div id="app"></div>
<div id="pops"></div>
<div class="scrim" id="scrim"></div>
<aside class="drawer" id="drawer" role="dialog" aria-label="Detalhes"></aside>
<div class="modal" id="modal"></div>
<div class="toasts" id="toasts" aria-live="polite"></div>
<script>window.__LIVE=true;window.__CFG={url:"'''+URL+'''",key:"'''+KEY+'''"};</script>
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
<script src="'''+SBJS+'''"></script>
<script>
'''+js+'''
</script>
</body>
</html>
'''
open(os.path.join(out,'index.html'),'w',encoding='utf-8').write(html)
open(os.path.join(out,'_headers'),'w',encoding='utf-8').write('''/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' '''+URL+'''; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
''')
print('ok',len(html)//1024,'KB')
