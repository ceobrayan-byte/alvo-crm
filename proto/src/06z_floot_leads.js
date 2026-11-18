/* ===== Bloco Leads (cópia do Floot): Kanban, ficha, Geladeira, Leads Frios ===== */
const FL={leads:[],cold:[],loaded:false,loading:false,f:{owner:'all',origin:'all'},cq:'',cpage:1,cprev:null,orgFor:null};
const FSTAGES=['Novo Lead','SDR / SRV','Closer','Call 1 agendada','No-show / Follow-up Call 1','Simulação recebida','Call 2','Segundo no-show','Fechamento','Geladeira'];
const FSALES='Suporte / Documentação',FORIGINS=['Simulador ALVO','Meta Ads','Google Ads','Indicação','Orgânico','WhatsApp'];
const isAdminish=()=>['Proprietário','Administrador','Gestor'].includes(ROLE());
const fOwnerOpts=(sel,all)=>(all?'<option value="all">Todos os responsáveis</option>':'')+sellersOf().map(u=>`<option value="${u.id}" ${sel===u.id?'selected':''}>${esc(u.name)}</option>`).join('');
const fBRL=v=>v==null||v===''?'—':'R$ '+Number(v).toLocaleString('pt-BR');
async function flLoad(force){
  if(FL.loading||(FL.loaded&&!force&&FL.orgFor===S.orgId))return;
  FL.loading=true;
  try{
    const[l,c]=await Promise.all([rpc('crm_leads_board',{p_org:S.orgId}),rpc('crm_cold_list',{p_org:S.orgId})]);
    FL.leads=l||[];FL.cold=c||[];FL.loaded=true;FL.orgFor=S.orgId;
  }catch(e){fail(e)}
  finally{FL.loading=false;if(S.view==='kanban'||S.view==='leads-frios')refresh()}
}
const flVisible=()=>FL.leads.filter(l=>{
  if(l.stage==='Geladeira')return true;
  if(!isAdminish()&&l.owner_user_id!==ME)return false;
  return(FL.f.owner==='all'||l.owner_user_id===FL.f.owner)&&(FL.f.origin==='all'||l.origin===FL.f.origin);
}).filter(l=>FL.f.owner==='all'||l.stage==='Geladeira'||l.owner_user_id===FL.f.owner);
const flSwitch=(on,act,id)=>`<button type="button" class="sw ${on?'on':''}" role="switch" aria-checked="${!!on}" data-act="${act}" data-id="${id}"></button>`;
function leadCard(l){
  const fridge=l.stage==='Geladeira';
  return`<div class="lcard" draggable="true" data-lead="${l.id}" data-act="lead-open" data-id="${l.id}">
   <div class="row sp"><b class="grow" style="font-size:13.5px">${esc(l.name)}</b>${l.owner_user_id?av(l.owner_user_id,22):''}</div>
   <div class="xs muted">${ic('phone')} ${esc(fmtPhone(l.phone)||'sem telefone')}</div>
   <div class="xs">${esc(l.sonho||l.product_interest||'—')}${l.valor_sonho||l.desired_credit?` · <b class="num">${fBRL(l.valor_sonho||l.desired_credit)}</b>`:''}</div>
   ${fridge?`<div class="row" style="gap:6px"><button class="btn sm" data-act="fridge-claim" data-id="${l.id}">${ic('hand')}Puxar para minha carteira</button><button class="btn sm ghost" data-act="fridge-cold" data-id="${l.id}">${ic('snowflake')}Encaminhar</button></div>`
   :`<div class="row sp"><span class="xs muted">Simulação</span>${flSwitch(l.simulacao,'lead-sim',l.id)}</div>`}
  </div>`;
}
VIEWS['kanban']=()=>{
  flLoad();
  const o=O(),all=flVisible(),title=isAdminish()?'Kanban Global':'Meu Kanban';
  const sales=all.filter(l=>l.stage===FSALES||l.fechou);
  const board=all.filter(l=>l.stage!==FSALES&&!l.fechou);
  return`<div class="pg" style="height:100%"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>${title}</h2></div>
   <button class="btn pri" data-act="lead-new">${ic('plus')}Novo lead</button></div>
   <div class="row wrap">${isAdminish()?`<select class="in" style="width:220px" data-chg="fl-owner" aria-label="Responsável">${fOwnerOpts(FL.f.owner,true)}</select>`:''}
    <select class="in" style="width:200px" data-chg="fl-origin" aria-label="Origem"><option value="all">Todas as origens</option>${FORIGINS.map(x=>`<option ${FL.f.origin===x?'selected':''}>${x}</option>`).join('')}</select>
    <span class="end sm muted">${board.length} leads no quadro${FL.loading?' · atualizando…':''}</span></div>
   <div class="board" style="flex:1;min-height:420px">${FSTAGES.map(s=>{const ds=board.filter(l=>l.stage===s);
     return`<div class="lcol" data-stage="${esc(s)}"><div class="kcol-h"><b>${esc(s)}</b><span class="bd mute">${ds.length}</span></div><div class="col" style="gap:9px">${ds.map(leadCard).join('')||'<div class="empty xs" style="padding:18px 6px">Sem leads</div>'}</div></div>`}).join('')}
    <div class="lcol nodrop" data-stage="${FSALES}"><div class="kcol-h"><b>Vendas efetivadas</b><span class="bd ok">${sales.length}</span></div><div class="col" style="gap:9px">${sales.map(l=>`<div class="lcard" data-act="lead-open" data-id="${l.id}"><b style="font-size:13.5px">${esc(l.name)}</b><div class="xs muted">${esc(l.owner_user_id?user(l.owner_user_id).name:'')}</div></div>`).join('')||'<div class="empty xs" style="padding:18px 6px">Nenhuma venda</div>'}</div></div>
   </div></div>`;
};
CHG['fl-owner']=el=>{FL.f.owner=el.value;refresh()};
CHG['fl-origin']=el=>{FL.f.origin=el.value;refresh()};
const flReplace=row=>{const i=FL.leads.findIndex(x=>x.id===row.id);if(i<0)FL.leads.unshift(row);else FL.leads[i]=row};
async function flMove(id,stage){
  const l=FL.leads.find(x=>x.id===id);if(!l||l.stage===stage)return;
  const before={...l};
  l.stage=stage;if(stage==='Geladeira')l.geladeira_desde=new Date().toISOString();refresh();
  try{flReplace(await rpc('crm_lead_move',{p_org:S.orgId,p_id:id,p_stage:stage}));toast(`<b>${esc(l.name)}</b> movido para ${esc(stage)}`,{icon:'move-right'})}
  catch(e){Object.assign(l,before);fail(e)}
  refresh();
}
document.addEventListener('dragstart',ev=>{const k=ev.target.closest&&ev.target.closest('.lcard[data-lead]');if(!k)return;S.ldrag=k.dataset.lead;k.classList.add('drag');ev.dataTransfer.effectAllowed='move';try{ev.dataTransfer.setData('text/plain',S.ldrag)}catch(e){}});
document.addEventListener('dragend',()=>{S.ldrag=null;$$('.lcard.drag').forEach(x=>x.classList.remove('drag'));$$('.lcol.over').forEach(x=>x.classList.remove('over'))});
document.addEventListener('dragover',ev=>{const c=ev.target.closest&&ev.target.closest('.lcol');if(c&&S.ldrag&&!c.classList.contains('nodrop')){ev.preventDefault();$$('.lcol.over').forEach(x=>x!==c&&x.classList.remove('over'));c.classList.add('over')}});
document.addEventListener('drop',ev=>{const c=ev.target.closest&&ev.target.closest('.lcol');if(c&&S.ldrag&&!c.classList.contains('nodrop')){ev.preventDefault();const id=S.ldrag;S.ldrag=null;c.classList.remove('over');flMove(id,c.dataset.stage)}});

ACT['lead-sim']=async(el,ev)=>{ev.stopPropagation();const l=FL.leads.find(x=>x.id===el.dataset.id);if(!l)return;
  const v=!l.simulacao;l.simulacao=v;refresh();
  try{flReplace(await rpc('crm_lead_save',{p_org:S.orgId,p_id:l.id,p_data:{simulacao:v}}))}catch(e){l.simulacao=!v;fail(e)}refresh()};
ACT['fridge-claim']=async(el,ev)=>{ev.stopPropagation();await guarded(async()=>{flReplace(await rpc('crm_fridge_action',{p_org:S.orgId,p_id:el.dataset.id,p_action:'claim'}));toast('Lead puxado para a sua carteira',{icon:'hand'})});refresh()};
ACT['fridge-cold']=async(el,ev)=>{ev.stopPropagation();await guarded(async()=>{await rpc('crm_fridge_action',{p_org:S.orgId,p_id:el.dataset.id,p_action:'cold'});FL.leads=FL.leads.filter(x=>x.id!==el.dataset.id);await flLoad(true);toast('Lead enviado para Leads Frios',{icon:'snowflake'})});refresh()};

/* ficha do cliente */
const fRow=(k,v)=>`<div class="fr"><span class="xs muted">${k}</span><b class="sm">${v||'—'}</b></div>`;
function leadDrawer(id){
  const l=FL.leads.find(x=>x.id===id);if(!l)return'';
  const sold=l.stage===FSALES||l.fechou;
  return`<div class="dr-h">${avN(l.name,48)}<div class="grow"><div class="eyebrow">Ficha do cliente</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(l.name)}</h3><div class="sm muted">${esc(l.stage)} · ${esc(l.owner_user_id?user(l.owner_user_id).name:'sem responsável')}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b">
   <div><div class="eyebrow" style="margin-bottom:8px">Contato e interesse</div><div class="col" style="gap:6px">${fRow('Telefone',esc(fmtPhone(l.phone)))}${fRow('E-mail',esc(l.email))}${fRow('CPF/CNPJ',esc(l.cpf_cnpj))}${fRow('Origem',esc(l.origin))}${fRow('Sonho',esc(l.sonho))}${fRow('Valor do sonho',fBRL(l.valor_sonho))}${fRow('Capacidade mensal',fBRL(l.capacidade))}</div></div>
   <div><div class="eyebrow" style="margin-bottom:8px">Atendimento</div><div class="col" style="gap:6px">${fRow('Etapa',esc(l.stage))}${fRow('Último contato',esc(l.last_contact))}${fRow('Call agendada',esc(l.agendado))}
    <div class="fr row sp"><span class="xs muted">Simulação</span>${flSwitch(l.simulacao,'lead-sim',l.id)}</div></div></div>
   <div><div class="eyebrow" style="margin-bottom:8px">Contratação</div><div class="fr row sp"><span class="xs muted">Fechou?</span><b class="sm">${l.fechou?'Sim':'Não'}</b></div></div>
  </div>
  <div class="dr-f"><button class="btn" data-act="lead-edit" data-id="${l.id}">${ic('pencil')}Editar informações</button>${sold?'':`<button class="btn pri" data-act="lead-sell" data-id="${l.id}">${ic('badge-check')}Efetivar venda</button>`}</div>`;
}
ACT['lead-open']=el=>{if(!FL.leads.find(x=>x.id===el.dataset.id))return;openDrawer(()=>leadDrawer(el.dataset.id))};
ACT['lead-sell']=async el=>{await guarded(async()=>{flReplace(await rpc('crm_lead_close_sale',{p_org:S.orgId,p_id:el.dataset.id}));toast('Venda efetivada. Caso criado em Suporte / Documentação.',{icon:'badge-check'})});refresh();redrawDrawer()};
function leadForm(l){
  l=l||{};
  const v=k=>esc(l[k]==null?'':l[k]);
  dialog({title:l.id?'Editar lead':'Novo lead',sub:'Leads',submit:'Salvar',wide:true,body:`
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Nome<input class="in" name="name" required maxlength="80" value="${v('name')}"></label><label class="fld">Telefone<input class="in" name="phone" placeholder="(65) 90000-0000" value="${esc(fmtPhone(l.phone)||'')}"></label>
   <label class="fld">E-mail<input class="in" name="email" type="email" value="${v('email')}"></label><label class="fld">CPF/CNPJ<input class="in" name="cpf_cnpj" value="${v('cpf_cnpj')}"></label>
   <label class="fld">Origem<select class="in" name="origin">${FORIGINS.map(x=>`<option ${l.origin===x?'selected':''}>${x}</option>`).join('')}</select></label>
   <label class="fld">Responsável<select class="in" name="owner_user_id">${fOwnerOpts(l.owner_user_id||ME)}</select></label>
   <label class="fld">Sonho<input class="in" name="sonho" placeholder="Ex.: Casa própria" value="${v('sonho')}"></label><label class="fld">Valor do sonho (R$)<input class="in num" name="valor_sonho" type="number" min="0" step="1000" value="${v('valor_sonho')}"></label>
   <label class="fld">Capacidade mensal (R$)<input class="in num" name="capacidade" type="number" min="0" step="100" value="${v('capacidade')}"></label><label class="fld">Call agendada<input class="in" name="agendado" placeholder="DD/MM/AAAA HH:MM" value="${v('agendado')}"></label>
   ${l.id?'':`<label class="fld">Etapa<select class="in" name="stage">${FSTAGES.map(x=>`<option>${x}</option>`).join('')}</select></label>`}</div>
   <div class="row"><label class="row sm"><input class="chk" type="checkbox" name="simulacao" ${l.simulacao?'checked':''}> Simulação</label>${l.id?`<button type="button" class="btn sm ghost end" style="color:var(--bad)" data-act="lead-del" data-id="${l.id}">${ic('trash-2')}Excluir</button>`:''}</div>`,
   onSubmit:dlgAsync(async f=>{
     const d={name:f.name,phone:f.phone,email:f.email,cpf_cnpj:f.cpf_cnpj,origin:f.origin,owner_user_id:f.owner_user_id,sonho:f.sonho,valor_sonho:f.valor_sonho,capacidade:f.capacidade,agendado:f.agendado,simulacao:!!f.simulacao};
     if(f.stage)d.stage=f.stage;
     flReplace(await rpc('crm_lead_save',{p_org:S.orgId,p_id:l.id||null,p_data:d}));
     toast(l.id?'Lead atualizado':'Lead criado',{icon:'check'});LS.after=()=>{refresh();if(S.ui.drawer)redrawDrawer()};
   })});
}
ACT['lead-new']=()=>leadForm();
ACT['lead-edit']=el=>leadForm(FL.leads.find(x=>x.id===el.dataset.id));
ACT['lead-del']=async el=>{if(!confirm('Excluir este lead? Esta ação não pode ser desfeita.'))return;
  await guarded(async()=>{await rpc('crm_lead_delete',{p_org:S.orgId,p_id:el.dataset.id});FL.leads=FL.leads.filter(x=>x.id!==el.dataset.id);toast('Lead excluído',{icon:'trash-2'})});closeAll();refresh()};

/* ===== Leads Frios ===== */
const csvEsc=v=>{v=String(v==null?'':v);return/[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v};
function parseCsv(txt){
  txt=txt.replace(/^﻿/,'');const first=txt.split(/\r?\n/)[0]||'';const del=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
  const rows=[];let row=[],cur='',q=false;
  for(let i=0;i<txt.length;i++){const c=txt[i];
    if(q){if(c==='"'){if(txt[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;else if(c===del){row.push(cur);cur=''}else if(c==='\n'){row.push(cur);rows.push(row);row=[];cur=''}else if(c!=='\r')cur+=c}
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(x=>x.trim()));
}
const nrm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().trim();
function csvToRows(txt){
  const r=parseCsv(txt);if(r.length<2)return[];
  const h=r[0].map(nrm),ix=(...n)=>h.findIndex(x=>n.includes(x));
  const m={name:ix('nome','name'),phone:ix('telefone','contato','phone','celular','whatsapp'),email:ix('email','e-mail'),origin:ix('origem','origin'),owner_retorno:ix('owner_retorno'),ultima_interacao:ix('ultima_interacao'),motivo:ix('motivo')};
  const g=(row,k)=>m[k]>=0?(row[m[k]]||'').trim():'';
  return r.slice(1).map(row=>({name:g(row,'name'),phone:g(row,'phone'),email:g(row,'email'),origin:g(row,'origin'),owner_retorno:g(row,'owner_retorno'),ultima_interacao:g(row,'ultima_interacao'),motivo:g(row,'motivo')}));
}
VIEWS['leads-frios']=()=>{
  flLoad();
  const q=nrm(FL.cq),rows=FL.cold.filter(c=>!q||nrm(c.name).includes(q)||String(c.phone).includes(q.replace(/\D/g,'')||'§')||nrm(c.email).includes(q));
  const pages=Math.max(1,Math.ceil(rows.length/20));FL.cpage=Math.min(FL.cpage,pages);
  const pg=rows.slice((FL.cpage-1)*20,FL.cpage*20);
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(O().name)}</div><h2>Leads Frios</h2></div>
   <button class="btn" data-act="cold-export">${ic('download')}Exportar CSV</button><label class="btn pri" style="cursor:pointer">${ic('upload')}Importar CSV<input id="coldf" type="file" accept=".csv,text/csv" hidden></label></div>
   <div class="sm muted">Base compartilhada. Só Nome e Contato são obrigatórios; duplicados e leads ativos são ignorados.</div>
   <label class="search" style="max-width:420px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="coldq" placeholder="Buscar por nome, telefone ou e-mail" value="${esc(FL.cq)}"></label>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nome</th><th>Contato</th><th>Origem</th><th>Última interação</th><th>Motivo</th><th></th></tr></thead><tbody>${pg.map(c=>`<tr><td><b>${esc(c.name)}</b><div class="xs muted">${esc(c.email||'')}</div></td><td class="sm">${esc(fmtPhone(c.phone))}</td><td class="sm">${esc(c.origin||'—')}</td><td class="sm muted">${esc(c.last_interaction||'—')}</td><td class="sm">${esc(c.reason||'—')}</td><td><button class="btn sm" data-act="cold-resume" data-id="${c.id}">${ic('flame')}Retomar</button></td></tr>`).join('')||'<tr><td colspan="6" class="empty">Nenhum lead frio.</td></tr>'}</tbody></table></div>
   <div class="row sp"><span class="xs muted">${rows.length} leads · página ${FL.cpage} de ${pages}</span><div class="row"><button class="btn sm" data-act="cold-page" data-id="-1" ${FL.cpage<=1?'disabled':''}>Anterior</button><button class="btn sm" data-act="cold-page" data-id="1" ${FL.cpage>=pages?'disabled':''}>Próxima</button></div></div></div>`;
};
ACT['cold-page']=el=>{FL.cpage+=+el.dataset.id;refresh()};
ACT['cold-resume']=async el=>{await guarded(async()=>{const l=await rpc('crm_cold_resume',{p_org:S.orgId,p_id:el.dataset.id});FL.cold=FL.cold.filter(x=>x.id!==el.dataset.id);flReplace(l);toast('Lead retomado para a sua carteira',{icon:'flame'})});refresh()};
ACT['cold-export']=()=>{
  const h=['telefone','nome','email','origem','owner_retorno','ultima_interacao','motivo','entrada_base'];
  const body=FL.cold.map(c=>[c.phone,c.name,c.email,c.origin,c.return_owner,c.last_interaction,c.reason,c.entered_at].map(csvEsc).join(';'));
  const blob=new Blob(['﻿'+[h.join(';'),...body].join('\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='leads-frios-alvo.csv';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
};
document.addEventListener('input',ev=>{const t=ev.target;if(t&&t.id==='coldq'){FL.cq=t.value;FL.cpage=1;const p=t.selectionStart;refresh();const n=$('#coldq');if(n){n.focus();try{n.setSelectionRange(p,p)}catch(e){}}}});
document.addEventListener('change',async ev=>{
  const t=ev.target;if(!t||t.id!=='coldf'||!t.files||!t.files[0])return;
  const file=t.files[0];t.value='';
  if(file.size>5*1024*1024){toast('Arquivo acima de 5 MB.',{icon:'alert-triangle'});return}
  let rows;try{rows=csvToRows(await file.text())}catch(e){toast('Não consegui ler o arquivo.',{icon:'alert-triangle'});return}
  if(!rows.length){toast('Arquivo vazio ou sem cabeçalho (nome;telefone).',{icon:'alert-triangle'});return}
  await guarded(async()=>{
    const pv=await rpc('crm_cold_import',{p_org:S.orgId,p_rows:rows,p_commit:false});
    FL.cprev=rows;
    dialog({title:'Prévia da importação',sub:'Leads Frios',submit:pv.new?`Importar ${pv.new} leads`:'Fechar',body:`<div class="g" style="grid-template-columns:repeat(4,1fr)">${[['Novos',pv.new],['Duplicados',pv.duplicates],['Já ativos',pv.active],['Inválidos',pv.invalid]].map(([k,n])=>`<div class="card" style="padding:12px"><div class="xs muted">${k}</div><b class="num" style="font-size:22px">${n}</b></div>`).join('')}</div>`,
      onSubmit:dlgAsync(async()=>{if(!pv.new)return;const r=await rpc('crm_cold_import',{p_org:S.orgId,p_rows:FL.cprev,p_commit:true});FL.cprev=null;await flLoad(true);toast(`${r.new} leads importados`,{icon:'upload'})})});
  });
});
