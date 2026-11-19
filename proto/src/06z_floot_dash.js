/* ===== Dashboard executivo (proprietário, administrador e coordenador) =====
   Fonte: crm_dashboard (vendas efetivadas, metas por ciclo, equipes e regiões, já filtrados pelo perfil no banco). */
const DX={d:null,loading:false,orgFor:null,cyc:null,from:'',to:'',team:'all',seller:'all',region:'all',cmp:true};
const dxExec=()=>['Proprietário','Administrador','Coordenador'].includes(ROLE());
const dxIso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const dxDay=s=>{const[y,m,d]=String(s).slice(0,10).split('-').map(Number);return new Date(y,m-1,d)};
function dxCycle(date,sd){const d=new Date(date);let y=d.getFullYear(),m=d.getMonth();if(d.getDate()<sd){m--;if(m<0){m=11;y--}}const start=new Date(y,m,sd),end=new Date(y,m+1,sd-1);return{key:dxIso(start),start,end}}
const dxLabel=c=>`${String(c.start.getDate()).padStart(2,'0')}/${String(c.start.getMonth()+1).padStart(2,'0')} – ${String(c.end.getDate()).padStart(2,'0')}/${String(c.end.getMonth()+1).padStart(2,'0')}/${c.end.getFullYear()}`;
const dxM=v=>{v=Number(v)||0;return v>=1e6?'R$ '+(v/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi':v>=1e3?'R$ '+Math.round(v/1e3).toLocaleString('pt-BR')+' mil':'R$ '+v.toLocaleString('pt-BR')};
async function dxLoad(force){
  if(DX.loading||(DX.d&&!force&&DX.orgFor===S.orgId))return;DX.loading=true;
  try{DX.d=await rpc('crm_dashboard',{p_org:S.orgId});DX.orgFor=S.orgId}catch(e){fail(e)}finally{DX.loading=false;if(S.view==='visao-geral')refresh()}
}
function dxCycles(){const d=DX.d,sd=d.cycle_start_day||15,now=dxCycle(new Date(),sd),list=[now];let c=now;
  const first=d.sales.length?dxCycle(dxDay(d.sales[0].date),sd):now;
  for(let i=0;i<24&&c.start>first.start;i++){c=dxCycle(new Date(c.start.getFullYear(),c.start.getMonth(),sd-1),sd);list.push(c)}return list}
const dxMem=id=>(DX.d.members.find(m=>m.id===id)||{});
const dxName=id=>{const m=dxMem(id);return m.role==='PROPRIETARIO'?'Escritório':(m.name||user(id).name||'—')};
function dxFilterSales(range){const d=DX.d;return d.sales.filter(s=>{const dt=dxDay(s.date);if(dt<range.start||dt>range.end)return false;const m=dxMem(s.seller);
  return(DX.seller==='all'||s.seller===DX.seller)&&(DX.team==='all'||m.team_id===DX.team)&&(DX.region==='all'||m.region_id===DX.region)})}
function dxGoal(c){if(!c)return null;const g=DX.d.goals.filter(x=>String(x.start).slice(0,10)===c.key);const ug=id=>{const x=g.find(y=>y.scope_type==='USER'&&y.scope_id===id);return x?Number(x.target):0};
  if(DX.seller!=='all')return ug(DX.seller)||null;
  const mem=DX.d.members.filter(m=>(DX.team==='all'||m.team_id===DX.team)&&(DX.region==='all'||m.region_id===DX.region));
  if(DX.team!=='all'||DX.region!=='all'||DX.d.scope!=='ORGANIZACAO'){const s=mem.reduce((a,m)=>a+ug(m.id),0);return s||null}
  const o=g.find(x=>x.scope_type==='ORG');return o?Number(o.target):(c.key===dxCycles()[0].key?(Number(DX.d.org_goal)||null):null)}
const dxSum=a=>a.reduce((t,s)=>t+Number(s.credit||0),0);
/* gráficos em SVG (marcas finas, eixo único, rótulos seletivos, dica ao passar o mouse) */
function dxPace(cur,prev,range,prange,goal){
  const W=640,H=220,P={l:56,r:16,t:14,b:26},days=Math.round((range.end-range.start)/864e5)+1;
  const cum=(sales,r)=>{const arr=new Array(days).fill(0);sales.forEach(s=>{const i=Math.round((dxDay(s.date)-r.start)/864e5);if(i>=0&&i<days)arr[i]+=Number(s.credit||0)});for(let i=1;i<days;i++)arr[i]+=arr[i-1];return arr};
  const today=Math.min(days-1,Math.floor((new Date()-range.start)/864e5));const a=cum(cur,range).map((v,i)=>i<=today?v:null),b=prev?cum(prev,prange):null;
  const max=Math.max(goal||0,...a.filter(v=>v!=null),...(b||[0]),1)*1.08,x=i=>P.l+(W-P.l-P.r)*i/Math.max(1,days-1),y=v=>H-P.b-(H-P.t-P.b)*v/max;
  const path=arr=>arr.map((v,i)=>v==null?'':(i&&arr[i-1]!=null?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1)).join('');
  const ticks=[0,.25,.5,.75,1].map(f=>max/1.08*f);
  const last=a.reduce((p,v,i)=>v!=null?i:p,0);
  return`<svg viewBox="0 0 ${W} ${H}" class="dxsvg" role="img" aria-label="Crédito acumulado no ciclo">
   ${ticks.map(t=>`<line x1="${P.l}" x2="${W-P.r}" y1="${y(t)}" y2="${y(t)}" class="dxgrid"/><text x="${P.l-8}" y="${y(t)+4}" class="dxax" text-anchor="end">${dxM(t).replace('R$ ','')}</text>`).join('')}
   ${goal?`<line x1="${P.l}" x2="${W-P.r}" y1="${y(goal)}" y2="${y(goal)}" class="dxgoal"/><text x="${W-P.r}" y="${y(goal)-6}" class="dxax" text-anchor="end">meta ${dxM(goal)}</text>`:''}
   ${b?`<path d="${path(b)}" class="dxl2"/>`:''}<path d="${path(a)}" class="dxl1"/>
   <circle cx="${x(last)}" cy="${y(a[last]||0)}" r="4.5" class="dxdot"/>
   ${[0,Math.floor(days/2),days-1].map(i=>{const d=new Date(range.start);d.setDate(d.getDate()+i);return`<text x="${x(i)}" y="${H-6}" class="dxax" text-anchor="${i===0?'start':i===days-1?'end':'middle'}">${dm(d)}</text>`}).join('')}
   ${a.map((v,i)=>`<rect x="${x(i)-(W-P.l-P.r)/days/2}" y="${P.t}" width="${(W-P.l-P.r)/days}" height="${H-P.t-P.b}" fill="transparent" data-tip="${esc((()=>{const d=new Date(range.start);d.setDate(d.getDate()+i);return dm(d)})())}|Ciclo atual: ${v==null?'—':esc(dxM(v))}${b?'|Ciclo anterior: '+esc(dxM(b[i])):''}"/>`).join('')}
  </svg>`;
}
function dxBars(rows,fmt,goalOf){ // barras horizontais, uma cor (magnitude)
  const max=Math.max(1,...rows.map(r=>Math.max(r.v,goalOf?goalOf(r)||0:0)));
  return`<div class="dxbars">${rows.map(r=>{const g=goalOf?goalOf(r):null;return`<div class="dxbar" data-tip="${esc(r.label)}|${esc(fmt(r.v))}${g?'|Meta: '+esc(fmt(g))+' · '+Math.round(r.v/g*100)+'%':''}"><span class="lbl">${esc(r.label)}</span><span class="trk"><i style="width:${(r.v/max*100).toFixed(1)}%"></i>${g?`<b class="gt" style="left:${(g/max*100).toFixed(1)}%"></b>`:''}</span><span class="num">${esc(fmt(r.v))}${g?` <small class="muted">${Math.round(r.v/g*100)}%</small>`:''}</span></div>`}).join('')||'<div class="empty">Sem vendas no período.</div>'}</div>`;
}
function dxHist(cycles){ // últimos ciclos: barras verticais com marca de meta
  const W=640,H=200,P={l:12,r:12,t:16,b:30},cs=cycles.slice(0,6).reverse(),vals=cs.map(c=>dxSum(dxFilterSales(c))),goals=cs.map(c=>dxGoal(c)||0);
  const max=Math.max(1,...vals,...goals)*1.1,bw=(W-P.l-P.r)/cs.length,y=v=>H-P.b-(H-P.t-P.b)*v/max;
  return`<svg viewBox="0 0 ${W} ${H}" class="dxsvg" role="img" aria-label="Crédito por ciclo">${cs.map((c,i)=>{const x0=P.l+i*bw+bw*.22,w=bw*.56,v=vals[i],g=goals[i];
   return`<g data-tip="Ciclo ${esc(dxLabel(c))}|Realizado: ${esc(dxM(v))}${g?'|Meta: '+esc(dxM(g))+' · '+Math.round(v/g*100)+'%':''}"><rect x="${P.l+i*bw}" y="${P.t}" width="${bw}" height="${H-P.t-P.b}" fill="transparent"/>
    <path d="M${x0} ${H-P.b} V${y(v)+4} q0 -4 4 -4 h${w-8} q4 0 4 4 V${H-P.b} Z" class="${c.key===DX.cyc?'dxb1':'dxb0'}"/>
    ${g?`<line x1="${x0-4}" x2="${x0+w+4}" y1="${y(g)}" y2="${y(g)}" class="dxgoal"/>`:''}
    <text x="${x0+w/2}" y="${y(v)-6}" class="dxval" text-anchor="middle">${v?esc(dxM(v).replace('R$ ','')):''}</text>
    <text x="${x0+w/2}" y="${H-10}" class="dxax" text-anchor="middle">${String(c.start.getMonth()+1).padStart(2,'0')}/${String(c.start.getFullYear()).slice(2)}</text></g>`}).join('')}</svg>`;
}
function dxRing(p){const r=46,c=2*Math.PI*r,v=Math.max(0,Math.min(1,p));return`<svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="dxring0"/><circle cx="60" cy="60" r="${r}" class="dxring1" stroke-dasharray="${(c*v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 60 60)"/></svg>`}
function dxExecView(){
  dxLoad();const d=DX.d,o=O();
  if(!d)return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Dashboard</h2></div></div><div class="empty">Carregando…</div></div>`;
  const cycles=dxCycles();if(!DX.cyc||(DX.cyc!=='custom'&&!cycles.some(c=>c.key===DX.cyc)))DX.cyc=cycles[0].key;
  const custom=DX.cyc==='custom',cyc=custom?null:cycles.find(c=>c.key===DX.cyc),ci=cycles.indexOf(cyc);
  const range=custom?{start:DX.from?dxDay(DX.from):cycles[cycles.length-1].start,end:DX.to?dxDay(DX.to):new Date()}:cyc;
  const prevC=custom?null:(cycles[ci+1]||dxCycle(new Date(cyc.start.getFullYear(),cyc.start.getMonth(),(d.cycle_start_day||15)-1),d.cycle_start_day||15));
  const sales=dxFilterSales(range),prev=prevC?dxFilterSales(prevC):null,real=dxSum(sales),goal=custom?null:dxGoal(cyc);
  const pct=goal?real/goal:null,prevReal=prev?dxSum(prev):null,delta=prevReal?((real-prevReal)/prevReal):null;
  const isNow=!custom&&ci===0,daysLeft=isNow?Math.max(0,Math.ceil((cyc.end-new Date())/864e5)):0;
  const teams=d.teams,regions=d.regions,sellersAll=[...new Set(d.sales.map(s=>s.seller))];
  // rankings
  const bySeller={};sales.forEach(s=>{bySeller[s.seller]=(bySeller[s.seller]||0)+Number(s.credit||0)});
  const rankS=Object.entries(bySeller).map(([id,v])=>({id,label:dxName(id),v})).sort((a,b)=>b.v-a.v);
  const userGoal=id=>{if(custom)return null;const g=d.goals.find(x=>x.scope_type==='USER'&&x.scope_id===id&&String(x.start).slice(0,10)===cyc.key);return g?Number(g.target):null};
  const rankT=teams.map(t=>{const ids=d.members.filter(m=>m.team_id===t.id).map(m=>m.id);return{id:t.id,label:t.coordinator?dxName(t.coordinator):t.name,v:sales.filter(s=>ids.includes(s.seller)).reduce((a,s)=>a+Number(s.credit||0),0),g:ids.reduce((a,id)=>a+(userGoal(id)||0),0)||null}}).sort((a,b)=>b.v-a.v);
  const rankR=regions.map(r=>{const ids=d.members.filter(m=>m.region_id===r.id).map(m=>m.id);return{id:r.id,label:r.name,v:sales.filter(s=>ids.includes(s.seller)).reduce((a,s)=>a+Number(s.credit||0),0),g:ids.reduce((a,id)=>a+(userGoal(id)||0),0)||null}}).filter(r=>r.v||r.g).sort((a,b)=>b.v-a.v);
  const byAdm={};sales.forEach(s=>{const k=s.adm||'—';byAdm[k]=(byAdm[k]||0)+Number(s.credit||0)});
  const podium=rankS.slice(0,3),medal=['1º','2º','3º'],ord=[1,0,2].filter(i=>podium[i]);
  return`<div class="pg dx">
   <div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · ${d.scope==='ORGANIZACAO'?'visão executiva':'sua equipe'}</div><h2>Dashboard</h2></div><button class="btn sm" data-act="dx-reload">${ic('refresh-cw')}Atualizar</button></div>
   <div class="row wrap dxfil">
    <select class="in" data-chg="dx-cyc" aria-label="Ciclo">${cycles.map((c,i)=>`<option value="${c.key}" ${c.key===DX.cyc?'selected':''}>Ciclo ${dxLabel(c)}${i===0?' (atual)':''}</option>`).join('')}<option value="custom" ${custom?'selected':''}>Período personalizado…</option></select>
    ${custom?`<input class="in" type="date" id="dxfrom" value="${esc(DX.from)}" aria-label="De"><input class="in" type="date" id="dxto" value="${esc(DX.to)}" aria-label="Até">`:''}
    ${teams.length>1?`<select class="in" data-chg="dx-team" aria-label="Coordenador"><option value="all">Todos os coordenadores</option>${teams.map(t=>`<option value="${t.id}" ${DX.team===t.id?'selected':''}>${esc(t.coordinator?dxName(t.coordinator):t.name)}</option>`).join('')}</select>`:''}
    <select class="in" data-chg="dx-seller" aria-label="Vendedor"><option value="all">Todos os vendedores</option>${sellersAll.map(id=>`<option value="${id}" ${DX.seller===id?'selected':''}>${esc(dxName(id))}</option>`).join('')}</select>
    ${regions.length&&d.scope==='ORGANIZACAO'?`<select class="in" data-chg="dx-region" aria-label="Região"><option value="all">Todas as regiões</option>${regions.map(r=>`<option value="${r.id}" ${DX.region===r.id?'selected':''}>${esc(r.name)}</option>`).join('')}</select>`:''}
    ${custom?'':`<label class="row sm" style="gap:6px"><input type="checkbox" data-chg="dx-cmp" ${DX.cmp?'checked':''}>Comparar com o ciclo anterior</label>`}
   </div>
   <div class="dxkpi">
    <div class="card dxhero">${goal?dxRing(pct):''}<div><div class="xs muted">Atingimento ${goal?'da meta':''}</div><div class="disp dxbig">${goal?Math.round(pct*100)+'%':'—'}</div><div class="sm muted">${goal?esc(dxM(real))+' de '+esc(dxM(goal)):'sem meta para este filtro'}</div>${isNow&&goal&&real<goal?`<div class="xs muted" style="margin-top:6px">${daysLeft} dia(s) restantes · precisa de ${esc(dxM((goal-real)/Math.max(1,daysLeft)))}/dia</div>`:''}</div></div>
    <div class="card"><div class="xs muted">Meta</div><div class="disp dxmid">${goal?esc(dxM(goal)):'—'}</div><div class="xs muted">${custom?'período personalizado':'ciclo '+esc(dxLabel(cyc))}</div></div>
    <div class="card"><div class="xs muted">Realizado</div><div class="disp dxmid">${esc(dxM(real))}</div><div class="xs ${delta==null?'muted':delta>=0?'up':'down'}">${delta==null?'—':(delta>=0?'▲ ':'▼ ')+Math.abs(Math.round(delta*100))+'% vs ciclo anterior'}</div></div>
    <div class="card"><div class="xs muted">Saldo para a meta</div><div class="disp dxmid">${goal?esc(dxM(Math.max(0,goal-real))):'—'}</div><div class="xs muted">${goal&&real>=goal?'meta batida 🎯':''}</div></div>
    <div class="card"><div class="xs muted">Vendas · ticket médio</div><div class="disp dxmid">${sales.length}</div><div class="xs muted">${sales.length?esc(dxM(real/sales.length))+' por venda':'—'}</div></div>
   </div>
   <div class="dxgrid2">
    <div class="card"><div class="row sp"><b class="sm">Ritmo do ${custom?'período':'ciclo'}</b><span class="xs muted dxleg"><i class="k1"></i>${custom?'acumulado':'ciclo atual'}${DX.cmp&&prev?'<i class="k2"></i>ciclo anterior':''}${goal?'<i class="kg"></i>meta':''}</span></div>${dxPace(sales,DX.cmp&&!custom?prev:null,range,prevC,goal)}</div>
    <div class="card"><div class="row sp"><b class="sm">Últimos ciclos</b><span class="xs muted">crédito vendido · traço = meta</span></div>${dxHist(cycles)}</div>
   </div>
   <div class="dxgrid2">
    <div class="card"><b class="sm">Ranking de vendedores</b>
     ${podium.length?`<div class="podium">${ord.map(i=>`<div class="pod p${i+1}"><div class="pav">${avN(podium[i].label,i===0?52:42)}</div><b class="sm">${esc(podium[i].label)}</b><span class="xs muted num">${esc(dxM(podium[i].v))}</span><div class="pbase"><span>${medal[i]}</span></div></div>`).join('')}</div>`:''}
     ${dxBars(rankS,dxM,r=>userGoal(r.id))}</div>
    <div class="col" style="gap:18px">
     ${d.scope==='ORGANIZACAO'&&rankT.length?`<div class="card"><b class="sm">Ranking de coordenadores (equipes)</b>${dxBars(rankT,dxM,r=>r.g)}</div>`:''}
     ${d.scope==='ORGANIZACAO'&&rankR.length?`<div class="card"><b class="sm">Ranking de regiões</b>${dxBars(rankR,dxM,r=>r.g)}</div>`:''}
     <div class="card"><b class="sm">Crédito por administradora</b>${dxBars(Object.entries(byAdm).map(([k,v])=>({label:k,v})).sort((a,b)=>b.v-a.v),dxM)}</div>
    </div>
   </div>
   <details class="card"><summary class="sm"><b>Vendas do período (${sales.length})</b> — tabela</summary><div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Data</th><th>Cliente</th><th>Vendedor</th><th>Administradora</th><th>Crédito</th></tr></thead><tbody>${sales.slice().reverse().map(s=>`<tr><td class="sm num">${esc(String(s.date).slice(0,10).split('-').reverse().join('/'))}</td><td>${esc(s.client||'')}</td><td class="sm">${esc(dxName(s.seller))}</td><td class="sm">${esc(s.adm||'—')}</td><td class="num">${esc(fBRL(s.credit))}</td></tr>`).join('')}</tbody></table></div></details>
  </div>`;
}
const DX_OLD=VIEWS['visao-geral'];
VIEWS['visao-geral']=()=>LIVE&&dxExec()?dxExecView():DX_OLD();
ACT['dx-reload']=async()=>{await dxLoad(true);toast('Dashboard atualizado',{icon:'refresh-cw'})};
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
