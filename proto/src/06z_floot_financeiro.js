/* ===== Bloco Financeiro / Comissões (cópia das regras do Floot) ===== */
const FIN={d:null,loading:false,orgFor:null,tab:null,month:'all',seller:'all',status:'all',q:''};
async function finLoad(force){
  if(FIN.loading||(FIN.d&&!force&&FIN.orgFor===S.orgId))return;
  FIN.loading=true;
  try{FIN.d=await rpc('crm_fin_list',{p_org:S.orgId});FIN.orgFor=S.orgId}catch(e){fail(e)}
  finally{FIN.loading=false;if(S.view==='financeiro')refresh()}
}
const fMon=d=>d?String(d).slice(5,7)+'/'+String(d).slice(0,4):'—';
const fN=v=>Number(v||0);
const fSum=(a,f)=>a.reduce((s,x)=>s+fN(f(x)),0);
const finBd=s=>`<span class="bd ${s==='Prevista'?'mute':'ok'}">${s}</span>`;
function finRows(kind){
  const d=FIN.d;if(!d)return[];const q=nrm(FIN.q);
  return d.events.filter(e=>e.kind===kind&&(FIN.month==='all'||fMon(e.due_month)===FIN.month||(FIN.month==='sem'&&!e.due_month))&&(FIN.seller==='all'||e.seller_user_id===FIN.seller)&&(FIN.status==='all'||e.status===FIN.status)&&(!q||nrm(e.client_name).includes(q)||nrm(e.quota).includes(q)||nrm(e.grp).includes(q)));
}
function finToolbar(kind){
  const months=[...new Set(FIN.d.events.filter(e=>e.kind===kind&&e.due_month).map(e=>fMon(e.due_month)))].sort((a,b)=>a.slice(3)+a.slice(0,2)<b.slice(3)+b.slice(0,2)?-1:1);
  return`<div class="row wrap"><select class="in" style="width:170px" data-chg="fin-month" aria-label="Competência"><option value="all">Todas as competências</option>${months.map(m=>`<option ${FIN.month===m?'selected':''}>${m}</option>`).join('')}<option value="sem" ${FIN.month==='sem'?'selected':''}>Sem competência</option></select>
  ${FIN.d.office?`<select class="in" style="width:200px" data-chg="fin-seller" aria-label="Vendedor">${fOwnerOpts(FIN.seller,true)}</select>`:''}
  <select class="in" style="width:160px" data-chg="fin-status" aria-label="Situação"><option value="all">Todas as situações</option>${['Prevista',kind==='ALVO'?'Recebida':'Paga'].map(s=>`<option ${FIN.status===s?'selected':''}>${s}</option>`).join('')}</select>
  <label class="search" style="max-width:280px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="finq" placeholder="Cliente, grupo ou cota" value="${esc(FIN.q)}"></label>
  <button class="btn sm end" data-act="fin-export" data-id="${kind}">${ic('download')}Exportar CSV</button></div>`;
}
function finTable(kind){
  const rows=finRows(kind),done=kind==='ALVO'?'Recebida':'Paga',off=FIN.d.office;
  const prev=fSum(rows.filter(r=>r.status==='Prevista'),r=>r.amount),real=fSum(rows.filter(r=>r.status!=='Prevista'),r=>r.actual_amount);
  return finToolbar(kind)+`<div class="sm muted">${rows.length} lançamentos · pendente <b class="num">${fBRL(prev)}</b> · ${done.toLowerCase()} <b class="num">${fBRL(real)}</b></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th>${kind==='VENDEDOR'&&off?'<th>Vendedor</th>':''}<th>Administradora · grupo/cota</th><th>Evento</th><th>Competência</th><th>Previsto</th><th>${kind==='ALVO'?'Recebido':'Pago'}</th><th>Situação</th><th></th></tr></thead><tbody>${rows.map(e=>`<tr><td><b>${esc(e.client_name)}</b><div class="xs muted">${esc(e.rule_id||'')}</div></td>${kind==='VENDEDOR'&&off?`<td class="sm">${fcUser(e.seller_user_id)}</td>`:''}<td class="sm">${esc(e.adm||'—')}<div class="xs muted">${esc(e.grp||'—')} / ${esc(e.quota||'—')}</div></td><td class="sm">${esc(e.event)}${e.eligible?' <span class="bd ok" title="Mensalidade confirmada">boleto ok</span>':''}</td><td class="sm">${fMon(e.due_month)}</td><td class="num">${fBRL(e.amount)}</td><td class="num">${e.status==='Prevista'?'—':fBRL(e.actual_amount)+`<div class="xs muted">${fcDate(e.settled_on)}${e.reference?' · '+esc(e.reference):''}</div>`}</td><td>${finBd(e.status)}</td><td>${off?(e.status==='Prevista'?`<button class="btn sm" data-act="fin-settle" data-id="${e.id}">${kind==='ALVO'?'Registrar recebimento':'Marcar pago'}</button>`:`<button class="btn sm ghost" data-act="fin-undo" data-id="${e.id}">Desfazer</button>`):''}</td></tr>`).join('')||`<tr><td colspan="9"><div class="empty">${FIN.loading?'Carregando…':'Nenhum lançamento. As comissões são geradas quando a venda é Efetivada e tem regra de comissão definida.'}</div></td></tr>`}</tbody></table></div>`;
}
function finMens(){
  const d=FIN.d,inst={};d.installments.forEach(i=>{(inst[i.case_id]=inst[i.case_id]||{})[i.n]=i});
  const q=nrm(FIN.q);const cs=d.cases.filter(c=>!q||nrm(c.client_name).includes(q));
  return`<div class="sm muted">Boleto confirmado conta como mensalidade do cliente e gera a previsão da comissão. Não é recebimento da ALVO nem repasse ao vendedor. Confirme na ordem 1 a 12.</div>
  <label class="search" style="max-width:320px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="finq" placeholder="Cliente" value="${esc(FIN.q)}"></label>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Cota</th>${Array.from({length:12},(_,i)=>`<th style="text-align:center">${i+1}</th>`).join('')}</tr></thead><tbody>${cs.map(c=>{const m=inst[c.id]||{};const next=Array.from({length:12},(_,i)=>i+1).find(n=>!(m[n]&&m[n].confirmed));const last=[...Array(12).keys()].map(i=>i+1).filter(n=>m[n]&&m[n].confirmed).pop();
   return`<tr><td><b>${esc(c.client_name)}</b><div class="xs muted">${fcUser(c.seller_user_id)}</div></td><td class="sm">${esc(c.adm||'—')}<div class="xs muted">${esc(c.grp||'—')} / ${esc(c.quota||'—')}</div></td>${Array.from({length:12},(_,i)=>{const n=i+1,ok=m[n]&&m[n].confirmed;
    return`<td style="text-align:center">${ok?(d.office&&n===last?`<button class="btn sm ghost" title="Desfazer" data-act="fin-inst" data-id="${c.id}" data-n="${n}" data-on="0">${ic('check')}</button>`:`<span class="bd ok">${ic('check')}</span>`):(d.office&&n===next?`<button class="btn sm" data-act="fin-inst" data-id="${c.id}" data-n="${n}" data-on="1">Confirmar</button>`:'<span class="muted">·</span>')}</td>`}).join('')}</tr>`}).join('')||`<tr><td colspan="14"><div class="empty">Nenhuma venda efetivada.</div></td></tr>`}</tbody></table></div>`;
}
function finRegras(){
  const d=FIN.d,semRegra=d.cases.filter(c=>!c.rule_id);
  return`${semRegra.length?`<div class="card" style="border-color:var(--warn)"><b class="sm">${semRegra.length} venda(s) efetivada(s) sem regra de comissão</b><div class="xs muted">Defina a regra para gerar o cronograma de comissões.</div><div class="col" style="gap:6px;margin-top:8px">${semRegra.map(c=>`<div class="row sp"><span class="sm">${esc(c.client_name)} · ${fBRL(c.credit)}</span><button class="btn sm" data-act="fin-rule" data-id="${c.id}">Definir regra</button></div>`).join('')}</div></div>`:''}
  <div class="eyebrow">Vendas com regra</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Cliente</th><th>Vendedor</th><th>Regra</th><th>Taxa adm.</th><th></th></tr></thead><tbody>${d.cases.filter(c=>c.rule_id).map(c=>`<tr><td><b>${esc(c.client_name)}</b></td><td class="sm">${fcUser(c.seller_user_id)}</td><td class="sm">${esc(c.rule_id)}</td><td class="sm">${c.admin_rate?c.admin_rate+'%':'—'}</td><td>${d.office?`<button class="btn sm ghost" data-act="fin-rule" data-id="${c.id}">Alterar</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5"><div class="empty">Nenhuma.</div></td></tr>'}</tbody></table></div>
  <div class="row sp"><div class="eyebrow">Acordos individuais de comissão</div>${d.admin?`<button class="btn sm" data-act="fin-agree">${ic('plus')}Definir acordo</button>`:''}</div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendedor</th><th>Administradora</th><th>Percentual</th><th>Observação</th></tr></thead><tbody>${d.agreements.map(a=>`<tr><td>${fcUser(a.seller_user_id)}</td><td>${esc(a.platform)}</td><td class="num">${a.percent}%</td><td class="sm">${esc(a.note||'')}</td></tr>`).join('')||'<tr><td colspan="4"><div class="empty">Sem acordos. Vale o percentual padrão da administradora.</div></td></tr>'}</tbody></table></div>
  <div class="eyebrow">Catálogo de regras (${d.catalog.length})</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Regra</th><th>Administradora</th><th>Produto</th><th>Plano</th><th>Comissão base</th><th>Eventos</th></tr></thead><tbody>${d.catalog.map(k=>`<tr><td><b>${esc(k.id)}</b></td><td>${esc(k.platform)}</td><td class="sm">${esc(k.product)}</td><td class="sm">${esc(k.plan)}</td><td class="num">${(k.commission_rate*100).toFixed(2)}%</td><td class="sm">${k.events.length}</td></tr>`).join('')}</tbody></table></div>`;
}
VIEWS['financeiro']=()=>{
  finLoad();const d=FIN.d,o=O();
  if(!d)return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Financeiro Comercial</h2></div></div><div class="empty">Carregando…</div></div>`;
  const tabs=d.office?[['alvo','Receita ALVO'],['vend','Repasses a vendedores'],['mens','Mensalidades'],['regras','Regras e acordos']]:[['vend','Minhas comissões']];
  if(!tabs.find(t=>t[0]===FIN.tab))FIN.tab=tabs[0][0];
  const A=d.events.filter(e=>e.kind==='ALVO'),V=d.events.filter(e=>e.kind==='VENDEDOR');
  const kp=d.office?[['ALVO a receber',fBRL(fSum(A.filter(e=>e.status==='Prevista'),e=>e.amount))],['ALVO recebido',fBRL(fSum(A.filter(e=>e.status==='Recebida'),e=>e.actual_amount))],['Vendedores a pagar',fBRL(fSum(V.filter(e=>e.status==='Prevista'),e=>e.amount))],['Vendedores pago',fBRL(fSum(V.filter(e=>e.status==='Paga'),e=>e.actual_amount))]]
   :[['Previsto para receber',fBRL(fSum(V.filter(e=>e.status==='Prevista'),e=>e.amount))],['Já recebido',fBRL(fSum(V.filter(e=>e.status==='Paga'),e=>e.actual_amount))],['Vendas efetivadas',d.cases.length],['Próximo mês',fBRL(fSum(V.filter(e=>e.status==='Prevista'&&e.due_month&&e.due_month.slice(0,7)===new Date(new Date().getFullYear(),new Date().getMonth()+1,1).toISOString().slice(0,7)),e=>e.amount))]];
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>${d.office?'Financeiro Comercial':'Minhas comissões'}</h2></div><button class="btn" data-act="fin-reload">${ic('refresh-cw')}Atualizar</button></div>
   <div class="g" style="grid-template-columns:repeat(4,1fr)">${kp.map(([a,b])=>`<div class="card"><div class="xs muted">${a}</div><div class="disp" style="font-size:26px">${b}</div></div>`).join('')}</div>
   <div class="row" role="tablist">${tabs.map(t=>`<button class="btn sm ${FIN.tab===t[0]?'pri':''}" role="tab" data-act="fin-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
   ${FIN.tab==='alvo'?finTable('ALVO'):FIN.tab==='vend'?finTable('VENDEDOR'):FIN.tab==='mens'?finMens():finRegras()}</div>`;
};
ACT['fin-tab']=el=>{FIN.tab=el.dataset.id;FIN.status='all';refresh()};
ACT['fin-reload']=async()=>{await finLoad(true);toast('Financeiro atualizado',{icon:'refresh-cw'})};
CHG['fin-month']=el=>{FIN.month=el.value;refresh()};CHG['fin-seller']=el=>{FIN.seller=el.value;refresh()};CHG['fin-status']=el=>{FIN.status=el.value;refresh()};
document.addEventListener('input',ev=>{if(ev.target.id==='finq'){FIN.q=ev.target.value;const p=ev.target.selectionStart;refresh();const n=$('#finq');if(n){n.focus();n.setSelectionRange(p,p)}}});
ACT['fin-settle']=el=>{const e=FIN.d.events.find(x=>x.id===el.dataset.id);if(!e)return;const alvo=e.kind==='ALVO',today=new Date(Date.now()-4*3600e3).toISOString().slice(0,10);
  dialog({title:alvo?'Registrar recebimento ALVO':'Marcar repasse como pago',sub:`${e.client_name} · ${e.event}`,submit:'Confirmar',body:`<div class="sm muted">Previsto: <b class="num">${fBRL(e.amount)}</b>${e.eligible?'':' · mensalidade ainda não confirmada'}</div><div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Valor (R$)<input class="in num" name="amount" type="number" step="0.01" min="0.01" required value="${e.amount}"></label><label class="fld">Data<input class="in" name="date" type="date" required value="${today}"></label></div><label class="fld">Referência (documento, comprovante)<input class="in" name="ref" maxlength="120"></label>`,
   onSubmit:dlgAsync(async f=>{await rpc('crm_fin_settle',{p_org:S.orgId,p_id:e.id,p_action:'settle',p_amount:Number(f.amount),p_date:f.date,p_ref:f.ref||null});await finLoad(true);FC.loaded=false;toast(alvo?'Recebimento registrado':'Repasse registrado',{icon:'check'})})})};
ACT['fin-undo']=async el=>{if(!confirm('Desfazer esta baixa? O lançamento volta para "Prevista".'))return;await guarded(async()=>{await rpc('crm_fin_settle',{p_org:S.orgId,p_id:el.dataset.id,p_action:'undo',p_amount:null,p_date:null,p_ref:null});await finLoad(true);toast('Baixa desfeita',{icon:'undo-2'})});refresh()};
ACT['fin-inst']=async el=>{await guarded(async()=>{await rpc('crm_fin_installment',{p_org:S.orgId,p_case:el.dataset.id,p_n:Number(el.dataset.n),p_confirm:el.dataset.on==='1'});await finLoad(true);toast(el.dataset.on==='1'?'Mensalidade confirmada (gera previsão, não é recebimento)':'Confirmação desfeita',{icon:'check'})});refresh()};
const finRuleOpts=sel=>{const by={};(FIN.d?.catalog||[]).forEach(k=>(by[k.platform]=by[k.platform]||[]).push(k));return'<option value="">— sem regra —</option>'+Object.entries(by).map(([p,a])=>`<optgroup label="${esc(p)}">${a.map(k=>`<option value="${esc(k.id)}" ${sel===k.id?'selected':''}>${esc(k.id)} · ${esc(k.product)} · ${esc(k.plan)}</option>`).join('')}</optgroup>`).join('')};
ACT['fin-rule']=async el=>{await finLoad();const c=FIN.d.cases.find(x=>x.id===el.dataset.id);if(!c)return;
  dialog({title:'Regra de comissão',sub:c.client_name,submit:'Salvar e recalcular',wide:true,body:`<label class="fld">Regra<select class="in" name="rule_id">${finRuleOpts(c.rule_id)}</select></label><label class="fld">Taxa de administração Canopus (%) — só para regras CAN-*<input class="in num" name="admin_rate" type="number" step="0.01" min="0.01" max="100" placeholder="20" value="${c.admin_rate||''}"></label><div class="xs muted">Recalcula somente lançamentos ainda previstos. Baixas já registradas são preservadas.</div>`,
   onSubmit:dlgAsync(async f=>{await rpc('crm_case_rule',{p_org:S.orgId,p_case:c.id,p_rule:f.rule_id||null,p_admin_rate:f.admin_rate?Number(f.admin_rate):null});await finLoad(true);FC.loaded=false;toast('Regra aplicada',{icon:'check'})})})};
ACT['fin-agree']=()=>{
  dialog({title:'Acordo individual de comissão',sub:'Percentual total do vendedor numa administradora',submit:'Salvar acordo',body:`<label class="fld">Vendedor<select class="in" name="seller">${fOwnerOpts()}</select></label><label class="fld">Administradora<select class="in" name="platform">${['Canopus','CNP','Porto','Servopa'].map(x=>`<option>${x}</option>`).join('')}</select></label><label class="fld">Percentual total (%)<input class="in num" name="percent" type="number" step="0.01" min="0" max="100" required></label><label class="fld">Observação<input class="in" name="note" maxlength="200"></label><div class="xs muted">Vale para vendas futuras e recalcula as previsões ainda não baixadas desse vendedor nessa administradora.</div>`,
   onSubmit:dlgAsync(async f=>{await rpc('crm_fin_agreement_save',{p_org:S.orgId,p_seller:f.seller,p_platform:f.platform,p_percent:Number(f.percent),p_note:f.note||null});await finLoad(true);toast('Acordo salvo',{icon:'check'})})})};
ACT['fin-export']=el=>{const kind=el.dataset.id,rows=finRows(kind);
  const h=['cliente','vendedor','administradora','grupo','cota','regra','evento','competencia','previsto','situacao','valor_baixa','data_baixa','referencia'];
  const lines=[h.join(';')].concat(rows.map(e=>[e.client_name,fcUser(e.seller_user_id).replace(/&[a-z#0-9]+;/g,''),e.adm,e.grp,e.quota,e.rule_id,e.event,fMon(e.due_month),String(e.amount).replace('.',','),e.status,e.actual_amount==null?'':String(e.actual_amount).replace('.',','),e.settled_on||'',e.reference||''].map(csvEsc).join(';')));
  const b=new Blob(['﻿'+lines.join('\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=`comissoes-${kind==='ALVO'?'alvo':'vendedores'}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
