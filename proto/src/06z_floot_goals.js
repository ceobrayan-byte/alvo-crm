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
  const og=g('ORG',S.orgId)??(cyc.key===cycles[0].key?Number(d.org_goal)||null:null),sumInd=people.reduce((a,m)=>a+(g('USER',m.id)||0),0);
  return`<div class="card col" style="gap:12px"><div class="row sp wrap"><div><div class="eyebrow">Metas do ciclo</div><b>${can?'Defina as metas de cada pessoa e da empresa':'Metas definidas pela diretoria'}</b></div>
   <select class="in" style="width:260px" data-chg="gl-cyc">${all.map(c=>`<option value="${c.key}" ${c.key===GL.cyc?'selected':''}>Ciclo ${dxLabel(c)}${c===nxt?' (próximo)':c.key===cycles[0].key?' (atual)':''}</option>`).join('')}</select></div>
   ${d.scope==='ORGANIZACAO'?`<div class="row wrap"><span class="sm">Meta geral da empresa</span>${inp('ORG',S.orgId,og)}<span class="xs muted">soma das metas individuais: ${esc(dxM(sumInd))}</span></div>`:''}
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Pessoa</th><th>Equipe · região</th><th>Meta</th><th>Realizado</th><th>Atingimento</th></tr></thead><tbody>
    ${people.map(m=>{const v=g('USER',m.id),r=real(m.id),t=d.teams.find(x=>x.id===m.team_id),rg=d.regions.find(x=>x.id===m.region_id);
     return`<tr><td><b>${esc(m.role==='PROPRIETARIO'?'Escritório · '+fname(m.name):m.name)}</b><div class="xs muted">${esc(({PROPRIETARIO:'Proprietário',ADMINISTRADOR:'Administrador',GESTOR:'Coordenador',VENDEDOR:'Vendedor'})[m.role]||m.role)}</div></td>
      <td class="sm">${esc(t?t.name:'—')}<div class="xs muted">${esc(rg?rg.name:'')}</div></td><td>${inp('USER',m.id,v)}</td><td class="num">${esc(dxM(r))}</td><td>${v?`<div class="row" style="gap:8px"><div class="bar" style="width:90px"><i style="width:${Math.min(100,r/v*100).toFixed(0)}%"></i></div><span class="xs num">${Math.round(r/v*100)}%</span></div>`:'<span class="xs muted">—</span>'}</td></tr>`}).join('')}
   </tbody></table></div>
   ${can?`<div class="row"><button class="btn pri" data-act="gl-save">${ic('save')}Salvar metas do ciclo</button><span class="xs muted">Coordenadores e vendedores apenas visualizam. A meta da equipe é a soma das metas de quem está nela.</span></div>`:''}</div>`;
}
const GL_OLD=VIEWS['metas'];
VIEWS['metas']=()=>{const h=GL_OLD();if(!LIVE)return h;
  const st=h.indexOf('<div class="pg-h"');if(st<0)return glPanel()+h;
  let depth=0,re=/<div\b|<\/div>/g;re.lastIndex=st;let m;while((m=re.exec(h))){depth+=m[0]==='</div>'?-1:1;if(depth===0)break}
  const cut=m?m.index+6:st;return h.slice(0,cut)+glPanel()+h.slice(cut)};
CHG['gl-cyc']=el=>{GL.cyc=el.value;refresh()};
ACT['gl-save']=async()=>{
  const cyc=GL.cyc,items=[...document.querySelectorAll('[data-goal]')].map(i=>{const[t,id]=i.dataset.goal.split('|');return{t,id,v:i.value===''?null:Number(i.value)}});
  const cur=t=>id=>{const x=DX.d.goals.find(y=>y.scope_type===t&&y.scope_id===id&&String(y.start).slice(0,10)===cyc);return x?Number(x.target):null};
  const changed=items.filter(x=>x.v!=null&&x.v!==cur(x.t)(x.id));
  if(!changed.length){toast('Nada mudou',{icon:'info'});return}
  await guarded(async()=>{for(const x of changed)await rpc('crm_goal_save',{p_org:S.orgId,p_scope_type:x.t,p_scope_id:x.id,p_start:cyc,p_target:x.v});await dxLoad(true);toast(`${changed.length} meta(s) salva(s)`,{icon:'target'})});refresh()};
