/* ===== App dos clientes (APP ALVO · alvoinvestimentos.com.br/meu-app) =====
   Pedidos de boleto e de lance feitos pelos clientes no app chegam aqui na hora e avisam no sino.
   Ao mudar a situação, o app do cliente é atualizado e ele recebe o aviso pelo próprio app. */
const AP={d:null,loading:false,orgFor:null,f:'abertas',q:''};
const AP_URL='https://alvoinvestimentos.com.br/meu-app';
const AP_ST=['Recebida','Em atendimento','Em análise','Enviada','Registrada na administradora','Não registrada','Concluída no suporte','Não atendida','Rejeitada'];
const AP_DONE=['Concluída no suporte','Rejeitada','Não atendida','Enviada','Registrada na administradora','Não registrada','Contemplada','Não contemplada'];
const apOpen=r=>!AP_DONE.includes(r.status);
async function apLoad(force){if(AP.loading||(AP.d&&!force&&AP.orgFor===S.orgId))return;AP.loading=true;
  try{AP.d=await rpc('crm_portal_requests',{p_org:S.orgId});AP.orgFor=S.orgId}catch(e){fail(e);AP.d=[]}finally{AP.loading=false;if(S.view==='app-clientes')refresh()}}
const apKind=r=>r.kind==='lance'?`Oferta de lance${r.payload&&r.payload.amount?' · '+fBRL(r.payload.amount)+(r.payload.percent?' ('+String(r.payload.percent).replace('.',',')+'%)':''):''}`:r.kind==='boleto'?`Segunda via de boleto${r.payload&&r.payload.competence?' · competência '+String(r.payload.competence).split('-').reverse().join('/'):''}`:esc(r.kind||'Solicitação');
const apBd=s=>`<span class="bd ${s==='Concluída no suporte'||s==='Enviada'||s==='Registrada na administradora'?'ok':s==='Rejeitada'||s==='Não atendida'||s==='Não registrada'?'bad':s==='Recebida'?'warn':'mute'}">${esc(s||'—')}</span>`;
VIEWS['app-clientes']=()=>{
  apLoad();const o=O();
  const head=`<div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · APP ALVO</div><h2>App dos clientes</h2></div>
    <a class="btn" href="${AP_URL}" target="_blank" rel="noopener">${ic('external-link')}Abrir o app</a><button class="btn sm" data-act="ap-reload">${ic('refresh-cw')}Atualizar</button></div>`;
  if(!AP.d)return`<div class="pg">${head}<div class="card"><div class="xs muted">Carregando solicitações…</div></div></div>`;
  const q=nrm(AP.q),all=AP.d,open=all.filter(apOpen);
  const rows=all.filter(r=>(AP.f==='todas'||(AP.f==='abertas'?apOpen(r):!apOpen(r)))&&(!q||nrm(r.client).includes(q)||nrm(r.protocol).includes(q)||nrm(r.quota).includes(q)));
  return`<div class="pg">${head}
   <div class="pskpi">
    <div class="card"><span class="xs muted">Abertas agora</span><b class="num">${open.length}</b><span class="xs muted">aguardando o suporte</span></div>
    <div class="card"><span class="xs muted">Boletos pedidos</span><b class="num">${all.filter(r=>r.kind==='boleto').length}</b><span class="xs muted">desde o início</span></div>
    <div class="card"><span class="xs muted">Ofertas de lance</span><b class="num">${all.filter(r=>r.kind==='lance').length}</b><span class="xs muted">desde o início</span></div>
    <div class="card"><span class="xs muted">Concluídas</span><b class="num">${all.filter(r=>!apOpen(r)).length}</b><span class="xs muted">atendidas ou encerradas</span></div>
   </div>
   <details class="card apinfo"><summary class="sm"><b>${ic('info')} Como funciona o app e onde dar suporte</b></summary>
    <div class="sm" style="line-height:1.7;margin-top:8px">
     <p>• O cliente acessa <b>${AP_URL.replace('https://','')}</b> com o e-mail cadastrado e vê as cotas efetivadas dele.</p>
     <p>• No app ele pode pedir a <b>segunda via do boleto</b> e registrar uma <b>oferta de lance</b> para a próxima assembleia.</p>
     <p>• Cada pedido chega aqui na hora e avisa no sino (você, administradores e suporte).</p>
     <p>• Ao mudar a situação abaixo, o app do cliente é atualizado e ele recebe o aviso por e-mail. O pedido é só um encaminhamento: o boleto ou o lance continua sendo feito na administradora pelo suporte.</p>
     <p>• Cliente sem acesso ou com dúvida de login: confirme o e-mail no cadastro e oriente a usar "esqueci minha senha" no app.</p></div></details>
   <div class="row wrap" style="gap:8px">
    <div class="row" role="tablist" style="gap:6px">${[['abertas','Abertas ('+open.length+')'],['concluidas','Concluídas'],['todas','Todas']].map(([k,l])=>`<button class="btn sm ${AP.f===k?'pri':''}" data-act="ap-f" data-id="${k}">${l}</button>`).join('')}</div>
    <label class="search" style="max-width:300px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="apq" placeholder="Cliente, protocolo ou cota" value="${esc(AP.q)}"></label></div>
   <div class="col" style="gap:10px">${rows.map(r=>`<div class="card aprow ${apOpen(r)?'open':''}">
     <div class="row sp wrap" style="gap:8px"><div><b>${esc(r.client||'Cliente')}</b> ${apBd(r.status)}<div class="sm">${apKind(r)}</div>
       <div class="xs muted">${esc(r.adm||'—')} · grupo ${esc(r.grp||'—')} · cota ${esc(r.quota||'—')} · protocolo ${esc(r.protocol||'—')} · ${r.created_at?esc(new Date(r.created_at).toLocaleString('pt-BR',{timeZone:'America/Cuiaba',dateStyle:'short',timeStyle:'short'})):''}</div>
       ${r.email?`<div class="xs muted">${ic('mail')} ${esc(r.email)}${r.phone?' · '+esc(fmtPhone(r.phone)):''}</div>`:''}
       ${r.note||r.handled_by?`<div class="xs" style="margin-top:4px">${r.handled_by?`<b>${esc(r.handled_by)}</b>: `:''}${esc(r.note||'')}</div>`:''}</div>
      <div class="row" style="gap:6px">${r.case_id?`<button class="btn sm ghost" data-act="case-open" data-id="${esc(r.case_id)}">${ic('folder-open')}Operação</button>`:''}<button class="btn sm ${apOpen(r)?'pri':''}" data-act="ap-edit" data-id="${r.id}">${ic('pencil')}Atender</button></div></div></div>`).join('')||'<div class="empty">Nenhuma solicitação nesta lista.</div>'}</div></div>`;
};
ACT['ap-reload']=async()=>{await apLoad(true);toast('Solicitações atualizadas',{icon:'refresh-cw'})};
ACT['ap-f']=el=>{AP.f=el.dataset.id;refresh()};
document.addEventListener('input',ev=>{const t=ev.target;if(t&&t.id==='apq'){AP.q=t.value;const p=t.selectionStart;refresh();const n=$('#apq');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}}});
ACT['ap-edit']=el=>{const r=(AP.d||[]).find(x=>x.id===el.dataset.id);if(!r)return;
  dialog({title:'Atender solicitação',sub:esc(r.client||''),submit:'Salvar e avisar o cliente',body:`<div class="sm">${apKind(r)} · protocolo ${esc(r.protocol||'')}</div>
   <label class="fld">Situação<select class="in" name="status">${AP_ST.map(s=>`<option ${r.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
   <label class="fld">Mensagem para o cliente (aparece no app)<textarea class="in" name="note" rows="3" maxlength="500" placeholder="Ex.: Boleto enviado para o seu e-mail.">${esc(r.note||'')}</textarea></label>
   <div class="xs muted">Ao salvar, o app do cliente é atualizado e ele recebe o aviso.</div>`,
   onSubmit:dlgAsync(async f=>{await rpc('crm_portal_request_update',{p_org:S.orgId,p_id:r.id,p_status:f.status,p_note:f.note});await apLoad(true);if(typeof ntLoad==='function')ntLoad();toast('Solicitação atualizada · cliente avisado no app',{icon:'check'})})})};
