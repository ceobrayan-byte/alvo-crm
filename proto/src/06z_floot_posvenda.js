/* ===== Negócios = painel de pós-venda =====
   Acompanha cada cota vendida (efetivada) até a contemplação e a liberação do crédito.
   Substitui o antigo pipeline Comercial/Reativação/Pós-venda (o comercial fica só em Funis). */
const PS={d:null,loading:false,orgFor:null,q:'',seller:'all',adm:'all',st:'all'};
const PS_ST=[['contemplada','Contemplada','party-popper'],['analise','Crédito em análise','file-search'],['liberado','Crédito liberado','badge-check'],['cancelada','Cancelada / desistente','circle-x']];
const PS_MODES=['Sorteio','Lance livre','Lance fixo','Lance embutido'];
const psStage=c=>(c.ps&&c.ps.stage)||'aguardando';
const psDate=s=>s?String(s).slice(0,10).split('-').reverse().join('/'):'—';
async function psLoad(force){
  if(PS.loading||(PS.d&&!force&&PS.orgFor===S.orgId))return;PS.loading=true;
  try{PS.d=await rpc('crm_postsale_list',{p_org:S.orgId});PS.orgFor=S.orgId}catch(e){fail(e);PS.d={can_edit:false,items:[]}}finally{PS.loading=false;if(S.view==='funis')refresh()}
}
const psName=id=>{const u=user(id);return u&&/propriet/i.test(String(u.role||u.roleLabel||''))?'Escritório':(u&&u.name)||'—'};
function psCard(c){const st=psStage(c),p=c.ps||{};
  return`<div class="lcard pscard" data-act="ps-open" data-id="${esc(c.id)}">
   <div class="row sp" style="gap:8px"><b class="grow" style="font-size:13.5px">${esc(c.client||'—')}</b>${c.seller?av(c.seller,22):''}</div>
   <div class="xs muted">${esc(c.adm||'—')} · grupo ${esc(c.grp||'—')} · cota ${esc(c.quota||'—')}</div>
   <div class="row sp"><b class="sm num">${esc(fBRL(c.credit))}</b><span class="xs muted">venda ${esc(psDate(c.date))}</span></div>
   ${st!=='aguardando'&&st!=='cancelada'&&p.contemplated_on?`<div class="xs"><span class="bd ok">${esc(p.mode||'Contemplada')}${p.bid_pct!=null?' · '+String(p.bid_pct).replace('.',',')+'%':''}</span> <span class="muted">em ${esc(psDate(p.contemplated_on))}</span></div>`:''}
   ${st==='liberado'&&p.released_on?`<div class="xs muted">crédito liberado em ${esc(psDate(p.released_on))}</div>`:''}
   ${c.first_payment&&c.first_payment!=='Pago'&&st==='aguardando'?`<div class="xs" style="color:var(--warn)">1ª parcela: ${esc(c.first_payment)}</div>`:''}
  </div>`}
VIEWS['funis']=()=>{
  if(!LIVE)return'<div class="pg"><div class="empty">Disponível no CRM conectado.</div></div>';
  psLoad();const o=O();
  if(!PS.d)return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Negócios · cotas contempladas</h2></div></div><div class="card"><div class="xs muted">Carregando cotas…</div></div></div>`;
  const items=(PS.d.items||[]).filter(c=>psStage(c)!=='aguardando'),q=PS.q.trim().toLowerCase();
  const list=items.filter(c=>(PS.seller==='all'||c.seller===PS.seller)&&(PS.adm==='all'||c.adm===PS.adm)&&(PS.st==='all'||psStage(c)===PS.st)&&(!q||[c.client,c.grp,c.quota,c.adm].some(x=>String(x||'').toLowerCase().includes(q))));
  const sum=a=>a.reduce((t,c)=>t+Number(c.credit||0),0);
  const by=k=>list.filter(c=>psStage(c)===k);
  const sellers=[...new Set(items.map(c=>c.seller))].sort((a,b)=>psName(a).localeCompare(psName(b),'pt-BR')),adms=[...new Set(items.map(c=>c.adm).filter(Boolean))].sort();
  const cont=list.filter(c=>['contemplada','analise','liberado'].includes(psStage(c)));
  return`<div class="pg" style="height:100%"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · acompanhamento após a venda</div><h2>Negócios · cotas contempladas</h2></div>
    <button class="btn sm" data-act="ps-reload">${ic('refresh-cw')}Atualizar</button>${PS.d.can_edit?`<button class="btn pri" data-act="ps-new">${ic('party-popper')}Registrar contemplação</button>`:''}</div>
   <div class="pskpi">
    <div class="card"><span class="xs muted">Cotas contempladas</span><b class="num">${list.filter(c=>psStage(c)!=='cancelada').length}</b><span class="xs muted">${esc(dxM(sum(list.filter(c=>psStage(c)!=='cancelada'))))} em crédito</span></div>
    <div class="card"><span class="xs muted">Recém-contempladas</span><b class="num">${by('contemplada').length}</b><span class="xs muted">${esc(dxM(sum(by('contemplada'))))}</span></div>
    <div class="card"><span class="xs muted">Crédito em análise</span><b class="num">${by('analise').length}</b><span class="xs muted">${esc(dxM(sum(by('analise'))))}</span></div>
    <div class="card"><span class="xs muted">Crédito liberado</span><b class="num">${esc(dxM(sum(by('liberado'))))}</b><span class="xs muted">${by('liberado').length} cota(s)</span></div>
   </div>
   <div class="row wrap" style="gap:8px">
    <input class="in" style="width:240px" placeholder="Buscar cliente, grupo ou cota" value="${esc(PS.q)}" data-inp="ps-q" aria-label="Buscar">
    ${sellers.length>1?`<select class="in" style="width:auto" data-chg="ps-seller" aria-label="Vendedor"><option value="all">Todos os vendedores</option>${sellers.map(id=>`<option value="${id}" ${PS.seller===id?'selected':''}>${esc(psName(id))}</option>`).join('')}</select>`:''}
    <select class="in" style="width:auto" data-chg="ps-adm" aria-label="Administradora"><option value="all">Todas as administradoras</option>${adms.map(a=>`<option ${PS.adm===a?'selected':''}>${esc(a)}</option>`).join('')}</select>
    <select class="in" style="width:auto" data-chg="ps-st" aria-label="Situação"><option value="all">Todas as situações</option>${PS_ST.map(([k,l])=>`<option value="${k}" ${PS.st===k?'selected':''}>${l}</option>`).join('')}</select>
    <span class="end xs muted">${PS.d.can_edit?'Clique na cota para atualizar a situação.':'Somente leitura · a atualização é feita pelo suporte.'}</span></div>
   <div class="board" style="flex:1;min-height:420px">${PS_ST.map(([k,l,icn])=>{const ds=by(k);
     return`<div class="lcol"><div class="kcol-h"><b>${ic(icn)} ${l}</b><span class="bd ${k==='liberado'||k==='contemplada'?'ok':k==='cancelada'?'bad':'mute'}">${ds.length}</span></div>
      <div class="xs muted" style="margin:-4px 0 8px">${esc(dxM(sum(ds)))}</div><div class="col" style="gap:9px">${ds.map(psCard).join('')||'<div class="empty xs" style="padding:18px 6px">Nenhuma cota</div>'}</div></div>`}).join('')}</div>
  </div>`;
};
ACT['ps-reload']=async()=>{await psLoad(true);toast('Pós-venda atualizado',{icon:'refresh-cw'})};
CHG['ps-seller']=el=>{PS.seller=el.value;refresh()};CHG['ps-adm']=el=>{PS.adm=el.value;refresh()};CHG['ps-st']=el=>{PS.st=el.value;refresh()};
document.addEventListener('input',ev=>{const t=ev.target;if(t&&t.dataset&&t.dataset.inp==='ps-q'){PS.q=t.value;clearTimeout(PS.t);PS.t=setTimeout(()=>{const pos=t.selectionStart;refresh();const n=document.querySelector('[data-inp="ps-q"]');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(e){}}},250)}});
ACT['ps-open']=el=>{const c=(PS.d.items||[]).find(x=>x.id===el.dataset.id);if(!c)return;const p=c.ps||{},st=psStage(c)==='aguardando'?'contemplada':psStage(c),can=PS.d.can_edit;
  const info=`<div class="g sm" style="grid-template-columns:1fr 1fr;gap:6px 16px">
    <div><span class="xs muted">Cliente</span><div><b>${esc(c.client||'—')}</b></div></div><div><span class="xs muted">Vendedor</span><div>${esc(psName(c.seller))}</div></div>
    <div><span class="xs muted">Administradora / produto</span><div>${esc(c.adm||'—')} · ${esc(c.product||'—')}</div></div><div><span class="xs muted">Grupo / cota</span><div class="num">${esc(c.grp||'—')} / ${esc(c.quota||'—')}</div></div>
    <div><span class="xs muted">Crédito</span><div class="num"><b>${esc(fBRL(c.credit))}</b>${c.term?` · ${c.term} meses`:''}</div></div><div><span class="xs muted">Data da venda</span><div>${esc(psDate(c.date))}</div></div></div>`;
  const log=(p.log||[]).slice().reverse().map(x=>`<div class="xs muted">${esc(new Date(x.at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}))} · ${esc(x.by||'')}: ${esc(x.from==='aguardando'?'Aguardando':(PS_ST.find(s=>s[0]===x.from)||[,x.from])[1])} → ${esc(x.to==='aguardando'?'Aguardando':(PS_ST.find(s=>s[0]===x.to)||[,x.to])[1])}</div>`).join('');
  if(!can){dialog({title:'Cota '+(c.quota||''),sub:esc((PS_ST.find(s=>s[0]===st)||[])[1]||''),submit:'Fechar',body:info+(p.contemplated_on?`<div class="sm" style="margin-top:10px">Contemplada em ${esc(psDate(p.contemplated_on))} · ${esc(p.mode||'')}${p.bid_pct!=null?' · lance '+p.bid_pct+'%':''}</div>`:'')+(p.note?`<div class="sm" style="margin-top:6px">${esc(p.note)}</div>`:'')+(log?`<div style="margin-top:12px">${log}</div>`:''),onSubmit:()=>{closeModal&&closeModal()}});return}
  dialog({title:'Acompanhar cota',sub:esc(c.client||''),submit:'Salvar',wide:true,body:info+`
   <div class="g" style="grid-template-columns:1fr 1fr;gap:12px;margin-top:14px">
    <label class="fld">Situação<select class="in" name="stage">${PS_ST.map(([k,l])=>`<option value="${k}" ${st===k?'selected':''}>${l}</option>`).join('')}${psStage(c)!=='aguardando'?'<option value="aguardando">Desfazer · não foi contemplada</option>':''}</select></label>
    <label class="fld">Data da contemplação<input class="in" type="date" name="contemplated_on" value="${esc(p.contemplated_on||'')}"></label>
    <label class="fld">Forma de contemplação<select class="in" name="mode"><option value="">—</option>${PS_MODES.map(m=>`<option ${p.mode===m?'selected':''}>${m}</option>`).join('')}</select></label>
    <label class="fld">Lance (% do crédito)<input class="in num" type="number" step="0.01" min="0" max="100" name="bid_pct" value="${p.bid_pct??''}"></label>
    <label class="fld">Crédito liberado em<input class="in" type="date" name="released_on" value="${esc(p.released_on||'')}"></label></div>
   <label class="fld">Observação<textarea class="in" name="note" rows="2" maxlength="600">${esc(p.note||'')}</textarea></label>
   ${log?`<details style="margin-top:6px"><summary class="xs muted">Histórico</summary>${log}</details>`:''}`,
   onSubmit:dlgAsync(async f=>{const r=await rpc('crm_postsale_save',{p_org:S.orgId,p_id:c.id,p_data:{stage:f.stage,contemplated_on:f.contemplated_on,mode:f.mode,bid_pct:f.bid_pct,released_on:f.released_on,note:f.note}});c.ps=r;refresh();toast('Cota atualizada',{icon:'badge-check'})})});
};

ACT['ps-new']=()=>{const pend=(PS.d.items||[]).filter(c=>psStage(c)==='aguardando');
  if(!pend.length){toast('Nenhuma cota vendida aguardando registro',{icon:'info'});return}
  dialog({title:'Registrar contemplação',sub:'Escolha a cota contemplada',submit:'Continuar',body:`<label class="fld">Cota<select class="in" name="id" required>${pend.map(c=>`<option value="${esc(c.id)}">${esc(c.client||'—')} · ${esc(c.adm||'')} ${esc(c.grp||'')}/${esc(c.quota||'')} · ${esc(fBRL(c.credit))}</option>`).join('')}</select></label>
   <div class="xs muted">Só cotas vendidas e efetivadas. Depois de salva, a cota passa a aparecer neste painel.</div>`,
   onSubmit:f=>{setTimeout(()=>ACT['ps-open']({dataset:{id:f.id}}),0)}})};
