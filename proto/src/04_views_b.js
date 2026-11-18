/* ===== Tarefas, Conversas, WhatsApp ===== */
const TICON={ligacao:'phone',reuniao:'video',whatsapp:'message-circle',documentos:'file-text',email:'mail'};
const TLABEL={ligacao:'Ligação',reuniao:'Reunião',whatsapp:'WhatsApp',documentos:'Documentos',email:'E-mail'};

/* ---------- Tarefas ---------- */
VIEWS['tarefas']=()=>{
  const o=O(),f=S.v,n=now(),mine=f.tscope!=='equipe';
  const all=o.tasks.filter(t=>!mine||t.owner===ME);
  const sets={hoje:all.filter(t=>!t.done&&sameDay(t.due,n)&&t.due>=n||!t.done&&sameDay(t.due,n)),atrasadas:all.filter(t=>!t.done&&t.due<n&&!sameDay(t.due,n)),proximas:all.filter(t=>!t.done&&t.due>n&&!sameDay(t.due,n)),concluidas:all.filter(t=>t.done)};
  const labels={hoje:'Hoje',atrasadas:'Atrasadas',proximas:'Próximas',concluidas:'Concluídas'};
  const list=sets[f.tasktab].sort((a,b)=>f.tasktab==='concluidas'?b.due-a.due:a.due-b.due);
  const groups={};list.forEach(t=>{(groups[dayLbl(t.due)]=groups[dayLbl(t.due)]||[]).push(t)});
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Tarefas</h2></div>
   ${LV('tarefas')>=3?`<div class="seg"><button class="${mine?'on':''}" data-act="tscope" data-id="minhas">Minhas</button><button class="${!mine?'on':''}" data-act="tscope" data-id="equipe">Equipe</button></div>`:''}
   <button class="btn pri" data-act="new-task">${ic('plus')}Nova tarefa</button></div>
   <div class="tabs" role="tablist">${Object.keys(labels).map(k=>`<button class="${f.tasktab===k?'on':''}" data-act="ttab" data-id="${k}">${labels[k]} <span class="bd ${k==='atrasadas'&&sets[k].length?'bad':'mute'}" style="margin-left:6px">${sets[k].length}</span></button>`).join('')}</div>
   <div class="col" style="gap:16px">${Object.keys(groups).map(day=>`<section><div class="eyebrow" style="margin-bottom:6px">${day}</div><div class="card" style="padding:4px 16px"><div class="list">${groups[day].map(t=>{const c=contact(t.contactId);return`<div class="li"><button data-act="task-done" data-id="${t.id}" aria-label="${t.done?'Tarefa concluída':'Concluir tarefa'}" style="width:22px;height:22px;border-radius:6px;border:1.5px solid ${t.done?'var(--ok)':'var(--line2)'};background:${t.done?'var(--ok)':'transparent'};flex:none;display:grid;place-items:center;color:#06261F">${t.done?ic('check'):''}</button>
     <div class="grow" style="${t.done?'opacity:.55;text-decoration:line-through':''}"><div class="sm" style="font-weight:600">${esc(t.title)}</div><div class="xs muted">${c?`<a href="#contatos" data-act="open-contact" data-id="${c.id}" style="text-decoration:underline">${esc(c.name)}</a> · `:''}${esc(TLABEL[t.type])}</div></div>
     <span class="bd ${t.done?'ok':t.due<n?'bad':'mute'}">${ic(TICON[t.type])}${hm(t.due)}</span>${mine?'':av(t.owner,24)}${!t.done?`<span class="xs muted num">+${t.xp} XP</span>`:''}</div>`}).join('')}</div></div></section>`).join('')||`<div class="card empty">Nenhuma tarefa nesta lista.</div>`}</div></div>`;
};
ACT.ttab=el=>{S.v.tasktab=el.dataset.id;refresh()};
ACT.tscope=el=>{S.v.tscope=el.dataset.id;refresh()};
ACT['task-done']=el=>{
  const t=O().tasks.find(x=>x.id===el.dataset.id);if(!t||t.done)return;
  const late=t.due<now();t.done=true;
  if(t.owner===ME){const g=O().g[ME];g.counters.tasks=(g.counters.tasks||0)+1;if(!late)award('tarefa');else toast('Tarefa concluída fora do prazo. O XP vale só para tarefas em dia.',{icon:'check'})}else toast('Tarefa concluída',{icon:'check'});
  refresh();
};
ACT['new-task']=el=>{
  const o=O(),d=el.dataset.id&&deal(el.dataset.id),pre=el.dataset.cid||(d&&d.contactId)||'',tm=new Date(now().getTime()+2*H);
  dialog({title:'Nova tarefa',sub:o.name,submit:'Criar tarefa',body:`
   <label class="fld">Título<input class="in" name="title" required maxlength="90" placeholder="Ex.: Enviar simulação"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Tipo<select class="in" name="type">${Object.keys(TLABEL).map(k=>`<option value="${k}">${TLABEL[k]}</option>`).join('')}</select></label>
   <label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>
   <label class="fld">Data<input class="in" type="date" name="date" required value="${tm.getFullYear()}-${pad(tm.getMonth()+1)}-${pad(tm.getDate())}"></label><label class="fld">Hora<input class="in" type="time" name="time" required value="${pad(tm.getHours())}:00"></label></div>
   <label class="fld">Contato<select class="in" name="contact"><option value="">Sem contato</option>${o.contacts.map(c=>`<option value="${c.id}" ${c.id===pre?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`,
   onSubmit:f=>{const due=new Date(f.date+'T'+f.time);if(isNaN(due)){toast('Data ou hora inválida',{icon:'x'});return false}
     o.tasks.push({id:'t'+(o.tasks.length+1),title:f.title.trim(),type:f.type,due,done:false,owner:f.owner,contactId:f.contact||null,dealId:d?d.id:null,xp:5});toast('Tarefa criada',{icon:'list-checks'});refresh();redrawDrawer()}});
};

/* ---------- Conversas ---------- */
const chIcon=c=>{const i=inst(c.instanceId);return i&&i.kind==='oficial'?bd('API oficial','gold'):bd('QR Code','warn')};
function convList(){
  const o=O(),f=S.v;
  let rows=o.convs.filter(c=>f.ctab==='resolvidas'?c.status==='resolvida':c.status==='aberta'&&(f.ctab==='todas'||(f.ctab==='minhas'?c.assignee===ME:!c.assignee)));
  if(f.cchan!=='all')rows=rows.filter(c=>inst(c.instanceId)&&inst(c.instanceId).kind===f.cchan);
  rows.sort((a,b)=>b.msgs[b.msgs.length-1].t-a.msgs[a.msgs.length-1].t);
  return rows;
}
VIEWS['conversas']=()=>{
  const o=O(),f=S.v,rows=convList(),cnt=k=>o.convs.filter(c=>k==='resolvidas'?c.status==='resolvida':c.status==='aberta'&&(k==='todas'||(k==='minhas'?c.assignee===ME:!c.assignee))).length;
  let cur=f.conv&&conv(f.conv);if(!cur||!rows.includes(cur)&&f.chatOpen!==true)cur=cur&&rows.includes(cur)?cur:(rows[0]||null);
  if(cur){f.conv=cur.id;cur.unread=0}
  const c=cur&&contact(cur.contactId),i=cur&&inst(cur.instanceId),d=c&&dealOfContact(c);
  const open=cur&&windowOpen(cur);
  return`<div class="chat ${f.chatOpen&&cur?'open':''}">
   <aside class="c-list" aria-label="Lista de conversas"><div style="padding:14px 14px 0"><div class="row sp" style="margin-bottom:10px"><h2 class="disp" style="font-size:26px">Conversas</h2><span class="bd ok">${ic('radio','')}${o.inst.filter(x=>x.state==='conectada').length} canais</span></div>
    <div class="tabs">${[['minhas','Minhas'],['nao','Fila'],['todas','Todas'],['resolvidas','Resolvidas']].map(([k,l])=>`<button class="${f.ctab===k?'on':''}" data-act="ctab" data-id="${k}" title="${k==='nao'?'Conversas sem responsável':l}" style="padding:0 9px;font-size:12px">${l}${k==='resolvidas'?'':` <span class="xs muted">${cnt(k)}</span>`}</button>`).join('')}</div>
    <div class="row" style="gap:6px;padding:10px 0">${[['all','Todos'],['oficial','Oficial'],['nao-oficial','QR Code']].map(([k,l])=>`<button class="chip ${f.cchan===k?'on':''}" data-act="cchan" data-id="${k}" style="height:26px;font-size:11.5px">${l}</button>`).join('')}</div></div>
    <div style="overflow:auto;flex:1">${rows.map(x=>{const cc=contact(x.contactId),last=x.msgs[x.msgs.length-1];return`<button class="c-item ${cur&&cur.id===x.id?'on':''}" data-act="open-conv" data-id="${x.id}">${avN(cc.name,38)}<div class="grow" style="min-width:0"><div class="row sp"><b class="sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cc.name)}</b><span class="xs muted" style="white-space:nowrap">${hm(last.t)}</span></div>
     <div class="row sp"><span class="xs muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${last.dir==='out'?'Você: ':''}${esc(last.text)}</span>${x.unread?`<span class="bd gold" style="padding:0 7px">${x.unread}</span>`:''}</div>
     <div class="row" style="gap:6px;margin-top:4px">${chIcon(x)}${slaRisk(x)?bd('SLA em risco','bad'):''}${!x.assignee?bd('Sem responsável','info'):''}</div></div></button>`}).join('')||`<div class="empty">Nenhuma conversa nesta lista.</div>`}</div></aside>
   <section class="c-thread" aria-label="Conversa">${cur?`
    <div class="row wrap" style="padding:12px 18px;border-bottom:1px solid var(--line)"><button class="ibtn back-c" data-act="chat-back" aria-label="Voltar">${ic('arrow-left')}</button>${avN(c.name,38)}<div style="flex:1 1 170px;min-width:150px"><b>${esc(c.name)}</b><div class="xs muted">${esc(c.phone)} · ${esc(i.name)}</div></div>
     <select class="in" style="width:150px" data-chg="convassign" data-id="${cur.id}" aria-label="Responsável"><option value="">Sem responsável</option>${ownerOpts(cur.assignee||'')}</select>
     <button class="btn sm" data-act="conv-deal" data-id="${cur.id}">${ic(d&&d.pipe==='comercial'?'kanban':'plus')}${d&&d.pipe==='comercial'?'Ver negócio':'Criar negócio'}</button><button class="btn sm" data-act="conv-resolve" data-id="${cur.id}">${ic('check')}${cur.status==='resolvida'?'Reabrir':'Resolver'}</button></div>
    <div class="msgs" id="msgs">${cur.msgs.map(m=>`<div class="m ${m.dir}">${m.dir==='note'?`<b class="xs">${ic('lock','')} Nota interna · ${esc(fname(user(m.by).name))}</b><br>`:''}${esc(m.text)}<span class="t">${hm(m.t)}${m.dir==='out'&&m.by?' · '+esc(fname(user(m.by).name)):''}</span></div>`).join('')}</div>
    <form class="composer" data-form="msg" data-id="${cur.id}">
     <div class="row sp"><div class="seg"><button type="button" class="${!f.note?'on':''}" data-act="note" data-id="0">Responder</button><button type="button" class="${f.note?'on':''}" data-act="note" data-id="1">Nota interna</button></div>
      <select class="in" style="width:200px" data-chg="quick" aria-label="Respostas rápidas"><option value="">Respostas rápidas</option>${QUICK.map((q,k)=>`<option value="${k}">${esc(q.slice(0,34))}…</option>`).join('')}</select></div>
     ${!open&&!f.note?`<div class="card row sm" style="padding:10px 12px;border-color:var(--warn)">${ic('clock')}<span class="grow">Janela de 24 h encerrada neste canal oficial. Só é possível enviar um modelo aprovado.</span><select class="in" style="width:200px" name="tpl" aria-label="Modelo">${TEMPLATES.filter(t=>t[1]==='Aprovado').map(t=>`<option>${t[0]}</option>`).join('')}</select></div>`:''}
     <div class="row" style="align-items:flex-end"><textarea class="in" name="text" rows="2" style="min-height:44px" placeholder="${f.note?'Nota visível só para a equipe…':open?'Escreva uma mensagem…':'Opcional: complemento ao modelo'}" ${!open&&!f.note?'':'required'} aria-label="Mensagem"></textarea><button class="btn pri" type="submit">${ic(f.note?'lock':'send')}${f.note?'Salvar nota':!open?'Enviar modelo':'Enviar'}</button></div></form>`:`<div class="empty" style="margin:auto">Selecione uma conversa.</div>`}</section>
   ${cur?`<aside class="c-info" aria-label="Detalhes do contato"><div class="col" style="align-items:center;text-align:center">${avN(c.name,56)}<b>${esc(c.name)}</b><span class="xs muted">${esc(c.city)} · ${esc(c.origin)}</span></div>
    <div class="sm col" style="gap:5px"><span>${ic('wallet','')} <b class="num">${brl(c.credit)}</b></span><span class="muted xs">${esc(c.product)} · ${esc(c.admin)}</span></div>
    ${d?`<div class="card" style="padding:12px"><div class="eyebrow">Negócio · ${esc(PIPES[d.pipe].label)}</div><div class="row sp" style="margin-top:6px"><b class="sm">${esc(stageOf(d.pipe,d.stage).label)}</b>${tempDot(d.temp)}</div><button class="btn sm" style="margin-top:10px;width:100%" data-act="open-deal" data-id="${d.id}">Abrir negócio</button></div>`:`<button class="btn sm" data-act="conv-deal" data-id="${cur.id}">${ic('plus')}Criar negócio</button>`}
    <div><div class="eyebrow" style="margin-bottom:6px">Canal</div><div class="sm">${esc(i.name)}</div><div class="xs muted">${i.kind==='oficial'?'API oficial · janela de 24 h '+(open?'aberta':'encerrada'):'Conexão por QR Code · sem modelos'}</div></div>
    <button class="btn sm" data-act="open-contact" data-id="${c.id}">${ic('contact')}Ver contato</button></aside>`:''}</div>`;
};
ACT.ctab=el=>{S.v.ctab=el.dataset.id;S.v.conv=null;S.v.chatOpen=false;refresh()};
ACT.cchan=el=>{S.v.cchan=el.dataset.id;refresh()};
ACT.note=el=>{S.v.note=el.dataset.id==='1';refresh()};
ACT['chat-back']=()=>{S.v.chatOpen=false;refresh()};
ACT['open-conv']=el=>{closeAll();const c=conv(el.dataset.id);S.v.conv=c.id;S.v.chatOpen=true;if(!convList().includes(c)){S.v.ctab=c.status==='resolvida'?'resolvidas':'todas'}go('conversas');refresh();const m=$('#msgs');if(m)m.scrollTop=m.scrollHeight};
ACT['start-conv']=el=>{
  const o=O(),c=contact(el.dataset.id),ex=o.convs.find(x=>x.contactId===c.id);if(ex)return ACT['open-conv']({dataset:{id:ex.id}});
  const i=o.inst.find(x=>x.state==='conectada');if(!i){toast('Nenhum canal conectado. Conecte uma instância em WhatsApp.',{icon:'wifi-off'});return}
  const nc={id:'v'+(o.convs.length+1),contactId:c.id,instanceId:i.id,assignee:ME,unread:0,status:'aberta',msgs:[{id:'s0',dir:'sys',text:'Conversa iniciada por '+user(ME).name,t:now()}],lastInAt:null,firstReply:false};
  o.convs.push(nc);S.v.ctab='minhas';ACT['open-conv']({dataset:{id:nc.id}});
};
CHG.convassign=el=>{const c=conv(el.dataset.id);c.assignee=el.value||null;if(c.assignee){c.msgs.push({id:'s'+c.msgs.length,dir:'sys',text:`Atribuída a ${user(c.assignee).name}`,t:now()})}toast(c.assignee?`Atribuída a <b>${esc(fname(user(c.assignee).name))}</b>`:'Conversa sem responsável',{icon:'user'});refresh()};
ACT['conv-resolve']=el=>{const c=conv(el.dataset.id);c.status=c.status==='resolvida'?'aberta':'resolvida';toast(c.status==='resolvida'?'Conversa resolvida':'Conversa reaberta',{icon:'check'});S.v.conv=null;S.v.chatOpen=false;refresh()};
ACT['conv-deal']=el=>{
  const o=O(),c=conv(el.dataset.id),ct=contact(c.contactId),ex=o.deals.find(d=>d.contactId===ct.id&&d.pipe==='comercial');
  if(ex)return openDrawer(()=>dealDrawer(ex.id));
  const d={id:'d'+(o.deals.length+1),contactId:ct.id,pipe:'comercial',stage:'novo',value:ct.credit||1,product:ct.product,admin:ct.admin,temp:'Morno',owner:c.assignee||ME,entered:0,lost:false,reason:'',wonAt:null,createdAt:now()};
  o.deals.push(d);o.tasks.push({id:'t'+(o.tasks.length+1),title:`Primeiro contato · ${fname(ct.name)}`,type:'whatsapp',due:new Date(now().getTime()+1*H),done:false,owner:d.owner,contactId:ct.id,dealId:d.id,xp:5});
  if(!c.assignee)c.assignee=ME;
  toast(`Negócio criado a partir da conversa com <b>${esc(fname(ct.name))}</b>`,{icon:'kanban',act:'go-pipe',id:'comercial',actLabel:'Ver no funil'});refresh();
};
CHG.quick=el=>{if(el.value==='')return;const ta=$('.composer textarea');if(ta){ta.value=QUICK[+el.value];ta.focus()}el.value=''};
const REPLIES=['Perfeito, obrigado!','Ótimo, aguardo então.','Pode ser sim, fico no aguardo.','Entendi. Vou conferir e te aviso.'];
FORMS.msg=(form,data)=>{
  const c=conv(form.dataset.id),f=S.v,text=(data.text||'').trim(),open=windowOpen(c);
  if(f.note){if(!text)return;c.msgs.push({id:'n'+c.msgs.length,dir:'note',text,t:now(),by:ME});refresh();return}
  if(!open){c.msgs.push({id:'o'+c.msgs.length,dir:'out',text:`[Modelo ${data.tpl}] ${text||'Olá! Podemos retomar nossa conversa?'}`,t:now(),by:ME});c.lastInAt=null;toast('Modelo enviado. A janela reabre quando o cliente responder.',{icon:'send'})}
  else{if(!text)return;const last=c.msgs[c.msgs.length-1];const fast=last&&last.dir==='in'&&(now()-last.t)<5*MIN&&!c.firstReply;
    c.msgs.push({id:'o'+c.msgs.length,dir:'out',text,t:now(),by:ME});if(!c.assignee)c.assignee=ME;
    if(fast){c.firstReply=true;const g=O().g[ME];g.counters.fast++;g.counters.fastWeek++;award('resposta')}}
  c.unread=0;refresh();
  if(!c.sim&&c.msgs.filter(m=>m.dir==='out').length>=1){c.sim=true;setTimeout(()=>{c.msgs.push({id:'r'+c.msgs.length,dir:'in',text:REPLIES[text.length%REPLIES.length],t:now(),by:null});c.lastInAt=now();c.unread=S.view==='conversas'&&S.v.conv===c.id?0:1;if(S.view==='conversas')refresh();else{renderNav();toast(`Nova mensagem de <b>${esc(fname(contact(c.contactId).name))}</b>`,{icon:'message-square',act:'open-conv',id:c.id,actLabel:'Abrir'})}},2400)}
};

/* ---------- WhatsApp ---------- */
function qrSvg(seed){const r=rngf(seed),n=25,s=6;let out='';const fin=(x,y)=>`<rect x="${x*s}" y="${y*s}" width="${7*s}" height="${7*s}" fill="#06261F"/><rect x="${(x+1)*s}" y="${(y+1)*s}" width="${5*s}" height="${5*s}" fill="#fff"/><rect x="${(x+2)*s}" y="${(y+2)*s}" width="${3*s}" height="${3*s}" fill="#06261F"/>`;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const inF=(x<8&&y<8)||(x>n-9&&y<8)||(x<8&&y>n-9);if(!inF&&r()>.52)out+=`<rect x="${x*s}" y="${y*s}" width="${s}" height="${s}" fill="#06261F"/>`}
  return`<svg class="qr" viewBox="0 0 ${n*s} ${n*s}" role="img" aria-label="QR Code de demonstração"><rect width="100%" height="100%" fill="#fff"/>${out}${fin(0,0)}${fin(n-7,0)}${fin(0,n-7)}</svg>`}
VIEWS['whatsapp']=()=>{
  const o=O(),pl=PLANS[o.plan],used=o.inst.length;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · canais</div><h2>WhatsApp</h2></div><span class="sm muted">${used} de ${pl.wa} instâncias do plano ${esc(pl.name)}</span><button class="btn pri" data-act="connect">${ic('plus')}Conectar instância</button></div>
   <div class="g" style="grid-template-columns:repeat(auto-fill,minmax(310px,1fr))">${o.inst.map(i=>`<section class="card ${i.state==='conectada'?'hud':''}"><div class="row" style="align-items:flex-start"><div class="org-mark" style="width:38px;height:38px">${ic('smartphone')}</div><div class="grow"><b>${esc(i.name)}</b><div class="xs muted">${esc(i.phone)}</div></div>${bd(i.state==='conectada'?'Conectada':'Desconectada',i.state==='conectada'?'ok':'bad')}</div>
    <div class="row wrap" style="margin:14px 0 4px;gap:6px">${i.kind==='oficial'?bd('API oficial · Cloud API','gold','badge-check'):bd('Não oficial · QR Code','warn','triangle-alert')}${i.kind==='oficial'?bd('Qualidade '+i.quality,i.quality==='Alta'?'ok':'warn'):''}</div>
    <div class="sm muted" style="min-height:40px">${i.kind==='oficial'?`Limite de ${i.tier}. Modelos aprovados pela Meta para iniciar conversas.`:'Sessão do aparelho conectado. Sem modelos oficiais; sujeita a bloqueio pela Meta.'}</div>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-act="inst-cfg" data-id="${i.id}">${ic('sliders-horizontal')}Configurar</button>${i.state!=='conectada'?`<button class="btn sm pri" data-act="inst-reconnect" data-id="${i.id}">${ic('qr-code')}Reconectar</button>`:`<button class="btn sm ghost" data-act="inst-off" data-id="${i.id}">Desconectar</button>`}</div></section>`).join('')}</div>
   <section class="card"><div class="card-h"><div><span class="eyebrow">Qual usar</span><h3>API oficial ou conexão por QR Code</h3></div></div><div class="tbl-wrap" style="border:0"><table class="tbl cmp" style="min-width:620px"><thead><tr><th></th><th>API oficial (WhatsApp Business Platform)</th><th>Não oficial (QR Code)</th></tr></thead><tbody>
    <tr><td>Conformidade</td><td>Dentro dos termos da Meta</td><td>Fora dos termos; a conta pode ser bloqueada sem aviso</td></tr>
    <tr><td>Primeiro contato</td><td>Por modelo aprovado; conversa livre por 24 h após a resposta do cliente</td><td>Mensagem livre, sem modelos</td></tr>
    <tr><td>Mensagens em lote</td><td>Só com modelo aprovado e consentimento (opt-in) do contato</td><td>Evite: é o principal motivo de bloqueio</td></tr>
    <tr><td>Estabilidade</td><td>Alta; não depende de aparelho</td><td>Depende do aparelho e da sessão; pode cair</td></tr>
    <tr><td>Custo</td><td>A Meta cobra por mensagem de modelo (marketing sempre é cobrado). Resposta livre dentro de 24 h não é cobrada</td><td>Sem cobrança da Meta</td></tr>
    <tr><td>Indicado para</td><td>Operação principal, retomadas, avisos</td><td>Atendimento receptivo de baixo volume ou teste</td></tr></tbody></table></div></section>
   <p class="demo">Conexão simulada: nenhuma mensagem real é enviada ou recebida nesta demonstração.</p></div>`;
};
function connectDialog(kind,step){
  const o=O(),pl=PLANS[o.plan];S.v.wa={kind,step};
  if(o.inst.length>=pl.wa){return dialog({title:'Limite do plano atingido',sub:'WhatsApp',submit:'Ver planos',body:`<p class="sm">O plano <b>${esc(pl.name)}</b> inclui ${pl.wa} instância${pl.wa>1?'s':''}, e todas já estão em uso. Para conectar outra, mude de plano ou remova uma instância.</p>`,onSubmit:()=>{go('planos')}})}
  if(!kind){return dialog({title:'Conectar instância',sub:'Passo 1 de 2 · tipo de conexão',submit:'Continuar',body:`<div class="col"><label class="card row" style="cursor:pointer;align-items:flex-start"><input type="radio" name="kind" value="oficial" checked class="chk" style="margin-top:3px"><div><b>API oficial</b><div class="sm muted">Número verificado na WhatsApp Business Platform. Estável, com modelos e dentro dos termos da Meta. Recomendado.</div></div></label>
    <label class="card row" style="cursor:pointer;align-items:flex-start"><input type="radio" name="kind" value="nao-oficial" class="chk" style="margin-top:3px"><div><b>Não oficial (QR Code)</b><div class="sm muted">Conecta um aparelho por QR Code. Rápido para testar, mas pode ser bloqueado pela Meta e não tem modelos.</div></div></label></div>`,onSubmit:f=>{setTimeout(()=>connectDialog(f.kind,2),0)}})}
  if(kind==='oficial')return dialog({title:'Dados da API oficial',sub:'Passo 2 de 2',submit:'Verificar e conectar',body:`<label class="fld">Nome da instância<input class="in" name="name" required placeholder="Ex.: Comercial Goiânia"></label>
    <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Número com DDI<input class="in" name="phone" required placeholder="+55 65 90000-0000"></label><label class="fld">ID do número (Phone Number ID)<input class="in" name="pid" required placeholder="1029384756"></label></div>
    <label class="fld">Token de acesso permanente<input class="in" type="password" name="tok" required autocomplete="off" placeholder="Guardado com criptografia; nunca exibido novamente"></label>`,
    onSubmit:f=>{o.inst.push({id:'i'+(o.inst.length+1),name:f.name,kind:'oficial',phone:f.phone,state:'conectada',quality:'Alta',tier:'1 mil/dia',since:dm(now())+'/2026'});toast(`Instância <b>${esc(f.name)}</b> verificada e conectada`,{icon:'badge-check'});refresh()}});
  return dialog({title:'Conectar por QR Code',sub:'Passo 2 de 2',submit:'Já escaneei',body:`<label class="fld">Nome da instância<input class="in" name="name" required placeholder="Ex.: Atendimento Goiânia"></label>
    <div class="row wrap" style="gap:20px;align-items:center">${qrSvg(o.inst.length+7)}<div class="col grow sm" style="min-width:220px"><span>1. Abra o WhatsApp no aparelho.</span><span>2. Toque em <b>Aparelhos conectados</b>.</span><span>3. Aponte a câmera para o QR Code.</span><span class="xs muted">QR Code de demonstração. Ele expira em 60 s em uma conexão real.</span></div></div>
    <label class="row sm" style="align-items:flex-start"><input class="chk" type="checkbox" name="ok" required style="margin-top:3px"><span>Entendo que esta conexão não é oficial, pode ser bloqueada pela Meta e não deve ser usada para disparos em massa.</span></label>`,
    onSubmit:f=>{o.inst.push({id:'i'+(o.inst.length+1),name:f.name,kind:'nao-oficial',phone:'+55 '+o.ddd+' 90000-09'+pad(o.inst.length),state:'conectada',since:dm(now())+'/2026'});toast(`Instância <b>${esc(f.name)}</b> conectada`,{icon:'smartphone'});refresh()}});
}
ACT.connect=()=>connectDialog(null,1);
ACT['inst-reconnect']=el=>{const i=inst(el.dataset.id);dialog({title:'Reconectar '+i.name,sub:'QR Code',submit:'Já escaneei',body:`<div class="row wrap" style="gap:20px;align-items:center">${qrSvg(+el.dataset.id.slice(1)+3)}<div class="col grow sm"><span>Escaneie com o aparelho de <b>${esc(i.phone)}</b>.</span><span class="xs muted">QR Code de demonstração.</span></div></div>`,onSubmit:()=>{i.state='conectada';toast(`<b>${esc(i.name)}</b> reconectada`,{icon:'wifi'});refresh()}})};
ACT['inst-off']=el=>{const i=inst(el.dataset.id);i.state='desconectada';toast(`<b>${esc(i.name)}</b> desconectada`,{icon:'wifi-off'});refresh()};
ACT['inst-cfg']=el=>{const i=inst(el.dataset.id);i.cfg=i.cfg||{auto:true,mode:'rodizio',hours:true,away:'Olá! Nosso atendimento retorna às 8h. Deixe sua mensagem que respondemos em breve.',pipe:'comercial'};openDrawer(()=>instDrawer(i.id))};
function instDrawer(id){
  const i=inst(id),c=i.cfg;
  return`<div class="dr-h"><div class="org-mark">${ic('smartphone')}</div><div class="grow"><div class="eyebrow">${i.kind==='oficial'?'API oficial':'Não oficial'}</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(i.name)}</h3><div class="sm muted">${esc(i.phone)} · desde ${esc(i.since)}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b"><div class="row sp"><div><b class="sm">Distribuição automática</b><div class="xs muted">Novas conversas são atribuídas sozinhas.</div></div>${sw(c.auto,'cfg-auto',id)}</div>
   <label class="fld">Regra de distribuição<select class="in" data-chg="cfg-mode" data-id="${id}"><option value="rodizio" ${c.mode==='rodizio'?'selected':''}>Rodízio entre vendedores</option><option value="equipe" ${c.mode==='equipe'?'selected':''}>Por equipe</option><option value="manual" ${c.mode==='manual'?'selected':''}>Manual (fila)</option></select></label>
   <label class="fld">Funil de destino<select class="in" data-chg="cfg-pipe" data-id="${id}">${Object.keys(PIPES).map(k=>`<option value="${k}" ${c.pipe===k?'selected':''}>${PIPES[k].label}</option>`).join('')}</select></label>
   <div class="row sp"><div><b class="sm">Horário de atendimento</b><div class="xs muted">Seg a sex, 8h às 18h</div></div>${sw(c.hours,'cfg-hours',id)}</div>
   <label class="fld">Mensagem de ausência<textarea class="in" data-chg="cfg-away" data-id="${id}" rows="3">${esc(c.away)}</textarea></label>
   <label class="fld">URL do webhook (somente leitura)<input class="in" readonly value="https://api.alvocrm.exemplo/hooks/${esc(S.orgId)}/${esc(id)}"></label>
   ${i.kind==='oficial'?`<div><div class="eyebrow" style="margin-bottom:8px">Modelos de mensagem</div><div class="list">${TEMPLATES.map(t=>`<div class="li"><span class="sm grow" style="font-family:monospace">${t[0]}</span><span class="xs muted">${t[2]}</span>${bd(t[1],t[1]==='Aprovado'?'ok':'warn')}</div>`).join('')}</div></div>`:`<div class="card sm" style="border-color:var(--warn)">${ic('triangle-alert')} Conexões por QR Code não têm modelos oficiais e podem ser bloqueadas. Use para atendimento receptivo.</div>`}</div>`;
}
ACT['cfg-auto']=el=>{const c=inst(el.dataset.id).cfg;c.auto=!c.auto;redrawDrawer()};
ACT['cfg-hours']=el=>{const c=inst(el.dataset.id).cfg;c.hours=!c.hours;redrawDrawer()};
CHG['cfg-mode']=el=>{inst(el.dataset.id).cfg.mode=el.value;toast('Regra de distribuição salva',{icon:'check'})};
CHG['cfg-pipe']=el=>{inst(el.dataset.id).cfg.pipe=el.value;toast('Funil de destino salvo',{icon:'check'})};
CHG['cfg-away']=el=>{inst(el.dataset.id).cfg.away=el.value;toast('Mensagem de ausência salva',{icon:'check'})};
