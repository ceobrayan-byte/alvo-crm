/* ===== Metas por ciclo (proprietário define; demais perfis só visualizam o que podem ver) ===== */
const GL={cyc:null};
function glPanel(){
  if(!LIVE)return'';
  if(!DX.d){dxLoad();return'<div class="card"><div class="xs muted">Carregando metas…</div></div>'}
  const d=DX.d,cycles=dxCycles().slice(0,4),nxt=(()=>{const c=dxCycles()[0];return dxCycle(new Date(c.end.getFullYear(),c.end.getMonth(),c.end.getDate()+1),d.cycle_start_day||15)})();
  const all=[nxt].concat(cycles);if(!GL.cyc||!all.some(c=>c.key===GL.cyc))GL.cyc=cycles[0].key;
  const cyc=all.find(c=>c.key===GL.cyc),can=LV('metas')>=3;
  const g=(t,id)=>{const x=d.goals.find(y=>y.scope_type===t&&y.scope_id===id&&String(y.start).slice(0,10)===cyc.key);return x?Number(x.target):null};
  const real=id=>d.sales.filter(s=>{const t=dxDay(s.date);return s.seller===id&&t>=cyc.start&&t<=cyc.end}).reduce((a,s)=>a+Number(s.credit||0),0);
  const people=d.members.filter(m=>!['SUPORTE','FINANCEIRO'].includes(m.role)&&m.status!=='INATIVO');
  const inp=(t,id,v)=>can?`<input class="in num" style="width:150px" type="number" step="1000" min="0" data-goal="${t}|${esc(id)}" value="${v??''}" placeholder="sem meta">`:`<span class="num">${v!=null?esc(dxM(v)):'—'}</span>`;
  const sumInd=people.reduce((a,m)=>a+(g('USER',m.id)||0),0);
  return`<div class="card col" style="gap:12px"><div class="row sp wrap"><div><div class="eyebrow">Metas do ciclo</div><b>${can?'Defina as metas de cada pessoa e da empresa':'Metas definidas pela diretoria'}</b></div>
   <select class="in" style="width:260px" data-chg="gl-cyc">${all.map(c=>`<option value="${c.key}" ${c.key===GL.cyc?'selected':''}>${esc(dxCLabel(c))}${c===nxt?' (próximo)':c.key===cycles[0].key?' (atual)':''}</option>`).join('')}</select></div>
   ${d.scope==='ORGANIZACAO'?`<div class="row wrap" style="gap:10px"><span class="sm">Meta da empresa no ciclo</span><b class="num">${esc(dxBRL(sumInd))}</b><span class="xs muted">soma das metas individuais (igual ao Floot)</span></div>`:''}
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pessoa</th><th>Equipe · região</th><th>Meta</th><th>Realizado</th><th>Atingimento</th></tr></thead><tbody>
    ${people.map(m=>{const v=g('USER',m.id),r=real(m.id),t=d.teams.find(x=>x.id===m.team_id),rg=d.regions.find(x=>x.id===m.region_id);
     return`<tr><td><b>${esc(m.role==='PROPRIETARIO'?'Escritório · '+fname(m.name):m.name)}</b><div class="xs muted">${esc(({PROPRIETARIO:'Proprietário',ADMINISTRADOR:'Administrador',GESTOR:'Coordenador',VENDEDOR:'Vendedor'})[m.role]||m.role)}</div></td>
      <td class="sm">${esc(t?t.name:'—')}<div class="xs muted">${esc(rg?rg.name:'')}</div></td><td>${inp('USER',m.id,v)}</td><td class="num">${esc(dxM(r))}</td><td>${v?`<div class="row" style="gap:8px"><div class="bar" style="width:90px"><i style="width:${Math.min(100,r/v*100).toFixed(0)}%"></i></div><span class="xs num">${Math.round(r/v*100)}%</span></div>`:'<span class="xs muted">—</span>'}</td></tr>`}).join('')}
   </tbody></table></div>
   ${can?`<div class="row"><button class="btn pri" data-act="gl-save">${ic('save')}Salvar metas do ciclo</button><span class="xs muted">Coordenadores e vendedores apenas visualizam. A meta da equipe é a soma das metas de quem está nela.</span></div>`:''}</div>`;
}
const GL_OLD=VIEWS['metas'];
GL.tab='metas';GL.dim='seller';GL.met='credito';GL.rcyc=null;
const CP={d:null,loading:false,orgFor:null};
async function cpLoad(force){if(CP.loading||(CP.d&&!force&&CP.orgFor===S.orgId))return;CP.loading=true;
  try{CP.d=await rpc('crm_campaigns',{p_org:S.orgId});CP.orgFor=S.orgId}catch(e){CP.d={can_edit:false,items:[]}}finally{CP.loading=false;if(S.view==='metas')refresh()}}
/* ---- ranking ---- */
function glRanking(){
  if(!DX.d){dxLoad();return'<div class="empty">Carregando…</div>'}
  const d=DX.d,cycles=dxCycles();if(!GL.rcyc||(GL.rcyc!=='all'&&!cycles.some(c=>c.key===GL.rcyc)))GL.rcyc=cycles[0].key;
  const cyc=GL.rcyc==='all'?null:cycles.find(c=>c.key===GL.rcyc);
  const inR=s=>{if(!cyc)return true;const t=dxDay(s.date);return t>=cyc.start&&t<=cyc.end};
  const sales=d.sales.filter(inR);
  const ug=id=>{if(!cyc)return 0;const g=d.goals.find(x=>x.scope_type==='USER'&&x.scope_id===id&&String(x.start).slice(0,10)===cyc.key);return g?Number(g.target):0};
  const val=list=>GL.met==='vendas'?list.length:list.reduce((a,s)=>a+Number(s.credit||0),0);
  const fmt=v=>GL.met==='vendas'?v+' venda'+(v===1?'':'s'):dxM(v);
  let groups=[];
  if(GL.dim==='seller'){const ids=[...new Set(d.members.filter(m=>!['SUPORTE','FINANCEIRO'].includes(m.role)&&(m.status!=='INATIVO'||ug(m.id)>0)).map(m=>m.id).concat(sales.map(s=>s.seller)))];
    groups=ids.map(id=>({id,label:dxName(id),sub:(d.teams.find(t=>t.id===dxMem(id).team_id)||{}).name||'',ids:[id]}))}
  else if(GL.dim==='team'){groups=d.teams.map(t=>({id:t.id,label:t.coordinator?dxName(t.coordinator):t.name,sub:t.name,ids:d.members.filter(m=>m.team_id===t.id).map(m=>m.id)}))}
  else{groups=d.regions.map(r=>({id:r.id,label:r.name,sub:'',ids:d.members.filter(m=>m.region_id===r.id).map(m=>m.id)})).filter(g=>g.ids.length)}
  const rows=groups.map(g=>{const ss=sales.filter(s=>g.ids.includes(s.seller)),goal=g.ids.reduce((a,id)=>a+ug(id),0),cred=ss.reduce((a,s)=>a+Number(s.credit||0),0);
    return Object.assign(g,{n:ss.length,cred,v:val(ss),goal,att:goal?cred/goal:null})});
  const key=GL.met==='atingimento'?(r=>r.att==null?-1:r.att):(r=>r.v);
  const off=r=>GL.dim==='seller'&&dxIsOffice(r.id);rows.sort((a,b)=>off(a)!==off(b)?(off(a)?1:-1):key(b)-key(a));
  const top=rows.filter(r=>key(r)>0&&!off(r)).slice(0,3),ord=[1,0,2].filter(i=>top[i]),medal=['1º','2º','3º'];
  const show=r=>GL.met==='atingimento'?(r.att==null?'sem meta':Math.round(r.att*100)+'%'):fmt(r.v);
  const isMe=r=>r.ids.includes(ME)&&GL.dim==='seller';
  const tabs=[['seller','Vendedores'],...(d.teams.length>1?[['team','Coordenadores / equipes']]:[]),...(d.scope==='ORGANIZACAO'&&d.regions.length?[['region','Regiões']]:[])];
  if(!tabs.some(t=>t[0]===GL.dim))GL.dim='seller';
  const maxv=Math.max(1,...rows.map(r=>GL.met==='atingimento'?(r.att||0):r.v));
  return`<div class="row wrap dxfil">
    <select class="in" data-chg="gl-rcyc">${cycles.map((c,i)=>`<option value="${c.key}" ${c.key===GL.rcyc?'selected':''}>${esc(dxCLabel(c))}${i===0?' · atual':''}</option>`).join('')}<option value="all" ${GL.rcyc==='all'?'selected':''}>Desde o início</option></select>
    <div class="row" role="tablist" style="gap:6px">${tabs.map(t=>`<button class="btn sm ${GL.dim===t[0]?'pri':''}" data-act="gl-dim" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
    <select class="in" data-chg="gl-met"><option value="credito" ${GL.met==='credito'?'selected':''}>Por crédito vendido</option><option value="vendas" ${GL.met==='vendas'?'selected':''}>Por número de vendas</option>${cyc?`<option value="atingimento" ${GL.met==='atingimento'?'selected':''}>Por atingimento da meta</option>`:''}</select></div>
   ${top.length?`<div class="card"><div class="podium big">${ord.map(i=>`<div class="pod p${i+1}"><div class="pav">${i===0?'<span class="crown">👑</span>':''}${avN(top[i].label,i===0?64:52)}</div><b>${esc(top[i].label)}</b><span class="sm num">${esc(show(top[i]))}</span>${top[i].att!=null&&GL.met!=='atingimento'?`<span class="xs muted">${Math.round(top[i].att*100)}% da meta</span>`:''}<div class="pbase"><span>${medal[i]}</span></div></div>`).join('')}</div></div>`:'<div class="empty">Ninguém pontuou neste período ainda.</div>'}
   <div class="card"><div class="row sp"><b class="sm">Classificação completa</b><span class="xs muted dxleg"><i class="k1"></i>${GL.met==='atingimento'?'atingimento':'resultado'}${cyc&&GL.met!=='atingimento'?'<i class="kg"></i>meta':''}</span></div>
    <div class="rk">${rows.map((r,i)=>{const v=GL.met==='atingimento'?(r.att||0):r.v,g=GL.met==='credito'&&r.goal?r.goal:GL.met==='atingimento'&&r.goal?1:null;
     return`<div class="rkrow ${isMe(r)?'me':''}" data-tip="${esc(r.label)}|${esc(fmt(r.v))} · ${r.n} venda(s)${r.goal?'|Meta: '+esc(dxM(r.goal))+' · '+Math.round(r.att*100)+'%':''}"><span class="pos">${off(r)?'—':(i+1)+'º'}</span>${avN(r.label,30)}<span class="nm"><b>${esc(r.label)}</b>${off(r)?'<div class="xs muted">Fora da competição</div>':r.sub&&GL.dim!=='region'?`<div class="xs muted">${esc(r.sub)}</div>`:''}</span>
      <span class="trk"><i style="width:${(v/Math.max(maxv,g||0)*100).toFixed(1)}%"></i>${g?`<b class="gt" style="left:${(g/Math.max(maxv,g)*100).toFixed(1)}%"></b>`:''}</span><span class="num val">${esc(show(r))}</span></div>`}).join('')}</div></div>`;
}
/* ---- campanhas, desafios e premiações ---- */
const CP_KIND={campanha:'Campanha',desafio:'Desafio',premiacao:'Premiação'};
function cpProgress(c){
  const d=DX.d;if(!d)return{rows:[],total:0};
  const st=dxDay(c.starts_on),en=dxDay(c.ends_on),ss=d.sales.filter(s=>{const t=dxDay(s.date);return t>=st&&t<=en});
  const inScope=id=>{const m=dxMem(id);return c.scope_type==='ORG'||(c.scope_type==='TEAM'&&m.team_id===c.scope_id)||(c.scope_type==='REGION'&&m.region_id===c.scope_id)||(c.scope_type==='USER'&&id===c.scope_id)};
  const mine=ss.filter(s=>inScope(s.seller)),v=l=>c.metric==='vendas'?l.length:l.reduce((a,s)=>a+Number(s.credit||0),0);
  const people=[...new Set(mine.map(s=>s.seller).concat(c.scope_type==='USER'?[c.scope_id]:[]))].map(id=>({id,label:dxName(id),v:v(mine.filter(s=>s.seller===id))})).sort((a,b)=>b.v-a.v);
  return{rows:people,total:v(mine)};
}
function cpScopeLabel(c){const d=DX.d||{teams:[],regions:[]};return c.scope_type==='ORG'?'Empresa toda':c.scope_type==='TEAM'?((d.teams.find(t=>t.id===c.scope_id)||{}).name||'Equipe'):c.scope_type==='REGION'?((d.regions.find(r=>r.id===c.scope_id)||{}).name||'Região'):dxName(c.scope_id)}
function glCampaigns(){
  cpLoad();if(!DX.d)dxLoad();const d=CP.d;if(!d||!DX.d)return'<div class="empty">Carregando…</div>';
  const fmt=(c,v)=>c.metric==='vendas'?v+' venda'+(v===1?'':'s'):dxM(v),today=new Date();
  const card=c=>{const p=cpProgress(c),end=dxDay(c.ends_on),st=dxDay(c.starts_on),live=c.active&&today<=new Date(end.getTime()+864e5)&&today>=st,left=Math.max(0,Math.ceil((end-today)/864e5)+1);
   const tgt=Number(c.target),coll=c.mode==='coletiva',pct=coll?p.total/tgt:null,hit=p.rows.filter(r=>r.v>=tgt);
   return`<div class="card col cp ${live?'':'past'}" style="gap:10px"><div class="row sp"><div><span class="bd ${c.kind==='premiacao'?'gold':c.kind==='desafio'?'warn':'ok'}">${CP_KIND[c.kind]}</span> ${live?`<span class="xs muted">${left} dia(s) restantes</span>`:`<span class="bd mute">${c.active?(today<st?'agendada':'encerrada'):'desativada'}</span>`}</div>
     ${d.can_edit?`<div class="row" style="gap:6px"><button class="btn sm ghost" data-act="cp-edit" data-id="${c.id}">${ic('pencil')}Editar</button>${c.active?`<button class="btn sm ghost" data-act="cp-off" data-id="${c.id}">Encerrar</button>`:''}</div>`:''}</div>
    <h3 style="font-size:17px">${esc(c.title)}</h3>${c.description?`<div class="sm muted">${esc(c.description)}</div>`:''}
    <div class="row wrap sm" style="gap:14px"><span>${ic('target')} Meta: <b>${esc(fmt(c,tgt))}</b> ${coll?'(soma do grupo)':'(cada pessoa)'}</span><span>${ic('users')} ${esc(cpScopeLabel(c))}</span><span>${ic('calendar')} ${esc(String(c.starts_on).split('-').reverse().join('/'))} a ${esc(String(c.ends_on).split('-').reverse().join('/'))}</span>${c.reward?`<span>${ic('gift')} Prêmio: <b>${esc(c.reward)}</b></span>`:''}</div>
    ${coll?`<div><div class="row sp xs"><span>${esc(fmt(c,p.total))} de ${esc(fmt(c,tgt))}</span><b>${Math.round(pct*100)}%</b></div><div class="bar" style="height:10px;margin-top:6px"><i style="width:${Math.min(100,pct*100).toFixed(0)}%"></i></div></div>`
     :`<div class="rk">${p.rows.slice(0,8).map((r,i)=>`<div class="rkrow ${r.id===ME?'me':''}"><span class="pos">${off(r)?'—':(i+1)+'º'}</span>${avN(r.label,26)}<span class="nm"><b class="sm">${esc(r.label)}</b></span><span class="trk"><i style="width:${Math.min(100,r.v/tgt*100).toFixed(0)}%"></i></span><span class="num val">${esc(fmt(c,r.v))}${r.v>=tgt?' ✅':''}</span></div>`).join('')||'<div class="xs muted">Ninguém pontuou ainda.</div>'}</div>
      ${hit.length?`<div class="xs"><b>${hit.length}</b> pessoa(s) já bateram a meta da ${CP_KIND[c.kind].toLowerCase()}.</div>`:''}`}</div>`};
  const items=d.items||[];
  return`<div class="row sp"><span class="sm muted">${d.can_edit?'Crie campanhas, desafios e premiações. O progresso é calculado sozinho pelas vendas efetivadas no período.':'Campanhas e desafios definidos pela diretoria.'}</span>${d.can_edit?`<button class="btn pri" data-act="cp-new">${ic('plus')}Nova campanha / desafio</button>`:''}</div>
   <div class="cpgrid">${items.map(card).join('')||'<div class="empty">Nenhuma campanha cadastrada.</div>'}</div>`;
}
function cpDialog(c){
  const d=DX.d,today=dxIso(new Date()),cyc=dxCycles()[0];c=c||{kind:'campanha',metric:'credito',mode:'individual',scope_type:'ORG',starts_on:dxIso(cyc.start),ends_on:dxIso(cyc.end)};
  dialog({title:c.id?'Editar':'Nova campanha / desafio',sub:'Só o proprietário cria e altera. Todos veem o que podem.',submit:'Salvar',wide:true,body:`
   <div class="g" style="grid-template-columns:1fr 2fr;gap:12px"><label class="fld">Tipo<select class="in" name="kind">${Object.entries(CP_KIND).map(([k,v])=>`<option value="${k}" ${c.kind===k?'selected':''}>${v}</option>`).join('')}</select></label>
   <label class="fld">Nome<input class="in" name="title" required maxlength="120" value="${esc(c.title||'')}" placeholder="Ex.: Corrida do crédito de dezembro"></label></div>
   <label class="fld">Regras / descrição<textarea class="in" name="description" rows="2" maxlength="600">${esc(c.description||'')}</textarea></label>
   <div class="g" style="grid-template-columns:1fr 1fr 1fr;gap:12px">
    <label class="fld">Medir por<select class="in" name="metric"><option value="credito" ${c.metric==='credito'?'selected':''}>Crédito vendido (R$)</option><option value="vendas" ${c.metric==='vendas'?'selected':''}>Número de vendas</option></select></label>
    <label class="fld">Meta<input class="in num" name="target" type="number" min="1" step="1" required value="${c.target||''}"></label>
    <label class="fld">Como conta<select class="in" name="mode"><option value="individual" ${c.mode==='individual'?'selected':''}>Cada pessoa precisa bater</option><option value="coletiva" ${c.mode==='coletiva'?'selected':''}>Soma do grupo</option></select></label></div>
   <div class="g" style="grid-template-columns:1fr 1fr;gap:12px">
    <label class="fld">Quem participa<select class="in" name="scope">${['ORG|Empresa toda'].concat(d.teams.map(t=>'TEAM:'+t.id+'|'+t.name),d.regions.map(r=>'REGION:'+r.id+'|Região '+r.name),d.members.filter(m=>!['SUPORTE','FINANCEIRO'].includes(m.role)).map(m=>'USER:'+m.id+'|'+dxName(m.id))).map(o=>{const[v,l]=o.split('|'),cur=c.scope_type==='ORG'?'ORG':c.scope_type+':'+c.scope_id;return`<option value="${esc(v)}" ${v===cur?'selected':''}>${esc(l)}</option>`}).join('')}</select></label>
    <label class="fld">Prêmio<input class="in" name="reward" maxlength="160" value="${esc(c.reward||'')}" placeholder="Ex.: R$ 1.000, viagem, folga…"></label></div>
   <div class="g" style="grid-template-columns:1fr 1fr;gap:12px"><label class="fld">Início<input class="in" type="date" name="starts_on" required value="${esc(String(c.starts_on).slice(0,10))}"></label><label class="fld">Fim<input class="in" type="date" name="ends_on" required value="${esc(String(c.ends_on).slice(0,10))}"></label></div>`,
   onSubmit:dlgAsync(async f=>{const[st,sid]=(f.scope||'ORG').split(':');
     await rpc('crm_campaign_save',{p_org:S.orgId,p_id:c.id||null,p_data:{kind:f.kind,title:f.title,description:f.description,metric:f.metric,target:Number(f.target),mode:f.mode,scope_type:st,scope_id:sid||'',reward:f.reward,starts_on:f.starts_on,ends_on:f.ends_on}});
     await cpLoad(true);toast(c.id?'Campanha atualizada':'Campanha criada',{icon:'trophy'})})});
}
VIEWS['metas']=()=>{
  if(!LIVE)return GL_OLD();
  const o=O(),tabs=[['metas','Metas do ciclo'],['ranking','Ranking'],['camp','Campanhas e desafios'],['conq','Conquistas']];
  const body=GL.tab==='metas'?glPanel():GL.tab==='ranking'?glRanking():GL.tab==='camp'?glCampaigns():(()=>{const h=GL_OLD(),st=h.indexOf('<div class="pg-h"');if(st<0)return h;let dpt=0,re=/<div\b|<\/div>/g;re.lastIndex=st;let m;while((m=re.exec(h))){dpt+=m[0]==='</div>'?-1:1;if(dpt===0)break}return h.slice(m?m.index+6:0).replace(/<\/div>\s*$/,'')})();
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Metas e conquistas</h2></div></div>
   <div class="row" role="tablist">${tabs.map(t=>`<button class="btn sm ${GL.tab===t[0]?'pri':''}" role="tab" data-act="gl-tab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>${body}</div>`;
};
ACT['gl-tab']=el=>{GL.tab=el.dataset.id;refresh()};ACT['gl-dim']=el=>{GL.dim=el.dataset.id;refresh()};
CHG['gl-rcyc']=el=>{GL.rcyc=el.value;refresh()};CHG['gl-met']=el=>{GL.met=el.value;refresh()};
ACT['cp-new']=()=>cpDialog();ACT['cp-edit']=el=>cpDialog(CP.d.items.find(x=>x.id===el.dataset.id));
ACT['cp-off']=async el=>{if(!confirm('Encerrar esta campanha agora?'))return;await guarded(async()=>{await rpc('crm_campaign_save',{p_org:S.orgId,p_id:el.dataset.id,p_data:{title:(CP.d.items.find(x=>x.id===el.dataset.id)||{}).title,active:false}});await cpLoad(true);toast('Campanha encerrada',{icon:'check'})});refresh()};
CHG['gl-cyc']=el=>{GL.cyc=el.value;refresh()};
ACT['gl-save']=async()=>{
  const cyc=GL.cyc,items=[...document.querySelectorAll('[data-goal]')].map(i=>{const[t,id]=i.dataset.goal.split('|');return{t,id,v:i.value===''?null:Number(i.value)}});
  const cur=t=>id=>{const x=DX.d.goals.find(y=>y.scope_type===t&&y.scope_id===id&&String(y.start).slice(0,10)===cyc);return x?Number(x.target):null};
  const changed=items.filter(x=>x.v!=null&&x.v!==cur(x.t)(x.id));
  if(!changed.length){toast('Nada mudou',{icon:'info'});return}
  await guarded(async()=>{for(const x of changed)await rpc('crm_goal_save',{p_org:S.orgId,p_scope_type:x.t,p_scope_id:x.id,p_start:cyc,p_target:x.v});await dxLoad(true);toast(`${changed.length} meta(s) salva(s)`,{icon:'target'})});refresh()};
