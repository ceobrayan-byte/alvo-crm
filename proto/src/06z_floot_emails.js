/* ===== E-mails (cópia do Floot: jornada do cliente + avisos à equipe, envio pelo Resend) ===== */
const EM_CAT=[['campaign','Disparo / campanha','Ofertas e campanhas para clientes que autorizaram',1,0],['payment-reminder','Lembrete de pagamento','Antes do vencimento confirmado',0,0],['payment-last-day','Último dia para pagamento','Dia do vencimento confirmado',0,0],
 ['assembly-today','Assembleia é HOJE','Dia oficial da assembleia',0,0],['assembly-feedback','Feedback de assembleia','Resultado oficial conferido',0,1],['birthday','Feliz aniversário','Data de nascimento confirmada',0,0],
 ['news','Novidades e comunicados','Sob demanda',1,0],['overdue-one','Parcela atrasada · 1 mês','Somente após confirmação da pendência',0,1],['overdue-two','Parcela atrasada · 2 meses','Somente após confirmação da pendência',0,1],
 ['pre-cancel','Pré-cancelamento','Risco confirmado pela administradora',0,1],['cancelled','Cota cancelada','Cancelamento confirmado oficialmente',0,1],['churn','Follow-up de recuperação','Acompanhamento após saída',1,1],['referral','Prêmio Indicador','Campanha com regras aprovadas',1,1]];
const EM_ICON={campaign:'✨','payment-reminder':'📅','payment-last-day':'⏰','assembly-today':'🎯','assembly-feedback':'📊',birthday:'🎉',news:'📣','overdue-one':'🤝','overdue-two':'🤝','pre-cancel':'🛡️',cancelled:'📄',churn:'🌱',referral:'🏆'};
const EM_NOTICE=['Aviso geral','Reunião','Metas e campanhas','Orientações comerciais','Comunicado urgente','Outros'];
const EM={d:null,loading:false,orgFor:null,tab:'models',pv:{},mk:'campaign',camp:{eyebrow:'',headline:'',subtitle:'',h1:'',h2:'',h3:'',ctaLabel:'',ctaUrl:''},prev:{},kind:'campaign',date:'',ref:'',body:'',adm:'all',q:'',sel:new Set(),tsel:new Set(),cat:'Aviso geral',subj:'',tbody:'',cfg:null,busy:false};
const emCat=k=>EM_CAT.find(x=>x[0]===k)||EM_CAT[0];
const emOk=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e||'');
async function emLoad(force){
  if(EM.loading||(EM.d&&!force&&EM.orgFor===S.orgId))return;EM.loading=true;
  try{EM.d=await rpc('crm_mail_audience',{p_org:S.orgId});EM.orgFor=S.orgId;
    if(EM.cfg==null&&window.mailFn)mailFn({action:'status',org:S.orgId}).then(r=>{EM.cfg=r;if(S.view==='emails')refresh()}).catch(()=>{EM.cfg={configured:false}});
  }catch(e){fail(e)}finally{EM.loading=false;if(S.view==='emails')refresh()}
}
const emEligible=c=>{const k=emCat(EM.kind);return emOk(c.email)&&!(k[3]&&(!c.marketing_ok||c.opt_out))};
const emStBd=s=>`<span class="bd ${({entregue:'ok',aberto:'ok',enviado:'ok',enviando:'mute',incerto:'warn',falhou:'bad',devolvido:'bad',spam:'bad'})[s]||'mute'}">${esc(s)}</span>`;
function emClients(){
  const d=EM.d,k=emCat(EM.kind),q=nrm(EM.q);
  const rows=d.clients.filter(c=>(EM.adm==='all'||c.adm===EM.adm)&&(!q||nrm(c.name).includes(q)||nrm(c.email).includes(q)||nrm(c.grp).includes(q)||nrm(c.quota).includes(q)));
  const adms=[...new Set(d.clients.map(c=>c.adm).filter(Boolean))].sort();
  const elig=rows.filter(emEligible),nsel=[...EM.sel].filter(id=>rows.some(c=>c.case_id===id&&emEligible(c))).length;
  return`<div class="card col" style="gap:12px"><div class="g" style="grid-template-columns:2fr 1fr 1fr;gap:12px">
   <label class="fld">Modelo<select class="in" data-chg="em-kind">${EM_CAT.map(x=>`<option value="${x[0]}" ${x[0]===EM.kind?'selected':''}>${esc(x[1])}${x[3]?' · campanha':''}</option>`).join('')}</select></label>
   ${EM.kind==='campaign'?'<div></div>':`<label class="fld">Data do evento<input class="in" type="date" id="emdate" value="${esc(EM.date)}"></label>`}
   <label class="fld">Administradora<select class="in" data-chg="em-adm"><option value="all">Todas</option>${adms.map(a=>`<option ${a===EM.adm?'selected':''}>${esc(a)}</option>`).join('')}</select></label></div>
   <div class="xs muted">Quando usar: <b>${esc(k[2])}</b>.${k[3]?' Campanha: só vai para quem autorizou receber campanhas (e tem link de descadastro).':''}${k[4]?' Exige evidência/regra informada abaixo.':''}</div>
   ${EM.kind==='campaign'?emCampForm():''}
   ${k[4]?`<label class="fld">Evidência ou regra da campanha<input class="in" id="emref" value="${esc(EM.ref)}" placeholder="Ex.: extrato da administradora de 18/11, campanha aprovada…"></label>`:''}
   <label class="fld">${EM.kind==='campaign'?'Texto principal da campanha':'Texto (opcional — em branco usa o texto padrão do modelo)'}<textarea class="in" id="embody" rows="3" maxlength="1800">${esc(EM.body)}</textarea></label></div>
  <div class="row wrap"><label class="search" style="max-width:300px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="emq" placeholder="Cliente, e-mail, grupo ou cota" value="${esc(EM.q)}"></label>
   <button class="btn sm" data-act="em-all">${ic('check-check')}Selecionar elegíveis (${elig.length})</button><button class="btn sm ghost" data-act="em-none">Limpar</button>
   <button class="btn sm ghost" data-act="em-preview">${ic('eye')}Prévia</button>
   <button class="btn pri end" data-act="em-send" ${nsel&&!EM.busy?'':'disabled'}>${ic('send')}Enviar para ${nsel}</button></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Cliente</th><th>E-mail</th><th>Administradora · grupo/cota</th><th>Campanhas</th></tr></thead><tbody>${rows.map(c=>{const ok=emEligible(c);
   return`<tr><td><input type="checkbox" data-chg="em-pick" data-id="${esc(c.case_id)}" ${EM.sel.has(c.case_id)&&ok?'checked':''} ${ok?'':'disabled'} aria-label="Selecionar ${esc(c.name)}"></td>
    <td><b>${esc(c.name)}</b><div class="xs muted">${fcUser(c.seller)}</div></td><td class="sm">${emOk(c.email)?esc(c.email):'<span class="bd warn">sem e-mail</span>'}</td>
    <td class="sm">${esc(c.adm||'—')}<div class="xs muted">${esc(c.grp||'—')} / ${esc(c.quota||'—')}</div></td>
    <td>${c.opt_out?'<span class="bd bad">descadastrado</span>':`<button class="btn sm ${c.marketing_ok?'':'ghost'}" data-act="em-mkt" data-id="${esc(c.client_id||'')}" data-on="${c.marketing_ok?0:1}" ${c.client_id?'':'disabled'}>${c.marketing_ok?'Autorizado':'Não autorizado'}</button>`}</td></tr>`}).join('')||'<tr><td colspan="5"><div class="empty">Nenhum cliente com cota efetivada.</div></td></tr>'}</tbody></table></div>`;
}
function emTeam(){
  const t=EM.d.team,n=[...EM.tsel].length;
  return`<div class="card col" style="gap:12px"><div class="g" style="grid-template-columns:1fr 2fr;gap:12px">
   <label class="fld">Categoria<select class="in" data-chg="em-cat">${EM_NOTICE.map(c=>`<option ${c===EM.cat?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
   <label class="fld">Assunto<input class="in" id="emsubj" maxlength="150" value="${esc(EM.subj)}"></label></div>
   <label class="fld">Mensagem<textarea class="in" id="emtbody" rows="6" maxlength="6000">${esc(EM.tbody)}</textarea></label></div>
  <div class="row wrap"><button class="btn sm" data-act="em-tall">${ic('check-check')}Selecionar todos</button><button class="btn sm ghost" data-act="em-tnone">Limpar</button>
 <button class="btn sm ghost" data-act="em-tpreview">${ic('eye')}Prévia</button>
   <button class="btn pri end" data-act="em-tsend" ${n&&!EM.busy?'':'disabled'}>${ic('send')}Enviar aviso para ${n}</button></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th>Pessoa</th><th>Perfil</th><th>E-mail</th></tr></thead><tbody>${t.map(u=>{const ok=emOk(u.email);
   return`<tr><td><input type="checkbox" data-chg="em-tpick" data-id="${esc(u.id)}" ${EM.tsel.has(u.id)&&ok?'checked':''} ${ok?'':'disabled'}></td><td><b>${esc(u.name)}</b></td><td class="sm">${esc(({PROPRIETARIO:'Proprietário',ADMINISTRADOR:'Administrador',GESTOR:'Coordenador',VENDEDOR:'Vendedor',SUPORTE:'Suporte',FINANCEIRO:'Financeiro'})[u.role]||u.role)}</td><td class="sm">${ok?esc(u.email):'<span class="bd warn">sem e-mail</span>'}</td></tr>`}).join('')}</tbody></table></div>`;
}
function emHist(){
  const h=EM.d.history,cat=k=>(EM_CAT.find(x=>x[0]===k)||[0,k])[1];
  return`<div class="row"><span class="sm muted">${h.length} envio(s) registrados · a situação de entrega é conferida no Resend</span><button class="btn sm end" data-act="em-refresh">${ic('refresh-cw')}Atualizar situação</button></div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>Modelo / categoria</th><th>Destinatário</th><th>Assunto</th><th>Situação</th></tr></thead><tbody>${h.map(r=>`<tr><td class="sm num">${fcDate(r.created_at)}</td><td class="sm">${r.kind==='cliente'?'Cliente':'Equipe'}</td><td class="sm">${esc(cat(r.template))}</td>
   <td><b class="sm">${esc(r.to_name||'')}</b><div class="xs muted">${esc(r.to_email)}</div></td><td class="sm">${esc(r.subject||'')}</td><td>${emStBd(r.status)}${r.error?`<div class="xs muted" style="max-width:220px">${esc(r.error)}</div>`:''}<div class="xs muted">${esc(r.sent_by||'')}</div></td></tr>`).join('')||'<tr><td colspan="6"><div class="empty">Nada enviado ainda.</div></td></tr>'}</tbody></table></div>`;
}
VIEWS['emails']=()=>{
  emLoad();const d=EM.d,o=O();
  if(!d)return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>E-mails</h2></div></div><div class="empty">Carregando…</div></div>`;
  const cfg=EM.cfg;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · remetente suporte@alvoinvestimentos.com</div><h2>E-mails</h2></div>
   ${cfg?(cfg.configured?'<span class="bd ok">Resend conectado</span>':'<span class="bd warn" title="Falta cadastrar a chave do Resend no Supabase">Resend sem chave</span>'):''}</div>
   <div class="row" role="tablist">${[['models','Modelos'],['cli','Clientes · jornada e disparo'],['team','Avisos à equipe'],['hist','Histórico']].map(t=>`<button class="btn sm ${EM.tab===t[0]?'pri':''}" role="tab" data-act="em-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
   ${EM.tab==='models'?emModels():EM.tab==='cli'?emClients():EM.tab==='team'?emTeam():emHist()}</div>`;
};
ACT['em-tab']=el=>{EM.tab=el.dataset.id;refresh();if(EM.tab==='hist')ACT['em-refresh'](null,true)};
CHG['em-kind']=el=>{EM.kind=el.value;refresh()};CHG['em-adm']=el=>{EM.adm=el.value;refresh()};CHG['em-cat']=el=>{EM.cat=el.value};
CHG['em-pick']=el=>{el.checked?EM.sel.add(el.dataset.id):EM.sel.delete(el.dataset.id);refresh()};
CHG['em-tpick']=el=>{el.checked?EM.tsel.add(el.dataset.id):EM.tsel.delete(el.dataset.id);refresh()};
ACT['em-all']=()=>{EM.d.clients.filter(c=>(EM.adm==='all'||c.adm===EM.adm)&&emEligible(c)).forEach(c=>EM.sel.add(c.case_id));refresh()};
ACT['em-none']=()=>{EM.sel.clear();refresh()};
ACT['em-tall']=()=>{EM.d.team.filter(u=>emOk(u.email)).forEach(u=>EM.tsel.add(u.id));refresh()};
ACT['em-tnone']=()=>{EM.tsel.clear();refresh()};
document.addEventListener('input',ev=>{const t=ev.target;if(!t||!t.id)return;if(t.id.startsWith('emc-')){EM.camp[t.id.slice(4)]=t.value;return}
  if(t.id==='emdate')EM.date=t.value;else if(t.id==='emref')EM.ref=t.value;else if(t.id==='embody')EM.body=t.value;else if(t.id==='emsubj')EM.subj=t.value;else if(t.id==='emtbody')EM.tbody=t.value;
  else if(t.id==='emq'){EM.q=t.value;const p=t.selectionStart;refresh();const n=$('#emq');if(n){n.focus();n.setSelectionRange(p,p)}}});
ACT['em-mkt']=async el=>{await guarded(async()=>{await rpc('crm_mail_marketing',{p_org:S.orgId,p_client:el.dataset.id,p_ok:el.dataset.on==='1'});await emLoad(true);toast(el.dataset.on==='1'?'Autorização de campanhas registrada':'Autorização removida',{icon:'check'})});refresh()};
ACT['em-preview']=()=>{const c=EM.d.clients.find(x=>EM.sel.has(x.case_id));emShow({action:'preview',org:S.orgId,mode:'cliente',template:EM.kind,caseId:c?c.case_id:null,eventDate:EM.date||null,body:EM.body,campaign:EM.kind==='campaign'?emCampData():undefined},emCat(EM.kind)[1])};
ACT['em-tpreview']=()=>emShow({action:'preview',org:S.orgId,mode:'aviso',category:EM.cat,subject:EM.subj,body:EM.tbody},'Aviso à equipe');
ACT['em-model']=el=>{EM.kind=el.dataset.id;emShow({action:'preview',org:S.orgId,mode:'cliente',template:EM.kind,body:'',campaign:EM.kind==='campaign'?emCampData(true):undefined},emCat(EM.kind)[1])};
ACT['em-use']=el=>{EM.kind=el.dataset.id;EM.tab='cli';closeModal();refresh()};
async function emShow(req,title){
  dialog({title:'Prévia · '+title,sub:'Exatamente como chega na caixa de entrada',submit:'Fechar',wide:true,body:`<div id="emprev" class="emprev"><div class="xs muted" style="padding:30px;text-align:center">Gerando prévia…</div></div>
    ${req.mode==='cliente'?`<div class="row" style="justify-content:flex-start"><button type="button" class="btn sm" data-act="em-use" data-id="${esc(req.template)}">${ic('send')}Usar este modelo</button></div>`:''}`,onSubmit:()=>{}});
  try{const r=await mailFn(req);const box=$('#emprev');if(!box)return;
    box.innerHTML=`<div class="emsubj"><span class="xs muted">Assunto</span><b class="sm">${esc(r.subject||'')}</b><span class="xs muted">De: ALVO Investimentos &lt;suporte@alvoinvestimentos.com&gt;</span></div><iframe title="Prévia do e-mail" sandbox="" class="emframe"></iframe>`;
    const fr=box.querySelector('iframe');fr.srcdoc=r.html;fr.onload=()=>{try{fr.style.height=Math.min(2400,fr.contentDocument.documentElement.scrollHeight+10)+'px'}catch(e){fr.style.height='1100px'}}}
  catch(e){const box=$('#emprev');if(box)box.innerHTML=`<div class="empty">${esc(e.message||'Não foi possível gerar a prévia')}</div>`}
}
function emCampData(sample){const c=EM.camp,x=(v,d)=>sample&&!String(v||'').trim()?d:v;
  return{eyebrow:x(c.eyebrow,'Condição especial'),headline:x(c.headline,'Sua próxima conquista começa agora'),subtitle:x(c.subtitle,'Uma oportunidade exclusiva para clientes ALVO.'),
    highlights:[x(c.h1,'Parcelas que cabem no bolso — planejamento sem juros'),x(c.h2,'Atendimento dedicado — seu consultor acompanha cada etapa'),x(c.h3,'Mais patrimônio — use o crédito para imóvel, veículo ou investimento')].filter(v=>String(v||'').trim()),
    ctaLabel:x(c.ctaLabel,'Quero saber mais'),ctaUrl:c.ctaUrl}}
function emCampForm(){const c=EM.camp,f=(id,l,ph,max)=>`<label class="fld">${l}<input class="in" id="emc-${id}" maxlength="${max}" value="${esc(c[id])}" placeholder="${esc(ph)}"></label>`;
  return`<div class="card col emcamp" style="gap:10px;background:color-mix(in srgb,var(--gold) 6%,transparent)"><b class="sm">${ic('sparkles')} Montagem do disparo</b>
   <div class="g" style="grid-template-columns:1fr 2fr;gap:10px">${f('eyebrow','Chamada (topo)','Ex.: Black Friday ALVO',40)}${f('headline','Título *','Ex.: Sua segunda carta com parcela reduzida',120)}</div>
   ${f('subtitle','Subtítulo','Ex.: Condição exclusiva para clientes, válida até 30/11',220)}
   <div class="g" style="grid-template-columns:1fr 1fr 1fr;gap:10px">${f('h1','Destaque 1','Título — explicação',160)}${f('h2','Destaque 2','Título — explicação',160)}${f('h3','Destaque 3','Título — explicação',160)}</div>
   <div class="g" style="grid-template-columns:1fr 2fr;gap:10px">${f('ctaLabel','Texto do botão','Quero aproveitar',40)}${f('ctaUrl','Link do botão (https://)','https://wa.me/55DDDNUMERO — vazio responde por e-mail',500)}</div></div>`}
function emModels(){
  const all=EM_CAT.map(x=>({id:x[0],t:x[1],w:x[2],promo:x[3],ev:x[4]})).concat([{id:'aviso',t:'Comunicado à equipe',w:'Avisos internos, reuniões, metas e campanhas',team:1}]);
  const cur=EM.mk||'campaign',k=all.find(x=>x.id===cur)||all[0],key=cur+'|'+S.orgId;
  if(EM.pv.key!==key&&!EM.pv.busy){EM.pv={key,busy:true};mailFn(cur==='aviso'?{action:'preview',org:S.orgId,mode:'aviso',category:'Metas e campanhas',subject:'Reta final do ciclo: vamos bater a meta!',body:'Faltam poucos dias para fechar o ciclo.\n\nRevise seu funil hoje, priorize quem está em fechamento e conte com o suporte para agilizar a documentação.'}:{action:'preview',org:S.orgId,mode:'cliente',template:cur,body:'',campaign:cur==='campaign'?emCampData(true):undefined})
    .then(r=>{EM.pv={key,html:r.html,subject:r.subject}}).catch(e=>{EM.pv={key,err:e.message||'Falha na prévia'}}).finally(()=>{if(S.view==='emails'&&EM.tab==='models')refresh()})}
  return`<div class="emsplit"><div class="emlist">${all.map(x=>`<button type="button" class="emitem ${x.id===cur?'on':''}" data-act="em-mk" data-id="${x.id}"><span class="emic2">${x.id==='aviso'?'📣':EM_ICON[x.id]||'✉️'}</span><span class="grow"><b class="sm">${esc(x.t)}</b><span class="xs muted">${esc(x.w)}</span></span>${x.promo?'<span class="bd warn">campanha</span>':x.team?'<span class="bd mute">interno</span>':''}</button>`).join('')}</div>
   <div class="emview"><div class="row sp wrap" style="gap:8px"><div><div class="eyebrow">Exemplo real · como chega na caixa de entrada</div><b>${esc(k.t)}</b></div>
     <button class="btn pri sm" data-act="${k.team?'em-tab':'em-use'}" data-id="${k.team?'team':k.id}">${ic('send')}Usar este modelo</button></div>
    <div class="emprev" style="margin-top:10px">${EM.pv.html?`<div class="emsubj"><span class="xs muted">Assunto</span><b class="sm">${esc(EM.pv.subject||'')}</b><span class="xs muted">De: ALVO Investimentos &lt;suporte@alvoinvestimentos.com&gt;</span></div><iframe title="Exemplo do e-mail" sandbox="allow-same-origin" class="emframe" srcdoc="${esc(EM.pv.html)}" onload="try{this.style.height=(this.contentDocument.documentElement.scrollHeight+12)+'px'}catch(e){}"></iframe>`:EM.pv.err?`<div class="empty">${esc(EM.pv.err)}</div>`:'<div class="xs muted" style="padding:40px;text-align:center">Gerando exemplo…</div>'}</div></div></div>`}
ACT['em-mk']=el=>{EM.mk=el.dataset.id;refresh()};

ACT['em-send']=async()=>{
  const k=emCat(EM.kind),ids=[...EM.sel].filter(id=>EM.d.clients.some(c=>c.case_id===id&&emEligible(c)));if(!ids.length)return;
  if(!confirm(`Enviar "${k[1]}" para ${ids.length} cliente(s) agora? O envio é real e não pode ser desfeito.`))return;
  EM.busy=true;refresh();
  await guarded(async()=>{const r=await mailFn({action:'send',org:S.orgId,mode:'cliente',template:k[0],caseIds:ids,eventDate:EM.date||null,reference:EM.ref,body:EM.body,campaign:k[0]==='campaign'?emCampData():undefined});
    toast(esc(r.message||'Enviado'),{icon:'send',ms:6000});EM.sel.clear();await emLoad(true)});
  EM.busy=false;refresh()};
ACT['em-tsend']=async()=>{
  const ids=[...EM.tsel];if(!ids.length)return;
  if(!confirm(`Enviar o aviso "${EM.subj}" para ${ids.length} pessoa(s) da equipe agora?`))return;
  EM.busy=true;refresh();
  await guarded(async()=>{const r=await mailFn({action:'send',org:S.orgId,mode:'aviso',category:EM.cat,subject:EM.subj,body:EM.tbody,userIds:ids});
    toast(esc(r.message||'Enviado'),{icon:'send',ms:6000});EM.tsel.clear();EM.subj='';EM.tbody='';await emLoad(true)});
  EM.busy=false;refresh()};
ACT['em-refresh']=async(el,quiet)=>{try{const r=await mailFn({action:'refresh',org:S.orgId});await emLoad(true);if(!quiet)toast(`${r.updated||0} situação(ões) atualizada(s)`,{icon:'refresh-cw'})}catch(e){if(!quiet)fail(e)}};
