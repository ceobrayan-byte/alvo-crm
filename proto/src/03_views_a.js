/* ===== Visão geral, Funis, Contatos ===== */
const ACT={},FORMS={},CHG={},VIEWS={},FLUSH=new Set(['conversas']);
const sellersOf=()=>O().users.filter(u=>u.id===ME||(u.sell&&['Vendedor','Administrador','Coordenador'].includes(u.role)&&u.status==='Ativo'));
const ownerOpts=(sel,all)=>(all?`<option value="all">Todos os responsáveis</option>`:'')+sellersOf().map(u=>`<option value="${u.id}" ${sel===u.id?'selected':''}>${esc(u.name)}</option>`).join('');
const plu=(n,a,b)=>n===1?a:b;
const greet=()=>{const h=now().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'};

VIEWS['visao-geral']=()=>{
  const m=metrics(),o=m.o,g=o.g[ME],L=lvl(g.xp);
  const fun=PIPES.comercial.stages.filter(s=>!s.lost).map(s=>{const ds=o.deals.filter(d=>d.pipe==='comercial'&&d.stage===s.id);return{s,n:ds.length,v:sum(ds.map(d=>d.value))}});
  const maxN=Math.max(...fun.map(f=>f.n),1);
  const cols=['#C48A2C','#3F8F77','#9CC5B5','#E2BE84','#5BA58E','#8F877A'];
  const origin=ORIGINS.map((k,i)=>({k,v:o.contacts.filter(c=>c.origin===k).length,c:cols[i]})).filter(x=>x.v);
  const rk=ranking(),pos=rk.findIndex(r=>r.u.id===ME),rshow=rk.slice(0,5);if(pos>4)rshow.push(rk[pos]);
  const dueToday=o.tasks.filter(t=>t.owner===ME&&!t.done&&sameDay(t.due,now())||t.owner===ME&&!t.done&&t.due<now()).slice(0,3);
  const doneToday=o.tasks.filter(t=>t.owner===ME&&t.done).length;
  const docs=o.deals.filter(d=>d.pipe==='posvenda'&&d.stage==='doc').length;
  const late=o.tasks.filter(t=>!t.done&&t.due<now()&&t.owner===ME).length;
  const unassigned=o.convs.filter(c=>!c.assignee&&c.status==='aberta').length;
  const alerts=[
    m.stale.length&&['timer',`${m.stale.length} ${plu(m.stale.length,'negócio sem contato','negócios sem contato')} há mais de 7 dias`,'Ver no funil','alert-go','funis'],
    m.risk.length&&['message-square-warning',`${m.risk.length} ${plu(m.risk.length,'conversa sem resposta além do prazo (SLA)','conversas sem resposta além do prazo (SLA)')}`,'Abrir conversas','go','conversas'],
    unassigned&&['inbox',`${unassigned} ${plu(unassigned,'conversa aguardando um responsável','conversas aguardando um responsável')}`,'Distribuir','go','conversas'],
    docs&&['file-text',`${docs} ${plu(docs,'caso com documentação pendente','casos com documentação pendente')}`,'Ver pós-venda','alert-pos','funis'],
    late&&['calendar-x',`${late} ${plu(late,'tarefa sua atrasada','tarefas suas atrasadas')}`,'Ver tarefas','alert-late','tarefas'],
  ].filter(Boolean);
  const hist=[...o.hist,{label:'Nov',value:m.credit,goal:o.goal,cur:true}];
  const kpi=(i,label,val,sub,sp)=>`<div class="card kpi"><span class="eyebrow">${label}</span><span class="v num">${val}</span><span class="d">${sub}</span>${spark(o.spark[sp])}</div>`;
  return`<div class="pg">
  <div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · ciclo ${dm(CYCLE.start)}–${dm(CYCLE.end)} · dia ${CYCLE.dayN} de ${CYCLE.dayTotal}</div><h2>${greet()}, ${esc(fname(user(ME).name))}</h2></div>
    <div class="row wrap"><button class="btn" data-act="new-contact">${ic('user-plus')}Novo contato</button><button class="btn" data-act="new-task">${ic('list-checks')}Nova tarefa</button><button class="btn pri" data-act="new-deal">${ic('plus')}Novo negócio</button></div></div>
  <div class="g g12">
   <section class="card hud s7" style="display:flex;flex-direction:column" aria-label="Pulso do ciclo"><div class="card-h"><div><span class="eyebrow">Pulso do ciclo</span><h3>Crédito vendido contra a meta</h3></div><span class="bd ${m.rhythm>=1?'ok':'warn'} end">${ic('gauge')}Ritmo ${m.rhythm.toFixed(1).replace('.',',')}×</span></div>
    <div class="row wrap" style="gap:28px;align-items:center;flex:1"><div class="ring">${ring(m.wpct,176)}<div class="mid"><span class="disp num" style="font-size:44px">${pct(m.wpct)}</span><span class="xs muted">da meta</span></div></div>
     <div class="grow col" style="min-width:230px;gap:14px">
      <div class="row sp"><span class="muted sm">Crédito vendido</span><b class="num">${brl(m.credit)}</b></div>
      <div class="row sp"><span class="muted sm">Meta do ciclo</span><b class="num">${brl(m.goal)}</b></div>
      <div class="row sp"><span class="muted sm">Faltam</span><b class="num">${brl(m.left)}</b></div>
      <div class="row sp"><span class="muted sm">Necessário por dia útil (${CYCLE.bdTotal-CYCLE.bdDone} restantes)</span><b class="num">${brlK(m.perDay)}</b></div>
      <div><div class="row sp xs muted" style="margin-bottom:5px"><span>Meta ${pct(m.wpct)}</span><span>Tempo do ciclo ${pct(m.elapsed)}</span></div>${bar(m.wpct)}<div style="height:6px"></div>${bar(m.elapsed,'background:var(--ink3)')}</div>
     </div></div></section>
   <section class="card s5" aria-label="Atenção agora"><div class="card-h"><div><span class="eyebrow">Atenção agora</span><h3>O que precisa de você</h3></div></div>
    <div class="list">${alerts.length?alerts.map(a=>`<div class="li">${ic(a[0],'')}<span class="grow sm">${a[1]}</span><button class="btn sm" data-act="${a[3]}" data-id="${a[4]}">${a[2]}</button></div>`).join(''):`<div class="empty">Tudo em dia por aqui.</div>`}</div></section>
  </div>
  <div class="g" style="grid-template-columns:repeat(auto-fit,minmax(168px,1fr))">
   ${kpi(0,'Conversas hoje',m.newToday,`<span class="up">+${Math.max(1,Math.round(m.newToday*.3))} vs. ontem</span>`,0)}
   ${kpi(1,'Conversas abertas',m.open.length,m.risk.length?`<span class="dn">${m.risk.length} fora do SLA</span>`:`<span class="up">SLA em dia</span>`,1)}
   ${kpi(2,'1ª resposta (média)','4m 12s','<span class="up">−18% na semana</span>',2)}
   ${kpi(3,'Negócios ativos',m.active.length,`${brlK(m.activeValue)} em carteira`,3)}
   ${kpi(4,'Conversão do ciclo',pct(m.conv,1),`${m.wonN} efetivadas de ${o.deals.filter(d=>d.pipe==='comercial').length} negócios`,4)}
   ${kpi(5,'Comissão estimada',brlK(m.commission),'<span class="muted" title="Demonstração: 1,5% sobre o crédito efetivado. As regras reais seguem o catálogo da administradora.">estimativa sobre suas vendas</span>',5)}
  </div>
  <div class="g g12">
   <section class="card s7"><div class="card-h"><div><span class="eyebrow">Histórico</span><h3>Crédito vendido por ciclo</h3></div><span class="xs muted end">tracejado = meta · valores em R$</span></div>${bars(hist)}</section>
   <section class="card s5"><div class="card-h"><div><span class="eyebrow">Funil comercial</span><h3>Negócios por etapa</h3></div></div>
    <div class="col" style="gap:9px">${fun.map(f=>`<button class="row" data-act="go-pipe" data-id="comercial" style="gap:10px;text-align:left"><span class="sm" style="width:130px">${esc(f.s.label)}</span><span class="grow bar" style="height:10px"><i style="width:${Math.max(3,f.n/maxN*100)}%"></i></span><b class="num sm" style="width:24px;text-align:right">${f.n}</b><span class="xs muted num" style="width:64px;text-align:right">${brlK(f.v)}</span></button>`).join('')}</div></section>
  </div>
  <div class="g g12">
   <section class="card s4"><div class="card-h"><div><span class="eyebrow">Missão do dia</span><h3>${doneToday} concluídas · ${dueToday.length} em foco</h3></div><span class="bd gold end">${ic('flame')}${g.streak} dias</span></div>
    <div class="list">${dueToday.length?dueToday.map(t=>`<div class="li"><button class="chk-b" data-act="task-done" data-id="${t.id}" aria-label="Concluir tarefa" style="width:22px;height:22px;border-radius:6px;border:1.5px solid var(--line2);flex:none"></button><div class="grow"><div class="sm" style="font-weight:600">${esc(t.title)}</div><div class="xs muted">${t.due<now()?'Atrasada · ':''}${dayLbl(t.due)} ${hm(t.due)}</div></div><span class="bd ok">+${t.xp} XP</span></div>`).join(''):`<div class="empty">Sem pendências para hoje.</div>`}</div></section>
   <section class="card s4"><div class="card-h"><div><span class="eyebrow">Ranking do ciclo</span><h3>Pontos de performance</h3></div><button class="btn sm ghost end" data-act="go" data-id="metas">Ver tudo</button></div>
    <div class="list">${rshow.map(r=>`<div class="li" style="${r.u.id===ME?'background:color-mix(in srgb,var(--gold) 10%,transparent);border-radius:10px;padding-left:8px;padding-right:8px':''}"><b class="num xs" style="width:20px">${rk.indexOf(r)+1}º</b>${avN(r.u.name,28)}<div class="grow"><div class="sm" style="font-weight:600">${esc(r.u.id===ME?'Você':r.u.name)}</div><div class="xs muted">${esc(r.lv.title)}</div></div><b class="num sm">${r.xp.toLocaleString('pt-BR')}</b></div>`).join('')}</div></section>
   <section class="card s4"><div class="card-h"><div><span class="eyebrow">Origem</span><h3>De onde vêm os contatos</h3></div></div>
    <div class="row" style="gap:18px">${donut(origin.map(x=>({v:x.v,c:x.c})),128)}<div class="col grow" style="gap:7px">${origin.map(x=>`<div class="row sm"><i style="width:9px;height:9px;border-radius:50%;background:${x.c}"></i><span class="grow">${x.k}</span><b class="num">${x.v}</b></div>`).join('')}</div></div></section>
  </div>
  <p class="demo">Demonstração com dados fictícios. Nenhuma informação real da ALVO é usada.</p></div>`;
};
ACT['alert-go']=()=>{S.v.pipe='comercial';S.v.owner='all';S.v.stale=true;go('funis')};
ACT['alert-pos']=()=>{S.v.pipe='posvenda';S.v.stale=false;go('funis')};
ACT['alert-late']=()=>{S.v.tasktab='atrasadas';go('tarefas')};
ACT['go-pipe']=el=>{S.v.pipe=el.dataset.id;S.v.stale=false;go('funis')};

/* ---------- Funis ---------- */
function dealCard(d){
  const c=contact(d.contactId),t=O().tasks.find(x=>x.dealId===d.id&&!x.done&&!x.title.startsWith('Formalizar'));
  const stale=d.entered>7&&!stageOf(d.pipe,d.stage).won&&!d.lost;
  return`<div class="kcard" draggable="true" data-deal="${d.id}" data-act="open-deal" data-id="${d.id}" tabindex="0" style="${stale?'border-left:3px solid var(--bad)':''}">
   <div class="row sp"><b class="sm">${esc(c.name)}</b>${tempDot(d.temp)}</div>
   <div class="row wrap" style="gap:6px"><span class="bd gold">${esc(d.product)}</span><span class="bd mute">${esc(d.admin)}</span>${stale?`<span class="bd bad">${d.entered} dias parado</span>`:''}</div>
   <div class="row sp"><b class="num">${brlK(d.value)}</b><span class="xs muted">${d.entered===0?'hoje':d.entered+' d na etapa'}</span></div>
   <div class="row">${av(d.owner,22)}<span class="xs muted grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t?esc(t.title.split(' · ')[0]):'Sem próxima ação'}</span></div></div>`;
}
VIEWS['funis']=()=>{
  const o=O(),P=PIPES[S.v.pipe],f=S.v;
  const all=o.deals.filter(d=>d.pipe===f.pipe&&(f.owner==='all'||d.owner===f.owner)&&(f.temp==='all'||d.temp===f.temp)&&(!f.stale||d.entered>7));
  const open=all.filter(d=>!d.lost&&!stageOf(d.pipe,d.stage).won);
  const wtd=sum(open.map(d=>d.value*stageOf(d.pipe,d.stage).p));
  return`<div class="pg" style="height:100%"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Funis de vendas</h2></div>
   <div class="seg" role="tablist">${Object.keys(PIPES).map(k=>`<button class="${f.pipe===k?'on':''}" data-act="pipe" data-id="${k}">${PIPES[k].label}</button>`).join('')}</div>
   <button class="btn pri" data-act="new-deal">${ic('plus')}Novo negócio</button></div>
   <div class="row wrap"><select class="in" style="width:220px" data-chg="fowner" aria-label="Responsável">${ownerOpts(f.owner,true)}</select>
    ${['all','Quente','Morno','Frio'].map(t=>`<button class="chip ${f.temp===t?'on':''}" data-act="ftemp" data-id="${t}">${t==='all'?'Todas as temperaturas':tempDot(t)+t}</button>`).join('')}
    ${f.stale?`<button class="chip on" data-act="fstale">${ic('timer')}Parados há 7+ dias ${ic('x')}</button>`:''}
    <span class="end sm muted">${open.length} em aberto · <b class="num mut2">${brlK(sum(open.map(d=>d.value)))}</b> · ponderado <b class="num mut2">${brlK(wtd)}</b></span></div>
   <div class="board" style="flex:1;min-height:420px">${P.stages.map(s=>{const ds=all.filter(d=>d.stage===s.id);return`<div class="kcol" data-stage="${s.id}"><div class="kcol-h"><b>${esc(s.label)}</b><span class="bd mute">${ds.length}</span><span class="xs muted end num">${brlK(sum(ds.map(d=>d.value)))}</span></div><div class="col" style="gap:9px">${ds.map(dealCard).join('')||`<div class="empty xs" style="padding:18px 6px">Arraste um cartão para cá</div>`}</div></div>`}).join('')}</div></div>`;
};
ACT.pipe=el=>{S.v.pipe=el.dataset.id;S.v.stale=false;refresh()};
ACT.ftemp=el=>{S.v.temp=el.dataset.id;refresh()};
ACT.fstale=()=>{S.v.stale=false;refresh()};
CHG.fowner=el=>{S.v.owner=el.value;refresh()};
function dealDrawer(id){
  const d=deal(id),c=contact(d.contactId),o=O(),st=stageOf(d.pipe,d.stage),cv=o.convs.find(x=>x.contactId===c.id);
  const ts=o.tasks.filter(t=>t.dealId===id);
  return`<div class="dr-h">${avN(c.name,44)}<div class="grow"><div class="eyebrow">${esc(PIPES[d.pipe].label)}</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(c.name)}</h3><div class="sm muted">${esc(d.product)} · ${esc(d.admin)} · <b class="num">${brl(d.value)}</b></div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b">
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Etapa<select class="in" data-chg="dealstage" data-id="${id}">${PIPES[d.pipe].stages.map(s=>`<option value="${s.id}" ${s.id===d.stage?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label>
    <label class="fld">Responsável<select class="in" data-chg="dealowner" data-id="${id}">${ownerOpts(d.owner)}</select></label>
    <label class="fld">Temperatura<select class="in" data-chg="dealtemp" data-id="${id}">${['Quente','Morno','Frio'].map(t=>`<option ${t===d.temp?'selected':''}>${t}</option>`).join('')}</select></label>
    <div class="fld">Probabilidade<div class="row" style="height:38px"><b class="num">${pct(st.p)}</b><span class="muted xs">· ponderado ${brlK(d.value*st.p)}</span></div></div></div>
   ${d.lost?`<div class="card" style="padding:12px;border-color:var(--bad)"><b class="sm">Perdido:</b> <span class="sm">${esc(d.reason)}</span></div>`:''}
   <div><div class="eyebrow" style="margin-bottom:8px">Contato</div><div class="sm col" style="gap:4px"><span>${ic('phone','')} ${esc(c.phone)}</span><span>${ic('mail','')} ${esc(c.email)}</span><span>${ic('map-pin','')} ${esc(c.city)} · origem ${esc(c.origin)}</span></div></div>
   <div><div class="row sp" style="margin-bottom:6px"><div class="eyebrow">Próximas ações</div><button class="btn sm ghost" data-act="new-task" data-id="${id}">${ic('plus')}Tarefa</button></div>
    <div class="list">${ts.map(t=>`<div class="li"><span class="bd ${t.done?'ok':t.due<now()?'bad':'mute'}">${t.done?'Feita':t.due<now()?'Atrasada':dayLbl(t.due)+' '+hm(t.due)}</span><span class="sm grow">${esc(t.title)}</span></div>`).join('')||'<div class="xs muted">Nenhuma tarefa vinculada.</div>'}</div></div>
  </div>
  <div class="dr-f">${cv?`<button class="btn" data-act="open-conv" data-id="${cv.id}">${ic('message-square')}Abrir conversa</button>`:`<button class="btn" data-act="start-conv" data-id="${c.id}">${ic('message-square')}Iniciar conversa</button>`}
   ${!d.lost&&!st.won?`<button class="btn" data-act="lose-deal" data-id="${id}">${ic('x')}Perdido</button>`:''}${!d.lost&&!st.won&&d.pipe==='comercial'?`<button class="btn pri" data-act="win-deal" data-id="${id}">${ic('badge-check')}Efetivar venda</button>`:''}</div>`;
}
ACT['open-deal']=el=>openDrawer(()=>dealDrawer(el.dataset.id));
CHG.dealstage=el=>{moveDeal(el.dataset.id,el.value);redrawDrawer()};
CHG.dealowner=el=>{deal(el.dataset.id).owner=el.value;toast('Responsável atualizado',{icon:'user'});refresh();redrawDrawer()};
CHG.dealtemp=el=>{deal(el.dataset.id).temp=el.value;refresh();redrawDrawer()};
ACT['win-deal']=el=>{winDeal(el.dataset.id);redrawDrawer()};
ACT['lose-deal']=el=>loseDialog(el.dataset.id);
ACT['new-deal']=el=>{
  const o=O(),P=PIPES[S.v.pipe];
  dialog({title:'Novo negócio',sub:P.label,submit:'Criar negócio',body:`
   <label class="fld">Contato<select class="in" name="contact" required>${o.contacts.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Valor do crédito (R$)<input class="in num" name="value" type="number" min="1000" step="1000" value="250000" required></label>
   <label class="fld">Produto<select class="in" name="product"><option>Imóvel</option><option>Veículo</option><option>Pesados</option><option>Serviços</option></select></label></div>
   <label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>`,
   onSubmit:f=>{const c=contact(f.contact);o.deals.push({id:'d'+(o.deals.length+1),contactId:c.id,pipe:S.v.pipe,stage:P.stages[0].id,value:+f.value,product:f.product,admin:'Canopus',temp:'Morno',owner:f.owner,entered:0,lost:false,reason:'',wonAt:null,createdAt:now()});
     toast(`Negócio criado para <b>${esc(fname(c.name))}</b> em ${esc(P.stages[0].label)}`,{icon:'plus'});go('funis');refresh()}});
};

/* ---------- Contatos ---------- */
function dealOfContact(c){return O().deals.filter(d=>d.contactId===c.id).sort((a,b)=>(a.pipe==='comercial'?0:1)-(b.pipe==='comercial'?0:1))[0]}
function contactsTable(){
  const o=O(),f=S.v,q=f.q.trim().toLowerCase();
  const rows=o.contacts.filter(c=>(!q||c.name.toLowerCase().includes(q)||c.phone.includes(q)||c.email.includes(q))&&(f.tag==='all'||c.tags.includes(f.tag))&&(f.owner==='all'||c.owner===f.owner));
  return`<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:36px"><input class="chk" type="checkbox" data-act="sel-all" aria-label="Selecionar todos"></th><th>Contato</th><th>Interesse</th><th>Etapa</th><th>Origem</th><th>Responsável</th><th>Última interação</th></tr></thead><tbody>${rows.map(c=>{
    const d=dealOfContact(c),st=d?stageOf(d.pipe,d.stage):null;
    return`<tr class="click ${f.sel.includes(c.id)?'sel':''}" data-act="open-contact" data-id="${c.id}"><td><input class="chk" type="checkbox" data-act="sel" data-id="${c.id}" ${f.sel.includes(c.id)?'checked':''} aria-label="Selecionar ${esc(c.name)}"></td>
    <td><div class="row">${avN(c.name,30)}<div><b>${esc(c.name)}</b><div class="xs muted">${esc(c.phone)}</div></div></div></td>
    <td><b class="num">${brlK(c.credit)}</b><div class="xs muted">${esc(c.product)} · ${esc(c.admin)}</div></td>
    <td>${st?bd(st.label,st.won?'ok':st.lost?'bad':'gold'):bd('Sem negócio','mute')}</td><td class="sm">${esc(c.origin)}</td>
    <td><div class="row">${av(c.owner,22)}<span class="sm">${esc(fname(user(c.owner).name))}</span></div></td><td class="sm muted">${rel(c.lastInt)}</td></tr>`}).join('')||`<tr><td colspan="7" class="empty">Nenhum contato encontrado.</td></tr>`}</tbody></table></div>
    <div class="xs muted" style="margin-top:8px">${rows.length} de ${o.contacts.length} contatos</div>`;
}
VIEWS['contatos']=()=>{
  const f=S.v,o=O();
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Contatos</h2></div>
   <button class="btn" data-act="import-csv">${ic('upload')}Importar CSV</button><button class="btn pri" data-act="new-contact">${ic('user-plus')}Novo contato</button></div>
   <div class="row wrap"><label class="search" style="min-width:280px;flex:1;max-width:420px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="cq" placeholder="Buscar por nome, telefone ou e-mail" value="${esc(f.q)}" aria-label="Buscar contatos"></label>
    <select class="in" style="width:210px" data-chg="fowner" aria-label="Responsável">${ownerOpts(f.owner,true)}</select>
    <div class="row wrap" style="gap:6px"><button class="chip ${f.tag==='all'?'on':''}" data-act="ftag" data-id="all">Todos</button>${TAGS.map(t=>`<button class="chip ${f.tag===t?'on':''}" data-act="ftag" data-id="${t}">${esc(t)}</button>`).join('')}</div></div>
   ${f.sel.length?`<div class="card row wrap" style="padding:10px 14px;border-color:var(--gold)"><b class="sm">${f.sel.length} selecionados</b><select class="in" style="width:200px" data-chg="bulkassign"><option value="">Atribuir a…</option>${ownerOpts('')}</select><select class="in" style="width:180px" data-chg="bulktag"><option value="">Adicionar etiqueta…</option>${TAGS.map(t=>`<option>${esc(t)}</option>`).join('')}</select><button class="btn sm ghost end" data-act="sel-clear">Limpar seleção</button></div>`:''}
   <div id="ctable">${contactsTable()}</div></div>`;
};
ACT.ftag=el=>{S.v.tag=el.dataset.id;refresh()};
ACT.sel=(el,ev)=>{ev.stopPropagation();const id=el.dataset.id,s=S.v.sel;const i=s.indexOf(id);i<0?s.push(id):s.splice(i,1);refresh()};
ACT['sel-all']=(el,ev)=>{ev.stopPropagation();const ids=$$('#ctable tr[data-id]').map(r=>r.dataset.id);S.v.sel=el.checked?ids:[];refresh()};
ACT['sel-clear']=()=>{S.v.sel=[];refresh()};
CHG.bulkassign=el=>{if(!el.value)return;S.v.sel.forEach(id=>contact(id).owner=el.value);toast(`${S.v.sel.length} contatos atribuídos a <b>${esc(fname(user(el.value).name))}</b>`,{icon:'user'});S.v.sel=[];refresh()};
CHG.bulktag=el=>{if(!el.value)return;S.v.sel.forEach(id=>{const c=contact(id);if(!c.tags.includes(el.value))c.tags.push(el.value)});toast(`Etiqueta “${esc(el.value)}” adicionada`,{icon:'tag'});S.v.sel=[];refresh()};
function contactDrawer(id){
  const c=contact(id),o=O(),ds=o.deals.filter(d=>d.contactId===id),cv=o.convs.find(x=>x.contactId===id),ts=o.tasks.filter(t=>t.contactId===id);
  const tl=[...(cv?cv.msgs.slice(-3).map(m=>({t:m.t,ic:m.dir==='in'?'arrow-down-left':'arrow-up-right',x:(m.dir==='in'?'Cliente: ':'Equipe: ')+m.text})):[]),{t:c.createdAt,ic:'user-plus',x:`Contato criado · origem ${c.origin}`}].sort((a,b)=>b.t-a.t);
  return`<div class="dr-h">${avN(c.name,48)}<div class="grow"><div class="eyebrow">Contato</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(c.name)}</h3><div class="sm muted">${esc(c.city)} · responsável ${esc(user(c.owner).name)}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b">
   <div class="row wrap">${cv?`<button class="btn" data-act="open-conv" data-id="${cv.id}">${ic('message-square')}Conversar</button>`:`<button class="btn" data-act="start-conv" data-id="${c.id}">${ic('message-square')}Iniciar conversa</button>`}<button class="btn" data-act="new-task" data-cid="${c.id}">${ic('list-checks')}Nova tarefa</button></div>
   <div class="sm col" style="gap:5px"><span>${ic('phone','')} ${esc(c.phone)}</span><span>${ic('mail','')} ${esc(c.email)}</span><span>${ic('wallet','')} Interesse: <b class="num">${brl(c.credit)}</b> em ${esc(c.product)} (${esc(c.admin)})</span></div>
   <div class="row wrap" style="gap:6px">${c.tags.map(t=>bd(t,'gold')).join('')}</div>
   <div><div class="eyebrow" style="margin-bottom:8px">Negócios</div>${ds.map(d=>`<button class="li click" style="width:100%;text-align:left" data-act="open-deal" data-id="${d.id}">${tempDot(d.temp)}<span class="grow sm"><b>${esc(PIPES[d.pipe].label)}</b> · ${esc(stageOf(d.pipe,d.stage).label)}</span><b class="num sm">${brlK(d.value)}</b></button>`).join('')||`<div class="xs muted" style="margin-bottom:8px">Sem negócios.</div><button class="btn sm" data-act="new-deal">${ic('plus')}Criar negócio</button>`}</div>
   <div><div class="eyebrow" style="margin-bottom:8px">Linha do tempo</div><div class="list">${tl.map(e=>`<div class="li" style="align-items:flex-start">${ic(e.ic)}<div class="grow sm">${esc(e.x)}</div><span class="xs muted">${rel(e.t)}</span></div>`).join('')}</div></div>
   <div><div class="eyebrow" style="margin-bottom:8px">Tarefas (${ts.length})</div>${ts.map(t=>`<div class="li"><span class="bd ${t.done?'ok':'mute'}">${t.done?'Feita':dayLbl(t.due)}</span><span class="sm grow">${esc(t.title)}</span></div>`).join('')||'<div class="xs muted">Nenhuma tarefa.</div>'}</div>
  </div>`;
}
ACT['open-contact']=el=>openDrawer(()=>contactDrawer(el.dataset.id));
ACT['new-contact']=()=>{
  const o=O();
  dialog({title:'Novo contato',sub:o.name,submit:'Salvar contato',body:`
   <label class="fld">Nome completo<input class="in" name="name" required maxlength="80" placeholder="Ex.: Ana Beatriz Moreira"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Telefone<input class="in" name="phone" required placeholder="(65) 90000-0000"></label><label class="fld">E-mail<input class="in" name="email" type="email" placeholder="nome@exemplo.com.br"></label>
   <label class="fld">Origem<select class="in" name="origin">${ORIGINS.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>
   <label class="fld">Produto<select class="in" name="product"><option>Imóvel</option><option>Veículo</option><option>Pesados</option><option>Serviços</option></select></label><label class="fld">Crédito desejado (R$)<input class="in num" name="credit" type="number" min="0" step="5000" value="200000"></label></div>
   <label class="row sm"><input class="chk" type="checkbox" name="mkdeal" checked> Criar negócio no funil Comercial</label>`,
   onSubmit:f=>{const c={id:'c'+(o.contacts.length+1),name:f.name.trim(),phone:f.phone,email:f.email||'',city:o.city,origin:f.origin,product:f.product,admin:'Canopus',credit:+f.credit||0,owner:f.owner,tags:[],createdAt:now(),lastInt:now(),notes:''};
     o.contacts.unshift(c);if(f.mkdeal)o.deals.push({id:'d'+(o.deals.length+1),contactId:c.id,pipe:'comercial',stage:'novo',value:c.credit||1,product:c.product,admin:c.admin,temp:'Morno',owner:c.owner,entered:0,lost:false,reason:'',wonAt:null,createdAt:now()});
     toast(`Contato <b>${esc(c.name)}</b> salvo${f.mkdeal?' e negócio criado em Novo lead':''}`,{icon:'user-plus',act:'open-contact',id:c.id,actLabel:'Abrir'});refresh()}});
};
ACT['import-csv']=()=>{
  const o=O();window._csv=[];
  dialog({title:'Importar contatos',sub:'Arquivo CSV',submit:'Importar',body:`<p class="sm muted">Colunas aceitas: <b>Nome</b> e <b>Telefone</b> (obrigatórias), E-mail e Origem. Telefones já cadastrados são ignorados.</p>
   <label class="fld">Arquivo<input class="in" type="file" id="csvf" accept=".csv,text/csv" style="padding-top:7px"></label><div id="csvprev" class="card sm muted" style="padding:12px">Nenhum arquivo selecionado. Sem arquivo à mão? Clique em importar para ver um exemplo com 3 contatos.</div>`,
   onSubmit:()=>{const rows=window._csv.length?window._csv:[['Aline Peixoto','(65) 90000-0901'],['Wagner Santana','(65) 90000-0902'],['Bianca Leal','(65) 90000-0903']];
     const have=new Set(o.contacts.map(c=>c.phone));let n=0,dup=0;rows.forEach(r=>{if(have.has(r[1])){dup++;return}have.add(r[1]);n++;o.contacts.unshift({id:'c'+(o.contacts.length+1),name:r[0],phone:r[1],email:r[2]||'',city:o.city,origin:r[3]||'Importação',product:'Imóvel',admin:'Canopus',credit:0,owner:ME,tags:[],createdAt:now(),lastInt:now(),notes:''})});
     toast(`${n} contatos importados${dup?` · ${dup} duplicados ignorados`:''}`,{icon:'upload'});refresh()}});
};
CHG.csvf=el=>{const f=el.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{const lines=String(rd.result).split(/\r?\n/).filter(Boolean);const head=lines[0].toLowerCase().split(/[;,]/).map(s=>s.trim());const ni=head.indexOf('nome'),ti=head.indexOf('telefone'),ei=head.indexOf('e-mail'),oi=head.indexOf('origem');
  window._csv=ni<0||ti<0?[]:lines.slice(1).map(l=>{const p=l.split(/[;,]/).map(s=>s.trim());return[p[ni],p[ti],ei>=0?p[ei]:'',oi>=0?p[oi]:'']}).filter(r=>r[0]&&r[1]);
  $('#csvprev').innerHTML=window._csv.length?`<b>${window._csv.length}</b> linhas válidas em <b>${esc(f.name)}</b>. Primeira: ${esc(window._csv[0][0])} · ${esc(window._csv[0][1])}`:`Não encontrei as colunas Nome e Telefone em ${esc(f.name)}.`};rd.readAsText(f)};
