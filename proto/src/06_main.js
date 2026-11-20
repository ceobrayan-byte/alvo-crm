/* ===== Shell, roteador, eventos e inicialização ===== */
const LOGO_IVORY='__LOGO_IVORY__';
const MAC=/Mac|iPhone|iPad/.test((navigator.platform||'')+(navigator.userAgent||''));
S.prefs={nConv:true,nSla:true,nTasks:true,nAch:true,digest:false,reduce:false,rail:false,pause:false,rankVis:true,twofa:true};
S.v.tfilter='abertos';

/* ----- preferências (só conveniência por navegador; falha silenciosa) ----- */
function savePrefs(){try{localStorage.setItem('alvo-crm-demo-v1',JSON.stringify({p:S.prefs,mode:S.ui.mode,rail:S.ui.rail}))}catch(e){}}
function loadPrefs(){try{const r=JSON.parse(localStorage.getItem('alvo-crm-demo-v1')||'null');if(r){Object.assign(S.prefs,r.p||{});S.ui.mode=r.mode==='claro'?'claro':'comando';S.ui.rail=!!r.rail}}catch(e){}}
function applyPrefs(){document.body.dataset.mode=S.ui.mode;document.body.dataset.motion=S.prefs.reduce?'reduce':'';document.body.dataset.rail=S.ui.rail?'1':'0';S.prefs.rail=S.ui.rail;const a=$('.app');if(a){a.classList.toggle('rail',S.ui.rail);a.classList.toggle('mnav',S.ui.mnav)}}
function setTheme(m){S.ui.mode=m;savePrefs();applyPrefs();refresh()}

/* ----- navegação ----- */
const NAV=[['Principal',[['visao-geral','layout-dashboard','D'],['kanban','kanban','F']]],['Leads',[['leads-frios','snowflake','L'],['contatos','refrigerator','C']]],['Clientes',[['clientes','users-round','C']]],['Financeiro',[['financeiro','wallet','F']]],['Suporte',[['emails','mail','E']]],
  ['Operação',[['funis','git-branch','N'],['tarefas','list-checks','T'],['conversas','message-square','M'],['whatsapp','smartphone','W']]],
  ['Desempenho',[['metas','trophy','M']]],['Gestão',[['equipe','users','E'],['planos','credit-card','P'],['suporte','life-buoy','S']]]];
const vlabel=v=>v==='perfil'?'Meu perfil':v==='contatos'?'Geladeira':v==='visao-geral'?'Dashboard':v==='funis'?'Negócios · pós-venda':v==='emails'?'E-mails':v==='kanban'?(seeAllLeads()?'Funis':'Meu funil'):v==='leads-frios'?'Leads Frios':v==='clientes'?(isOffice()?'Clientes / CRM Global':ROLE()==='Coordenador'?'Clientes da equipe':'Minha carteira'):v==='suporte'?'Suporte / Operacional':v==='financeiro'?(isOffice()?'Financeiro Comercial':ROLE()==='Coordenador'?'Financeiro da equipe':'Minhas comissões'):(MODS.find(m=>m[0]===v)||[0,v])[1];
const VIC=Object.fromEntries(NAV.flatMap(g=>g[1].map(i=>[i[0],i[1]])));
function miniRing(p,n){const r=16,c=2*Math.PI*r;return`<span class="mini-ring"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" fill="none" stroke="rgba(243,238,228,.18)" stroke-width="3"/><circle cx="20" cy="20" r="${r}" fill="none" stroke="#C48A2C" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/></svg><b>${n}</b></span>`}
function renderNav(){
  const o=O(),g=o.g[ME],L=lvl(g.xp),un=o.convs.filter(c=>c.status==='aberta'&&c.unread>0).length,late=o.tasks.filter(t=>!t.done&&t.owner===ME&&t.due<now()).length;
  const cnt={conversas:un,tarefas:late};
  $('#sb').innerHTML=`<div class="sb-top"><img src="${LOGO_IVORY}" alt="ALVO"><span class="ptag">Plataforma<br>Comercial</span><span class="mono" aria-hidden="true">A</span><button class="ibtn sb-tog" data-act="rail" aria-label="${S.ui.rail?'Expandir':'Recolher'} menu" title="${S.ui.rail?'Expandir':'Recolher'} menu">${ic(S.ui.rail?'panel-left-open':'panel-left-close')}</button></div>
   <button class="orgbtn" data-act="pop" data-id="org" aria-label="Trocar de organização" aria-haspopup="true"><span class="org-mark">${esc(o.mark)}</span><span class="meta grow" style="min-width:0"><div class="t">${esc(o.name)}</div><div class="s">${esc(o.sub)}</div></span>${ic('chevrons-up-down')}</button>
   <nav class="nav" aria-label="Seções">${NAV.map(gr=>[gr[0],gr[1].filter(([v])=>LV(v)>0||!O().screens)]).filter(gr=>gr[1].length).map(gr=>`<div class="grp-t">${gr[0]}</div>${gr[1].map(([v,icn,fb])=>{const lock=LV(v)===0,label=vlabel(v);return`<a href="#${v}" class="${S.view===v?'on':''} ${lock?'lock':''}" data-act="nav" data-id="${v}" title="${esc(label)}${lock?' (sem acesso)':''}" ${S.view===v?'aria-current="page"':''}>${ic(icn,'',fb)}<span class="lbl">${esc(label)}</span>${lock?`<span class="cnt" style="background:transparent;color:inherit;padding:0">${ic('lock')}</span>`:cnt[v]?`<span class="cnt">${cnt[v]}</span>`:''}</a>`}).join('')}`).join('')}</nav>
   <div class="sb-foot"><button class="lvl-card" data-act="go" data-id="metas" aria-label="Nível ${L.n}, ${esc(L.title)}. Abrir metas e conquistas">${miniRing(L.pct,L.n)}<span class="txt grow"><div class="t">${esc(L.title)}</div><div class="s num">${g.xp.toLocaleString('pt-BR')} XP${S.prefs.pause?' · pausa':''}</div><div class="bar" style="margin-top:6px;height:4px">${'<i style="width:'+Math.max(3,L.pct*100)+'%"></i>'}</div></span></button>
    <button class="collapse" data-act="rail" aria-label="${S.ui.rail?'Expandir':'Recolher'} menu">${ic('chevrons-left')}<span class="lbl">${S.ui.rail?'Fixar menu aberto':'Recolher menu'}</span></button></div>`;
  icons();
}
function renderTop(){
  const o=O(),unread=o.notifs.filter(n=>!n.read).length,u=user(ME);
  $('#top').innerHTML=`<button class="ibtn burger" data-act="burger" aria-label="Abrir menu">${ic('menu')}</button>
   <div class="grow" style="min-width:0"><div class="crumb">${esc(o.name)} <span aria-hidden="true">/</span> ${esc(vlabel(S.view))}</div><h1 class="sr-only">${esc(vlabel(S.view))}</h1></div>
   <button class="search" data-act="cmd" aria-label="Buscar e executar comandos">${ic('search')}<span class="t search-lbl">Buscar contatos, telas e ações</span><span class="kbd">${MAC?'⌘K':'Ctrl K'}</span></button>
   <button class="ibtn" data-act="theme-toggle" aria-label="Alternar entre tema Comando e Claro">${ic(S.ui.mode==='claro'?'moon':'sun')}</button>
   <button class="ibtn" data-act="pop" data-id="notif" aria-label="Notificações${unread?`, ${unread} novas`:''}" aria-haspopup="true">${ic('bell')}${unread?'<span class="dot"></span>':''}</button>
   <button class="ibtn" data-act="pop" data-id="user" aria-label="Menu do usuário" aria-haspopup="true" style="border:0;width:auto">${avN(u.name,34)}</button>`;
  renderPops();
}
function renderPops(){
  const o=O(),p=S.ui.pop,u=user(ME);let h='';
  if(p==='notif')h=`<div class="pop" role="dialog" aria-label="Notificações" style="position:fixed;top:60px"><div class="row sp"><h4>Notificações</h4><button class="btn sm ghost" data-act="read-all">Marcar como lidas</button></div>${o.notifs.map(n=>`<button class="pi" data-act="notif" data-id="${n.id}">${ic(n.icon)}<span class="grow"><span class="sm" style="${n.read?'':'font-weight:600'}">${esc(n.text)}</span><br><span class="xs muted">${rel(n.t)}</span></span>${n.read?'':'<span class="temp" style="background:var(--gold);margin-top:6px"></span>'}</button>`).join('')||'<div class="empty">Sem notificações.</div>'}</div>`;
  else if(p==='user')h=`<div class="pop" role="dialog" aria-label="Menu do usuário" style="position:fixed;top:60px"><div class="row" style="padding:10px">${avN(u.name,40)}<div><b>${esc(u.name)}</b><div class="xs muted">${esc(u.role)} · ${esc(o.name)}</div></div></div>
    <button class="pi" data-act="go" data-id="perfil">${ic('user-round')}<span class="sm">Meu perfil</span></button><button class="pi" data-act="go" data-id="metas">${ic('trophy')}<span class="sm">Metas e conquistas</span></button><button class="pi" data-act="theme-toggle">${ic(S.ui.mode==='claro'?'moon':'sun')}<span class="sm">Tema ${S.ui.mode==='claro'?'Comando (escuro)':'Claro'}</span></button>
    ${LIVE&&window.pvMenu?pvMenu():''}${LIVE?'':`<div style="padding:10px;border-top:1px solid var(--line);margin-top:6px"><label class="fld">Ver como (demonstração)<select class="in" data-chg="asrole">${ROLES.map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></label><div class="xs muted" style="margin-top:6px;font-weight:400">Mostra como menu e telas mudam para cada perfil.</div></div>`}
    <button class="pi" data-act="logout">${ic('log-out')}<span class="sm">Sair</span></button></div>`;
  else if(p==='org'){const left=window.innerWidth<=900?12:(S.ui.rail?84:12);h=`<div class="pop left" role="dialog" aria-label="Organizações" style="position:fixed;top:112px;left:${left}px"><h4>Organizações</h4>${Object.values(S.orgs).map(x=>`<button class="pi ${x.id===S.orgId?'on':''}" data-act="org" data-id="${x.id}"><span class="org-mark" style="width:30px;height:30px;font-size:16px">${esc(x.mark)}</span><span class="grow"><b class="sm">${esc(x.name)}</b><br><span class="xs muted">${esc(x.sub)} · ${esc(PLANS[x.plan].name)} · você é ${esc(x.users.find(y=>y.id===ME).role)}</span></span>${x.id===S.orgId?ic('check'):''}</button>`).join('')}
    <button class="pi" data-act="new-org" style="border-top:1px solid var(--line);margin-top:6px">${ic(o.plan==='corporativo'?'plus':'lock')}<span class="sm">Nova organização${o.plan==='corporativo'?'':' (plano Corporativo)'}</span></button>${LIVE&&window.pvMenu?pvMenu():''}</div>`}
  $('#pops').innerHTML=h;icons();
}
function resetViewState(){Object.assign(S.v,{conv:null,sel:[],owner:'all',temp:'all',stale:false,q:'',tag:'all',chatOpen:false,ctab:'minhas',cchan:'all',pipe:'comercial',tscope:'minhas'})}
function deny(v){toast(`O perfil <b>${esc(ROLE())}</b> não tem acesso a ${esc(vlabel(v))}.`,{icon:'lock',act:'req-access',id:v,actLabel:'Solicitar acesso'})}
function refresh(top){
  const v=$('#view');if(!VIEWS[S.view])S.view='visao-geral';
  const st=v.scrollTop,ta=$('.composer textarea'),keep=ta?{v:ta.value,f:document.activeElement===ta}:null;
  v.className='view'+(FLUSH.has(S.view)?' flush':'');v.innerHTML=VIEWS[S.view]();v.scrollTop=top?0:st;
  if(keep){const n=$('.composer textarea');if(n&&keep.v){n.value=keep.v;if(keep.f)n.focus()}}
  renderNav();renderTop();icons();
  if(S.view==='conversas'){const m=$('#msgs');if(m)m.scrollTop=m.scrollHeight}
}
function go(v){
  if(!VIEWS[v])return;if(LV(v)===0){deny(v);return}
  const was=S.view;S.view=v;S.ui.mnav=false;S.ui.pop=null;if(S.ui.drawer||S.ui.modal)closeAll();
  try{if(location.hash!=='#'+v){S.hashSet=true;location.hash=v}}catch(e){}
  applyPrefs();refresh(was!==v);
}
window.addEventListener('hashchange',()=>{if(S.hashSet){S.hashSet=false;return}const v=location.hash.slice(1);if(VIEWS[v]&&v!==S.view)go(v)});

/* ----- ações do shell ----- */
ACT.nav=el=>go(el.dataset.id);
ACT.go=el=>go(el.dataset.id);
ACT.close=()=>closeAll();
ACT['close-modal']=()=>{S.ui.cmd=null;closeModal()};
ACT.pop=el=>{const k=el.dataset.id;S.ui.pop=S.ui.pop===k?null:k;renderPops()};
ACT.burger=()=>{if(window.innerWidth>900){ACT.rail();return}S.ui.mnav=!S.ui.mnav;applyPrefs()};
ACT.rail=()=>{S.ui.rail=!S.ui.rail;savePrefs();applyPrefs();renderNav()};
ACT['theme-toggle']=()=>{S.ui.pop=null;setTheme(S.ui.mode==='claro'?'comando':'claro')};
ACT.theme=el=>setTheme(el.dataset.id);
ACT.logout=()=>{S.ui.pop=null;renderPops();toast('Demonstração: não há sessão real para encerrar.',{icon:'log-out'})};
ACT['req-access']=el=>{toast(`Pedido de acesso a ${esc(vlabel(el.dataset.id))} enviado aos administradores.`,{icon:'send'})};
ACT.notif=el=>{const n=O().notifs.find(x=>x.id===el.dataset.id);if(n){n.read=true;S.ui.pop=null;go(n.view)}};
ACT['read-all']=()=>{O().notifs.forEach(n=>n.read=true);renderTop()};
ACT.org=el=>{
  const id=el.dataset.id;S.ui.pop=null;if(id===S.orgId){renderPops();return}
  S.orgId=id;resetViewState();if(S.ui.drawer||S.ui.modal)closeAll();
  if(LV(S.view)===0)S.view='visao-geral';
  toast(`Organização: <b>${esc(O().name)}</b> · seu perfil: ${esc(ROLE())}`,{icon:'building-2'});refresh(true);
};
ACT['new-org']=()=>{
  S.ui.pop=null;renderPops();
  if(O().plan!=='corporativo'){toast('Múltiplas organizações fazem parte do plano Corporativo.',{icon:'lock',act:'go',id:'planos',actLabel:'Ver planos'});return}
  dialog({title:'Nova organização',sub:'Múltiplas organizações',submit:'Criar organização',body:`<label class="fld">Nome<input class="in" name="name" required maxlength="50" placeholder="Ex.: ALVO Sul"></label><label class="fld">Cidade<input class="in" name="city" required maxlength="40" placeholder="Ex.: Rondonópolis"></label><p class="sm muted">Você entra como administrador, no plano Essencial e com dados de exemplo. Equipe, funis e WhatsApp são independentes dos de outras organizações.</p>`,
   onSubmit:f=>{const n=Object.keys(S.orgs).length+1,id='org'+n,nm=f.name.trim(),ct=f.city.trim();
     const def={id,name:nm,sub:'Nova · '+ct,mark:nm[0].toUpperCase(),plan:'essencial',seats:5,seed:50+n,nContacts:8,ddd:'65',city:ct,goal:500000,users:[{id:'me',name:user(ME).name,cargo:'Administradora',team:'Gestão',role:'Administrador'}],inst:[]};
     ORGDEFS.push(def);const o=genOrg(def);const g=o.g[ME];g.ach=[];g.streak=0;g.cycleXp=0;g.log=[];Object.keys(g.counters).forEach(k=>g.counters[k]=0);
     Object.assign(o,{tickets:[],invites:[],invoices:[],hist:[],notifs:[{id:'n1',icon:'party-popper',text:'Organização criada. Convide a equipe e conecte um WhatsApp.',t:now(),view:'equipe',read:false}]});S.orgs[id]=o;ACT.org({dataset:{id}})}});
};
CHG.asrole=el=>{user(ME).role=el.value;S.ui.pop=null;toast(`Visualizando como <b>${esc(el.value)}</b>`,{icon:'eye'});if(LV(S.view)===0)go('visao-geral');else refresh()};

/* ----- paleta de comandos ----- */
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function cmdItems(q){
  const o=O(),n=norm(q.trim()),items=[];
  const add=(grp,label,icon,run,sub='')=>items.push({grp,label,icon,run,sub,k:norm(label+' '+sub)});
  MODS.forEach(m=>{if(LV(m[0])>0)add('Telas','Ir para '+m[1],VIC[m[0]]||'arrow-right',()=>go(m[0]))});
  add('Telas','Ir para Meu perfil','user-round',()=>go('perfil'));
  if(LV('contatos')>=2)add('Ações','Novo contato','user-plus',()=>ACT['new-contact']());
  if(LV('tarefas')>=2)add('Ações','Nova tarefa','list-checks',()=>ACT['new-task']({dataset:{}}));
  if(LV('funis')>=2)add('Ações','Novo negócio','plus',()=>ACT['new-deal']({dataset:{}}));
  if(LV('whatsapp')>=2)add('Ações','Conectar instância de WhatsApp','smartphone',()=>ACT.connect());
  if(LV('equipe')>=3)add('Ações','Convidar usuário','user-plus',()=>ACT.invite());
  add('Ações','Abrir chamado de suporte','life-buoy',()=>ACT['new-ticket']());
  add('Ações','Alternar tema (Comando e Claro)',S.ui.mode==='claro'?'moon':'sun',()=>ACT['theme-toggle']());
  add('Ações',S.ui.rail?'Expandir menu lateral':'Recolher menu lateral','chevrons-left',()=>ACT.rail());
  Object.values(S.orgs).filter(x=>x.id!==S.orgId).forEach(x=>add('Organizações','Trocar para '+x.name,'building-2',()=>ACT.org({dataset:{id:x.id}}),x.sub));
  if(LV('contatos')>0)o.contacts.forEach(c=>add('Contatos',c.name,'contact',()=>ACT['open-contact']({dataset:{id:c.id}}),c.phone+' · '+c.product));
  if(!n)return items.filter(i=>i.grp!=='Contatos').slice(0,9);
  const hit=items.filter(i=>i.k.includes(n));
  return[...hit.filter(i=>i.grp!=='Contatos'),...hit.filter(i=>i.grp==='Contatos').slice(0,6)].slice(0,12);
}
function cmdRes(){
  const c=S.ui.cmd;c.items=cmdItems(c.q);c.i=Math.min(c.i,Math.max(0,c.items.length-1));let last='',h='';
  c.items.forEach((it,i)=>{if(it.grp!==last){h+=`<div class="eyebrow" style="padding:10px 10px 4px">${it.grp}</div>`;last=it.grp}
    h+=`<button class="pi ${i===c.i?'on':''}" data-act="cmd-run" data-id="${i}">${ic(it.icon)}<span class="grow sm"><b>${esc(it.label)}</b>${it.sub?`<span class="xs muted"> · ${esc(it.sub)}</span>`:''}</span></button>`});
  return h||'<div class="empty">Nada encontrado.</div>';
}
function openCmd(){S.ui.cmd={q:'',i:0,items:[]};openModal(()=>`<div class="dlg cmd" role="dialog" aria-modal="true" aria-label="Busca e comandos"><input id="cmdq" placeholder="Buscar contatos, telas e ações…" autocomplete="off" aria-label="Buscar"><div class="res" id="cmdres">${cmdRes()}</div><div class="row xs muted" style="padding:9px 16px;border-top:1px solid var(--line);gap:16px"><span>↑ ↓ navegar</span><span>Enter abrir</span><span>Esc fechar</span></div></div>`)}
ACT.cmd=()=>openCmd();
ACT['cmd-run']=el=>{const it=S.ui.cmd&&S.ui.cmd.items[+el.dataset.id];S.ui.cmd=null;closeModal();if(it)setTimeout(it.run,0)};

/* ----- eventos (delegação) ----- */
document.addEventListener('click',ev=>{
  const t=ev.target;if(!t.closest)return;
  if(t.id==='modal'){S.ui.cmd=null;closeModal();return}
  if(t.id==='scrim'){S.ui.cmd=null;closeAll();return}
  const el=t.closest('[data-act]');
  if(S.ui.pop&&!t.closest('.pop')&&!(el&&el.dataset.act==='pop')){S.ui.pop=null;renderPops()}
  if(S.ui.mnav&&!t.closest('.sb')&&!(el&&el.dataset.act==='burger')){S.ui.mnav=false;applyPrefs()}
  if(!el||el.disabled)return;const f=ACT[el.dataset.act];if(!f)return;
  if(el.tagName==='A')ev.preventDefault();
  f(el,ev);
});
document.addEventListener('change',ev=>{const t=ev.target;if(!t||!t.dataset)return;if(t.id==='csvf'){CHG.csvf(t);return}const k=t.dataset.chg;if(k&&CHG[k])CHG[k](t)});
document.addEventListener('input',ev=>{const t=ev.target;
  if(t.id==='cq'){S.v.q=t.value;const c=$('#ctable');if(c){c.innerHTML=contactsTable();icons()}}
  else if(t.id==='cmdq'&&S.ui.cmd){S.ui.cmd.q=t.value;S.ui.cmd.i=0;$('#cmdres').innerHTML=cmdRes();icons()}});
document.addEventListener('submit',ev=>{
  const form=ev.target.closest&&ev.target.closest('form[data-form]');if(!form)return;ev.preventDefault();
  const name=form.dataset.form,data=Object.fromEntries(new FormData(form).entries());
  if(name==='dlg'){const r=S.ui.dlgSubmit&&S.ui.dlgSubmit(data);if(r!==false)closeModal();return}
  if(name==='msg'||name==='ticket-reply')form.reset();
  if(FORMS[name])FORMS[name](form,data);
});
document.addEventListener('keydown',ev=>{
  const t=ev.target;
  if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(S.ui.cmd){S.ui.cmd=null;closeModal()}else openCmd();return}
  if(ev.key==='Escape'){if(S.ui.pop){S.ui.pop=null;renderPops()}else if(S.ui.modal){S.ui.cmd=null;closeModal()}else if(S.ui.drawer)closeAll();else if(S.ui.mnav){S.ui.mnav=false;applyPrefs()}return}
  if(t.id==='cmdq'&&S.ui.cmd){const c=S.ui.cmd;
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ev.preventDefault();c.i=(c.i+(ev.key==='ArrowDown'?1:-1)+c.items.length)%Math.max(1,c.items.length);$('#cmdres').innerHTML=cmdRes();icons();const on=$('#cmdres .pi.on');on&&on.scrollIntoView({block:'nearest'})}
    else if(ev.key==='Enter'){ev.preventDefault();const b=$('#cmdres .pi.on');b&&b.click()}return}
  if((ev.key==='Enter'||ev.key===' ')&&t.classList&&t.classList.contains('kcard')){ev.preventDefault();t.click()}
});
/* arrastar e soltar no funil (o seletor de etapa no painel é a alternativa por teclado e toque) */
document.addEventListener('dragstart',ev=>{const k=ev.target.closest&&ev.target.closest('.kcard');if(!k)return;S.drag=k.dataset.deal;k.classList.add('drag');ev.dataTransfer.effectAllowed='move';try{ev.dataTransfer.setData('text/plain',S.drag)}catch(e){}});
document.addEventListener('dragend',()=>{S.drag=null;$$('.kcard.drag,.kcol.over').forEach(x=>x.classList.remove('drag','over'))});
document.addEventListener('dragover',ev=>{const c=ev.target.closest&&ev.target.closest('.kcol');if(c&&S.drag){ev.preventDefault();$$('.kcol.over').forEach(x=>x!==c&&x.classList.remove('over'));c.classList.add('over')}});
document.addEventListener('drop',ev=>{const c=ev.target.closest&&ev.target.closest('.kcol');if(c&&S.drag){ev.preventDefault();const id=S.drag;S.drag=null;c.classList.remove('over');moveDeal(id,c.dataset.stage)}});
ACT.skip=()=>{const v=$('#view');v&&v.focus()};

/* ----- mensagem recebida simulada, para a demonstração do chat compartilhado ----- */
function simInbound(){
  if(document.hidden)return setTimeout(simInbound,15000);
  const o=O(),c=o.convs.find(x=>x.status==='aberta'&&x.msgs[x.msgs.length-1].dir==='out'&&x.assignee);if(!c)return;
  const txt=['Consegue me ligar ainda hoje?','Fechado, pode seguir com a proposta.','Minha esposa quer ver as parcelas de novo.'][c.id.length%3];
  c.msgs.push({id:'sim'+c.msgs.length,dir:'in',text:txt,t:now(),by:null});c.lastInAt=now();c.unread=(c.unread||0)+1;
  const ct=contact(c.contactId);o.notifs.unshift({id:'n'+Date.now(),icon:'message-square',text:`Nova mensagem de ${ct.name}`,t:now(),view:'conversas',read:false});
  if(S.view==='conversas')refresh();else{renderNav();renderTop()}
  toast(`Nova mensagem de <b>${esc(fname(ct.name))}</b>: ${esc(txt)}`,{icon:'message-square',act:'open-conv',id:c.id,actLabel:'Abrir',ms:7000});
}

/* ----- início ----- */
function mountShell(){
  $('#app').innerHTML=`<button class="skip" data-act="skip">Ir para o conteúdo</button><div class="app"><aside class="sb" id="sb" aria-label="Menu principal"></aside><div class="main"><header class="top" id="top"></header><main class="view" id="view" tabindex="-1"></main></div></div>`;
}
function boot(){
  loadPrefs();mountShell();
  const h=(location.hash||'').slice(1);if(VIEWS[h]&&LV(h)>0)S.view=h;
  applyPrefs();refresh(true);
}
if(!window.__LIVE){boot();setTimeout(simInbound,24000)}
