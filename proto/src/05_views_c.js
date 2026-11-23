/* ===== Metas e conquistas, Equipe, Suporte, Planos, Perfil ===== */
const sellersAll=()=>{const o=O();return o.users.filter(u=>o.g[u.id]&&u.sell)};
const credOf=uid=>sum(O().deals.filter(d=>d.owner===uid&&d.pipe==='comercial'&&d.stage==='ganho'&&d.wonAt>=CYCLE.start).map(d=>d.value));
const gname=u=>{const g=O().g[u.id];return g&&g.hidden&&u.id!==ME?'Participante oculto':u.name};
const metricSum=k=>{const o=O();return sum(sellersAll().map(u=>{const c=o.g[u.id].counters;return k==='calls'?c.callsDone:k==='fast'?c.fastWeek:c.won}))};
const CH_KIND={calls:['Calls realizadas','calls'],fast:['Respostas em menos de 5 min','respostas'],won:['Vendas efetivadas','vendas']};
const brl2=v=>'R$ '+v.toFixed(2).replace('.',',');
const tabsHtml=(list,cur,act)=>`<div class="tabs" role="tablist">${list.map(([k,l,n])=>`<button role="tab" aria-selected="${cur===k}" class="${cur===k?'on':''}" data-act="${act}" data-id="${k}">${l}${n!=null?` <span class="bd mute" style="margin-left:6px">${n}</span>`:''}</button>`).join('')}</div>`;

/* ---------- Desafios (calculados a partir do estado) ---------- */
function challenges(){
  const o=O(),g=o.g[ME],sl=sellersAll();g.claimed=g.claimed||[];
  const base=[
    {id:'c1',scope:'indiv',title:'Resposta relâmpago',desc:'Responda 30 conversas em menos de 5 minutos nesta semana.',cur:g.counters.fastWeek,target:30,unit:'respostas',xp:60,ends:'Termina na sexta-feira'},
    {id:'c2',scope:'indiv',title:'Documentação limpa',desc:'Formalize 5 vendas sem nenhuma correção de cadastro.',cur:g.counters.docsClean,target:5,unit:'formalizações',xp:90,ends:'Termina no fim do ciclo'},
    {id:'c3',scope:'indiv',title:'Semana sem atrasos',desc:'Conclua a agenda sem tarefas atrasadas por 5 dias úteis.',cur:g.counters.tidyDays,target:5,unit:'dias',xp:40,ends:'Meta atingida nesta semana'},
    {id:'t1',scope:'equipe',title:'Calls do ciclo',desc:'Cada call realizada pelo time soma para a meta coletiva.',cur:metricSum('calls'),target:Math.max(20,Math.round(sl.length*11/10)*10),unit:'calls',xp:100,ends:'Termina no fim do ciclo',by:'calls'},
    {id:'t2',scope:'equipe',title:'Fila sempre no prazo',desc:'Dias úteis fechados sem nenhuma conversa fora do SLA.',cur:CYCLE.bdDone,target:5,unit:'dias úteis',xp:80,ends:'Termina na sexta-feira'},
    ...(o.customCh||[]).map(c=>({...c,cur:Math.max(0,metricSum(c.by)-c.base)}))];
  return base.map(c=>({...c,cur:Math.min(c.cur,c.target),done:c.cur>=c.target,claimed:g.claimed.includes(c.id)}));
}
function chCard(c){
  const p=c.cur/c.target,sl=sellersAll();
  const top=c.scope==='equipe'&&c.by?sl.map(u=>({u,v:O().g[u.id].counters[c.by==='calls'?'callsDone':c.by==='fast'?'fastWeek':'won']})).sort((a,b)=>b.v-a.v).slice(0,4):[];
  return`<div class="card ${c.done&&!c.claimed?'hud':''}"><div class="row sp" style="align-items:flex-start"><div><span class="eyebrow">${c.scope==='equipe'?'Desafio de equipe':'Desafio individual'}</span><h3 style="font-size:15px;margin-top:2px">${esc(c.title)}</h3></div>${c.claimed?bd('Resgatado','ok','check'):c.done?bd('Concluído','gold','trophy'):bd('+'+c.xp+' XP','mute')}</div>
   <p class="sm muted" style="margin:8px 0 12px;min-height:34px">${esc(c.desc)}</p>
   <div class="row sp sm" style="margin-bottom:6px"><b class="num">${c.cur} de ${c.target} ${esc(c.unit)}</b><span class="muted">${pct(p)}</span></div>${bar(p)}
   ${top.length?`<div class="row" style="margin-top:12px;gap:6px">${top.map(t=>`<span title="${esc(gname(t.u))}: ${t.v}">${avN(gname(t.u),24)}</span>`).join('')}<span class="xs muted">maiores contribuições</span></div>`:''}
   <div class="row sp" style="margin-top:14px"><span class="xs muted">${esc(c.ends)}</span>${c.done&&!c.claimed?`<button class="btn sm pri" data-act="claim" data-id="${c.id}">${ic('gift')}Resgatar +${c.xp} XP</button>`:''}</div></div>`;
}
ACT.claim=el=>{
  const g=O().g[ME],c=challenges().find(x=>x.id===el.dataset.id);if(!c||!c.done||c.claimed)return;
  g.claimed.push(c.id);const before=lvl(g.xp).n;g.xp+=c.xp;g.cycleXp+=c.xp;g.log.unshift({t:now(),label:'Desafio: '+c.title,xp:c.xp});
  if(c.scope==='equipe')g.counters.teamCh++;
  toast(`<b>+${c.xp} XP</b> · desafio “${esc(c.title)}” resgatado`,{xp:1,icon:'trophy'});
  const a=lvl(g.xp);if(a.n>before)toast(`Nível ${a.n} · <b>${esc(a.title)}</b>`,{xp:1,icon:'award',ms:6000});
  checkAch();refresh();renderNav();
};
ACT['new-challenge']=()=>{
  dialog({title:'Novo desafio de equipe',sub:'Gamificação',submit:'Criar desafio',body:`
   <label class="fld">Nome<input class="in" name="title" required maxlength="50" placeholder="Ex.: Semana de calls"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">O que conta<select class="in" name="by">${Object.keys(CH_KIND).map(k=>`<option value="${k}">${CH_KIND[k][0]}</option>`).join('')}</select></label>
   <label class="fld">Quantidade para concluir<input class="in num" name="target" type="number" min="1" max="999" value="30" required></label></div>
   <label class="fld">Recompensa para quem participa (XP)<input class="in num" name="xp" type="number" min="10" max="150" step="10" value="60" required></label>
   <p class="sm muted">O progresso é medido a partir de agora e conta o trabalho de todos os vendedores. Recompensas altas demais distorcem o foco: o limite é 150 XP.</p>`,
   onSubmit:f=>{const o=O();(o.customCh=o.customCh||[]).push({id:'x'+(o.customCh.length+1),scope:'equipe',title:f.title.trim(),desc:`Meta coletiva: ${f.target} ${CH_KIND[f.by][1]} a partir de hoje.`,target:+f.target,unit:CH_KIND[f.by][1],xp:Math.min(150,+f.xp),ends:'Termina no fim do ciclo',by:f.by,base:metricSum(f.by)});
     S.v.gtab='desafios';toast(`Desafio <b>${esc(f.title)}</b> publicado para a equipe`,{icon:'trophy'});refresh()}});
};
ACT['set-goals']=()=>{
  const o=O(),n=Math.max(1,sellersAll().length);
  dialog({title:'Meta do ciclo',sub:`Ciclo ${dm(CYCLE.start)} a ${dm(CYCLE.end)}`,submit:'Salvar meta',body:`
   <label class="fld">Meta de crédito vendido da organização (R$)<input class="in num" name="goal" type="number" min="100000" step="50000" value="${o.goal}" required></label>
   <p class="sm muted">A meta individual é a divisão igual entre ${n} vendedores (hoje ${brlK(o.goal/n)} cada). Gestores podem ajustar metas individuais na tela de cada usuário.</p>`,
   onSubmit:f=>{o.goal=+f.goal;toast(`Meta do ciclo atualizada para <b>${brlK(o.goal)}</b>`,{icon:'target'});refresh()}});
};
ACT.pause=()=>{S.prefs.pause=!S.prefs.pause;savePrefs();toast(S.prefs.pause?'Modo pausa ativado. A sequência e as metas diárias ficam congeladas.':'Modo pausa desativado',{icon:'pause'});refresh()};

/* ---------- Metas e conquistas ---------- */
const GT={};
GT.metas=()=>{
  const m=metrics(),o=m.o,g=o.g[ME],L=lvl(g.xp),f=S.v,nextA=ACH.filter(a=>!g.ach.includes(a.id)).map(a=>({a,p:achVal(a,g)/a.target})).sort((x,y)=>y.p-x.p).slice(0,3);
  const seg=`<div class="seg"><button class="${f.gscope==='indiv'?'on':''}" data-act="gscope" data-id="indiv">Individual</button><button class="${f.gscope==='equipe'?'on':''}" data-act="gscope" data-id="equipe">Equipe</button></div>`;
  if(f.gscope==='equipe'){
    const sl=sellersAll(),teams={};sl.forEach(u=>{const t=teams[u.team]=teams[u.team]||{name:u.team,n:0,credit:0,xp:0,calls:0};t.n++;t.credit+=credOf(u.id);t.xp+=o.g[u.id].cycleXp;t.calls+=o.g[u.id].counters.callsDone});
    const tl=Object.values(teams).sort((a,b)=>b.credit-a.credit),mx=Math.max(...tl.map(t=>t.credit),1);
    const rows=sl.map(u=>({u,c:credOf(u.id),xp:o.g[u.id].cycleXp})).sort((a,b)=>b.c-a.c||b.xp-a.xp);
    return`<div class="col" style="gap:16px"><div class="row">${seg}<span class="xs muted">A visão de equipe mostra o conjunto; quem não vendeu ainda aparece com o esforço do ciclo (XP).</span></div>
     <div class="g g12"><section class="card hud s5"><div class="card-h"><div><span class="eyebrow">Meta coletiva</span><h3>${esc(o.name)}</h3></div></div>
      <div class="row wrap" style="gap:22px"><div class="ring">${ring(m.wpct,150)}<div class="mid"><span class="disp num" style="font-size:36px">${pct(m.wpct)}</span></div></div>
       <div class="grow col" style="gap:8px;min-width:150px"><div class="row sp sm"><span class="muted">Vendido</span><b class="num">${brlK(m.credit)}</b></div><div class="row sp sm"><span class="muted">Meta</span><b class="num">${brlK(m.goal)}</b></div><div class="row sp sm"><span class="muted">Ritmo</span><b class="num">${m.rhythm.toFixed(1).replace('.',',')}×</b></div></div></div></section>
      <section class="card s7"><div class="card-h"><div><span class="eyebrow">Equipes</span><h3>Crédito e esforço por equipe</h3></div></div><div class="col" style="gap:14px">${tl.map(t=>`<div><div class="row sp sm" style="margin-bottom:5px"><b>${esc(t.name)} <span class="muted" style="font-weight:400">· ${t.n} pessoas</span></b><span class="num">${brlK(t.credit)} · ${t.xp.toLocaleString('pt-BR')} XP · ${t.calls} calls</span></div>${bar(t.credit/mx)}</div>`).join('')}</div></section></div>
     <section class="card"><div class="card-h"><div><span class="eyebrow">Contribuição</span><h3>Progresso individual dentro do time</h3></div></div><div class="tbl-wrap" style="border:0"><table class="tbl" style="min-width:560px"><thead><tr><th>Pessoa</th><th>Equipe</th><th>Crédito vendido</th><th style="width:30%">Meta individual</th><th>XP do ciclo</th></tr></thead><tbody>${rows.map(r=>`<tr><td><div class="row">${avN(gname(r.u),26)}<b>${esc(r.u.id===ME?'Você':gname(r.u))}</b></div></td><td class="sm">${esc(r.u.team)}</td><td class="num">${brlK(r.c)}</td><td><div class="row"><span class="grow">${bar(r.c/m.myTarget)}</span><b class="xs num" style="width:38px;text-align:right">${pct(r.c/m.myTarget)}</b></div></td><td class="num">${r.xp.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody></table></div></section></div>`;
  }
  const goals=[['Crédito vendido',m.myCredit/m.myTarget,`${brlK(m.myCredit)} de ${brlK(m.myTarget)}`],['Calls realizadas',g.counters.callsDone/40,`${g.counters.callsDone} de 40`],['Primeira resposta em até 5 min (semana)',g.counters.fastWeek/30,`${g.counters.fastWeek} de 30`],['Contato mínimo diário',Math.min(1,g.streak/10),`${g.streak} dias úteis seguidos`],['Formalizações sem correção',g.counters.docsClean/5,`${g.counters.docsClean} de 5`]];
  const myPct=m.myCredit/m.myTarget,left=Math.max(0,m.myTarget-m.myCredit);
  return`<div class="col" style="gap:16px"><div class="row">${seg}${S.prefs.pause?bd('Modo pausa ativo','info','pause'):''}</div>
   <div class="g g12"><section class="card hud s7"><div class="card-h"><div><span class="eyebrow">Sua meta do ciclo</span><h3>Crédito vendido contra a meta individual</h3></div></div>
    <div class="row wrap" style="gap:28px"><div class="ring">${ring(myPct,168)}<div class="mid"><span class="disp num" style="font-size:42px">${pct(myPct)}</span><span class="xs muted">da meta</span></div></div>
     <div class="grow col" style="gap:11px;min-width:220px"><div class="row sp"><span class="muted sm">Vendido por você</span><b class="num">${brl(m.myCredit)}</b></div><div class="row sp"><span class="muted sm">Meta individual</span><b class="num">${brl(m.myTarget)}</b></div><div class="row sp"><span class="muted sm">Faltam</span><b class="num">${brl(left)}</b></div><div class="row sp"><span class="muted sm">Por dia útil restante</span><b class="num">${brlK(left/Math.max(1,CYCLE.bdTotal-CYCLE.bdDone))}</b></div><div class="row sp"><span class="muted sm" title="Estimativa de demonstração">Comissão estimada</span><b class="num">${brl(m.commission)}</b></div></div></div></section>
    <section class="card s5"><div class="card-h"><div><span class="eyebrow">Progressão</span><h3>Nível ${L.n} · ${esc(L.title)}</h3></div><span class="bd gold end">${ic('flame')}${g.streak} dias</span></div>
     <div class="row sp sm" style="margin-bottom:6px"><b class="num">${g.xp.toLocaleString('pt-BR')} XP</b><span class="muted">${L.next?`faltam ${(L.next-g.xp).toLocaleString('pt-BR')} para ${esc(TITLES[L.n])}`:'nível máximo'}</span></div>${bar(L.pct)}
     <div class="row sp" style="margin-top:16px"><div><div class="eyebrow">XP do ciclo</div><b class="num" style="font-size:20px">${g.cycleXp.toLocaleString('pt-BR')}</b></div><div><div class="eyebrow">Conquistas</div><b class="num" style="font-size:20px">${g.ach.length}/${ACH.length}</b></div><div><div class="eyebrow">Vendas</div><b class="num" style="font-size:20px">${g.counters.won}</b></div></div>
     <div class="row sp" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--line)"><div><b class="sm">Modo pausa</b><div class="xs muted">Folga ou férias: congela sequência e metas diárias.</div></div>${sw(S.prefs.pause,'pause')}</div></section></div>
   <div class="g g12"><section class="card s7"><div class="card-h"><div><span class="eyebrow">Metas do ciclo</span><h3>Cinco medidas, nenhuma isolada</h3></div></div><div class="col" style="gap:15px">${goals.map(x=>`<div><div class="row sp sm" style="margin-bottom:5px"><span>${x[0]}</span><b class="num">${x[2]}</b></div>${bar(Math.min(1,x[1]))}</div>`).join('')}</div></section>
    <section class="card s5"><div class="card-h"><div><span class="eyebrow">Perto de desbloquear</span><h3>Próximas conquistas</h3></div><button class="btn sm ghost end" data-act="gtab" data-id="conquistas">Ver todas</button></div>
     <div class="list">${nextA.map(n=>`<div class="li"><span class="ach-ic" style="width:38px;height:38px">${ic(n.a.icon)}</span><div class="grow"><div class="sm" style="font-weight:600">${esc(n.a.name)}</div><div class="xs muted">${esc(n.a.desc)}</div><div style="margin-top:6px">${bar(n.p)}</div></div></div>`).join('')}</div></section></div>
   <section class="card"><div class="card-h"><div><span class="eyebrow">Histórico</span><h3>Últimos pontos de XP</h3></div></div><div class="list">${g.log.slice(0,6).map(l=>`<div class="li">${ic('zap','up')}<span class="grow sm">${esc(l.label)}</span><span class="xs muted">${rel(l.t)}</span><b class="num sm up">+${l.xp}</b></div>`).join('')||'<div class="empty">Sem pontos ainda neste ciclo.</div>'}</div></section></div>`;
};
GT.desafios=()=>{
  const all=challenges(),ind=all.filter(c=>c.scope==='indiv'),eq=all.filter(c=>c.scope==='equipe'),pend=all.filter(c=>c.done&&!c.claimed).length;
  return`<div class="col" style="gap:18px">${pend?`<div class="card row" style="border-color:var(--gold);padding:12px 16px">${ic('gift')}<span class="grow sm"><b>${pend} ${pend>1?'recompensas':'recompensa'} para resgatar.</b> Desafios concluídos rendem XP extra.</span></div>`:''}
   <section><div class="row sp" style="margin-bottom:10px"><div><span class="eyebrow">Para você</span><h3 style="font-size:16px">Desafios individuais</h3></div></div><div class="g" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${ind.map(chCard).join('')}</div></section>
   <section><div class="row sp" style="margin-bottom:10px"><div><span class="eyebrow">Para o time</span><h3 style="font-size:16px">Desafios de equipe</h3></div>${LV('metas')>=3?`<button class="btn sm" data-act="new-challenge">${ic('plus')}Novo desafio</button>`:''}</div><div class="g" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${eq.map(chCard).join('')}</div></section></div>`;
};
GT.conquistas=()=>{
  const g=O().g[ME];
  return`<div class="col" style="gap:16px"><div class="row sp"><div><span class="eyebrow">Coleção</span><h3 style="font-size:16px">${g.ach.length} de ${ACH.length} conquistas</h3></div><div style="width:240px">${bar(g.ach.length/ACH.length)}</div></div>
   <div class="g" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr))">${ACH.map(a=>{const on=g.ach.includes(a.id),v=Math.min(a.target,achVal(a,g));return`<div class="card ach ${on?'on':''}"><div class="row" style="align-items:flex-start;gap:14px"><span class="ach-ic">${ic(a.icon)}</span><div class="grow"><div class="row sp"><b class="sm">${esc(a.name)}</b><span class="bd ${on?'gold':'mute'}">Nível ${a.tier}</span></div><div class="xs muted" style="margin-top:3px">${esc(a.desc)}</div></div></div>
     <div style="margin-top:14px">${on?`<div class="row sm up">${ic('check')}Desbloqueada</div>`:`<div class="row sp xs muted" style="margin-bottom:5px"><span>Progresso</span><span class="num">${v} de ${a.target}</span></div>${bar(v/a.target)}`}</div></div>`}).join('')}</div></div>`;
};
GT.ranking=()=>{
  const o=O(),f=S.v,rk=ranking(),mx=Math.max(...rk.map(r=>r.xp),1);
  const seg=`<div class="seg"><button class="${f.rank==='ciclo'?'on':''}" data-act="rank" data-id="ciclo">Pessoas</button><button class="${f.rank==='time'?'on':''}" data-act="rank" data-id="time">Equipes</button></div>`;
  if(f.rank==='time'){const t={};rk.forEach(r=>{const x=t[r.u.team]=t[r.u.team]||{name:r.u.team,n:0,xp:0,credit:0};x.n++;x.xp+=r.xp;x.credit+=r.credit});const tl=Object.values(t).sort((a,b)=>b.xp/b.n-a.xp/a.n);
    return`<div class="col" style="gap:14px"><div class="row">${seg}<span class="xs muted">Equipes comparadas pela média de XP por pessoa, para não favorecer times maiores.</span></div><div class="card"><div class="list">${tl.map((x,i)=>`<div class="li"><b class="num" style="width:26px">${i+1}º</b><div class="grow"><div class="row sp"><b>${esc(x.name)}</b><span class="sm num">${Math.round(x.xp/x.n).toLocaleString('pt-BR')} XP médios · ${brlK(x.credit)}</span></div><div style="margin-top:6px">${bar((x.xp/x.n)/Math.max(...tl.map(y=>y.xp/y.n)))}</div></div></div>`).join('')}</div></div></div>`}
  return`<div class="col" style="gap:14px"><div class="row">${seg}<span class="xs muted">Reinicia a cada ciclo (${dm(CYCLE.start)} a ${dm(CYCLE.end)}). Nível e conquistas não reiniciam.</span></div>
   <div class="tbl-wrap"><table class="tbl" style="min-width:640px"><thead><tr><th style="width:56px">Pos.</th><th>Pessoa</th><th>Nível</th><th style="width:28%">XP do ciclo</th><th>Crédito vendido</th></tr></thead><tbody>${rk.map((r,i)=>`<tr style="${r.u.id===ME?'background:color-mix(in srgb,var(--gold) 10%,transparent)':''}"><td><b class="num">${i+1}º</b></td><td><div class="row">${avN(gname(r.u),30)}<div><b>${esc(r.u.id===ME?'Você':gname(r.u))}</b><div class="xs muted">${esc(r.u.team)}</div></div></div></td><td class="sm">${r.lv.n} · ${esc(r.lv.title)}</td><td><div class="row"><span class="grow">${bar(r.xp/mx)}</span><b class="num sm" style="width:46px;text-align:right">${r.xp.toLocaleString('pt-BR')}</b></div></td><td class="num">${brlK(r.credit)}</td></tr>`).join('')}</tbody></table></div></div>`;
};
GT.como=()=>`<div class="g g12">
  <section class="card s7"><div class="card-h"><div><span class="eyebrow">XP</span><h3>O que rende pontos</h3></div></div><div class="tbl-wrap" style="border:0"><table class="tbl" style="min-width:420px"><thead><tr><th>Ação</th><th>XP</th><th>Limite por dia</th></tr></thead><tbody>${Object.values(XP_RULES).map(r=>`<tr><td>${esc(r.label)}</td><td class="num"><b>+${r.xp}${r.label==='Venda efetivada'?' a +400':''}</b></td><td class="muted">${r.cap?r.cap+' XP':'Sem limite'}</td></tr>`).join('')}</tbody></table></div>
   <p class="sm muted" style="margin-top:10px">Venda efetivada: 150 XP fixos mais 1 XP a cada R$ 1 mil de crédito, até 250. Os limites diários evitam que volume substitua qualidade.</p></section>
  <section class="card s5"><div class="card-h"><div><span class="eyebrow">Níveis</span><h3>Progressão contínua</h3></div></div><div class="list">${LEVELS.map((x,i)=>`<div class="li"><b class="num" style="width:26px">${i+1}</b><span class="grow sm">${esc(TITLES[i])}</span><span class="xs muted num">${x.toLocaleString('pt-BR')} XP</span></div>`).join('')}</div></section>
  <section class="card s12"><div class="card-h"><div><span class="eyebrow">Princípios</span><h3>Como a gamificação se comporta</h3></div></div>
   <div class="g" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">${[['shield-check','Qualidade antes de volume','O XP vem de resposta rápida, tarefa em dia e documentação correta. Há limite diário por ação.'],['heart-handshake','Sem punições','Ninguém perde XP ou nível. Um dia ruim não apaga o que foi conquistado.'],['pause','Pausa sem perda','No modo pausa, folgas e férias não quebram a sequência nem as metas diárias.'],['eye-off','Privacidade','Cada pessoa decide se o seu nome aparece no ranking dos colegas. A gestão sempre vê os números.'],['users','Equipe também conta','Desafios coletivos e ranking por média evitam que o time vire uma disputa individual.'],['gauge','Estímulo discreto','Avisos de XP são curtos, sem sons e sem animações longas. Dá para reduzir tudo no perfil.']].map(p=>`<div class="row" style="align-items:flex-start;gap:12px"><span class="ach-ic" style="width:38px;height:38px">${ic(p[0])}</span><div><b class="sm">${p[1]}</b><div class="xs muted" style="margin-top:3px">${p[2]}</div></div></div>`).join('')}</div></section></div>`;
VIEWS['metas']=()=>{
  const f=S.v,pend=challenges().filter(c=>c.done&&!c.claimed).length;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(O().name)} · ciclo ${dm(CYCLE.start)}–${dm(CYCLE.end)}</div><h2>Metas e conquistas</h2></div>${LV('metas')>=3?`<button class="btn" data-act="set-goals">${ic('target')}Definir meta do ciclo</button>`:''}</div>
   ${tabsHtml([['metas','Metas'],['desafios','Desafios',pend||null],['conquistas','Conquistas'],['ranking','Ranking'],['como','Como funciona']],f.gtab,'gtab')}${GT[f.gtab]()}</div>`;
};
ACT.gtab=el=>{S.v.gtab=el.dataset.id;refresh()};
ACT.gscope=el=>{S.v.gscope=el.dataset.id;refresh()};
ACT.rank=el=>{S.v.rank=el.dataset.id;refresh()};

/* ---------- Equipe e permissões ---------- */
const seatsFree=()=>{const o=O();return o.seats-(o.users.filter(u=>u.status==='Ativo').length+o.invites.filter(i=>i.status==='Pendente').length)};
const roleTone=r=>({Proprietário:'gold',Administrador:'gold',Gestor:'info',Vendedor:'ok',Suporte:'warn',Financeiro:'mute'}[r]||'mute');
const LVL=['Sem acesso','Ver','Editar','Total'];
function eqUsers(){
  const o=O(),act=o.users.filter(u=>u.status==='Ativo').length;
  return`<div class="row wrap"><div class="card row" style="padding:10px 16px;gap:14px"><div><div class="eyebrow">Assentos</div><b class="num">${act} ativos + ${o.invites.filter(i=>i.status==='Pendente').length} convites de ${o.seats}</b></div><div style="width:120px">${bar((o.seats-seatsFree())/o.seats)}</div></div></div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Usuário</th><th>Cargo e equipe</th><th>Perfil</th><th>Status</th><th>Último acesso</th></tr></thead><tbody>${o.users.map(u=>`<tr class="click" data-act="open-user" data-id="${u.id}"><td><div class="row">${avN(u.name,32)}<div><b>${esc(u.name)}</b>${u.id===ME?' <span class="bd gold">Você</span>':''}<div class="xs muted">${esc(u.email)}</div></div></div></td><td>${esc(u.cargo)}<div class="xs muted">${esc(u.team)}</div></td><td>${bd(u.role,roleTone(u.role))}</td><td>${bd(u.status,u.status==='Ativo'?'ok':'mute')}</td><td class="sm muted">${u.id===ME?'agora':rel(u.last)}</td></tr>`).join('')}</tbody></table></div>`;
}
function eqInvites(){
  const o=O();
  return`<div class="tbl-wrap"><table class="tbl" style="min-width:680px"><thead><tr><th>E-mail</th><th>Perfil</th><th>Equipe</th><th>Enviado</th><th>Status</th><th></th></tr></thead><tbody>${o.invites.map(i=>`<tr><td><b>${esc(i.email)}</b></td><td>${bd(i.role,roleTone(i.role))}</td><td class="sm">${esc(i.team)}</td><td class="sm muted">${rel(i.sent)}</td><td>${bd(i.status,i.status==='Pendente'?'warn':'mute')}</td>
   <td><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sm" data-act="inv-resend" data-id="${i.id}">${ic('key-round')}Liberar acesso</button><button class="ibtn" style="width:30px;height:30px" data-act="inv-copy" data-id="${i.id}" aria-label="Copiar link do convite">${ic('copy')}</button><button class="ibtn" style="width:30px;height:30px" data-act="inv-del" data-id="${i.id}" aria-label="Revogar convite">${ic('trash-2')}</button></div></td></tr>`).join('')||`<tr><td colspan="6" class="empty">Nenhum convite enviado.</td></tr>`}</tbody></table></div>
   <p class="sm muted">Convites antigos: clique em <b>Liberar acesso</b>, informe o nome e a pessoa recebe por e-mail o link do CRM e uma senha provisória.</p>`;
}
function eqPerms(){
  const o=O(),can=LV('equipe')>=3;
  return`<div class="card" style="padding:12px 16px"><div class="row wrap" style="gap:18px"><span class="xs muted">Níveis:</span>${LVL.map((l,i)=>`<span class="row xs"><span class="pcell l${i}" style="min-width:0;padding:0 8px;height:22px">${l}</span></span>`).join('')}<span class="xs muted end">${can?'Clique em uma célula para alterar.':'Somente leitura para o seu perfil.'}</span></div></div>
   <div class="tbl-wrap"><table class="tbl" style="min-width:760px"><thead><tr><th>Tela</th>${ROLES.map(r=>`<th style="text-align:center">${r}</th>`).join('')}</tr></thead><tbody>${MODS.map((m,mi)=>`<tr><td><b>${m[1]}</b></td>${ROLES.map(r=>{const v=o.perms[r][mi],lock=!can||r==='Proprietário';return`<td style="text-align:center"><button class="pcell l${v}" data-act="perm" data-role="${r}" data-m="${mi}" ${lock?'disabled style="cursor:default"':''} aria-label="${r}, ${m[1]}: ${LVL[v]}">${LVL[v]}</button></td>`}).join('')}</tr>`).join('')}</tbody></table></div>
   <div class="g" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))"><div class="card"><div class="eyebrow">Escopo dos dados</div><div class="sm col" style="gap:6px;margin-top:8px"><span><b>Vendedor</b> vê só os próprios contatos, negócios e conversas.</span><span><b>Gestor</b> vê os da sua equipe.</span><span><b>Administrador</b> vê toda a organização.</span></div></div>
   <div class="card"><div class="eyebrow">Boas práticas</div><div class="sm muted" style="margin-top:8px">Dê o menor acesso necessário. Planos e pagamentos ficam restritos a Administrador e Financeiro.</div>${can?`<button class="btn sm" style="margin-top:10px" data-act="perm-reset">${ic('refresh-cw')}Restaurar padrão</button>`:''}</div></div>`;
}
VIEWS['equipe']=()=>{
  const o=O(),f=S.v,can=LV('equipe')>=3;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Equipe e permissões</h2></div>${can?`<button class="btn pri" data-act="invite">${ic('user-plus')}Convidar usuário</button>`:''}</div>
   ${tabsHtml([['usuarios','Usuários',o.users.length],['convites','Convites',o.invites.filter(i=>i.status==='Pendente').length||null],['permissoes','Permissões']],f.eqtab,'eqtab')}
   ${f.eqtab==='usuarios'?eqUsers():f.eqtab==='convites'?eqInvites():eqPerms()}</div>`;
};
ACT.eqtab=el=>{S.v.eqtab=el.dataset.id;refresh()};
ACT.invite=()=>{
  const o=O(),pl=PLANS[o.plan];
  if(seatsFree()<=0)return dialog({title:'Assentos esgotados',sub:'Convidar usuário',submit:'Ver planos',body:`<p class="sm">A organização usa todos os ${o.seats} assentos contratados no plano <b>${esc(pl.name)}</b> (usuários ativos e convites pendentes). Para convidar mais pessoas, compre assentos ou mude de plano.</p>`,onSubmit:()=>{go('planos')}});
  const teams=[...new Set(o.users.map(u=>u.team))];
  dialog({title:'Convidar usuário',sub:`${seatsFree()} assentos livres`,submit:'Enviar convite',body:`
   <label class="fld">E-mail<input class="in" type="email" name="email" required placeholder="pessoa@empresa.com.br"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Perfil<select class="in" name="role">${ROLES.filter(r=>r!=='Proprietário').map(r=>`<option ${r==='Vendedor'?'selected':''}>${r}</option>`).join('')}</select></label>
   <label class="fld">Equipe<select class="in" name="team">${teams.map(t=>`<option>${esc(t)}</option>`).join('')}</select></label></div>
   <label class="fld">Mensagem (opcional)<textarea class="in" name="msg" rows="2" placeholder="Bem-vindo(a) ao time!"></textarea></label>`,
   onSubmit:f=>{const em=f.email.trim().toLowerCase();if(o.users.some(u=>u.email===em)||o.invites.some(i=>i.email===em&&i.status==='Pendente')){toast('Esse e-mail já tem acesso ou um convite pendente',{icon:'mail-x'});return false}
     o.invites.unshift({id:'iv'+(o.invites.length+1+Math.floor(Math.random()*90)),email:em,role:f.role,team:f.team,status:'Pendente',sent:now()});S.v.eqtab='convites';toast(`Convite enviado para <b>${esc(em)}</b>`,{icon:'send'});refresh()}});
};
ACT['inv-resend']=el=>{const i=O().invites.find(x=>x.id===el.dataset.id);i.sent=now();i.status='Pendente';toast(`Convite reenviado para <b>${esc(i.email)}</b>`,{icon:'send'});refresh()};
ACT['inv-del']=el=>{const o=O();const i=o.invites.find(x=>x.id===el.dataset.id);o.invites=o.invites.filter(x=>x!==i);toast('Convite revogado',{icon:'trash-2'});refresh()};
ACT['inv-copy']=el=>{const link=`https://app.alvo.exemplo/convite/${el.dataset.id}`,done=ok=>toast(ok?'Link do convite copiado':`Link do convite: <span class="xs muted">${esc(link)}</span>`,{icon:'copy'});try{navigator.clipboard.writeText(link).then(()=>done(true),()=>done(false))}catch(e){done(false)}};
ACT.perm=el=>{
  const o=O(),r=el.dataset.role,mi=+el.dataset.m;if(LV('equipe')<3||r==='Proprietário')return;
  const next=(o.perms[r][mi]+1)%4;
  if(r===ROLE()&&MODS[mi][0]==='equipe'&&next<3){toast('Você perderia o acesso a esta tela. Peça a outro administrador.',{icon:'lock'});return}
  o.perms[r][mi]=next;toast(`${r} · ${MODS[mi][1]}: <b>${LVL[next]}</b>`,{icon:'shield'});refresh();
};
ACT['perm-reset']=()=>{O().perms=JSON.parse(JSON.stringify(PERM0));toast('Permissões restauradas ao padrão',{icon:'refresh-cw'});refresh();renderNav()};
function userDrawer(id){
  const o=O(),u=user(id),g=o.g[id],can=LV('equipe')>=3,locked=!can||u.role==='Proprietário',L=g&&lvl(g.xp),teams=LIVE&&o.teams?['—'].concat(o.teams.map(t=>t.name)):[...new Set(o.users.map(x=>x.team))];
  return`<div class="dr-h">${avN(u.name,48)}<div class="grow"><div class="eyebrow">${esc(u.team)}</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(u.name)}</h3><div class="sm muted">${esc(u.email)}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b"><div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Perfil<select class="in" data-chg="urole" data-id="${id}" ${locked?'disabled':''}>${ROLES.map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></label>
   <label class="fld">Equipe<select class="in" data-chg="uteam" data-id="${id}" ${!can?'disabled':''}>${teams.map(t=>`<option ${t===u.team?'selected':''}>${esc(t)}</option>`).join('')}</select></label>
   <label class="fld">Cargo<input class="in" data-chg="ucargo" data-id="${id}" value="${esc(u.cargo)}" ${!can?'disabled':''}></label><div class="fld">Status<div class="row" style="height:38px">${bd(u.status,u.status==='Ativo'?'ok':'mute')}</div></div></div>
   ${g?`<div class="card" style="padding:14px"><div class="eyebrow">Desempenho no ciclo</div><div class="row sp" style="margin-top:8px"><div><div class="xs muted">Nível</div><b>${L.n} · ${esc(L.title)}</b></div><div><div class="xs muted">XP do ciclo</div><b class="num">${g.cycleXp.toLocaleString('pt-BR')}</b></div><div><div class="xs muted">Crédito</div><b class="num">${brlK(credOf(id))}</b></div><div><div class="xs muted">Conquistas</div><b class="num">${g.ach.length}</b></div></div></div>`:''}
   <div class="sm muted">Último acesso: ${id===ME?'agora':rel(u.last)}. ${locked&&u.role==='Proprietário'?'O perfil do proprietário não pode ser alterado.':''}</div></div>
  ${can&&id!==ME&&u.role!=='Proprietário'?`<div class="dr-f"><button class="btn" data-act="u-reset" data-id="${id}">${ic('key-round')}Redefinir acesso</button><button class="btn" data-act="u-toggle" data-id="${id}">${ic(u.status==='Ativo'?'user-x':'user-check')}${u.status==='Ativo'?'Desativar':'Reativar'}</button></div>`:''}`;
}
ACT['open-user']=el=>openDrawer(()=>userDrawer(el.dataset.id));
CHG.urole=el=>{const u=user(el.dataset.id);if(u.id===ME&&LV('equipe')>=3&&!['Proprietário','Administrador'].includes(el.value)){toast('Você perderia o acesso a Equipe. Peça a outro administrador.',{icon:'lock'});redrawDrawer();return}u.role=el.value;toast(`Perfil de <b>${esc(fname(u.name))}</b>: ${el.value}`,{icon:'shield'});refresh();renderNav();redrawDrawer()};
CHG.uteam=el=>{user(el.dataset.id).team=el.value;toast('Equipe atualizada',{icon:'users'});refresh();redrawDrawer()};
CHG.ucargo=el=>{user(el.dataset.id).cargo=el.value.trim()||user(el.dataset.id).cargo;toast('Cargo atualizado',{icon:'check'});refresh()};
ACT['u-toggle']=el=>{const u=user(el.dataset.id);u.status=u.status==='Ativo'?'Inativo':'Ativo';toast(`${esc(fname(u.name))} ${u.status==='Ativo'?'reativado(a)':'desativado(a)'}. O assento ${u.status==='Ativo'?'volta a ser usado':'foi liberado'}.`,{icon:'user-check'});refresh();redrawDrawer()};
ACT['u-reset']=el=>{toast(`Link de redefinição enviado para <b>${esc(user(el.dataset.id).email)}</b>`,{icon:'key-round'})};

/* ---------- Suporte interno ---------- */
const SLA_H={essencial:'24 h',equipe:'4 h',corporativo:'1 h'};
const TSTATUS={'Aberto':'info','Em atendimento':'warn','Aguardando você':'gold','Resolvido':'ok'};
const KBTXT={0:'Em WhatsApp, escolha Conectar instância e depois API oficial. Informe o número com DDI, o ID do número e o token de acesso permanente. A verificação confirma o número e libera os modelos aprovados.',1:'A API oficial segue os termos da Meta, tem estabilidade alta e permite modelos para iniciar conversas. A conexão por QR Code é rápida, mas pode ser bloqueada e não tem modelos. Use a oficial na operação principal.',2:'Você ganha XP por respostas rápidas, tarefas em dia, calls, avanço de etapa, documentação correta e vendas. Cada ação tem limite diário. O ranking reinicia a cada ciclo; níveis e conquistas permanecem.',3:'Em Equipe, convide por e-mail e escolha o perfil. Em Permissões, ajuste o nível de acesso de cada perfil por tela. Convites usam um assento até serem aceitos ou expirarem.',4:'O ciclo comercial vai do dia 15 ao dia 14. Vendas efetivadas dentro dele contam para a meta e a comissão daquele ciclo. Depois do corte, o ciclo é congelado.',5:'Responda em até 5 minutos para pontuar. Use respostas rápidas para ganhar tempo, mas personalize a mensagem. Conversas sem responsável aparecem em Não atribuídas.'};
function tkList(){
  const o=O(),f=S.v,mine=LV('suporte')<3;
  return o.tickets.filter(t=>f.tfilter==='todos'||f.tfilter==='abertos'&&t.status!=='Resolvido'||f.tfilter==='resolvidos'&&t.status==='Resolvido').filter(t=>!mine||t.by===ME);
}
VIEWS['suporte']=()=>{
  const o=O(),f=S.v,list=tkList(),down=o.inst.filter(i=>i.state!=='conectada').length,open=o.tickets.filter(t=>t.status!=='Resolvido').length;
  const tab=f.stab;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · SLA do plano ${esc(PLANS[o.plan].name)}: primeira resposta em até ${SLA_H[o.plan]}</div><h2>Suporte interno</h2></div><button class="btn pri" data-act="new-ticket">${ic('plus')}Abrir chamado</button></div>
   <div class="g g12"><div class="s8 col" style="gap:14px">${tabsHtml([['tickets','Chamados',open||null],['base','Base de conhecimento']],tab,'stab')}
    ${tab==='tickets'?`<div class="row wrap">${[['abertos','Em aberto'],['resolvidos','Resolvidos'],['todos','Todos']].map(([k,l])=>`<button class="chip ${f.tfilter===k?'on':''}" data-act="tfilter" data-id="${k}">${l}</button>`).join('')}</div>
     <div class="card" style="padding:4px 16px"><div class="list">${list.map(t=>`<button class="li click" data-act="open-ticket" data-id="${t.id}" style="width:100%;text-align:left"><span class="xs muted num" style="width:54px">${t.id}</span><div class="grow"><div class="sm" style="font-weight:600">${esc(t.title)}</div><div class="xs muted">${esc(t.cat)} · aberto ${rel(t.opened)} · última mensagem ${rel(t.msgs[t.msgs.length-1].t)}</div></div>${t.prio==='Alta'?bd('Alta','bad'):''}${bd(t.status,TSTATUS[t.status])}</button>`).join('')||'<div class="empty">Nenhum chamado nesta lista.</div>'}</div></div>`
     :`<div class="card" style="padding:4px 16px"><div class="list">${KB.map((k,i)=>`<button class="li click" data-act="open-kb" data-id="${i}" style="width:100%;text-align:left">${ic('book-open')}<span class="grow sm" style="font-weight:600">${esc(k[0])}</span><span class="xs muted">${k[1]} de leitura</span></button>`).join('')}</div></div>`}</div>
    <aside class="s4 col" style="gap:14px"><section class="card"><div class="card-h"><div><span class="eyebrow">Status</span><h3>Serviços</h3></div></div><div class="list">
      <div class="li"><span class="live"></span><span class="grow sm">Plataforma</span><span class="xs up">Operacional</span></div>
      <div class="li"><span class="live"></span><span class="grow sm">WhatsApp API oficial</span><span class="xs up">Operacional</span></div>
      <div class="li"><span class="temp" style="background:${down?'var(--warn)':'var(--ok)'}"></span><span class="grow sm">Conexões por QR Code</span><span class="xs ${down?'':'up'}" style="${down?'color:var(--warn)':''}">${down?down+' sessão caída':'Operacional'}</span></div></div></section>
     <section class="card"><div class="eyebrow">Atendimento</div><div class="sm col" style="gap:6px;margin-top:8px"><span>${ic('clock','')} Seg a sex, 8h às 18h (Cuiabá)</span><span>${ic('timer','')} Primeira resposta: até ${SLA_H[o.plan]}</span>${o.plan==='corporativo'?`<span>${ic('user-round','')} Gerente de conta: Vitória Salles</span>`:''}</div></section></aside></div></div>`;
};
ACT.stab=el=>{S.v.stab=el.dataset.id;refresh()};
ACT.tfilter=el=>{S.v.tfilter=el.dataset.id;refresh()};
function ticketDrawer(id){
  const t=O().tickets.find(x=>x.id===id),adm=LV('suporte')>=3;
  return`<div class="dr-h"><div class="grow"><div class="eyebrow">${t.id} · ${esc(t.cat)}</div><h3 style="font-size:17px;margin-top:3px;line-height:1.3">${esc(t.title)}</h3><div class="row wrap" style="margin-top:8px;gap:6px">${bd(t.status,TSTATUS[t.status])}${bd('Prioridade '+t.prio,t.prio==='Alta'?'bad':'mute')}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b" style="gap:10px">${t.msgs.map(m=>`<div class="m ${m.who==='me'?'out':'in'}" style="max-width:92%">${m.who==='sup'?`<b class="xs">${ic('life-buoy','')} Suporte ALVO</b><br>`:''}${esc(m.text)}<span class="t">${dayLbl(m.t)} ${hm(m.t)}</span></div>`).join('')}</div>
  <form data-form="ticket-reply" data-id="${id}" class="dr-f" style="flex-direction:column;align-items:stretch">${adm?`<label class="row sm">Status<select class="in" style="width:190px" data-chg="tstatus" data-id="${id}">${Object.keys(TSTATUS).map(s=>`<option ${s===t.status?'selected':''}>${s}</option>`).join('')}</select></label>`:''}
   ${t.status==='Resolvido'?`<div class="row sp"><span class="sm muted">Chamado resolvido.</span><button type="button" class="btn" data-act="tk-reopen" data-id="${id}">Reabrir</button></div>`:`<textarea class="in" name="text" rows="2" required placeholder="Escreva sua resposta…" aria-label="Resposta"></textarea><div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="tk-resolve" data-id="${id}">${ic('check')}Marcar como resolvido</button><button class="btn pri" type="submit">${ic('send')}Enviar</button></div>`}</form>`;
}
ACT['open-ticket']=el=>openDrawer(()=>ticketDrawer(el.dataset.id));
FORMS['ticket-reply']=(form,data)=>{
  const t=O().tickets.find(x=>x.id===form.dataset.id),text=(data.text||'').trim();if(!text)return;
  t.msgs.push({who:'me',text,t:now()});t.status='Em atendimento';redrawDrawer();refresh();
  setTimeout(()=>{t.msgs.push({who:'sup',text:'Recebemos sua mensagem e já estamos analisando. Voltamos com uma resposta dentro do prazo do seu plano.',t:now()});O().notifs.unshift({id:'n'+Date.now(),icon:'life-buoy',text:`Chamado ${t.id} recebeu uma resposta`,t:now(),view:'suporte',read:false});if(S.ui.drawer)redrawDrawer();if(S.view==='suporte')refresh();renderTop()},1800);
};
CHG.tstatus=el=>{const t=O().tickets.find(x=>x.id===el.dataset.id);t.status=el.value;toast(`Status: <b>${esc(el.value)}</b>`,{icon:'check'});refresh();redrawDrawer()};
ACT['tk-resolve']=el=>{const t=O().tickets.find(x=>x.id===el.dataset.id);t.status='Resolvido';toast(`Chamado ${t.id} resolvido`,{icon:'check'});refresh();redrawDrawer()};
ACT['tk-reopen']=el=>{const t=O().tickets.find(x=>x.id===el.dataset.id);t.status='Aberto';toast(`Chamado ${t.id} reaberto`,{icon:'life-buoy'});refresh();redrawDrawer()};
ACT['open-kb']=el=>{const k=KB[+el.dataset.id];dialog({title:k[0],sub:'Base de conhecimento · '+k[1]+' de leitura',submit:'Fechar',body:`<p class="sm" style="line-height:1.65">${esc(KBTXT[+el.dataset.id])}</p><p class="xs muted">Artigo de demonstração.</p>`,onSubmit:()=>{}})};
ACT['new-ticket']=()=>{
  const o=O();
  dialog({title:'Abrir chamado',sub:'Suporte interno',submit:'Enviar chamado',body:`
   <label class="fld">Assunto<input class="in" name="title" required maxlength="90" placeholder="Resuma o problema em uma frase"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Categoria<select class="in" name="cat">${['WhatsApp','Funis e negócios','Contas e acesso','Planos e pagamentos','Comissões','Documentação','Outro'].map(c=>`<option>${c}</option>`).join('')}</select></label>
   <label class="fld">Prioridade<select class="in" name="prio"><option>Baixa</option><option selected>Média</option><option>Alta</option></select></label></div>
   <label class="fld">Descrição<textarea class="in" name="desc" rows="4" required placeholder="O que aconteceu, em qual tela e o que você esperava?"></textarea></label>
   <p class="sm muted">Primeira resposta em até ${SLA_H[o.plan]} no plano ${esc(PLANS[o.plan].name)}.</p>`,
   onSubmit:f=>{const t={id:'S-'+(1049+o.tickets.length-4),title:f.title.trim(),cat:f.cat,status:'Aberto',by:ME,prio:f.prio,opened:now(),msgs:[{who:'me',text:f.desc.trim(),t:now()}]};o.tickets.unshift(t);S.v.stab='tickets';S.v.tfilter='abertos';
     toast(`Chamado <b>${t.id}</b> aberto`,{icon:'life-buoy',act:'open-ticket',id:t.id,actLabel:'Abrir'});refresh()}});
};

/* ---------- Planos e pagamentos ---------- */
const usersActive=()=>O().users.filter(u=>u.status==='Ativo').length;
VIEWS['planos']=()=>{
  const o=O(),f=S.v,pl=PLANS[o.plan],ann=f.billing==='anual',price=k=>PLANS[k].price*(ann?.8:1),total=o.seats*pl.price,open=o.invoices.find(i=>i.status==='Em aberto');
  const meter=(l,v,mx)=>`<div><div class="row sp sm" style="margin-bottom:5px"><span>${l}</span><b class="num">${v} de ${mx>=99?'ilimitados':mx}</b></div>${bar(mx>=99?.12:v/mx)}</div>`;
  const pipesUsed=Object.keys(PIPES).length;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Planos e pagamentos</h2></div></div>
   <div class="g g12"><section class="card hud s7"><div class="card-h"><div><span class="eyebrow">Plano atual</span><h3 style="font-size:20px">${esc(pl.name)}</h3></div>${bd('Ativo','ok')}</div>
     <div class="row wrap" style="gap:28px;align-items:flex-end;margin-bottom:18px"><div><div class="disp num" style="font-size:46px">${brl(total)}</div><div class="xs muted">por mês · ${o.seats} assentos × ${brl2(pl.price)}</div></div><div class="sm muted">Próxima cobrança em <b class="mut2">25/11/2026</b><br>${(open?`Fatura ${open.id} em aberto`:'Sem pendências')}</div></div>
     <div class="g" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${meter('Usuários (ativos e convites)',o.seats-seatsFree(),o.seats)}${meter('Instâncias de WhatsApp',o.inst.length,pl.wa)}${meter('Funis',pipesUsed,pl.pipes)}</div>
     <div class="row wrap" style="margin-top:18px"><button class="btn" data-act="buy-seats">${ic('user-plus')}Comprar assentos</button>${open?`<button class="btn pri" data-act="pay" data-id="${open.id}">${ic('qr-code')}Pagar fatura ${open.id}</button>`:''}</div></section>
    <section class="card s5"><div class="card-h"><div><span class="eyebrow">Forma de pagamento</span><h3>${esc(o.pay||'Pix')}</h3></div><button class="btn sm end" data-act="pay-method">Alterar</button></div>
     <div class="sm muted">${(o.pay||'Pix').startsWith('Cartão')?'Cobrança automática no dia 25 de cada mês.':(o.pay||'Pix')==='Boleto'?'O boleto é emitido 5 dias antes do vencimento.':'O código Pix é gerado a cada fatura. O plano continua ativo por 3 dias após o vencimento.'}</div>
     <div class="card" style="padding:12px;margin-top:14px">${ic('building-2')}<span class="sm" style="margin-left:6px">Nota fiscal enviada para <b>financeiro@exemplo.com.br</b></span></div></section></div>
   <section><div class="row sp wrap" style="margin-bottom:12px"><div><span class="eyebrow">Comparar</span><h3 style="font-size:16px">Escolha o plano da organização</h3></div><div class="seg"><button class="${!ann?'on':''}" data-act="billing" data-id="mensal">Mensal</button><button class="${ann?'on':''}" data-act="billing" data-id="anual">Anual · −20%</button></div></div>
    <div class="g" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${Object.keys(PLANS).map(k=>{const p=PLANS[k],cur=k===o.plan;return`<div class="card ${cur?'hud':''}" style="${cur?'border-color:var(--gold)':''}"><div class="row sp"><h3 class="disp" style="font-size:28px">${p.name}</h3>${cur?bd('Plano atual','gold'):k==='equipe'?bd('Mais escolhido','mute'):''}</div>
      <div style="margin:10px 0 14px"><span class="disp num" style="font-size:38px">${brl2(price(k))}</span><span class="xs muted"> por usuário/mês${ann?', cobrado por ano':''}</span></div><div class="col" style="gap:8px;margin-bottom:16px">${['Até '+p.users+' usuários',...p.feat].map(x=>`<div class="row sm" style="align-items:flex-start;gap:8px">${ic('check','up')}<span>${x}</span></div>`).join('')}</div>
      <button class="btn ${cur?'':'pri'}" style="width:100%" ${cur?'disabled':''} data-act="plan-change" data-id="${k}">${cur?'Plano atual':(PLANS[k].price>pl.price?'Fazer upgrade':'Mudar para este plano')}</button></div>`}).join('')}</div></section>
   <section class="card"><div class="card-h"><div><span class="eyebrow">Histórico</span><h3>Faturas</h3></div></div><div class="tbl-wrap" style="border:0"><table class="tbl" style="min-width:600px"><thead><tr><th>Fatura</th><th>Vencimento</th><th>Valor</th><th>Forma</th><th>Status</th><th></th></tr></thead><tbody>${o.invoices.map(i=>`<tr><td><b>${i.id}</b></td><td>${dm(i.date)}/${i.date.getFullYear()}</td><td class="num">${brl(i.amount)}</td><td class="sm">${esc(i.method)}</td><td>${bd(i.status,i.status==='Pago'?'ok':'warn')}</td><td style="text-align:right">${i.status==='Em aberto'?`<button class="btn sm pri" data-act="pay" data-id="${i.id}">Pagar</button>`:`<button class="btn sm ghost" data-act="inv-dl" data-id="${i.id}">${ic('download')}Recibo</button>`}</td></tr>`).join('')}</tbody></table></div></section>
   <p class="demo">Demonstração: nenhuma cobrança real é feita e nenhum dado de pagamento é coletado.</p></div>`;
};
ACT.billing=el=>{S.v.billing=el.dataset.id;refresh()};
ACT['inv-dl']=el=>toast(`Recibo da fatura ${esc(el.dataset.id)}: download simulado`,{icon:'download'});
ACT['plan-change']=el=>{
  const o=O(),k=el.dataset.id,np=PLANS[k],cur=PLANS[o.plan],act=usersActive();
  if(act>np.users)return dialog({title:'Não é possível mudar agora',sub:'Plano '+np.name,submit:'Entendi',body:`<p class="sm">O plano <b>${np.name}</b> permite até ${np.users} usuários e a organização tem ${act} ativos. Desative usuários antes de mudar.</p>`,onSubmit:()=>{}});
  if(o.inst.length>np.wa)return dialog({title:'Não é possível mudar agora',sub:'Plano '+np.name,submit:'Entendi',body:`<p class="sm">O plano <b>${np.name}</b> inclui ${np.wa} instância${np.wa>1?'s':''} de WhatsApp e há ${o.inst.length} conectadas. Remova instâncias antes de mudar.</p>`,onSubmit:()=>{}});
  const seats=Math.min(o.seats,np.users);
  dialog({title:np.price>cur.price?'Fazer upgrade':'Mudar de plano',sub:`${cur.name} para ${np.name}`,submit:'Confirmar mudança',body:`
   <div class="card" style="padding:14px"><div class="row sp sm"><span class="muted">Novo valor mensal</span><b class="num">${brl(seats*np.price)}</b></div><div class="row sp sm" style="margin-top:6px"><span class="muted">Assentos</span><b class="num">${seats}${seats<o.seats?' (limite do plano)':''}</b></div></div>
   <p class="sm muted">${np.price>cur.price?'O valor proporcional dos dias restantes entra na próxima fatura e os recursos novos ficam disponíveis na hora.':'A mudança vale a partir da próxima fatura. Recursos fora do novo plano ficam indisponíveis nessa data.'}</p>`,
   onSubmit:()=>{o.plan=k;o.seats=seats;toast(`Plano alterado para <b>${np.name}</b>`,{icon:'badge-check'});refresh();renderNav()}});
};
ACT['buy-seats']=()=>{
  const o=O(),pl=PLANS[o.plan],room=pl.users-o.seats;
  if(room<=0)return dialog({title:'Limite do plano',sub:'Comprar assentos',submit:'Ver planos',body:`<p class="sm">O plano <b>${pl.name}</b> chega a ${pl.users} usuários e todos os assentos já foram contratados. Faça upgrade para ampliar.</p>`,onSubmit:()=>{}});
  dialog({title:'Comprar assentos',sub:'Plano '+pl.name,submit:'Adicionar assentos',body:`<label class="fld">Quantidade (até ${room})<input class="in num" type="number" name="n" min="1" max="${room}" value="1" required></label><p class="sm muted">Cada assento custa ${brl2(pl.price)} por mês. A cobrança proporcional entra na próxima fatura.</p>`,
   onSubmit:f=>{const n=Math.min(room,Math.max(1,+f.n||1));o.seats+=n;toast(`${n} assento${n>1?'s':''} adicionado${n>1?'s':''}`,{icon:'user-plus'});refresh()}});
};
ACT['pay-method']=()=>{
  const o=O();
  dialog({title:'Forma de pagamento',sub:'Cobrança mensal',submit:'Salvar',body:`<label class="fld">Como pagar<select class="in" name="m">${['Pix','Cartão de crédito','Boleto'].map(m=>`<option ${(o.pay||'Pix')===m?'selected':''}>${m}</option>`).join('')}</select></label><p class="sm muted">Para cartão, os dados são informados no ambiente seguro do processador de pagamentos, nunca aqui.</p>`,onSubmit:f=>{o.pay=f.m;toast(`Forma de pagamento: <b>${esc(f.m)}</b>`,{icon:'credit-card'});refresh()}});
};
ACT.pay=el=>{
  const o=O(),inv=o.invoices.find(i=>i.id===el.dataset.id);
  dialog({title:`Pagar fatura ${inv.id}`,sub:'Pix · demonstração',submit:'Simular pagamento',body:`
   <div class="row wrap" style="gap:20px;align-items:center">${qrSvg(77)}<div class="col grow" style="min-width:220px"><div class="disp num" style="font-size:36px">${brl(inv.amount)}</div><div class="sm muted">Vencimento ${dm(inv.date)}/${inv.date.getFullYear()}</div><label class="fld">Pix copia e cola (exemplo)<input class="in" readonly value="EXEMPLO-PIX-${inv.id}-SEM-VALOR-REAL"></label></div></div>
   <p class="sm muted">Este QR Code é ilustrativo e não gera cobrança. O botão abaixo apenas simula a confirmação do pagamento.</p>`,
   onSubmit:()=>{inv.status='Pago';inv.method='Pix';toast(`Fatura <b>${inv.id}</b> paga. Obrigado!`,{icon:'badge-check'});refresh()}});
};

/* ---------- Perfil ---------- */
const PREFS_N=[['nConv','Nova conversa para mim'],['nSla','Conversa perto de estourar o SLA'],['nTasks','Tarefas do dia e atrasadas'],['nAch','Conquistas e desafios']];
VIEWS['perfil']=()=>{
  const o=O(),u=user(ME),g=o.g[ME],L=lvl(g.xp),P=S.prefs;
  const prow=(k,l,sub)=>`<div class="row sp"><div><b class="sm">${l}</b>${sub?`<div class="xs muted">${sub}</div>`:''}</div>${sw(P[k],'pref',k)}</div>`;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Meu perfil</h2></div></div>
   <div class="g g12"><form class="card s7 col" data-form="perfil" style="gap:16px"><div class="row">${avN(u.name,56)}<div class="grow"><b style="font-size:16px">${esc(u.name)}</b><div class="sm muted">${bd(u.role,roleTone(u.role))} nível ${L.n} · ${esc(L.title)}</div></div></div>
    <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Nome completo<input class="in" name="name" required maxlength="80" value="${esc(u.name)}"></label><label class="fld">Cargo<input class="in" name="cargo" maxlength="60" value="${esc(u.cargo)}"></label>
     <label class="fld">E-mail<input class="in" type="email" name="email" required value="${esc(u.email)}"></label><label class="fld">Telefone<input class="in" name="phone" value="${esc(u.phone||'(65) 99999-0000')}"></label></div>
    <label class="fld">Assinatura nas mensagens<input class="in" name="sig" maxlength="80" value="${esc(u.sig||u.name.split(' ')[0]+' · ALVO')}"></label>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="submit">${ic('check')}Salvar alterações</button></div></form>
    <section class="card s5 col" style="gap:16px"><div><span class="eyebrow">Aparência</span></div>
     <div class="row sp"><div><b class="sm">Tema</b><div class="xs muted">Comando é escuro; Claro é o padrão do sistema ALVO.</div></div><div class="seg"><button class="${S.ui.mode==='comando'?'on':''}" data-act="theme" data-id="comando">Comando</button><button class="${S.ui.mode==='claro'?'on':''}" data-act="theme" data-id="claro">Claro</button></div></div>
     ${prow('reduce','Reduzir animações','Para o anel orbital e os avisos de XP.')}${prow('rail','Menu lateral recolhido','Mostra só os ícones.')}</section></div>
   <div class="g g12"><section class="card s6 col" style="gap:14px"><div><span class="eyebrow">Notificações</span></div>${PREFS_N.map(p=>prow(p[0],p[1])).join('')}${prow('digest','Resumo diário por e-mail','Enviado às 8h30.')}</section>
    <section class="card s6 col" style="gap:14px"><div><span class="eyebrow">Gamificação e privacidade</span></div>${prow('rankVis','Aparecer no ranking dos colegas','Desligado, seu nome vira “Participante oculto” para os outros.')}${prow('pause','Modo pausa','Congela sequência e metas diárias em folgas e férias.')}
     <div><span class="eyebrow">Segurança</span></div>${prow('twofa','Verificação em duas etapas','Pedida em novos aparelhos.')}
     <div class="list"><div class="li">${ic('monitor')}<div class="grow sm"><b>Este navegador</b><div class="xs muted">Cuiabá · agora</div></div>${bd('Atual','ok')}</div><div class="li">${ic('smartphone')}<div class="grow sm"><b>iPhone</b><div class="xs muted">Cuiabá · ontem</div></div><button class="btn sm ghost" data-act="end-session">Encerrar</button></div></div></section></div></div>`;
};
FORMS.perfil=(form,d)=>{const u=user(ME);u.name=d.name.trim()||u.name;u.cargo=d.cargo.trim();u.email=d.email.trim();u.phone=d.phone;u.sig=d.sig;toast('Perfil atualizado',{icon:'check'});refresh()};
ACT['end-session']=el=>{el.closest('.li').remove();toast('Sessão encerrada',{icon:'log-out'})};
ACT.pref=el=>{
  const k=el.dataset.id;S.prefs[k]=!S.prefs[k];
  if(k==='rail'){S.ui.rail=S.prefs.rail;}
  if(k==='reduce')applyPrefs();
  if(k==='rankVis')O().g[ME].hidden=!S.prefs.rankVis;
  if(k==='pause')toast(S.prefs.pause?'Modo pausa ativado':'Modo pausa desativado',{icon:'pause'});
  savePrefs();applyPrefs();refresh();
};
