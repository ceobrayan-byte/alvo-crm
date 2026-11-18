import sys,glob,os
root=os.path.dirname(os.path.abspath(__file__))
src=os.path.join(root,'src')
css=open(os.path.join(src,'00_style.css'),encoding='utf-8').read()
js=''.join(open(f,encoding='utf-8').read()+'\n' for f in sorted(glob.glob(os.path.join(src,'0[1-6]_*.js'))))
logo=open(os.path.join(root,'logo_ivory.b64'),encoding='utf-8').read().strip()
if not logo.startswith('data:'): logo='data:image/png;base64,'+logo
js=js.replace('__LOGO_IVORY__',logo)
html='''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ALVO · Plataforma Comercial (demonstração)</title>
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
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
<script>
'''+js+'''
</script>
</body>
</html>
'''
out=sys.argv[1] if len(sys.argv)>1 else os.path.join(root,'index.html')
open(out,'w',encoding='utf-8').write(html)
open(os.path.join(root,'bundle.js'),'w',encoding='utf-8').write(js)
print('ok',len(html)//1024,'KB')
