/* ===== Estado, utilitários, componentes, gráficos e gamificação ===== */
const S={orgId:'matriz',orgs:{},view:'visao-geral',ui:{rail:false,mode:'comando',mnav:false,pop:null,drawer:null,modal:null,dlgSubmit:null},
  v:{pipe:'comercial',owner:'all',temp:'all',q:'',tag:'all',ctab:'minhas',conv:null,note:false,tasktab:'hoje',gtab:'metas',gscope:'indiv',rank:'ciclo',eqtab:'usuarios',billing:'mensal',sel:[],cchan:'all',stab:'tickets'}};
ORGDEFS.forEach(d=>{S.orgs[d.id]=genOrg(d)});
const O=()=>S.orgs[S.orgId];
const GHOST={id:'?',name:'Sem responsável',cargo:'',team:'—',role:'Vendedor',email:'',status:'Inativo',sell:false,last:new Date(0)};
const user=id=>O().users.find(u=>u.id===id)||GHOST;
const contact=id=>O().contacts.find(c=>c.id===id);
const deal=id=>O().deals.find(d=>d.id===id);
const conv=id=>O().convs.find(c=>c.id===id);
const inst=id=>O().inst.find(i=>i.id===id);
const ROLE=()=>user(ME).role;
const LV=mod=>{mod=({'kanban':'contatos','leads-frios':'contatos','clientes':'contatos'})[mod]||mod;const i=MODS.findIndex(m=>m[0]===mod);return i<0?3:(O().perms[ROLE()][i]||0)};
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const sum=a=>a.reduce((x,y)=>x+y,0);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const brl=v=>'R$ '+Math.round(v).toLocaleString('pt-BR');
const pct=(v,d=0)=>(v*100).toFixed(d).replace('.',',')+'%';
const pad=n=>String(n).padStart(2,'0');
const hm=d=>pad(d.getHours())+':'+pad(d.getMinutes());
const dm=d=>pad(d.getDate())+'/'+pad(d.getMonth()+1);
const sameDay=(a,b)=>a.toDateString()===b.toDateString();
const dayLbl=d=>{const n=now();if(sameDay(d,n))return'Hoje';if(sameDay(d,new Date(n.getTime()-D)))return'Ontem';if(sameDay(d,new Date(n.getTime()+D)))return'Amanhã';return dm(d)};
const rel=d=>{const m=Math.round((now()-d)/MIN);if(m<1)return'agora';if(m<60)return`há ${m} min`;const h=Math.round(m/60);if(h<24)return`há ${h} h`;const dd=Math.round(h/24);return dd===1?'ontem':`há ${dd} dias`};
const ic=(n,c='',fb='')=>`<i data-lucide="${n}" class="ic ${c}" data-fb="${fb}"></i>`;
const icons=()=>{try{window.lucide&&lucide.createIcons()}catch(e){}};
const AVC=['#C48A2C','#3F8F77','#9CC5B5','#E2BE84','#B9B1A3','#5BA58E'];
const avN=(name,sz=32)=>{const p=String(name).split(' ');const ini=(p[0][0]+(p[1]?p[1][0]:'')).toUpperCase();let h=0;for(const ch of name)h=(h*31+ch.charCodeAt(0))>>>0;return`<span class="av" style="width:${sz}px;height:${sz}px;background:${AVC[h%AVC.length]};font-size:${Math.round(sz*.38)}px" aria-hidden="true">${ini}</span>`};
const av=(id,sz=32)=>{const u=user(id);return u?avN(u.name,sz):avN('? ',sz)};
const tone=t=>({Quente:'bad',Morno:'warn',Frio:'info'}[t]||'mute');
const tempDot=t=>`<span class="temp" style="background:${{Quente:'var(--bad)',Morno:'var(--warn)',Frio:'var(--info)'}[t]||'var(--ink3)'}" title="${t}"></span>`;
const bd=(txt,t='mute',i='')=>`<span class="bd ${t}">${i?ic(i,'',''):''}${esc(txt)}</span>`;
const sw=(on,act,id='')=>`<button type="button" class="sw ${on?'on':''}" role="switch" aria-checked="${!!on}" data-act="${act}" data-id="${id}"></button>`;

/* ----- métricas derivadas (tudo vem do estado, nada é digitado à mão) ----- */
function metrics(){
  const o=O(), cm=o.deals.filter(d=>d.pipe==='comercial');
  const won=cm.filter(d=>d.stage==='ganho'&&d.wonAt&&d.wonAt>=CYCLE.start);
  const active=cm.filter(d=>!['ganho','perdido'].includes(d.stage));
  const stale=active.filter(d=>d.entered>7);
  const credit=sum(won.map(d=>d.value));
  const wpct=credit/o.goal, elapsed=CYCLE.bdDone/CYCLE.bdTotal;
  const open=o.convs.filter(c=>c.status==='aberta');
  const risk=open.filter(slaRisk);
  const mine=won.filter(d=>d.owner===ME);
  const myTarget=o.goal/Math.max(1,o.users.filter(u=>u.sell&&['Vendedor','Administrador','Gestor'].includes(u.role)).length);
  return{o,won,wonN:won.length,credit,goal:o.goal,wpct,elapsed,rhythm:elapsed?wpct/elapsed:0,left:Math.max(0,o.goal-credit),perDay:Math.max(0,o.goal-credit)/Math.max(1,CYCLE.bdTotal-CYCLE.bdDone),
    active,activeValue:sum(active.map(d=>d.value)),weighted:sum(active.map(d=>d.value*stageOf('comercial',d.stage).p)),stale,
    conv:cm.length?won.length/cm.length:0,open,risk,myCredit:sum(mine.map(d=>d.value)),myTarget,commission:sum(mine.map(d=>d.value))*0.015,
    newToday:o.convs.filter(c=>c.msgs[0].t>=new Date(NOW0.getFullYear(),NOW0.getMonth(),NOW0.getDate())).length};
}
function slaRisk(c){
  if(c.status!=='aberta')return false;const last=c.msgs[c.msgs.length-1];if(!last||last.dir!=='in')return false;
  const lim=(c.assignee?60:10); return (now()-last.t)/MIN>lim;
}
const windowOpen=c=>{const i=inst(c.instanceId);if(!i||i.kind!=='oficial')return true;return c.lastInAt&&(now()-c.lastInAt)<24*H};

/* ----- gamificação ----- */
function lvl(xp){let i=0;while(i<LEVELS.length-1&&xp>=LEVELS[i+1])i++;const nx=LEVELS[i+1]==null?null:LEVELS[i+1];return{n:i+1,title:TITLES[i],floor:LEVELS[i],next:nx,pct:nx==null?1:(xp-LEVELS[i])/(nx-LEVELS[i])}}
function achVal(a,g){const c=g.counters;switch(a.key){case'won':return c.won;case'fast':return c.fast;case'streak':return g.streak;case'docsClean':return c.docsClean;case'teamCh':return c.teamCh;case'tidyDays':return c.tidyDays;
  case'doubleWeek':return g.ach.includes('dupla')?1:0;case'cleanWallet':return g.ach.includes('carteira')?1:0;case'conv20':return metrics().conv>=.2?1:0;case'goalHit':return(metrics().myCredit/metrics().myTarget)>=1?1:0}return 0}
function checkAch(){const g=O().g[ME];ACH.forEach(a=>{if(g.ach.includes(a.id))return;if(achVal(a,g)>=a.target){g.ach.push(a.id);toast(`Conquista desbloqueada: <b>${esc(a.name)}</b>`,{xp:1,icon:a.icon,ms:6000})}})}
function award(key,o={}){
  const g=O().g[ME], rule=XP_RULES[key]; let xp=rule.xp;
  if(key==='venda')xp+=Math.min(250,Math.round((o.credit||0)/1000));
  const ck=now().toDateString()+key; g.caps[ck]=g.caps[ck]||0;
  if(rule.cap&&g.caps[ck]+xp>rule.cap){toast('Limite diário de XP desta ação atingido. O XP prioriza qualidade, não volume.',{icon:'gauge'});return 0}
  g.caps[ck]+=xp;const before=lvl(g.xp).n;g.xp+=xp;g.cycleXp+=xp;g.log.unshift({t:now(),label:rule.label,xp});
  toast(`<b>+${xp} XP</b> · ${esc(rule.label)}`,{xp:1,icon:'zap'});
  const a=lvl(g.xp);if(a.n>before)toast(`Nível ${a.n} · <b>${esc(a.title)}</b>`,{xp:1,icon:'award',ms:6000});
  checkAch();return xp;
}
function ranking(){const o=O();return o.users.filter(u=>o.g[u.id]&&u.sell).map(u=>({u,xp:o.g[u.id].cycleXp,credit:sum(o.deals.filter(d=>d.owner===u.id&&d.pipe==='comercial'&&d.stage==='ganho'&&d.wonAt>=CYCLE.start).map(d=>d.value)),lv:lvl(o.g[u.id].xp)})).sort((a,b)=>b.xp-a.xp)}

/* ----- ações de negócio ----- */
const stIdx=(pipe,id)=>PIPES[pipe].stages.findIndex(s=>s.id===id);
function moveDeal(id,stage){
  const d=deal(id);if(!d||d.stage===stage)return;
  const st=stageOf(d.pipe,stage);
  if(st.lost){return loseDialog(id)}
  const fwd=stIdx(d.pipe,stage)>stIdx(d.pipe,d.stage);
  if(st.won&&d.pipe==='comercial')return winDeal(id);
  d.stage=stage;d.entered=0;d.lost=false;
  toast(`Negócio movido para <b>${esc(st.label)}</b>`,{icon:'arrow-right'});
  if(fwd)award('avanco');
  refresh();
}
function winDeal(id){
  const d=deal(id),c=contact(d.contactId),g=O().g[ME];
  d.stage='ganho';d.wonAt=now();d.entered=0;d.lost=false;if(d.owner===ME)g.counters.won++;
  O().deals.push({id:'d'+(O().deals.length+1),contactId:c.id,pipe:'posvenda',stage:'doc',value:d.value,product:d.product,admin:d.admin,temp:'Morno',owner:d.owner,entered:0,lost:false,reason:'',wonAt:null,createdAt:now()});
  O().tasks.push({id:'t'+(O().tasks.length+1),title:`Coletar documentos · ${fname(c.name)}`,type:'documentos',due:new Date(now().getTime()+6*H),done:false,owner:d.owner,contactId:c.id,dealId:d.id,xp:5});
  toast(`Venda efetivada · <b>${brlK(d.value)}</b> com ${esc(fname(c.name))}. Caso criado no pós-venda.`,{icon:'badge-check',ms:5200,act:'go',id:'funis',actLabel:'Ver'});
  if(d.owner===ME)award('venda',{credit:d.value});
  refresh();
}
function loseDialog(id){
  const d=deal(id);
  dialog({title:'Marcar como perdido',sub:contact(d.contactId).name,submit:'Confirmar perda',
    body:`<label class="fld">Motivo<select class="in" name="reason"><option>Sem retorno do cliente</option><option>Optou por outra administradora</option><option>Sem renda comprovada</option><option>Preço acima do esperado</option><option>Desistiu do consórcio</option></select></label>
    <p class="sm muted">O negócio fica no funil, na coluna Perdido, e pode ser reaberto arrastando para outra etapa.</p>`,
    onSubmit:f=>{d.stage='perdido';d.lost=true;d.reason=f.reason;toast('Negócio marcado como perdido',{icon:'x'});refresh();redrawDrawer()}});
}

/* ----- overlays ----- */
function toast(msg,o={}){
  const el=document.createElement('div');el.className='toast'+(o.xp?' xp':'');el.setAttribute('role','status');
  el.innerHTML=`${ic(o.icon||'check')}<span class="grow">${msg}</span>${o.act?`<button class="btn sm" data-act="${o.act}" data-id="${o.id||''}">${o.actLabel}</button>`:''}`;
  const box=$('#toasts');while(box.children.length>=3)box.firstChild.remove();box.appendChild(el);icons();setTimeout(()=>el.remove(),o.ms||4200);
}
function redrawDrawer(){const d=$('#drawer');if(S.ui.drawer){d.innerHTML=S.ui.drawer();d.classList.add('open')}else d.classList.remove('open');$('#scrim').classList.toggle('open',!!(S.ui.drawer||S.ui.modal));icons()}
function openDrawer(fn){S.ui.drawer=fn;S.ui.pop=null;renderTop();redrawDrawer()}
function openModal(fn){S.ui.modal=fn;S.ui.pop=null;const m=$('#modal');m.innerHTML=fn();m.classList.add('open');$('#scrim').classList.add('open');icons();setTimeout(()=>{const f=$('#modal input:not([type=checkbox]),#modal select,#modal textarea');f&&f.focus()},40)}
function closeAll(){S.ui.drawer=null;S.ui.modal=null;S.ui.pop=null;const m=$('#modal');m.classList.remove('open');m.innerHTML='';$('#drawer').classList.remove('open');$('#scrim').classList.remove('open');renderTop()}
function closeModal(){S.ui.modal=null;const m=$('#modal');m.classList.remove('open');m.innerHTML='';$('#scrim').classList.toggle('open',!!S.ui.drawer)}
function dialog({title,sub='',body,submit='Salvar',wide=false,onSubmit}){
  S.ui.dlgSubmit=onSubmit;
  openModal(()=>`<div class="dlg ${wide?'wide':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><form data-form="dlg" class="col" style="gap:16px">
    <div class="row" style="align-items:flex-start"><div class="grow"><div class="eyebrow">${esc(sub)}</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(title)}</h3></div><button type="button" class="ibtn" data-act="close-modal" aria-label="Fechar">${ic('x')}</button></div>
    ${body}<div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn pri" type="submit">${submit}</button></div></form></div>`);
}

/* ----- gráficos ----- */
function ring(p,size=168){
  const c=size/2,r1=c-5,r2=c-17,r3=c-29,circ=2*Math.PI*r2,q=Math.max(0,Math.min(1,p));
  return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true"><defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E2BE84"/><stop offset="1" stop-color="#C48A2C"/></linearGradient></defs>
  <circle class="spin" cx="${c}" cy="${c}" r="${r1}" fill="none" stroke="var(--gold)" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="1 6.1"/>
  <circle cx="${c}" cy="${c}" r="${r3}" fill="none" stroke="var(--line2)" stroke-width="1"/>
  <circle cx="${c}" cy="${c}" r="${r2}" fill="none" stroke="var(--line)" stroke-width="9"/>
  <circle cx="${c}" cy="${c}" r="${r2}" fill="none" stroke="url(#rg)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(circ*q).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 ${c} ${c})"/></svg>`;
}
function bars(data,w=640,h=250){
  if(!data||!data.length)return'<div class="empty">O histórico aparece depois do primeiro ciclo fechado.</div>';
  const pl=52,pr=10,pt=22,pb=30,iw=w-pl-pr,ih=h-pt-pb,top=Math.max(...data.map(d=>Math.max(d.value,d.goal)))*1.08,step=iw/data.length,bw=step*.48,y=v=>pt+ih-(v/top)*ih;
  let g='';[0,.5,1].forEach(f=>{const v=top*f;g+=`<line x1="${pl}" x2="${w-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${pl-8}" y="${y(v)+4}" text-anchor="end" font-size="10.5" fill="var(--ink3)">${v?brlK(v).replace('R$ ',''):'0'}</text>`});
  data.forEach((d,i)=>{const x=pl+i*step+(step-bw)/2,yy=y(d.value);
    g+=`<rect x="${x}" y="${yy}" width="${bw}" height="${pt+ih-yy}" rx="4" fill="${d.cur?'var(--gold)':'var(--green2)'}" opacity="${d.cur?1:.85}"/>
    <line x1="${x-6}" x2="${x+bw+6}" y1="${y(d.goal)}" y2="${y(d.goal)}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="3 3"/>
    <text x="${x+bw/2}" y="${yy-6}" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--ink)">${brlK(d.value).replace('R$ ','')}</text>
    <text x="${x+bw/2}" y="${h-10}" text-anchor="middle" font-size="11" fill="var(--ink3)">${esc(d.label)}</text>`});
  return`<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" role="img" aria-label="Crédito vendido por ciclo comparado à meta">${g}</svg>`;
}
function donut(parts,size=140){
  const c=size/2,r=c-14,circ=2*Math.PI*r,tot=sum(parts.map(p=>p.v))||1;let acc=0,out='';
  parts.forEach(p=>{const len=p.v/tot*circ;out+=`<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${p.c}" stroke-width="16" stroke-dasharray="${Math.max(0,len-2).toFixed(1)} ${(circ-len+2).toFixed(1)}" stroke-dashoffset="${(-acc).toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>`;acc+=len});
  return`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true">${out}</svg>`;
}
function spark(v,w=120,h=34){
  const mx=Math.max(...v),mn=Math.min(...v),x=i=>2+i/(v.length-1)*(w-4),y=n=>h-4-((n-mn)/(mx-mn||1))*(h-8),pts=v.map((n,i)=>`${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ');
  return`<svg viewBox="0 0 ${w} ${h}" style="height:${h}px;width:100%;max-width:${w}px;display:block" aria-hidden="true"><polygon points="2,${h} ${pts} ${w-2},${h}" fill="var(--gold)" opacity=".13"/><polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="1.6"/><circle cx="${x(v.length-1)}" cy="${y(v[v.length-1])}" r="2.6" fill="var(--accent)"/></svg>`;
}
const bar=(p,c='')=>`<div class="bar" role="progressbar" aria-valuenow="${Math.round(p*100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(2,Math.min(100,p*100))}%;${c}"></i></div>`;
