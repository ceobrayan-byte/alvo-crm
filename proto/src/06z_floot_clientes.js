/* ===== Bloco Clientes / Suporte-Operacional / Efetivação (cópia do Floot) ===== */
const FC={cases:[],custs:[],loaded:false,loading:false,orgFor:null,q:'',st:'all',sq:''};
const CSTAT=['Documentação pendente','Em análise','Aguardando pagamento','Efetivado'];
const isOffice=()=>['Proprietário','Administrador','Suporte'].includes(ROLE());
async function fcLoad(force){
  if(FC.loading||(FC.loaded&&!force&&FC.orgFor===S.orgId))return;
  FC.loading=true;
  try{
    const[c,k]=await Promise.all([rpc('crm_customers_list',{p_org:S.orgId}),rpc('crm_cases_list',{p_org:S.orgId}).catch(()=>[])]);
    FC.custs=c||[];FC.cases=k||[];FC.loaded=true;FC.orgFor=S.orgId;
  }catch(e){fail(e)}
  finally{FC.loading=false;if(S.view==='clientes'||S.view==='suporte')refresh()}
}
const fcUser=id=>{if(!id)return'—';const u=O().users.find(x=>x.id===id);return esc(u?u.name:(/^USR-/.test(id)?'—':id))};
const fcDone=c=>c.status==='Efetivado'&&c.accepted&&c.first_payment==='Pago';
const fcStatusBd=c=>`<span class="bd ${c.status==='Efetivado'?'ok':c.status==='Documentação pendente'?'warn':'mute'}">${esc(c.status)}</span>`;
const fcDate=d=>d?String(d).slice(0,10).split('-').reverse().join('/'):'—';

/* ---- Clientes ---- */
const fcEf=k=>k.status==='Efetivado';
const fcCusts=()=>FC.custs.filter(c=>(c.cases||[]).some(fcEf));
VIEWS['clientes']=()=>{
  fcLoad();
  const custs=fcCusts(),q=nrm(FC.q),rows=custs.filter(c=>!q||nrm(c.name).includes(q)||String(c.cpf_cnpj||'').includes(q.replace(/\D/g,'')||'§')||String(c.phone||'').includes(q.replace(/\D/g,'')||'§'));
  const cotas=custs.reduce((a,c)=>a+(c.cases||[]).filter(fcEf).length,0),cred=custs.reduce((a,c)=>a+(c.cases||[]).filter(fcEf).reduce((s,k)=>s+Number(k.credit||0),0),0),pend=custs.reduce((a,c)=>a+(c.cases||[]).filter(k=>!fcEf(k)).length,0);
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(O().name)}</div><h2>${isOffice()?'Clientes / CRM Global':'Minha carteira'}</h2></div>
   ${isOffice()?`<button class="btn pri" data-act="case-manual">${ic('plus')}Nova operação</button>`:''}</div>
   <div class="g" style="grid-template-columns:repeat(4,1fr)">${[['Clientes',custs.length],['Cotas efetivadas',cotas],['Crédito em carteira',fBRL(cred)],['Nova cota em andamento',pend]].map(([a,b])=>`<div class="card"><div class="xs muted">${a}</div><div class="disp" style="font-size:26px">${b}</div></div>`).join('')}</div>
   <label class="search" style="max-width:420px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="custq" placeholder="Buscar por nome, CPF/CNPJ ou telefone" value="${esc(FC.q)}"></label>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Contato</th><th>Cotas</th><th>Crédito</th><th>Consultor</th><th></th></tr></thead><tbody>${rows.map(c=>{const all=c.cases||[],ks=all.filter(fcEf),op=all.length-ks.length;return`<tr data-act="cust-open" data-id="${c.id}" style="cursor:pointer"><td><b>${esc(c.name)}</b><div class="xs muted">${esc(c.cpf_cnpj||'')}</div></td><td class="sm">${esc(fmtPhone(c.phone)||'—')}</td><td>${ks.length}</td><td class="num">${fBRL(ks.reduce((s,k)=>s+Number(k.credit||0),0))}</td><td class="sm">${fcUser(c.owner_user_id)}</td><td><span class="bd ok">Efetivado</span>${op?` <span class="bd warn">+${op} em andamento</span>`:''}</td></tr>`}).join('')||`<tr><td colspan="6"><div class="empty">${FC.loading?'Carregando…':'Nenhum cliente. Efetive uma venda no Kanban para criar o primeiro.'}</div></td></tr>`}</tbody></table></div></div>`;
};
document.addEventListener('input',ev=>{if(ev.target.id==='custq'){FC.q=ev.target.value;const p=ev.target.selectionStart;refresh();const n=$('#custq');if(n){n.focus();n.setSelectionRange(p,p)}}
  if(ev.target.id==='opq'){FC.sq=ev.target.value;const p=ev.target.selectionStart;refresh();const n=$('#opq');if(n){n.focus();n.setSelectionRange(p,p)}}});
function caseLine(k){return`<div class="card" style="padding:12px"><div class="row sp"><b class="sm">${esc(k.product||'Cota')} · ${fBRL(k.credit)}</b>${fcStatusBd(k)}</div>
  <div class="xs muted">${esc(k.admin||'Administradora a definir')} · Grupo ${esc(k.grp||'—')} · Cota ${esc(k.quota||'—')} · ${k.term?k.term+' meses':'prazo —'}</div>
  <div class="xs muted">Docs: ${esc(k.docs)} · 1ª parcela: ${esc(k.first_payment)} · Venda ${fcDate(k.sale_date)}</div></div>`}
function custDrawer(id){
  const c=FC.custs.find(x=>x.id===id);if(!c)return'';
  return`<div class="dr-h">${avN(c.name,48)}<div class="grow"><div class="eyebrow">Ficha do cliente</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(c.name)}</h3><div class="sm muted">Consultor: ${fcUser(c.owner_user_id)}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic("x")}</button></div>
  <div class="dr-b"><div><div class="eyebrow" style="margin-bottom:8px">Cadastro</div><div class="col" style="gap:6px">${fRow('CPF/CNPJ',esc(c.cpf_cnpj))}${fRow('Telefone',esc(fmtPhone(c.phone)))}${fRow('E-mail',esc(c.email))}${fRow('Nascimento',c.birth_date?esc(String(c.birth_date).split('-').reverse().join('/')):'')}${fRow('Observações',esc(c.notes))}</div></div>
   <div><div class="eyebrow" style="margin-bottom:8px">Cotas efetivadas (${(c.cases||[]).filter(fcEf).length})</div><div class="col" style="gap:8px">${(c.cases||[]).filter(fcEf).map(k=>`<div data-act="case-open" data-id="${k.id}" style="cursor:pointer">${caseLine(k)}</div>`).join('')||'<div class="empty xs">Sem cotas efetivadas.</div>'}</div></div>
   ${(c.cases||[]).some(k=>!fcEf(k))?`<div><div class="eyebrow" style="margin-bottom:8px">Em andamento no suporte (${(c.cases||[]).filter(k=>!fcEf(k)).length})</div><div class="col" style="gap:8px">${(c.cases||[]).filter(k=>!fcEf(k)).map(k=>`<div data-act="case-open" data-id="${k.id}" style="cursor:pointer;opacity:.85">${caseLine(k)}</div>`).join('')}</div><div class="xs muted" style="margin-top:6px">Vira cota do cliente quando for efetivada.</div></div>`:''}</div>
  <div class="dr-f"><button class="btn" data-act="cust-edit" data-id="${c.id}">${ic('pencil')}Editar cadastro</button><button class="btn pri" data-act="cust-sale" data-id="${c.id}">${ic('plus')}Nova venda</button></div>`;
}
ACT['cust-open']=el=>openDrawer(()=>custDrawer(el.dataset.id));
ACT['cust-sale']=async el=>{await guarded(async()=>{const l=await rpc('crm_customer_new_sale',{p_org:S.orgId,p_id:el.dataset.id});flReplace(l);toast('Oportunidade criada no Kanban',{icon:'plus'})});closeAll();go('kanban')};
ACT['cust-edit']=el=>{const c=FC.custs.find(x=>x.id===el.dataset.id);if(!c)return;const v=k=>esc(c[k]==null?'':c[k]);
  dialog({title:'Editar cadastro do cliente',sub:'Clientes',submit:'Salvar',wide:true,body:`<div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Nome<input class="in" name="name" required value="${v('name')}"></label><label class="fld">CPF/CNPJ<input class="in" name="cpf_cnpj" value="${v('cpf_cnpj')}"></label>
   <label class="fld">Telefone<input class="in" name="phone" value="${v('phone')}"></label><label class="fld">E-mail<input class="in" name="email" type="email" value="${v('email')}"></label>
   <label class="fld">Data de nascimento<input class="in" type="date" name="birth" value="${esc(c.birth_date||'')}"><span class="xs muted">Envia o e-mail de aniversário automaticamente.</span></label>
   ${isOffice()?`<label class="fld">Consultor responsável<select class="in" name="owner_user_id">${fOwnerOpts(c.owner_user_id)}</select></label>`:''}</div><label class="fld">Observações<textarea class="in" name="notes" rows="3">${v('notes')}</textarea></label>`,
   onSubmit:dlgAsync(async f=>{const d={name:f.name,cpf_cnpj:f.cpf_cnpj,phone:f.phone,email:f.email,notes:f.notes};if(f.owner_user_id)d.owner_user_id=f.owner_user_id;
     await rpc('crm_customer_save',{p_org:S.orgId,p_id:c.id,p_data:d});if((f.birth||'')!==(c.birth_date||''))await rpc('crm_customer_birth',{p_org:S.orgId,p_id:c.id,p_birth:f.birth||null});await fcLoad(true);toast('Cadastro atualizado',{icon:'check'});LS.after=()=>{refresh();if(S.ui.drawer)redrawDrawer()}})})};

/* ---- Suporte / Operacional ---- */
VIEWS['suporte']=()=>{
  fcLoad();
  const q=nrm(FC.sq),rows=FC.cases.filter(k=>!fcEf(k)&&(FC.st==='all'||k.status===FC.st)&&(!q||nrm(k.client_name).includes(q)||nrm(k.quota).includes(q)||nrm(k.grp).includes(q)));
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(O().name)}</div><h2>Suporte / Operacional</h2></div>${isOffice()?`<button class="btn pri" data-act="case-manual">${ic('plus')}Nova operação</button>`:''}</div>
   <div class="row wrap"><select class="in" style="width:220px" data-chg="fc-st"><option value="all">Todas as situações</option>${CSTAT.filter(s=>s!=='Efetivado').map(s=>`<option ${FC.st===s?'selected':''}>${s}</option>`).join('')}</select>
   <label class="search" style="max-width:360px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="opq" placeholder="Cliente, grupo ou cota" value="${esc(FC.sq)}"></label><span class="end sm muted">${rows.length} operação(ões) pendente(s) · as efetivadas ficam em Clientes</span></div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Consultor</th><th>Produto / crédito</th><th>Administradora · grupo/cota</th><th>Docs</th><th>1ª parcela</th><th>Situação</th></tr></thead><tbody>${rows.map(k=>`<tr data-act="case-open" data-id="${k.id}" style="cursor:pointer"><td><b>${esc(k.client_name)}</b>${k.manual?' <span class="bd mute">manual</span>':''}</td><td class="sm">${fcUser(k.seller_user_id)}</td><td class="sm">${esc(k.product||'—')}<div class="xs num">${fBRL(k.credit)}</div></td><td class="sm">${esc(k.admin||'—')}<div class="xs muted">${esc(k.grp||'—')} / ${esc(k.quota||'—')}</div></td><td>${k.docs==='Completo'?'<span class="bd ok">Completo</span>':'<span class="bd warn">Pendente</span>'}</td><td>${k.first_payment==='Pago'?'<span class="bd ok">Pago</span>':'<span class="bd mute">Pendente</span>'}</td><td>${fcStatusBd(k)}</td></tr>`).join('')||`<tr><td colspan="7"><div class="empty">${FC.loading?'Carregando…':'Nenhuma operação.'}</div></td></tr>`}</tbody></table></div></div>`;
};
CHG['fc-st']=el=>{FC.st=el.value;refresh()};
function caseDrawer(id){
  const k=FC.cases.find(x=>x.id===id)||FC.custs.flatMap(c=>c.cases||[]).find(x=>x.id===id);if(!k)return'';
  const ro=!isOffice();
  return`<div class="dr-h">${avN(k.client_name,48)}<div class="grow"><div class="eyebrow">Operação${ro?' (somente leitura)':''}</div><h3 class="disp" style="font-size:24px;margin-top:2px">${esc(k.client_name)}</h3><div class="sm muted">Consultor: ${fcUser(k.seller_user_id)}</div></div>${fcStatusBd(k)}</div>
  <div class="dr-b"><div><div class="eyebrow" style="margin-bottom:8px">Carta</div><div class="col" style="gap:6px">${fRow('Produto',esc(k.product))}${fRow('Crédito',fBRL(k.credit))}${fRow('Prazo',k.term?k.term+' meses':'')}${fRow('Administradora',esc(k.admin))}${fRow('Grupo / cota',esc((k.grp||'—')+' / '+(k.quota||'—')))}${fRow('Contrato',esc(k.contract))}${fRow('Data da venda',fcDate(k.sale_date))}</div></div>
   <div><div class="eyebrow" style="margin-bottom:8px">Efetivação</div><div class="col" style="gap:6px">${fRow('Documentação',esc(k.docs))}${fRow('Assinatura',k.signed?'Assinado':'Pendente')}${fRow('Aceite',k.accepted?'Aceito':'Pendente')}${fRow('1ª parcela',esc(k.first_payment))}</div></div>
   <div><div class="eyebrow" style="margin-bottom:8px">Histórico</div><div class="col" style="gap:6px">${(k.history||[]).slice().reverse().map(h=>`<div class="xs"><b>${fcDate(h.at)}</b> · ${fcUser(h.by)} — ${esc(h.what)}</div>`).join('')||'<div class="xs muted">Sem registros.</div>'}</div></div></div>
  ${ro?'':`<div class="dr-f"><button class="btn" data-act="case-edit" data-id="${k.id}">${ic('pencil')}Editar operação</button><button class="btn" data-act="case-dup" data-id="${k.id}">${ic('copy')}Nova cota</button><button class="btn" data-act="case-return" data-id="${k.id}">${ic('undo-2')}Devolver ao Kanban</button></div>`}`;
}
ACT['case-open']=el=>openDrawer(()=>caseDrawer(el.dataset.id));
const caseFind=id=>FC.cases.find(x=>x.id===id)||FC.custs.flatMap(c=>c.cases||[]).find(x=>x.id===id);
ACT['case-edit']=async el=>{const k=caseFind(el.dataset.id);if(!k)return;await finLoad();const v=x=>esc(k[x]==null?'':k[x]);
  dialog({title:'Editar operação',sub:k.client_name,submit:'Salvar',wide:true,body:`<div class="g" style="grid-template-columns:1fr 1fr">
   <label class="fld">Situação<select class="in" name="status">${CSTAT.map(s=>`<option ${k.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
   <label class="fld">Documentação<select class="in" name="docs">${['Pendente','Completo'].map(s=>`<option ${k.docs===s?'selected':''}>${s}</option>`).join('')}</select></label>
   <label class="fld">1ª parcela<select class="in" name="first_payment">${['Pendente','Pago'].map(s=>`<option ${k.first_payment===s?'selected':''}>${s}</option>`).join('')}</select></label>
   <label class="fld">Produto<input class="in" name="product" value="${v('product')}"></label>
   <label class="fld">Administradora<input class="in" name="admin" value="${v('admin')}"></label><label class="fld">Contrato<input class="in" name="contract" value="${v('contract')}"></label>
   <label class="fld">Grupo<input class="in" name="grp" value="${v('grp')}"></label><label class="fld">Cota<input class="in" name="quota" value="${v('quota')}"></label>
   <label class="fld">Crédito (R$)<input class="in num" name="credit" type="number" min="0" step="100" value="${v('credit')}"></label><label class="fld">Prazo (meses)<input class="in num" name="term" type="number" min="1" step="1" value="${v('term')}"></label>
   <label class="fld">Data da venda<input class="in" name="sale_date" type="date" value="${esc(k.sale_date||'')}"></label>
   <label class="fld">Regra de comissão<select class="in" name="rule_id">${finRuleOpts(k.rule_id)}</select></label><label class="fld">Taxa adm. Canopus (%)<input class="in num" name="admin_rate" type="number" step="0.01" min="0.01" max="100" value="${v('admin_rate')}"></label></div>
   <div class="row"><label class="row sm"><input class="chk" type="checkbox" name="signed" ${k.signed?'checked':''}> Contrato assinado</label><label class="row sm"><input class="chk" type="checkbox" name="accepted" ${k.accepted?'checked':''}> Aceite do cliente</label></div>
   <label class="fld">Motivo da correção (obrigatório se mudar administradora, grupo ou cota)<input class="in" name="reason" maxlength="300"></label>`,
   onSubmit:dlgAsync(async f=>{if((f.rule_id||'')!==(k.rule_id||'')||Number(f.admin_rate||0)!==Number(k.admin_rate||0))await rpc('crm_case_rule',{p_org:S.orgId,p_case:k.id,p_rule:f.rule_id||null,p_admin_rate:f.admin_rate?Number(f.admin_rate):null});const d={status:f.status,docs:f.docs,first_payment:f.first_payment,product:f.product,admin:f.admin,contract:f.contract,grp:f.grp,quota:f.quota,credit:f.credit,term:f.term,sale_date:f.sale_date,signed:!!f.signed,accepted:!!f.accepted,reason:f.reason};
     await rpc('crm_case_update',{p_org:S.orgId,p_id:k.id,p_data:d});await fcLoad(true);FIN.d=null;toast('Operação atualizada',{icon:'check'});LS.after=()=>{refresh();if(S.ui.drawer)redrawDrawer()}})})};
ACT['case-return']=el=>{const k=caseFind(el.dataset.id);if(!k)return;
  dialog({title:'Devolver ao Kanban — '+k.client_name,sub:'O cliente voltará para atendimento. As informações operacionais ficam no histórico.',submit:'Devolver ao Kanban',body:`<label class="fld">Etapa de retorno<select class="in" name="stage">${['Fechamento','Call 2','Call 1 agendada','Simulação recebida','Closer'].map(s=>`<option>${s}</option>`).join('')}</select></label><label class="fld">Motivo do retorno<textarea class="in" name="reason" rows="3" maxlength="1000" required placeholder="Ex.: fechamento marcado por engano"></textarea></label>`,
   onSubmit:dlgAsync(async f=>{flReplace(await rpc('crm_case_return',{p_org:S.orgId,p_id:k.id,p_stage:f.stage,p_reason:f.reason}));await fcLoad(true);closeAll();toast('Cliente devolvido ao Kanban',{icon:'undo-2'})})})};
ACT['case-dup']=el=>{const k=caseFind(el.dataset.id);if(!k)return;
  dialog({title:'Nova cota para '+k.client_name,sub:'Duplica o cadastro do cliente numa nova cota (mesma administradora).',submit:'Criar cota',body:`<div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Grupo<input class="in" name="grp"></label><label class="fld">Cota<input class="in" name="quota" required></label><label class="fld">Crédito (R$)<input class="in num" name="credit" type="number" min="1" step="100" required value="${esc(k.credit||'')}"></label><label class="fld">Data da venda<input class="in" name="sale_date" type="date"></label></div>`,
   onSubmit:dlgAsync(async f=>{await rpc('crm_case_duplicate',{p_org:S.orgId,p_id:k.id,p_grp:f.grp||null,p_quota:f.quota,p_credit:Number(f.credit),p_sale_date:f.sale_date||null});await fcLoad(true);toast('Nova cota criada',{icon:'copy'});LS.after=()=>{refresh();if(S.ui.drawer)redrawDrawer()}})})};
ACT['case-manual']=()=>{
  dialog({title:'Nova operação manual',sub:'Venda sem origem no Kanban. Salve como rascunho ou registre a venda completa.',submit:'Registrar venda',wide:true,body:`<div class="g" style="grid-template-columns:1fr 1fr">
   <label class="fld">Cliente<input class="in" name="client_name" required></label><label class="fld">Consultor<select class="in" name="seller_user_id">${fOwnerOpts(ME)}</select></label>
   <label class="fld">Telefone<input class="in" name="phone" required></label><label class="fld">E-mail<input class="in" name="email" type="email"></label><label class="fld">CPF/CNPJ<input class="in" name="cpf_cnpj"></label><label class="fld">Produto<input class="in" name="product" placeholder="Imóvel, Veículo…"></label>
   <label class="fld">Administradora<input class="in" name="admin"></label><label class="fld">Contrato<input class="in" name="contract"></label><label class="fld">Grupo<input class="in" name="grp"></label><label class="fld">Cota<input class="in" name="quota"></label>
   <label class="fld">Crédito (R$)<input class="in num" name="credit" type="number" min="1" step="100"></label><label class="fld">Prazo (meses)<input class="in num" name="term" type="number" min="1" step="1"></label><label class="fld">Data da venda<input class="in" name="sale_date" type="date"></label></div>
   <div class="row wrap"><label class="row sm"><input class="chk" type="checkbox" name="docs_complete"> Documentação completa</label><label class="row sm"><input class="chk" type="checkbox" name="signed"> Assinado</label><label class="row sm"><input class="chk" type="checkbox" name="accepted"> Aceite</label><label class="row sm"><input class="chk" type="checkbox" name="first_payment"> 1ª parcela paga</label></div>
   <div class="row"><button type="button" class="btn" data-act="case-draft">Salvar rascunho</button></div>`,
   onSubmit:dlgAsync(async f=>{await manualSave(f,'register')})});
};
async function manualSave(f,mode){
  const d={...f,docs_complete:!!f.docs_complete,signed:!!f.signed,accepted:!!f.accepted,first_payment:!!f.first_payment};
  await rpc('crm_case_manual',{p_org:S.orgId,p_data:d,p_mode:mode});await fcLoad(true);toast(mode==='draft'?'Rascunho salvo':'Venda registrada',{icon:'check'});LS.after=()=>refresh();
}
ACT['case-draft']=async el=>{const form=el.closest('form');if(!form)return;const f=Object.fromEntries(new FormData(form).entries());
  await guarded(async()=>{await manualSave(f,'draft');closeModal()});refresh()};
