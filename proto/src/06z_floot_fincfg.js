/* ===== Financeiro › Gestão de comissionamento (somente o proprietário configura) =====
   Separação: RECEITA ALVO = regra oficial da administradora (catálogo) · REPASSE AO VENDEDOR = acordos e níveis daqui.
   Mudar a remuneração do vendedor não altera valor nem calendário do que a ALVO recebe. */
const CA={d:null,loading:false,orgFor:null,draft:null,coord:'default'};
const CA_PLAT=['Canopus','CNP','Porto','Servopa','Âncora'];
async function caLoad(force){
  if(CA.loading||(CA.d&&!force&&CA.orgFor===S.orgId))return;CA.loading=true;
  try{CA.d=await rpc('crm_commission_admin',{p_org:S.orgId});CA.orgFor=S.orgId;CA.draft=JSON.parse(JSON.stringify(CA.d.policy||{coordinator:{below_percent:0.02,tiers:[]},coordinator_overrides:{},seller_tiers:[]}))}
  catch(e){CA.d={owner:false,error:true}}finally{CA.loading=false;if(S.view==='financeiro')refresh()}
}
const caPct=v=>(Number(v)||0).toLocaleString('pt-BR',{maximumFractionDigits:3})+'%';
const caBase=pl=>{const k=(CA.d.catalog||[]).find(x=>x.platform.toLowerCase()===pl.toLowerCase());return k?k.commission_rate*100:null};
const caAgr=(sid,pl)=>(CA.d.agreements||[]).filter(a=>a.seller_user_id===sid&&a.active&&a.platform.toLowerCase()===pl.toLowerCase()).sort((a,b)=>String(b.effective_from).localeCompare(String(a.effective_from))||String(b.created_at).localeCompare(String(a.created_at)))[0];
function caTiersEditor(tiers,below,path){
  return`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Atingimento da meta da equipe</th><th>% sobre o crédito efetivado dos outros vendedores</th><th></th></tr></thead><tbody>
   <tr><td class="sm">abaixo de ${tiers.length?tiers[0].attainment:100}%</td><td><input class="in num" style="width:110px" type="number" step="0.001" min="0" max="5" data-ca="${path}.below" value="${below}"> %</td><td></td></tr>
   ${tiers.map((t,i)=>`<tr><td>a partir de <input class="in num" style="width:90px" type="number" step="1" min="0" data-ca="${path}.tiers.${i}.attainment" value="${t.attainment}"> %</td><td><input class="in num" style="width:110px" type="number" step="0.001" min="0" max="5" data-ca="${path}.tiers.${i}.percent" value="${t.percent}"> %</td><td><button class="btn sm ghost" data-act="ca-del" data-id="${path}.tiers.${i}">${ic('trash-2')}</button></td></tr>`).join('')}
  </tbody></table></div><button class="btn sm" data-act="ca-add" data-id="${path}.tiers">${ic('plus')}Adicionar faixa</button>`;
}
function caPreview(){
  // apuração do ciclo atual com os dados do dashboard (meta da equipe = soma das metas individuais do ciclo)
  if(!DX.d){dxLoad();return'<div class="xs muted">Carregando apuração…</div>'}
  const d=DX.d,cyc=dxCycles()[0],sales=d.sales.filter(s=>{const t=dxDay(s.date);return t>=cyc.start&&t<=cyc.end});
  const gl=id=>{const g=d.goals.find(x=>x.scope_type==='USER'&&x.scope_id===id&&String(x.start).slice(0,10)===cyc.key);return g?Number(g.target):0};
  const tierOf=(pol,att)=>{let p=Number(pol.below_percent)||0;(pol.tiers||[]).forEach(t=>{if(att*100>=Number(t.attainment))p=Number(t.percent)});return p};
  const rowsC=d.teams.filter(t=>t.coordinator).map(t=>{const ids=d.members.filter(m=>m.team_id===t.id).map(m=>m.id),goal=ids.reduce((a,id)=>a+gl(id),0),real=sales.filter(s=>ids.includes(s.seller)).reduce((a,s)=>a+Number(s.credit||0),0);
    const others=sales.filter(s=>ids.includes(s.seller)&&s.seller!==t.coordinator).reduce((a,s)=>a+Number(s.credit||0),0),pol=CA.draft.coordinator_overrides[t.coordinator]||CA.draft.coordinator,att=goal?real/goal:0,p=tierOf(pol,att);
    return`<tr><td><b>${esc(dxName(t.coordinator))}</b>${CA.draft.coordinator_overrides[t.coordinator]?' <span class="bd gold">regra própria</span>':''}</td><td class="num">${goal?esc(dxM(goal)):'<span class="muted">sem meta</span>'}</td><td class="num">${esc(dxM(real))}</td><td class="num">${goal?Math.round(att*100)+'%':'—'}</td><td class="num">${caPct(p)}</td><td class="num">${esc(dxM(others))}</td><td class="num"><b>${goal?fBRL(Math.round(others*p)/100):'—'}</b></td></tr>`}).join('');
  const st=CA.draft.seller_tiers||[];
  const rowsS=st.length?[...new Set(sales.map(s=>s.seller))].map(id=>{const goal=gl(id),real=sales.filter(s=>s.seller===id).reduce((a,s)=>a+Number(s.credit||0),0),att=goal?real/goal:0;let b=0;st.forEach(t=>{if(att*100>=Number(t.attainment))b=Number(t.bonus)});
    return`<tr><td><b>${esc(dxName(id))}</b></td><td class="num">${goal?esc(dxM(goal)):'<span class="muted">sem meta</span>'}</td><td class="num">${esc(dxM(real))}</td><td class="num">${goal?Math.round(att*100)+'%':'—'}</td><td class="num">${caPct(b)}</td><td class="num"><b>${goal?fBRL(Math.round(real*b)/100):'—'}</b></td></tr>`}).join(''):'';
  return`<div class="eyebrow" style="margin-top:6px">Apuração prévia · ciclo ${esc(dxLabel(cyc))} (não gera pagamento)</div>
   <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Coordenador</th><th>Meta da equipe</th><th>Realizado</th><th>Atingimento</th><th>Faixa</th><th>Crédito dos outros vendedores</th><th>Bônus previsto</th></tr></thead><tbody>${rowsC||'<tr><td colspan="7"><div class="empty">Nenhuma equipe com coordenador.</div></td></tr>'}</tbody></table></div>
   ${rowsS?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendedor</th><th>Meta</th><th>Realizado</th><th>Atingimento</th><th>Bônus</th><th>Bônus previsto</th></tr></thead><tbody>${rowsS}</tbody></table></div>`:''}`;
}
function caView(){
  caLoad();const d=CA.d;
  if(!d)return'<div class="empty">Carregando…</div>';
  if(!d.owner)return'<div class="empty">Somente o proprietário acessa a gestão de comissionamento.</div>';
  const sellers=d.sellers.filter(s=>s.role!=='PROPRIETARIO'),coords=sellers.filter(s=>s.role==='GESTOR'),ov=CA.draft.coordinator_overrides||{};
  const cpol=CA.coord==='default'?CA.draft.coordinator:ov[CA.coord];
  return`<div class="card" style="border-color:var(--line2)"><div class="sm"><b>Como funciona:</b> a <b>receita da ALVO</b> segue a regra oficial de cada administradora (abaixo, só leitura). O <b>repasse ao vendedor</b> é configurado aqui. Alterar o repasse <b>não muda</b> o valor nem o calendário do que a ALVO recebe. Novos percentuais valem para vendas a partir de hoje; vendas anteriores e baixas já registradas são preservadas.</div></div>
  <div class="eyebrow">1 · Percentual do vendedor por administradora</div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Vendedor</th>${CA_PLAT.map(p=>`<th>${esc(p)}<div class="xs muted" style="font-weight:400">padrão ${caBase(p)!=null?caPct(caBase(p)):'—'}</div></th>`).join('')}</tr></thead><tbody>
   ${sellers.map(s=>`<tr><td><b>${esc(s.name)}</b><div class="xs muted">${s.role==='GESTOR'?'Coordenador':'Vendedor'}</div></td>${CA_PLAT.map(p=>{const a=caAgr(s.id,p);return`<td><button class="btn sm ${a?'':'ghost'}" data-act="ca-agr" data-id="${esc(s.id)}" data-p="${esc(p)}" title="${a?esc((a.note||'')+' · desde '+String(a.effective_from).split('-').reverse().join('/')):'usa o padrão da administradora'}">${a?caPct(a.percent):'<span class="muted">padrão</span>'}</button></td>`}).join('')}</tr>`).join('')}
  </tbody></table></div>
  <details><summary class="sm muted">Histórico de alterações dos percentuais (${d.agreements.length})</summary><div class="tbl-wrap" style="margin-top:8px"><table class="tbl"><thead><tr><th>Vendedor</th><th>Administradora</th><th>%</th><th>Vale desde</th><th>Observação</th><th>Situação</th></tr></thead><tbody>${d.agreements.map(a=>`<tr><td class="sm">${esc((d.sellers.find(s=>s.id===a.seller_user_id)||{}).name||a.seller_user_id)}</td><td class="sm">${esc(a.platform)}</td><td class="num">${caPct(a.percent)}</td><td class="sm num">${esc(String(a.effective_from).split('-').reverse().join('/'))}</td><td class="sm">${esc(a.note||'')}</td><td>${a.active?'<span class="bd ok">ativo</span>':'<span class="bd mute">substituído</span>'}</td></tr>`).join('')}</tbody></table></div></details>
  <div class="row sp"><div class="eyebrow">2 · Níveis do coordenador (bônus sobre a equipe)</div>
   <select class="in" style="width:260px" data-chg="ca-coord"><option value="default">Regra geral (todos os coordenadores)</option>${coords.map(c=>`<option value="${esc(c.id)}" ${CA.coord===c.id?'selected':''}>${esc(c.name)}${ov[c.id]?' · regra própria':''}</option>`).join('')}</select></div>
  ${CA.coord!=='default'&&!cpol?`<div class="card row sp"><span class="sm">${esc((coords.find(c=>c.id===CA.coord)||{}).name||'')} segue a regra geral.</span><button class="btn sm" data-act="ca-ovr" data-id="${esc(CA.coord)}">${ic('plus')}Criar regra própria para este coordenador</button></div>`
   :caTiersEditor(cpol.tiers||[],cpol.below_percent||0,CA.coord==='default'?'coordinator':'coordinator_overrides.'+CA.coord)+(CA.coord!=='default'?` <button class="btn sm ghost" data-act="ca-ovr-del" data-id="${esc(CA.coord)}">Voltar para a regra geral</button>`:'')}
  <div class="eyebrow">3 · Níveis progressivos dos vendedores (bônus por atingimento da meta individual)</div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Atingimento da meta individual</th><th>Bônus sobre o crédito do ciclo</th><th></th></tr></thead><tbody>
   ${(CA.draft.seller_tiers||[]).map((t,i)=>`<tr><td>a partir de <input class="in num" style="width:90px" type="number" step="1" min="0" data-ca="seller_tiers.${i}.attainment" value="${t.attainment}"> %</td><td><input class="in num" style="width:110px" type="number" step="0.001" min="0" max="5" data-ca="seller_tiers.${i}.bonus" value="${t.bonus}"> %</td><td><button class="btn sm ghost" data-act="ca-del" data-id="seller_tiers.${i}">${ic('trash-2')}</button></td></tr>`).join('')||'<tr><td colspan="3"><div class="empty">Nenhum nível cadastrado — vendedores recebem só o percentual da administradora.</div></td></tr>'}
  </tbody></table></div><button class="btn sm" data-act="ca-add" data-id="seller_tiers">${ic('plus')}Adicionar nível</button>
  <div class="row"><button class="btn pri" data-act="ca-save">${ic('save')}Salvar níveis e regras</button><button class="btn ghost" data-act="ca-reset">Descartar alterações</button></div>
  ${caPreview()}
  <div class="eyebrow">4 · Receita ALVO — regras oficiais das administradoras (só leitura)</div>
  <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Regra</th><th>Administradora · produto · plano</th><th>ALVO recebe (por evento)</th><th>Padrão do vendedor</th></tr></thead><tbody>
   ${d.catalog.map(k=>`<tr><td><b class="sm">${esc(k.id)}</b></td><td class="sm">${esc(k.platform)}<div class="xs muted">${esc(k.product||'')} · ${esc(k.plan||'')}</div></td>
    <td class="xs">${k.alvo_kind==='cnp'&&!(k.alvo_events||[]).length?'conforme planilha CNP':(k.alvo_events||[]).map(e=>`${esc(e.event)}: <b>${caPct(e.pct)}</b>`).join(' · ')||'—'}</td><td class="num">${caPct(k.commission_rate*100)}<div class="xs muted">${(k.events||[]).length} evento(s)</div></td></tr>`).join('')}
  </tbody></table></div>`;
}
const caPath=(o,path)=>{const ks=path.split('.');let x=o;for(let i=0;i<ks.length-1;i++)x=x[ks[i]];return[x,ks[ks.length-1]]};
document.addEventListener('change',ev=>{const t=ev.target;if(!t||!t.dataset||!t.dataset.ca||!CA.draft)return;const[o,k]=caPath(CA.draft,t.dataset.ca.replace(/\.below$/,'.below_percent'));o[k]=Number(t.value)});
CHG['ca-coord']=el=>{CA.coord=el.value;refresh()};
ACT['ca-add']=el=>{const[o,k]=caPath(CA.draft,el.dataset.id);const arr=o[k]=o[k]||[];const last=arr[arr.length-1];
  arr.push(el.dataset.id==='seller_tiers'?{attainment:last?Number(last.attainment)+20:100,bonus:last?Number(last.bonus)+0.1:0.1}:{attainment:last?Number(last.attainment)+20:100,percent:last?Number(last.percent)+0.02:0.03});refresh()};
ACT['ca-del']=el=>{const ks=el.dataset.id.split('.'),i=+ks.pop();const[o,k]=caPath(CA.draft,ks.join('.'));o[k].splice(i,1);refresh()};
ACT['ca-ovr']=el=>{CA.draft.coordinator_overrides=CA.draft.coordinator_overrides||{};CA.draft.coordinator_overrides[el.dataset.id]=JSON.parse(JSON.stringify({below_percent:CA.draft.coordinator.below_percent,tiers:CA.draft.coordinator.tiers}));refresh()};
ACT['ca-ovr-del']=el=>{delete CA.draft.coordinator_overrides[el.dataset.id];CA.coord='default';refresh()};
ACT['ca-reset']=()=>{CA.draft=JSON.parse(JSON.stringify(CA.d.policy));refresh()};
ACT['ca-save']=async()=>{
  const sortT=a=>(a||[]).sort((x,y)=>Number(x.attainment)-Number(y.attainment));
  sortT(CA.draft.coordinator.tiers);Object.values(CA.draft.coordinator_overrides||{}).forEach(p=>sortT(p.tiers));sortT(CA.draft.seller_tiers);
  await guarded(async()=>{await rpc('crm_commission_policy_save',{p_org:S.orgId,p_data:CA.draft});await caLoad(true);toast('Regras de comissionamento salvas',{icon:'check'})});refresh()};
ACT['ca-agr']=el=>{const s=CA.d.sellers.find(x=>x.id===el.dataset.id),p=el.dataset.p,a=caAgr(s.id,p);
  dialog({title:'Percentual do vendedor',sub:`${s.name} · ${p}`,submit:'Salvar',body:`<label class="fld">Percentual total do vendedor (%)<input class="in num" name="pct" type="number" step="0.01" min="0" max="100" required value="${a?a.percent:(caBase(p)??'')}"></label>
   <label class="fld">Motivo / observação<input class="in" name="note" maxlength="200" required placeholder="Ex.: acordo de meta, promoção…"></label>
   <div class="xs muted">Vale para vendas a partir de hoje. Vendas anteriores, baixas já feitas e a receita ALVO não mudam.</div>`,
   onSubmit:dlgAsync(async f=>{await rpc('crm_fin_agreement_save',{p_org:S.orgId,p_seller:s.id,p_platform:p,p_percent:Number(f.pct),p_note:f.note});await caLoad(true);FIN.d=null;finLoad(true);toast('Percentual atualizado',{icon:'check'})})})};
