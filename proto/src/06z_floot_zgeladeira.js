/* ===== Contatos = Geladeira (igual ao Floot) e Leads Frios com a base completa =====
   Geladeira: leads em espera, compartilhados. Dias na Geladeira, registrar contato, observação/retorno, interesse e retomar para o Kanban.
   Leads Frios: contatos enviados da Geladeira + base importada (paginada no banco). */
const GZ={q:'',view:'all',interest:'',owner:''};
const gzDays=l=>{const d=l.geladeira_desde||l.updated_at||l.created_at;return d?Math.max(0,Math.floor((Date.now()-new Date(d))/864e5)):null};
const gzF=l=>(l.source_data&&l.source_data.fridge)||{};
const gzDate=v=>v?new Date(v).toLocaleString('pt-BR',{timeZone:'America/Cuiaba',dateStyle:'short',timeStyle:'short'}):'—';
const gzToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Cuiaba'}).format(new Date());
const gzCan=()=>ROLE()!=='Suporte';
VIEWS['contatos']=()=>{
  if(!LIVE)return'<div class="pg"><div class="empty">Disponível no CRM conectado.</div></div>';
  flLoad();const o=O(),q=nrm(GZ.q),today=gzToday();
  const all=FL.leads.filter(l=>l.stage==='Geladeira'&&!l.fechou&&l.status!=='excluido');
  const rows=all.filter(l=>{const f=gzF(l);return(!q||nrm(l.name).includes(q)||String(l.phone||'').includes(q.replace(/\D/g,'')||'§'))
    &&(!GZ.interest||f.interest===GZ.interest)&&(!GZ.owner||l.owner_user_id===GZ.owner)
    &&(GZ.view==='all'||(GZ.view==='scheduled'&&f.due)||(GZ.view==='overdue'&&f.due&&f.due<today)||(GZ.view==='today'&&f.due===today))})
    .sort((a,b)=>String(gzF(b).contacted_at||'').localeCompare(String(gzF(a).contacted_at||''))||a.name.localeCompare(b.name,'pt-BR'));
  const owners=[...new Set(all.map(l=>l.owner_user_id).filter(Boolean))];
  const cnt=k=>all.filter(l=>gzF(l).interest===k).length,sched=all.filter(l=>gzF(l).due).length,late=all.filter(l=>gzF(l).due&&gzF(l).due<today).length;
  const can=gzCan();
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · contatos em espera</div><h2>Geladeira</h2></div><button class="btn sm" data-act="gz-reload">${ic('refresh-cw')}Atualizar</button></div>
   <div class="sm muted">Contatos que ainda não estão prontos para comprar. Registre cada contato, marque o interesse e retome para o Kanban quando for a hora. Base compartilhada por toda a equipe.</div>
   <div class="pskpi">
    <div class="card"><span class="xs muted">Na Geladeira</span><b class="num">${all.length}</b><span class="xs muted">contatos em espera</span></div>
    <div class="card"><span class="xs muted">Muito interesse</span><b class="num">${cnt('high')}</b><span class="xs muted">pretendem comprar, mas não agora</span></div>
    <div class="card"><span class="xs muted">Retornos agendados</span><b class="num">${sched}</b><span class="xs muted">${late?late+' atrasado(s)':'nenhum atrasado'}</span></div>
    <div class="card"><span class="xs muted">Interesse médio / pouco</span><b class="num">${cnt('medium')} / ${cnt('low')}</b><span class="xs muted">classificados pela equipe</span></div>
   </div>
   <div class="row wrap" style="gap:8px">
    <label class="search" style="max-width:300px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="gzq" placeholder="Nome ou telefone" value="${esc(GZ.q)}"></label>
    <select class="in" style="width:auto" data-chg="gz-view"><option value="all">Todos</option><option value="today" ${GZ.view==='today'?'selected':''}>Retorno hoje</option><option value="scheduled" ${GZ.view==='scheduled'?'selected':''}>Agendados</option><option value="overdue" ${GZ.view==='overdue'?'selected':''}>Atrasados</option></select>
    <select class="in" style="width:auto" data-chg="gz-int"><option value="">Qualquer interesse</option>${[['high','Muito'],['medium','Médio'],['low','Pouco']].map(([v,l])=>`<option value="${v}" ${GZ.interest===v?'selected':''}>${l}</option>`).join('')}</select>
    <select class="in" style="width:auto" data-chg="gz-own"><option value="">Todos os responsáveis</option>${owners.map(id=>`<option value="${id}" ${GZ.owner===id?'selected':''}>${esc(user(id).name||id)}</option>`).join('')}</select>
    <span class="end xs muted">${rows.length} contato(s)</span></div>
   <div class="tbl-wrap"><table class="tbl gztbl"><thead><tr><th>Nome</th><th>Contato</th><th title="Dias na Geladeira">DG</th><th></th><th>Último contato</th><th>Observação / retorno</th><th>Interesse</th><th></th></tr></thead><tbody>
   ${rows.map(l=>{const f=gzF(l),d=gzDays(l),late=f.due&&f.due<today,ph=String(l.phone||'').replace(/\D/g,'');
    return`<tr><td><b class="sm">${esc(l.name)}</b><div class="xs muted">${esc(user(l.owner_user_id).name||'sem responsável')} · ${esc(l.origin||'—')}</div></td>
     <td class="sm">${ph?`<a href="https://wa.me/55${ph.replace(/^55/,'')}" target="_blank" rel="noopener" class="gzph">${ic('message-circle')}${esc(fmtPhone(l.phone))}</a>`:'—'}</td>
     <td><span class="gzdg ${d>=60?'hot':d>=30?'warm':''}">${d==null?'—':d}</span></td>
     <td>${can?`<button class="btn sm" data-act="gz-contact" data-id="${l.id}">${ic('phone-call')}Registrar contato</button>`:''}</td>
     <td class="xs">${f.contacted_by?`<b>${esc(f.contacted_by)}</b><div class="muted">${esc(gzDate(f.contacted_at))}</div>`:'<span class="muted">—</span>'}</td>
     <td class="xs" style="max-width:260px">${f.note?`<div>${esc(f.note)}</div>`:''}${f.due?`<span class="bd ${late?'bad':'mute'}">retorno ${esc(f.due.split('-').reverse().join('/'))}</span>`:''} ${can?`<button class="btn sm ghost" data-act="gz-note" data-id="${l.id}">${ic('pencil')}${f.note||f.due?'Editar':'Anotar'}</button>`:''}</td>
     <td><div class="gzint" role="group" aria-label="Interesse">${[['low','Pouco'],['medium','Médio'],['high','Muito']].map(([v,t])=>`<button type="button" class="${f.interest===v?'on '+v:''}" data-act="gz-int" data-id="${l.id}" data-v="${v}" ${can?'':'disabled'}>${t}</button>`).join('')}</div></td>
     <td>${can?`<button class="btn sm pri" data-act="gz-kanban" data-id="${l.id}">${ic('undo-2')}Kanban</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="8"><div class="empty">Nenhum contato nesta lista.</div></td></tr>'}
   </tbody></table></div></div>`;
};
const gzSave=async(id,data,msg)=>{await guarded(async()=>{flReplace(await rpc('crm_fridge_update',{p_org:S.orgId,p_id:id,p_data:data}));if(msg)toast(msg,{icon:'check'})});refresh()};
ACT['gz-reload']=async()=>{await flLoad(true);toast('Geladeira atualizada',{icon:'refresh-cw'})};
ACT['gz-contact']=el=>gzSave(el.dataset.id,{action:'contact'},'Contato registrado');
ACT['gz-int']=el=>gzSave(el.dataset.id,{action:'interest',interest:el.dataset.v});
ACT['gz-note']=el=>{const l=FL.leads.find(x=>x.id===el.dataset.id);if(!l)return;const f=gzF(l);
  dialog({title:'Observação e retorno',sub:esc(l.name),submit:'Salvar',body:`<label class="fld">Observação<textarea class="in" name="note" rows="3" maxlength="800">${esc(f.note||'')}</textarea></label><label class="fld">Retorno agendado<input class="in" type="date" name="due" value="${esc(f.due||'')}"></label>`,
   onSubmit:dlgAsync(async v=>{flReplace(await rpc('crm_fridge_update',{p_org:S.orgId,p_id:l.id,p_data:{action:'note',note:v.note,due:v.due}}));toast('Anotação salva',{icon:'check'});LS.after=()=>refresh()})})};
ACT['gz-kanban']=async el=>{await guarded(async()=>{flReplace(await rpc('crm_fridge_action',{p_org:S.orgId,p_id:el.dataset.id,p_action:'claim'}));toast('Contato retomado para o seu Kanban',{icon:'undo-2'})});refresh()};
CHG['gz-view']=el=>{GZ.view=el.value;refresh()};CHG['gz-int']=el=>{GZ.interest=el.value;refresh()};CHG['gz-own']=el=>{GZ.owner=el.value;refresh()};
document.addEventListener('input',ev=>{const t=ev.target;if(t&&t.id==='gzq'){GZ.q=t.value;const p=t.selectionStart;refresh();const n=$('#gzq');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}}});

/* ---- Leads Frios: base completa, paginada no banco ---- */
const LF={q:'',origin:'',offset:0,d:null,busy:false,key:''};
async function lfLoad(force){const key=[S.orgId,LF.q,LF.origin,LF.offset].join('|');if(LF.busy||(!force&&LF.key===key&&LF.d))return;LF.busy=true;
  try{LF.d=await rpc('crm_cold_page',{p_org:S.orgId,p_q:LF.q,p_origin:LF.origin,p_offset:LF.offset});LF.key=key}catch(e){fail(e)}finally{LF.busy=false;if(S.view==='leads-frios'){const a=document.activeElement&&document.activeElement.id;refresh();if(a==='lfq'){const n=$('#lfq');if(n){n.focus();const L=n.value.length;try{n.setSelectionRange(L,L)}catch(e){}}}}}}
const LF_OLD=VIEWS['leads-frios'];
VIEWS['leads-frios']=()=>{
  if(!LIVE)return LF_OLD();
  lfLoad();const d=LF.d,o=O();
  const head=`<div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · base para prospecção</div><h2>Leads Frios</h2></div>
   <button class="btn" data-act="cold-export">${ic('download')}Exportar enviados</button><label class="btn pri" style="cursor:pointer">${ic('upload')}Importar CSV<input id="coldf" type="file" accept=".csv,text/csv" hidden></label></div>`;
  if(!d)return`<div class="pg">${head}<div class="card"><div class="xs muted">Carregando a base…</div></div></div>`;
  const tot=Number(d.total||0),pg=Math.floor(LF.offset/20)+1,pages=Math.max(1,Math.ceil(tot/20));
  return`<div class="pg">${head}
   <div class="sm muted">Base compartilhada: contatos enviados da Geladeira e a base importada. Puxe um contato para o seu Kanban para começar o atendimento.</div>
   <div class="row wrap" style="gap:8px">
    <label class="search" style="max-width:340px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="lfq" placeholder="Buscar por nome ou telefone" value="${esc(LF.q)}"></label>
    <select class="in" style="width:auto" data-chg="lf-origin"><option value="">Todas as origens</option>${(d.origins||[]).map(x=>`<option ${LF.origin===x?'selected':''}>${esc(x)}</option>`).join('')}</select>
    <span class="end sm"><b class="num">${tot.toLocaleString('pt-BR')}</b> <span class="muted">contatos disponíveis</span></span></div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>Contato</th><th>Origem</th><th>Situação</th><th></th></tr></thead><tbody>
    ${(d.rows||[]).map(c=>`<tr><td><b class="sm">${esc(c.name||'—')}</b>${c.email?`<div class="xs muted">${esc(c.email)}</div>`:''}</td><td class="sm">${esc(fmtPhone(c.phone)||'—')}</td><td class="sm">${esc(c.origin||'—')}</td>
      <td class="xs">${c.kind==='frio'?`<span class="bd warn">veio da Geladeira</span><div class="muted">${esc(c.reason||'')}${c.owner?' · '+esc(c.owner):''}</div>`:'<span class="bd mute">base importada</span>'}</td>
      <td>${ROLE()!=='Suporte'?`<button class="btn sm pri" data-act="lf-take" data-id="${esc(c.id)}">${ic('flame')}Puxar para o Kanban</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Nenhum contato encontrado.</div></td></tr>'}
   </tbody></table></div>
   <div class="row sp"><span class="xs muted">Página ${pg} de ${pages.toLocaleString('pt-BR')}${LF.busy?' · carregando…':''}</span><div class="row"><button class="btn sm" data-act="lf-page" data-id="-20" ${LF.offset<=0?'disabled':''}>Anterior</button><button class="btn sm" data-act="lf-page" data-id="20" ${LF.offset+20>=tot?'disabled':''}>Próxima</button></div></div></div>`;
};
ACT['lf-page']=el=>{LF.offset=Math.max(0,LF.offset+Number(el.dataset.id));lfLoad()};
CHG['lf-origin']=el=>{LF.origin=el.value;LF.offset=0;lfLoad()};
ACT['lf-take']=async el=>{await guarded(async()=>{const l=await rpc('crm_cold_take',{p_org:S.orgId,p_id:el.dataset.id});flReplace(l);toast('Contato puxado para o seu Kanban (Closer)',{icon:'flame'});await lfLoad(true)})};
document.addEventListener('input',ev=>{const t=ev.target;if(t&&t.id==='lfq'){LF.q=t.value;clearTimeout(LF.t);LF.t=setTimeout(()=>{LF.offset=0;lfLoad()},350)}});
