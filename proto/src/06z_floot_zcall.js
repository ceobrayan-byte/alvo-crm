/* ===== Modo call: roteiro estruturado dentro da ficha do lead =====
   Call 1 = diagnóstico (sonho, capacidade, explicação do consórcio). Call 2 = apresentação da simulação e fechamento.
   Respostas atualizam a ficha do lead; o resultado move a etapa no funil e agenda a próxima call como tarefa. */
const clCap=t=>String(t||'').replace(/(^|\s)\S/g,c=>c.toUpperCase());
const CL={lead:null,kind:'Call 1',t0:0,tick:null,hist:{}};
const CL_SONHO=['Imóvel','Veículo','Investimento / renda','Alavancagem patrimonial','Reforma / construção','Outro'];
const CL_OBJ=[
 ['Demora para ser contemplado','Mostre a estratégia de lance (embutido + livre) e o histórico de lances do grupo. Quem planeja o lance antecipa a contemplação.'],
 ['Prefiro financiamento','Compare o custo total: no consórcio não há juros, só taxa de administração diluída. A diferença costuma pagar várias parcelas.'],
 ['Preciso falar com cônjuge/sócio','Ótimo sinal. Agende a Call 2 com os dois presentes e envie a simulação antes.'],
 ['Não tenho dinheiro para lance','Use o lance embutido (parte da própria carta) e a parcela reduzida até a contemplação.'],
 ['A parcela ficou alta','Ajuste crédito ou prazo, ou use parcela reduzida. Volte ao sonho: qual valor resolve de verdade?'],
 ['Vou pensar','Pergunte: "O que falta para você se sentir seguro?" e trate o ponto específico. Combine data de retorno.']];
const CL_DOCS=['RG ou CNH','CPF','Comprovante de residência','Comprovante de renda','E-mail e telefone confirmados'];
function clSteps(k,l){
  const v=(n,d)=>esc(l[n]??d??'');
  if(k==='Call 2')return[
   ['retomar','Retomar o sonho',`<p class="clsay">"${esc(clCap(fname(l.name||'')))}, na nossa conversa você me disse que o objetivo é <b>${v('sonho','—')}</b>, de cerca de <b>${esc(fBRL(l.valor_sonho))}</b>, com parcela confortável de <b>${esc(fBRL(l.capacidade))}</b>. Continua sendo isso?"</p>
     <label class="fld">Algo mudou desde a Call 1?<input class="in" name="mudou" placeholder="Ex.: quer antecipar para o meio do ano"></label>`],
   ['simulacao','Apresentar a simulação',`<div class="g" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
     <label class="fld">Administradora<select class="in" name="adm"><option value="">—</option>${['Canopus','CNP','Porto','Servopa','Âncora'].map(a=>`<option>${a}</option>`).join('')}</select></label>
     <label class="fld">Crédito<input class="in" name="credito" inputmode="numeric" value="${v('valor_sonho','')}"></label>
     <label class="fld">Parcela<input class="in" name="parcela_sim" inputmode="numeric"></label>
     <label class="fld">Prazo (meses)<input class="in" name="prazo" inputmode="numeric"></label>
     <label class="fld">Lance embutido (%)<input class="in" name="lance_emb" inputmode="decimal"></label>
     <label class="fld">Lance livre (R$)<input class="in" name="lance_livre" inputmode="numeric"></label></div>
     <p class="clsay">"Com essa estratégia de lance você fica entre os mais bem posicionados do grupo. E sem juros: o que você paga vira patrimônio."</p>`],
   ['objecoes','Tratar objeções',clObj()],
   ['fechamento','Fechamento',`<p class="clsay">"Faz sentido para você garantir essa cota hoje e já participar da próxima assembleia?"</p>
     <div class="xs muted" style="margin:6px 0">Documentos para seguir:</div><div class="clchips">${CL_DOCS.map((d,i)=>`<label class="clchk"><input type="checkbox" name="doc_${i}" value="${esc(d)}">${esc(d)}</label>`).join('')}</div>`]];
  return[
   ['abertura','Abertura · 2 min',`<p class="clsay">"Oi ${esc(clCap(fname(l.name||'')))}, aqui é ${esc(fname(user(ME).name||''))} da ALVO Investimentos. Hoje a ideia é entender o seu objetivo e mostrar como o consórcio pode te levar até ele. Leva uns 20 minutos, pode ser?"</p>
     <label class="clchk"><input type="checkbox" name="ok_abertura" value="1">Cliente disponível e com tempo para a call</label>`],
   ['sonho','O sonho',`<div class="g" style="grid-template-columns:1fr 1fr;gap:10px">
     <label class="fld">O que quer conquistar?<select class="in" name="sonho"><option value="">—</option>${CL_SONHO.map(s=>`<option ${l.sonho===s?'selected':''}>${s}</option>`).join('')}</select></label>
     <label class="fld">Valor do bem / crédito<input class="in" name="valor" inputmode="numeric" value="${l.valor_sonho?v('valor_sonho'):''}" placeholder="Ex.: 300000"></label>
     <label class="fld">Para quando?<select class="in" name="quando"><option value="">—</option>${['Até 6 meses','6 a 12 meses','1 a 2 anos','Sem pressa / planejamento'].map(s=>`<option>${s}</option>`).join('')}</select></label>
     <label class="fld">Por que agora?<input class="in" name="motivo" placeholder="Ex.: sair do aluguel, trocar de carro"></label></div>
     <p class="xs muted">Pergunte: "Se você já tivesse isso hoje, o que mudaria na sua vida?"</p>`],
   ['capacidade','Capacidade',`<div class="g" style="grid-template-columns:1fr 1fr;gap:10px">
     <label class="fld">Parcela que cabe no mês<input class="in" name="parcela" inputmode="numeric" value="${l.capacidade?v('capacidade'):''}" placeholder="Ex.: 1500"></label>
     <label class="fld">Tem recurso para lance?<input class="in" name="lance" inputmode="numeric" placeholder="Valor disponível (R$)"></label>
     <label class="fld">FGTS disponível? (imóvel)<select class="in" name="fgts"><option value="">—</option><option>Sim</option><option>Não</option></select></label>
     <label class="fld">Quem mais decide?<input class="in" name="decisor" placeholder="Ex.: esposa, sócio"></label></div>`],
   ['explicar','Consórcio em 1 minuto',`<p class="clsay">"O consórcio é um grupo de pessoas com o mesmo objetivo. Todo mês tem assembleia: alguém é contemplado por sorteio e outros por lance. Não tem juros, só uma taxa de administração diluída. Quando você é contemplado, recebe a carta de crédito e compra à vista."</p>
     <div class="clchips">${['Grupo e assembleia','Sorteio e lance','Sem juros','Carta de crédito à vista'].map((t,i)=>`<label class="clchk"><input type="checkbox" name="entendeu_${i}" value="${esc(t)}">${t}</label>`).join('')}</div>`],
   ['objecoes','Objeções',clObj()]];
}
function clObj(){return`<div class="clobj">${CL_OBJ.map(([t,a],i)=>`<label class="clchk"><input type="checkbox" name="obj_${i}" value="${esc(t)}" data-act="cl-obj">${esc(t)}<span class="xs muted clans">${esc(a)}</span></label>`).join('')}</div>`}
function clOutcomes(k){return k==='Call 2'
  ?[['fechou','Fechou! Ir para fechamento','badge-check'],['retorno','Vai pensar · agendar retorno','calendar-clock'],['noshow','Não compareceu','phone-missed'],['geladeira','Sem interesse agora · Geladeira','refrigerator']]
  :[['simulacao','Enviar simulação + agendar Call 2','send'],['call2','Agendar Call 2','calendar-plus'],['fechamento','Quer fechar já','badge-check'],['noshow','Não compareceu','phone-missed'],['geladeira','Sem interesse agora · Geladeira','refrigerator']]}
function clRender(){
  const l=FL.leads.find(x=>x.id===CL.lead);if(!l)return'';const k=CL.kind,steps=clSteps(k,l),ph=String(l.phone||'').replace(/\D/g,'');
  return`<div class="dlg clwin" role="dialog" aria-modal="true" aria-label="Modo call"><form data-form="dlg" class="col" style="gap:0">
   <div class="clhead"><div class="grow"><div class="eyebrow">Modo call · ${esc(l.stage)}</div><h3 class="disp" style="font-size:26px">${esc(l.name)}</h3>
     <div class="row wrap" style="gap:8px;margin-top:4px">${ph?`<a class="btn sm" href="tel:${ph}">${ic('phone')}${esc(fmtPhone(l.phone))}</a><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/55${ph.replace(/^55/,'')}">${ic('message-circle')}WhatsApp</a>`:''}
      <button type="button" class="btn sm pri" data-act="cl-meet">${ic('video')}Abrir Google Meet</button><div class="row" role="tablist" style="gap:4px">${['Call 1','Call 2'].map(x=>`<button type="button" class="btn sm ${k===x?'pri':''}" data-act="cl-kind" data-id="${x}">${x}</button>`).join('')}</div></div></div>
     <div class="cltimer"><span class="xs muted">Duração</span><b id="cltime" class="num">00:00</b></div>
     <button type="button" class="ibtn" data-act="close-modal" aria-label="Fechar">${ic('x')}</button></div>
   <div class="clmeet"><span class="xs muted">${ic('video')} Videochamada</span><input class="in" id="clmeet" name="meet" placeholder="Cole aqui o link do Meet (meet.google.com/…)" value="${esc(CL.meet||'')}">
     <button type="button" class="btn sm" data-act="cl-inv-wa">${ic('message-circle')}Enviar convite no WhatsApp</button><button type="button" class="btn sm ghost" data-act="cl-inv-copy">${ic('copy')}Copiar convite</button></div>
   <div class="clbody"><nav class="clnav">${steps.map((s,i)=>`<button type="button" data-act="cl-go" data-id="cl-${s[0]}"><span>${i+1}</span>${esc(s[1])}</button>`).join('')}<button type="button" data-act="cl-go" data-id="cl-resultado"><span>✓</span>Resultado</button></nav>
    <div class="clsteps" id="clsteps">${steps.map((s,i)=>`<section id="cl-${s[0]}" class="clstep"><div class="eyebrow">Etapa ${i+1}</div><h4>${esc(s[1])}</h4>${s[2]}</section>`).join('')}
     <section id="cl-resultado" class="clstep"><div class="eyebrow">Fechar a call</div><h4>Resultado</h4>
      <div class="clout">${clOutcomes(k).map(([v,t,icn],i)=>`<label class="clopt"><input type="radio" name="outcome" value="${v}" ${i===0?'required':''}>${ic(icn)}<span>${t}</span></label>`).join('')}</div>
      <div class="g" style="grid-template-columns:1fr 1fr;gap:10px;margin-top:10px"><label class="fld">Próxima call / retorno<input class="in" type="datetime-local" name="next_at"></label><div class="xs muted" style="align-self:end">Vira tarefa na agenda do responsável.</div></div>
      <label class="fld">Anotações da call<textarea class="in" name="notes" rows="3" maxlength="2000" placeholder="O que o cliente falou, combinados, pontos de atenção"></textarea></label>
     </section></div></div>
   <div class="row clfoot"><span class="xs muted grow">As respostas atualizam a ficha do lead e a etapa no funil.</span><button type="button" class="btn" data-act="close-modal">Cancelar</button><button class="btn pri" type="submit">${ic('save')}Salvar call</button></div>
  </form></div>`;
}
function clOpen(id,kind){const l=FL.leads.find(x=>x.id===id);if(!l)return;
  CL.lead=id;CL.kind=kind||(/Call 2|Simulação|Fechamento|Segundo/.test(l.stage)?'Call 2':'Call 1');CL.t0=Date.now();
  S.ui.dlgSubmit=f=>{clSave(f);return false};openModal(clRender);clTick()}
function clTick(){clearInterval(CL.tick);CL.tick=setInterval(()=>{const e=$('#cltime');if(!e){clearInterval(CL.tick);return}const s=Math.floor((Date.now()-CL.t0)/1000);e.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0')},1000)}
async function clSave(f){
  const l=FL.leads.find(x=>x.id===CL.lead);if(!l)return;
  const ans={};Object.entries(f).forEach(([k,v])=>{if(['outcome','next_at','notes'].includes(k)||v==='')return;const m=k.match(/^(obj|doc|entendeu)_\d+$/);if(m){(ans[m[1]]=ans[m[1]]||[]).push(v)}else ans[k]=v});
  const next=f.next_at?new Date(f.next_at).toISOString():null;
  await guarded(async()=>{const r=await rpc('crm_call_save',{p_org:S.orgId,p_lead:l.id,p_data:{kind:CL.kind,outcome:f.outcome,next_at:next,notes:f.notes||'',answers:ans,started_at:new Date(CL.t0).toISOString(),duration_s:Math.round((Date.now()-CL.t0)/1000)}});
    flReplace(r.lead);delete CL.hist[l.id];clearInterval(CL.tick);closeModal();
    toast(`${esc(CL.kind)} registrada · ${esc(l.name)} agora em <b>${esc(r.lead.stage)}</b>${next?' · próxima call agendada nas tarefas':''}`,{icon:'phone-call',ms:6000});
    if(f.outcome==='fechou'||f.outcome==='fechamento')setTimeout(()=>{if(confirm('Abrir agora a efetivação da venda deste cliente?'))ACT['lead-sell']({dataset:{id:l.id}})},300);
    if(next)reload().catch(()=>{});refresh();if(S.ui.drawer)redrawDrawer()})}
ACT['cl-start']=el=>{CL.meet='';clOpen(el.dataset.id)};
/* Google Meet ao lado do CRM (o Google não permite abrir o Meet dentro de outro site) */
ACT['cl-meet']=()=>{const W=screen.availWidth||1440,H=screen.availHeight||900,w=Math.round(W*.55);
  const win=window.open('https://meet.google.com/new','alvo-meet',`popup=yes,width=${w},height=${H},left=${W-w},top=0`);
  if(!win){toast('O navegador bloqueou a janela. Permita pop-ups para crm.alvoinvestimentos.com.br.',{icon:'triangle-alert',ms:7000});return}
  toast('Meet aberto ao lado. Ele usa a conta Google logada neste navegador (o e-mail do vendedor). Copie o link da reunião e cole no campo "Videochamada".',{icon:'video',ms:9000})};
const clInvite=()=>{const l=FL.leads.find(x=>x.id===CL.lead)||{},link=(($('#clmeet')||{}).value||'').trim();CL.meet=link;
  if(!/^https:\/\/meet\.google\.com\/[a-z0-9-]+/i.test(link)){toast('Cole o link do Meet (https://meet.google.com/...) no campo Videochamada.',{icon:'triangle-alert'});return null}
  return{l,link,msg:`Olá, ${clCap(fname(l.name||''))}! Aqui é ${fname(user(ME).name||'')} da ALVO Investimentos. Segue o link da nossa videochamada: ${link}`}};
ACT['cl-inv-wa']=()=>{const r=clInvite();if(!r)return;const ph=String(r.l.phone||'').replace(/\D/g,'').replace(/^55/,'');window.open(`https://wa.me/${ph?'55'+ph:''}?text=${encodeURIComponent(r.msg)}`,'_blank','noopener')};
ACT['cl-inv-copy']=()=>{const r=clInvite();if(!r)return;try{navigator.clipboard.writeText(r.msg).then(()=>toast('Convite copiado',{icon:'copy'}))}catch(e){}};
document.addEventListener('input',ev=>{if(ev.target&&ev.target.id==='clmeet')CL.meet=ev.target.value});
ACT['cl-kind']=el=>{CL.kind=el.dataset.id;openModal(clRender);clTick()};
ACT['cl-go']=(el,ev)=>{try{ev&&ev.preventDefault&&ev.preventDefault()}catch(e){}const t=document.getElementById(el.dataset.id);if(t)t.scrollIntoView({behavior:'smooth',block:'start'})};
ACT['cl-obj']=()=>{};
/* histórico de calls na ficha do lead */
async function clHist(id){try{CL.hist[id]=await rpc('crm_lead_calls',{p_org:S.orgId,p_lead:id})}catch(e){CL.hist[id]=[]}if(S.ui.drawer)redrawDrawer()}
const CL_OUT={simulacao:'Simulação enviada',call2:'Call 2 agendada',fechamento:'Quer fechar',fechou:'Fechou',retorno:'Retorno agendado',noshow:'Não compareceu',geladeira:'Geladeira'};
{const LD0=leadDrawer;leadDrawer=function(id){let h=LD0(id);if(!LIVE)return h;const l=FL.leads.find(x=>x.id===id);if(!l)return h;
  if(CL.hist[id]===undefined){CL.hist[id]=null;clHist(id)}
  const hs=CL.hist[id];
  const box=`<div><div class="row sp" style="margin-bottom:8px"><div class="eyebrow">Calls</div><button class="btn sm pri" data-act="cl-start" data-id="${l.id}">${ic('phone-call')}Iniciar call</button></div>
   <div class="col" style="gap:6px">${hs==null?'<div class="xs muted">Carregando…</div>':hs.length?hs.slice(0,6).map(c=>`<div class="card" style="padding:10px 12px"><div class="row sp"><b class="sm">${esc(c.kind)} · ${esc(CL_OUT[c.outcome]||c.outcome||'')}</b><span class="xs muted">${esc(new Date(c.created_at).toLocaleString('pt-BR',{timeZone:'America/Cuiaba',dateStyle:'short',timeStyle:'short'}))}</span></div>
     <div class="xs muted">${esc(c.by_name||'')}${c.duration_s?' · '+Math.round(c.duration_s/60)+' min':''}${c.next_at?' · próxima: '+esc(new Date(c.next_at).toLocaleString('pt-BR',{timeZone:'America/Cuiaba',dateStyle:'short',timeStyle:'short'})):''}</div>
     ${c.answers&&c.answers.obj?`<div class="xs">Objeções: ${esc(c.answers.obj.join(', '))}</div>`:''}${c.notes?`<div class="xs" style="margin-top:2px">${esc(c.notes)}</div>`:''}</div>`).join(''):'<div class="xs muted">Nenhuma call registrada. Use "Iniciar call" para seguir o roteiro.</div>'}</div></div>`;
  return h.replace('<div class="dr-b">','<div class="dr-b">'+box)}}
