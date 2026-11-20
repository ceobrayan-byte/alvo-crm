/* ===== Dashboard executivo (proprietário, administrador e coordenador) =====
   Fonte: crm_dashboard (vendas registradas e efetivadas, metas individuais por ciclo, equipes e regiões; já filtrado pelo perfil no banco).
   Regras iguais às do Floot:
   * ciclo inicial do ranking: 01/10/2026 a 14/11/2026; depois, do dia 15 ao dia 14; antes de outubro, mês calendário;
   * meta do período = soma das metas individuais do ciclo;
   * corrida ordenada pelo % da meta; o Escritório fica fora da competição (sempre por último). */
const DX={d:null,loading:false,orgFor:null,cyc:null,from:'',to:'',team:'all',seller:'all',region:'all',cmp:true};
const DX_INI={start:'2026-10-01',end:'2026-11-14'};
const dxExec=()=>['Proprietário','Administrador','Coordenador'].includes(ROLE());
const dxIso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dxDay=s=>{const[y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
function dxCycle(date){
  const d=new Date(date.getFullYear(),date.getMonth(),date.getDate()),iso=dxIso(d),y=d.getFullYear(),m=d.getMonth();
  let start,end,kind='ciclo';
  if(iso>=DX_INI.start&&iso<=DX_INI.end){start=dxDay(DX_INI.start);end=dxDay(DX_INI.end);kind='inicial'}
  else if(iso<DX_INI.start){start=new Date(y,m,1);end=new Date(y,m+1,0);kind='mes'}
  else if(d.getDate()>=15){start=new Date(y,m,15);end=new Date(y,m+1,14)}
  else{start=new Date(y,m-1,15);end=new Date(y,m,14)}
  return{key:dxIso(start),start,end,kind};
}
const dxDD=d=>String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0');
const dxLabel=c=>c.kind==='mes'?['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][c.start.getMonth()]+'/'+c.start.getFullYear():`${dxDD(c.start)} a ${dxDD(c.end)}/${c.end.getFullYear()}`;
const dxCLabel=c=>c.kind==='inicial'?'Ciclo inicial · '+dxLabel(c):c.kind==='mes'?'Mês '+dxLabel(c):'Ciclo '+dxLabel(c);
const dxM=v=>{v=Number(v)||0;const a=Math.abs(v);return a>=1e6?'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi':a>=1e3?'R$ '+(v/1e3).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil':'R$ '+v.toLocaleString('pt-BR')};
const dxBRL=v=>'R$ '+(Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const dxPct=v=>v==null?'—':(v*100).toLocaleString('pt-BR',{maximumFractionDigits:1})+'%';
async function dxLoad(force){
  if(DX.loading||(DX.d&&!force&&DX.orgFor===S.orgId))return;DX.loading=true;
  try{DX.d=await rpc('crm_dashboard',{p_org:S.orgId});DX.orgFor=S.orgId}catch(e){fail(e)}finally{DX.loading=false;if(['visao-geral','metas','financeiro'].includes(S.view))refresh()}
}
function dxCycles(){const d=DX.d,now=dxCycle(new Date()),list=[now];let c=now;
  const first=d.sales.length?dxCycle(dxDay(d.sales[0].date)):now;
  for(let i=0;i<36&&c.start>first.start;i++){c=dxCycle(new Date(c.start.getFullYear(),c.start.getMonth(),c.start.getDate()-1));list.push(c)}return list}
const dxMem=id=>(DX.d.members.find(m=>m.id===id)||{});
const dxIsOffice=id=>dxMem(id).role==='PROPRIETARIO';
const dxName=id=>{const m=dxMem(id);return m.role==='PROPRIETARIO'?'Escritório':(m.name||user(id).name||'—')};
const dxShort=id=>{const n=dxName(id);if(n==='Escritório')return n;const p=n.toLowerCase().split(/\s+/).filter(Boolean);const w=p.length>1?[p[0],p[p.length-1]]:p;return w.map(x=>x[0].toUpperCase()+x.slice(1)).join(' ')};
const dxSum=a=>Math.round(a.reduce((t,s)=>t+Number(s.credit||0),0)*100)/100;
const dxUG=(id,c)=>{if(!c)return null;const g=DX.d.goals.find(x=>x.scope_type==='USER'&&x.scope_id===id&&String(x.start).slice(0,10)===c.key);return g?Number(g.target):null};
const dxInFilter=id=>{const m=dxMem(id);return(DX.seller==='all'||id===DX.seller)&&(DX.team==='all'||m.team_id===DX.team)&&(DX.region==='all'||m.region_id===DX.region)};
function dxFilterSales(range){return DX.d.sales.filter(s=>{const t=dxDay(s.date);return t>=range.start&&t<=range.end&&dxInFilter(s.seller)})}
/* quem entra na corrida: vendedores/coordenadores/escritório do filtro; inativos só se tiverem meta ou venda no período */
function dxPeople(c,sales){return DX.d.members.filter(m=>!['SUPORTE','FINANCEIRO'].includes(m.role)&&dxInFilter(m.id)&&(m.status==='ATIVO'||(dxUG(m.id,c)||0)>0||sales.some(s=>s.seller===m.id))).map(m=>m.id)
  .concat([...new Set(sales.map(s=>s.seller))].filter(id=>!DX.d.members.some(m=>m.id===id)))}
function dxGoal(c){if(!c)return null;const sales=dxFilterSales(c),ids=dxPeople(c,sales),g=ids.reduce((a,id)=>a+(dxUG(id,c)||0),0);return g>0?g:null}
/* ---------- gráficos ---------- */
function dxPace(cur,prev,range,prange,goal,isNow){
  const W=680,H=230,P={l:58,r:18,t:16,b:28},days=Math.round((range.end-range.start)/864e5)+1;
  const cum=(sales,r,n)=>{const arr=new Array(n).fill(0);sales.forEach(s=>{const i=Math.round((dxDay(s.date)-r.start)/864e5);if(i>=0&&i<n)arr[i]+=Number(s.credit||0)});for(let i=1;i<n;i++)arr[i]+=arr[i-1];return arr};
  const today=isNow?Math.min(days-1,Math.floor((new Date()-range.start)/864e5)):days-1;
  const a=cum(cur,range,days).map((v,i)=>i<=today?v:null),b=prev?cum(prev,prange,days):null;
  const max=Math.max(goal||0,...a.filter(v=>v!=null),...(b||[0]),1)*1.08,x=i=>P.l+(W-P.l-P.r)*i/Math.max(1,days-1),y=v=>H-P.b-(H-P.t-P.b)*v/max;
  const path=arr=>arr.map((v,i)=>v==null?'':(i&&arr[i-1]!=null?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join('');
  const last=a.reduce((p,v,i)=>v!=null?i:p,0),area=path(a)+`L${x(last).toFixed(1)} ${y(0)}L${x(0)} ${y(0)}Z`;
  const ticks=[0,.25,.5,.75,1].map(f=>max/1.08*f),dayAt=i=>{const d=new Date(range.start);d.setDate(d.getDate()+i);return d};
  const xl=[0,Math.round((days-1)/3),Math.round((days-1)*2/3),days-1];
  return`<svg viewBox="0 0 ${W} ${H}" class="dxsvg" role="img" aria-label="Crédito acumulado no período">
   <defs><linearGradient id="dzg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--c1)" stop-opacity=".28"/><stop offset="1" stop-color="var(--c1)" stop-opacity="0"/></linearGradient></defs>
   ${ticks.map(t=>`<line x1="${P.l}" x2="${W-P.r}" y1="${y(t)}" y2="${y(t)}" class="dxgrid"/><text x="${P.l-8}" y="${y(t)+4}" class="dxax" text-anchor="end">${t?dxM(t).replace('R$ ',''):'0'}</text>`).join('')}
   ${goal?`<path d="M${x(0)} ${y(0)}L${x(days-1)} ${y(goal)}" class="dxgoal"/><text x="${W-P.r}" y="${y(goal)-7}" class="dxax" text-anchor="end">meta ${dxM(goal)}</text>`:''}
   ${b?`<path d="${path(b)}" class="dxl2"/>`:''}<path d="${area}" fill="url(#dzg)"/><path d="${path(a)}" class="dxl1"/>
   <circle cx="${x(last)}" cy="${y(a[last]||0)}" r="4.5" class="dxdot"/>
   ${xl.map((i,k)=>`<text x="${x(i)}" y="${H-8}" class="dxax" text-anchor="${k===0?'start':k===xl.length-1?'end':'middle'}">${dm(dayAt(i))}</text>`).join('')}
   ${a.map((v,i)=>`<rect x="${(x(i)-(W-P.l-P.r)/days/2).toFixed(1)}" y="${P.t}" width="${((W-P.l-P.r)/days).toFixed(1)}" height="${H-P.t-P.b}" fill="transparent" data-tip="${esc(dm(dayAt(i)))}|Acumulado: ${v==null?'—':esc(dxBRL(v))}${goal?'|Ritmo ideal: '+esc(dxM(goal*(i+1)/days)):''}${b?'|Período anterior: '+esc(dxM(b[i])):''}"/>`).join('')}
  </svg>`;
}
function dxBars(rows,goalOf){
  const max=Math.max(1,...rows.map(r=>Math.max(r.v,goalOf?goalOf(r)||0:0)));
  return`<div class="dzbars">${rows.map(r=>{const g=goalOf?goalOf(r):null;return`<div class="dzbar" data-tip="${esc(r.label)}|${esc(dxBRL(r.v))}${r.n!=null?' · '+r.n+' venda(s)':''}${g?'|Meta: '+esc(dxBRL(g))+' · '+dxPct(r.v/g):''}">
    <div class="row sp"><span class="sm nm">${esc(r.label)}</span><span class="sm num"><b>${esc(dxM(r.v))}</b>${g?` <span class="xs muted">/ ${esc(dxM(g))}</span>`:''}</span></div>
    <div class="trk"><i style="width:${(r.v/max*100).toFixed(1)}%"></i>${g?`<b class="gt" style="left:${Math.min(100,g/max*100).toFixed(1)}%"></b>`:''}</div></div>`}).join('')||'<div class="xs muted" style="padding:10px 0">Sem vendas no período.</div>'}</div>`;
}
/* pódio digital (usado também no ranking de Metas) */
function dxPodium(top){if(!top.length)return'';const ord=[1,0,2].filter(i=>top[i]);
  return`<div class="dzpod">${ord.map(i=>{const t=top[i];return`<div class="dzp p${i+1}">
    <div class="ring" style="--p:${Math.max(2,Math.min(100,(t.p||0)*100)).toFixed(0)}">${avN(t.name,i===0?64:54)}</div>
    <b class="sm nm">${esc(t.label)}</b>${t.sub?`<span class="xs muted nm">${esc(t.sub)}</span>`:''}
    <span class="pv num">${esc(t.big)}</span><span class="xs muted num">${t.small}</span>
    <div class="pil"><span class="rk">0${i+1}</span></div></div>`}).join('')}</div>`}
function dxGauge(p){const r=52,c=2*Math.PI*r,v=Math.max(0,Math.min(1,p));
  return`<div class="dzgauge"><svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true"><defs><linearGradient id="dzgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E2BE84"/><stop offset="1" stop-color="#C48A2C"/></linearGradient></defs>
   <circle cx="75" cy="75" r="66" fill="none" stroke="var(--line2)" stroke-width="1" stroke-dasharray="2 5"/>
   <circle cx="75" cy="75" r="${r}" fill="none" stroke="color-mix(in srgb,var(--ink) 10%,transparent)" stroke-width="12"/>
   <circle cx="75" cy="75" r="${r}" fill="none" stroke="url(#dzgg)" stroke-width="12" stroke-linecap="round" stroke-dasharray="${(c*v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 75 75)"/></svg>
   <div class="gv"><b class="num">${dxPct(p)}</b><span class="xs muted">da meta</span></div></div>`}
/* ---------- tela ---------- */
function dxExecView(){
  dxLoad();const d=DX.d,o=O();
  if(!d)return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Dashboard</h2></div></div><div class="card"><div class="xs muted">Carregando dados…</div></div></div>`;
  const cycles=dxCycles();if(!DX.cyc||(DX.cyc!=='custom'&&!cycles.some(c=>c.key===DX.cyc)))DX.cyc=cycles[0].key;
  const custom=DX.cyc==='custom',cyc=custom?null:cycles.find(c=>c.key===DX.cyc),ci=cycles.indexOf(cyc);
  const range=custom?{start:DX.from?dxDay(DX.from):cycles[cycles.length-1].start,end:DX.to?dxDay(DX.to):new Date()}:cyc;
  const prevC=custom?null:(cycles[ci+1]||null);
  const sales=dxFilterSales(range),prev=prevC?dxFilterSales(prevC):null,real=dxSum(sales),goal=custom?null:dxGoal(cyc);
  const pct=goal?real/goal:null,prevReal=prev?dxSum(prev):null,delta=prevReal&&prevC&&prevC.kind!=='mes'&&cyc.kind!=='mes'?((real-prevReal)/prevReal):null;
  const isNow=!custom&&ci===0,days=Math.round((range.end-range.start)/864e5)+1,dayN=isNow?Math.min(days,Math.floor((new Date()-range.start)/864e5)+1):days;
  const daysLeft=isNow?Math.max(0,days-dayN+1):0,expected=goal&&isNow?goal*dayN/days:null,gap=goal?Math.max(0,goal-real):null;
  const teams=d.teams,regions=d.regions;
  /* corrida da meta */
  const people=dxPeople(cyc,sales);
  const race=people.map(id=>{const own=sales.filter(s=>s.seller===id),t=dxSum(own),g=custom?null:dxUG(id,cyc);return{id,label:dxShort(id),full:dxName(id),office:dxIsOffice(id),t,n:own.length,g:g||null,pct:g?t/g:null,team:(teams.find(x=>x.id===dxMem(id).team_id)||{}).name||'',inactive:dxMem(id).status==='INATIVO'}})
    .filter(r=>r.t>0||r.g||!r.inactive)
    .sort((a,b)=>a.office!==b.office?(a.office?1:-1):(a.pct==null)!==(b.pct==null)?(a.pct==null?1:-1):(b.pct||0)-(a.pct||0)||b.t-a.t||a.label.localeCompare(b.label,'pt-BR'));
  const raceMax=Math.max(1,...race.map(r=>r.pct||0));
  let pos=0;
  const rankT=teams.map(t=>{const ids=d.members.filter(m=>m.team_id===t.id).map(m=>m.id),ss=sales.filter(s=>ids.includes(s.seller));return{label:t.coordinator?dxShort(t.coordinator):t.name,v:dxSum(ss),n:ss.length,g:custom?null:(ids.reduce((a,id)=>a+(dxUG(id,cyc)||0),0)||null)}}).filter(r=>r.v||r.g).sort((a,b)=>b.v-a.v);
  const rankR=regions.map(r=>{const ids=d.members.filter(m=>m.region_id===r.id).map(m=>m.id),ss=sales.filter(s=>ids.includes(s.seller));return{label:r.name,v:dxSum(ss),n:ss.length,g:custom?null:(ids.reduce((a,id)=>a+(dxUG(id,cyc)||0),0)||null)}}).filter(r=>r.v||r.g).sort((a,b)=>b.v-a.v);
  const byAdm={};sales.forEach(s=>{const k=s.adm||'—';byAdm[k]=byAdm[k]||{v:0,n:0};byAdm[k].v+=Number(s.credit||0);byAdm[k].n++});
  const rankA=Object.entries(byAdm).map(([k,x])=>({label:k,v:Math.round(x.v*100)/100,n:x.n})).sort((a,b)=>b.v-a.v);
  const sellersSel=[...new Set(d.members.filter(m=>!['SUPORTE','FINANCEIRO'].includes(m.role)&&(DX.team==='all'||m.team_id===DX.team)&&(m.status==='ATIVO'||d.sales.some(s=>s.seller===m.id))).map(m=>m.id))].sort((a,b)=>dxName(a).localeCompare(dxName(b),'pt-BR'));
  const status=custom?'período personalizado':isNow?`dia ${dayN} de ${days} · ${daysLeft} dia(s) para fechar`:'encerrado';
  const tone=pct==null?'':pct>=1?'ok':expected&&real>=expected?'ok':isNow?'warn':'bad';
  const list=sales.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))||String(b.id).localeCompare(String(a.id)));
  const LIM=DX.all?list.length:8;
  return`<div class="pg dz">
   <div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · ${d.scope==='ORGANIZACAO'?'visão executiva':'sua equipe'}</div><h2>Dashboard</h2></div>
    <button class="btn sm" data-act="dx-reload" title="Atualizar dados">${ic('refresh-cw')}Atualizar</button></div>
   <div class="dzfil">
    <select class="in" data-chg="dx-cyc" aria-label="Período">${cycles.map((c,i)=>`<option value="${c.key}" ${c.key===DX.cyc?'selected':''}>${esc(dxCLabel(c))}${i===0?' · atual':''}</option>`).join('')}<option value="custom" ${custom?'selected':''}>Período personalizado…</option></select>
    ${custom?`<input class="in" type="date" id="dxfrom" value="${esc(DX.from)}" aria-label="De"><input class="in" type="date" id="dxto" value="${esc(DX.to)}" aria-label="Até">`:''}
    ${teams.length>1?`<select class="in" data-chg="dx-team" aria-label="Coordenador"><option value="all">Todas as equipes</option>${teams.map(t=>`<option value="${t.id}" ${DX.team===t.id?'selected':''}>${esc(t.name)}</option>`).join('')}</select>`:''}
    <select class="in" data-chg="dx-seller" aria-label="Vendedor"><option value="all">Todos os vendedores</option>${sellersSel.map(id=>`<option value="${id}" ${DX.seller===id?'selected':''}>${esc(dxName(id))}</option>`).join('')}</select>
    ${regions.length>1&&d.scope==='ORGANIZACAO'?`<select class="in" data-chg="dx-region" aria-label="Região"><option value="all">Todas as regiões</option>${regions.map(r=>`<option value="${r.id}" ${DX.region===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select>`:''}
    ${DX.team!=='all'||DX.seller!=='all'||DX.region!=='all'?`<button class="btn sm ghost" data-act="dx-clear">${ic('x')}Limpar filtros</button>`:''}
   </div>
   <div class="dzhero">
    <div class="card dzmain">
     <div class="dzgrid-bg" aria-hidden="true"></div>
     <div class="eyebrow">${esc(custom?dxLabel({kind:'x',start:range.start,end:range.end}):dxCLabel(cyc))}</div>
     <div class="dzhero-in">
      <div class="grow" style="min-width:0">
       <div class="xs muted" style="margin-top:10px">Realizado · vendas efetivadas</div>
       <div class="dzbig num">${esc(dxBRL(real))}</div>
       <div class="row wrap" style="gap:8px;margin-top:4px"><span class="dztag">${ic('receipt')}${sales.length} venda${sales.length===1?'':'s'}</span>${sales.length?`<span class="dztag">${ic('ticket')}ticket ${esc(dxM(real/sales.length))}</span>`:''}${delta!=null?`<span class="dztag ${delta>=0?'up':'down'}">${ic(delta>=0?'trending-up':'trending-down')}${Math.abs(Math.round(delta*100))}% vs ciclo anterior</span>`:''}</div>
       ${goal?`<div class="dzprog"><div class="trk"><i class="${tone}" style="width:${Math.min(100,pct*100).toFixed(1)}%"></i>${expected?`<b class="exp" style="left:${Math.min(100,expected/goal*100).toFixed(1)}%" title="Onde deveria estar hoje"></b>`:''}</div>
        <div class="row sp xs muted"><span>0</span>${expected?`<span>▲ ritmo ideal hoje ${esc(dxM(expected))}</span>`:''}<span>${esc(dxM(goal))}</span></div></div>`:`<div class="xs muted" style="margin-top:14px">${custom?'Metas valem por ciclo completo; escolha um ciclo para ver o atingimento.':'Nenhuma meta individual cadastrada para este ciclo/filtro.'}</div>`}
      </div>
      ${goal?dxGauge(pct):''}
     </div>
    </div>
    <div class="dzside">
     <div class="card dztile"><span class="ti">${ic('target')}</span><div><span class="xs muted">Meta do período</span><b class="num">${goal?esc(dxBRL(goal)):'Não definida'}</b><span class="xs muted">${goal?'soma das metas individuais':'cadastre em Metas e conquistas'}</span></div></div>
     <div class="card dztile ${gap===0?'ok':''}"><span class="ti">${ic(gap===0?'trophy':'flag')}</span><div><span class="xs muted">Falta para a meta</span><b class="num">${gap==null?'—':gap===0?'Meta batida':esc(dxBRL(gap))}</b><span class="xs muted">${isNow&&gap?'precisa de '+esc(dxM(gap/Math.max(1,daysLeft)))+' por dia até '+dxDD(range.end):goal?dxPct(pct)+' atingido':''}</span></div></div>
     <div class="card dztile"><span class="ti">${ic('history')}</span><div><span class="xs muted">${prevC?(prevC.kind==='mes'?'Mês':'Ciclo')+' anterior':'Comparação'}</span><b class="num">${prevReal!=null?esc(dxBRL(prevReal)):'—'}</b><span class="xs muted">${prevC?esc(dxLabel(prevC)):''}</span></div></div>
    </div>
   </div>
   <div class="card">
    <div class="row sp wrap"><div><b>Corrida da meta</b><div class="xs muted">Ordem pelo % da meta do ciclo · Escritório fora da competição</div></div><span class="dzchip">${race.filter(r=>!r.office).length} na disputa</span></div>
    ${dxPodium(race.filter(r=>!r.office&&(r.t>0||r.pct)).slice(0,3).map(r=>({name:r.full,label:r.label,sub:r.team,big:r.g?dxPct(r.pct):dxM(r.t),small:r.g?esc(dxM(r.t))+' de '+esc(dxM(r.g)):r.n+' venda(s)',p:r.pct||0})))}
    <div class="dzrace">${race.map(r=>{const p=r.pct||0,w=Math.min(100,p/Math.max(1,raceMax)*100);if(!r.office)pos++;
      return`<div class="dzlane ${r.office?'office':''} ${r.id===ME?'me':''}" data-tip="${esc(r.full)}|${esc(dxBRL(r.t))} · ${r.n} venda(s)${r.g?'|Meta: '+esc(dxBRL(r.g))+' · '+dxPct(r.pct):'|Sem meta no ciclo'}">
       <span class="pos">${r.office?'':pos+'º'}</span>${avN(r.full,34)}
       <div class="who"><b class="sm">${esc(r.label)}</b><span class="xs muted">${r.office?'Fora da competição':esc(r.team||'Sem equipe')}${r.inactive?' · inativo':''}</span></div>
       <div class="trk"><i style="width:${w.toFixed(1)}%"></i>${r.g?`<b class="gt" style="left:${Math.min(100,100/Math.max(1,raceMax)).toFixed(1)}%"></b>`:''}</div>
       <div class="res"><b class="sm num">${r.g?dxPct(r.pct):'sem meta'}</b><span class="xs muted num">${esc(dxM(r.t))}${r.g?' de '+esc(dxM(r.g)):''}</span></div></div>`}).join('')||'<div class="xs muted" style="padding:10px 0">Ninguém neste filtro.</div>'}</div>
   </div>
   <div class="dzgrid">
    <div class="card"><div class="row sp wrap"><b>Ritmo do ${custom?'período':prevC&&cyc.kind==='mes'?'mês':'ciclo'}</b><span class="xs muted dxleg"><i class="k1"></i>acumulado${goal?'<i class="kg"></i>ritmo ideal até a meta':''}${DX.cmp&&prev?'<i class="k2"></i>período anterior':''}</span></div>
     ${dxPace(sales,DX.cmp&&!custom?prev:null,range,prevC,goal,isNow)}
     ${custom?'':`<label class="row xs muted" style="gap:6px;margin-top:6px"><input type="checkbox" data-chg="dx-cmp" ${DX.cmp?'checked':''}>comparar com o período anterior</label>`}</div>
    <div class="card"><b>${d.scope==='ORGANIZACAO'&&rankT.length>1?'Equipes (coordenadores)':'Administradoras'}</b>
     ${d.scope==='ORGANIZACAO'&&rankT.length>1?dxBars(rankT,r=>r.g)+`<div class="dzsub"><b class="sm">Administradoras</b></div>`+dxBars(rankA):dxBars(rankA)}
     ${d.scope==='ORGANIZACAO'&&rankR.length>1?`<div class="dzsub"><b class="sm">Regiões</b></div>${dxBars(rankR,r=>r.g)}`:''}</div>
   </div>
   <div class="card"><div class="row sp wrap"><div><b>Vendas efetivadas no período</b><div class="xs muted">${sales.length} venda(s) · ${esc(dxBRL(real))}</div></div></div>
    <div class="tbl-wrap" style="margin-top:10px"><table class="tbl dztbl"><thead><tr><th>Cliente</th><th>Vendedor</th><th>Data</th><th>Administradora</th><th>Grupo / cota</th><th style="text-align:right">Crédito</th></tr></thead><tbody>
     ${list.slice(0,LIM).map(s=>`<tr><td><b class="sm">${esc(s.client||'—')}</b></td><td class="sm">${esc(dxShort(s.seller))}</td><td class="sm num">${esc(String(s.date).slice(0,10).split('-').reverse().join('/'))}</td><td class="sm">${esc(s.adm||'—')}${s.product?`<div class="xs muted">${esc(s.product)}</div>`:''}</td><td class="sm num">${esc((s.grp||'—')+' / '+(s.quota||'—'))}</td><td class="num" style="text-align:right">${esc(dxBRL(s.credit))}</td></tr>`).join('')||'<tr><td colspan="6" class="muted sm">Nenhuma venda efetivada no período.</td></tr>'}
    </tbody></table></div>
    ${list.length>8?`<button class="btn sm ghost" style="margin-top:8px" data-act="dx-all">${DX.all?'Mostrar menos':'Ver todas as '+list.length+' vendas'}</button>`:''}
   </div>
  </div>`;
}
const DX_OLD=VIEWS['visao-geral'];
VIEWS['visao-geral']=()=>LIVE&&dxExec()?dxExecView():DX_OLD();
ACT['dx-reload']=async()=>{await dxLoad(true);toast('Dashboard atualizado',{icon:'refresh-cw'})};
ACT['dx-clear']=()=>{DX.team='all';DX.seller='all';DX.region='all';refresh()};
ACT['dx-all']=()=>{DX.all=!DX.all;refresh()};
CHG['dx-cyc']=el=>{DX.cyc=el.value;refresh()};CHG['dx-team']=el=>{DX.team=el.value;DX.seller='all';refresh()};CHG['dx-seller']=el=>{DX.seller=el.value;refresh()};
CHG['dx-region']=el=>{DX.region=el.value;refresh()};CHG['dx-cmp']=el=>{DX.cmp=el.checked;refresh()};
document.addEventListener('change',ev=>{const t=ev.target;if(t&&(t.id==='dxfrom'||t.id==='dxto')){DX[t.id==='dxfrom'?'from':'to']=t.value;refresh()}});
/* dica ao passar o mouse nos gráficos */
(function(){let tip=null;
  document.addEventListener('mouseover',ev=>{const el=ev.target.closest&&ev.target.closest('[data-tip]');if(!el){if(tip)tip.style.display='none';return}
    if(!tip){tip=document.createElement('div');tip.className='dxtip';document.body.appendChild(tip)}
    const p=el.getAttribute('data-tip').split('|');tip.innerHTML=`<b>${esc(p[0])}</b>${p.slice(1).map(x=>`<div>${esc(x)}</div>`).join('')}`;tip.style.display='block'});
  document.addEventListener('mousemove',ev=>{if(tip&&tip.style.display==='block'){const w=tip.offsetWidth;tip.style.left=Math.min(innerWidth-w-8,ev.clientX+14)+'px';tip.style.top=(ev.clientY+14)+'px'}});
})();
