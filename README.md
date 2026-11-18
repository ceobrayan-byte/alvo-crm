# ALVO CRM

Front estático do CRM da ALVO (Supabase + Cloudflare Pages).

- `dist/` é o que vai ao ar (Cloudflare Pages: sem comando de build, diretório de saída `dist`).
- `proto/src/` são os fontes; `python3 proto/build_live.py` regenera `dist/`.
- `sql/` são as migrações já aplicadas no Supabase `alvo-crm`.
- A chave `sb_publishable_…` no front é pública por desenho; a segurança está nas políticas e funções do banco.
