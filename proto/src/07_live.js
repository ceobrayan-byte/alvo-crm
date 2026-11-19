/* ===== Camada ao vivo: entrada, leitura e gravação no Supabase =====
   Só roda quando a página define window.__LIVE. As telas continuam as mesmas: aqui os dados reais
   são colocados no mesmo formato que o protótipo usava, e as ações passam a chamar as funções do banco. */
(function(){
if(!window.__LIVE)return;
LIVE=true;
const CFG=window.__CFG||{};
const LS={stage:{},info:{},orgList:[],at:0,busy:false,after:null,notice:null,started:false};
const RK={PROPRIETARIO:'Proprietário',ADMINISTRADOR:'Administrador',GESTOR:'Coordenador',VENDEDOR:'Vendedor',SUPORTE:'Suporte',FINANCEIRO:'Financeiro'};
const RKI=Object.fromEntries(Object.entries(RK).map(([k,v])=>[v,k]));
const cap1=s=>{s=String(s||'').toLowerCase();return s.charAt(0).toUpperCase()+s.slice(1)};
let sb=null;

/* ----- utilitários ----- */
const rpcRaw=async(fn,args)=>{const{data,error}=await sb.rpc(fn,args||{});if(error)throw error;return data};
/* ----- "Ver como": o dono/administrador vê o CRM exatamente como um membro da equipe vê (somente leitura) ----- */
const PV={on:false,id:null,name:'',roleKey:null,scope:null,perms:{},realMe:null,team:{}};
const PV_READ=new Set(['crm_boot','crm_me','crm_team','crm_leads_board','crm_cold_list','crm_customers_list','crm_cases_list','crm_fin_list','crm_mail_audience']);
const pvVis=o=>o==null||o===PV.id||PV.scope==='ORGANIZACAO'||(PV.scope==='EQUIPE'&&PV.team[PV.id]&&PV.team[o]===PV.team[PV.id]);
function pvFilter(fn,d){
  const office=(PV.perms.suporte||0)>=3,admin=(PV.perms.equipe||0)>=3;
  if(fn==='crm_boot'&&d&&d.me){d=Object.assign({},d);d.me=Object.assign({},d.me,{role:PV.roleKey,data_scope:PV.scope,permissions:PV.perms,user:{id:PV.id,name:PV.name,email:''}});
    d.leads=(d.leads||[]).filter(l=>pvVis(l.owner_user_id));d.deals=(d.deals||[]).filter(x=>pvVis(x.owner_user_id));d.tasks=(d.tasks||[]).filter(t=>pvVis(t.assigned_user_id));
    if(!(PV.perms.equipe>=1))d.invites=[];return d}
  if(fn==='crm_leads_board')return(d||[]).filter(l=>l.stage==='Geladeira'||pvVis(l.owner_user_id));
  if(fn==='crm_cases_list')return office?d:(d||[]).filter(c=>pvVis(c.seller_user_id));
  if(fn==='crm_customers_list'){if(office)return d;return(d||[]).map(c=>Object.assign({},c,{cases:(c.cases||[]).filter(k=>pvVis(k.seller_user_id))})).filter(c=>pvVis(c.owner_user_id)||c.cases.length)}
  if(fn==='crm_fin_list'&&d){if(office)return Object.assign({},d,{admin,agreements:admin?d.agreements:[]});
    const cases=(d.cases||[]).filter(c=>pvVis(c.seller_user_id)),ids=new Set(cases.map(c=>c.id));
    return Object.assign({},d,{office:false,admin,cases,events:(d.events||[]).filter(e=>e.kind==='VENDEDOR'&&pvVis(e.seller_user_id)),installments:(d.installments||[]).filter(i=>ids.has(i.case_id)),agreements:admin?d.agreements:[]})}
  return d;
}
const rpc=async(fn,args)=>{
  if(PV.on&&!PV_READ.has(fn))throw Object.assign(new Error(`Modo "Ver como": você está vendo o CRM como ${PV.name}. Nada é gravado nesse modo.`),{code:'PV'});
  const d=await rpcRaw(fn,args);return PV.on?pvFilter(fn,d):d;
};
function errMsg(e){
  const m=(e&&e.message)||String(e);
  if(/Failed to fetch|NetworkError|Load failed/i.test(m))return'Sem conexão com o servidor. Verifique a internet e tente de novo. Se persistir, o banco pode estar pausado por inatividade.';
  if(/JWT expired|invalid JWT/i.test(m))return'Sua sessão expirou. Entre de novo.';
  if(e&&e.code==='42501'&&!/permiss|encontrad|outro e-mail|vinculado|sess|acesso/i.test(m))return'Você não tem permissão para esta ação.';
  if(e&&e.code==='23505')return'Esse registro já existe.';
  return m;
}
function fail(e){
  const m=errMsg(e);
  if(/sess(ão|ao) expirou/i.test(m)){sb.auth.signOut().finally(()=>showLogin('Sua sessão expirou. Entre de novo.'));return}
  toast(esc(m),{icon:'triangle-alert',ms:6500});
}
async function guarded(fn){
  if(LS.busy)return false;LS.busy=true;
  try{await fn();return true}catch(e){fail(e);return false}
  finally{LS.busy=false;const b=$('#modal form button.pri');if(b)b.disabled=false}
}
function dlgAsync(fn){
  return f=>{
    const b=$('#modal form button.pri');if(b)b.disabled=true;
    guarded(()=>fn(f)).then(ok=>{if(ok){closeModal();if(LS.after){const a=LS.after;LS.after=null;setTimeout(a,30)}}});
    return false;
  };
}
const soon=()=>toast('Esta função chega na próxima etapa. Por enquanto ela não grava nada.',{icon:'clock'});
const fmtPhone=raw=>{
  let d=String(raw||'').replace(/\D/g,'');if(d.length>11&&d.startsWith('55'))d=d.slice(2);
  if(d.length===11)return`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if(d.length===10)return`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return d||'—';
};
const isoDay=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
function computeCycle(startDay){
  const t=new Date();let m=t.getMonth();if(t.getDate()<startDay)m--;
  const start=new Date(t.getFullYear(),m,startDay),end=new Date(t.getFullYear(),m+1,startDay-1,23,59,59);
  let bdT=0,bdD=0;
  for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)){const w=d.getDay();if(w>0&&w<6){bdT++;if(d<=t)bdD++}}
  Object.assign(CYCLE,{start,end,bdTotal:bdT,bdDone:bdD,dayN:Math.floor((t-start)/D)+1,dayTotal:Math.round((end-start)/D)+1});
}
const inviteToken=()=>{const m=/[#&]convite=([A-Za-z0-9]+)/.exec(location.hash||'');return m?m[1]:null};
const clearInvite=()=>{try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}};

/* ----- telas de entrada ----- */
function authShell(inner){$('#app').innerHTML=`<div class="auth"><div class="auth-card"><img src="${LOGO_IVORY}" alt="ALVO">${inner}</div></div>`}
function authErr(m,ok){const e=$('#aerr');if(e){e.className=ok?'ok':'err';e.textContent=m||''}}
function authMsg(e){
  const m=(e&&e.message)||String(e);
  if(/Invalid login credentials/i.test(m))return'E-mail ou senha incorretos.';
  if(/Email not confirmed/i.test(m))return'Confirme seu e-mail pelo link que enviamos antes de entrar.';
  if(/already registered|already been registered/i.test(m))return'Este e-mail já tem conta. Use Entrar.';
  if(/Password should be|at least/i.test(m))return'A senha precisa ter pelo menos 8 caracteres.';
  if(/rate limit|too many/i.test(m))return'Muitas tentativas. Aguarde alguns minutos.';
  if(/signups? (not allowed|disabled)/i.test(m))return'Cadastro desativado. Peça ao administrador para criar seu acesso.';
  return errMsg(e);
}
function showLogin(msg,mode){
  const inv=inviteToken();mode=mode||(inv?'signup':'login');
  const su=mode==='signup';
  authShell(`<div><div class="eyebrow">Plataforma Comercial</div><h1>${su?'Criar conta':'Entrar'}</h1></div>
   ${inv?'<p class="sm muted">Você recebeu um convite. Use o mesmo e-mail para o qual ele foi enviado.</p>':''}
   <form id="af" class="col" style="gap:14px" novalidate>
    ${su?'<label class="fld">Seu nome<input class="in" name="name" required maxlength="60" autocomplete="name"></label>':''}
    <label class="fld">E-mail<input class="in" type="email" name="email" required autocomplete="username"></label>
    <label class="fld">Senha<input class="in" type="password" name="pw" required minlength="8" autocomplete="${su?'new-password':'current-password'}"></label>
    <div class="err" id="aerr" role="alert">${esc(msg||'')}</div>
    <button class="btn pri" type="submit">${su?'Criar conta':'Entrar'}</button>
   </form>
   <button class="lnk" id="swm" type="button">${su?'Já tenho conta. Entrar':(inv?'Ainda não tenho conta. Criar conta':'')}</button>
   ${su?'':'<button class="lnk" id="forgot" type="button">Esqueci minha senha</button>'}`);
  const f=$('#af');f.querySelector('input').focus();
  const sw=$('#swm');if(sw)sw.onclick=()=>showLogin('',su?'login':'signup');
  const fg=$('#forgot');
  if(fg)fg.onclick=async()=>{
    const em=f.email.value.trim();if(!em)return authErr('Digite seu e-mail e clique de novo.');
    try{const{error}=await sb.auth.resetPasswordForEmail(em,{redirectTo:location.origin+location.pathname});if(error)throw error;authErr('Se o e-mail existir, enviamos o link para criar uma nova senha.',true)}catch(e){authErr(authMsg(e))}
  };
  f.onsubmit=async ev=>{
    ev.preventDefault();const em=f.email.value.trim(),pw=f.pw.value;
    if(!em||!pw)return authErr('Preencha e-mail e senha.');
    if(su&&pw.length<8)return authErr('A senha precisa ter pelo menos 8 caracteres.');
    const btn=f.querySelector('button.pri');btn.disabled=true;authErr('');
    try{
      if(su){
        const{data,error}=await sb.auth.signUp({email:em,password:pw,options:{data:{name:f.name.value.trim()},emailRedirectTo:location.origin+location.pathname+(inv?'#convite='+inv:'')}});
        if(error)throw error;
        if(!data.session){authErr('Enviamos um e-mail para confirmar sua conta. Depois de confirmar, volte aqui e entre.',true);btn.disabled=false;return}
      }else{
        const{error}=await sb.auth.signInWithPassword({email:em,password:pw});if(error)throw error;
      }
      await enter();
    }catch(e){authErr(authMsg(e));btn.disabled=false}
  };
}
function showNewPassword(forced){
  authShell(`<div><div class="eyebrow">Plataforma Comercial</div><h1>${forced?'Defina sua senha':'Nova senha'}</h1></div>${forced?'<p class="sm muted">A senha provisória serve só para o primeiro acesso. Escolha uma senha sua, com pelo menos 8 caracteres.</p>':''}
   <form id="af" class="col" style="gap:14px" novalidate><label class="fld">Nova senha<input class="in" type="password" name="pw" required minlength="8" autocomplete="new-password"></label>
   <div class="err" id="aerr" role="alert"></div><button class="btn pri" type="submit">Salvar senha</button></form>`);
  $('#af').onsubmit=async ev=>{ev.preventDefault();const pw=ev.target.pw.value;if(pw.length<8)return authErr('A senha precisa ter pelo menos 8 caracteres.');
    try{const{error}=await sb.auth.updateUser({password:pw,data:{temp_pw:false}});if(error)throw error;await enter()}catch(e){authErr(authMsg(e))}};
}
function showUnlinked(msg){
  authShell(`<div><div class="eyebrow">Plataforma Comercial</div><h1>Acesso pendente</h1></div>
   <p class="sm" style="line-height:1.6">Seu login existe, mas ainda não está vinculado a uma organização. ${esc(msg||'Peça um convite ao administrador e abra o link recebido.')}</p>
   <button class="btn pri" id="retry" type="button">Tentar de novo</button><button class="btn" id="out" type="button">Sair</button>`);
  $('#retry').onclick=()=>enter();$('#out').onclick=()=>signOut();
}
function showFatal(e){
  authShell(`<div><div class="eyebrow">Plataforma Comercial</div><h1>Não foi possível carregar</h1></div>
   <p class="sm" style="line-height:1.6">${esc(errMsg(e))}</p><button class="btn pri" id="retry" type="button">Tentar de novo</button><button class="btn" id="out" type="button">Sair</button>`);
  $('#retry').onclick=()=>enter();$('#out').onclick=()=>signOut();
}
async function signOut(){try{await sb.auth.signOut()}catch(e){}location.reload()}

/* ----- leitura: banco -> formato das telas ----- */
async function loadOrg(orgId,me,b){
  /* uma só chamada (crm_boot) traz tudo: antes eram ~14 requisições em 4 rodadas */
  if(!b)b=await rpc('crm_boot',{p_org:orgId});
  if(b.me)me=b.me;
  LS.roles=b.roles||[];LS.permRows=b.perms||[];LS.team=b.team||[];
  const org=b.org||{},perm=b.perms||[],teams=b.teams||[],pipes=b.pipes||[],stages=b.stages||[],team=b.team||[];
  const leads=b.leads||[],deals=b.deals||[],tasks=b.tasks||[],xp=b.xp||[],invs=b.invites||[];
  /* funis */
  Object.keys(PIPES).forEach(k=>delete PIPES[k]);LS.stage={};LS.info={};
  const pk={};
  pipes.forEach(p=>{
    pk[p.id]=p.key;LS.stage[p.key]={};
    const st=stages.filter(s=>s.pipeline_id===p.id).sort((a,b)=>a.sort-b.sort);
    PIPES[p.key]={label:p.name,stages:st.map(s=>({id:s.key,label:s.label,p:+s.probability||0,won:s.kind==='GANHA',lost:s.kind==='PERDIDA'}))};
    st.forEach(s=>{LS.stage[p.key][s.key]=s.id;LS.info[s.id]={pipe:p.key,key:s.key,kind:s.kind}});
  });
  if(!PIPES[S.v.pipe])S.v.pipe=Object.keys(PIPES)[0]||'comercial';
  /* ciclo */
  const startDay=org.cycle_start_day||15;computeCycle(startDay);
  const cycleIso=isoDay(CYCLE.start);
  /* equipe */
  const users0=team.map(m=>({id:m.id,team_id:m.team_id||null,name:m.name,cargo:m.job_title||RK[m.role]||m.role,team:m.team||'—',role:RK[m.role]||m.role,sell:m.is_seller!==false&&!['SUPORTE','FINANCEIRO'].includes(m.role),
    status:m.status==='ATIVO'?'Ativo':'Inativo',email:m.email||'',last:m.last_access_at?new Date(m.last_access_at):new Date(0)}));
  const myTeam=(team.find(m=>m.id===me.user.id)||{}).team_id||null;
  const users=me.data_scope==='EQUIPE'?users0.filter(u=>u.id===me.user.id||(myTeam&&u.team_id===myTeam)):users0;
  if(!users.some(u=>u.id===me.user.id))users.unshift({id:me.user.id,name:me.user.name,cargo:RK[me.role]||me.role,team:'—',role:RK[me.role]||me.role,sell:true,status:'Ativo',email:me.user.email||'',last:new Date()});
  /* telas por perfil (menu) */
  const screens={};(b.screens||[]).forEach(r=>{const lab=RK[r.role_key];if(!lab)return;(screens[lab]=screens[lab]||{})[r.screen]=r.level});
  /* permissões */
  const perms={};ROLES.forEach(r=>perms[r]=MODS.map(()=>0));
  perm.forEach(p=>{const lab=RK[p.role_key],mi=MODS.findIndex(m=>m[0]===p.module);if(lab&&mi>=0)perms[lab][mi]=p.level});
  const myLab=RK[me.role];if(myLab&&me.permissions)MODS.forEach((m,i)=>{if(me.permissions[m[0]]!=null)perms[myLab][i]=me.permissions[m[0]]});
  /* contatos, negócios, tarefas */
  const prodOf={};
  const contacts=leads.map(l=>{prodOf[l.id]=l.product_interest||'Imóvel';
    return{id:l.id,name:l.name,phone:fmtPhone(l.phone),email:l.email||'',city:org.city||'',origin:l.origin||'—',product:l.product_interest||'Imóvel',admin:'—',credit:+l.desired_credit||0,owner:l.owner_user_id,tags:l.tags||[],createdAt:new Date(l.created_at),lastInt:new Date(l.updated_at),notes:''}});
  const cset=new Set(contacts.map(c=>c.id));
  const dls=deals.filter(d=>d.lead_id&&cset.has(d.lead_id)&&LS.info[d.stage_id]).map(d=>{const si=LS.info[d.stage_id];
    return{id:d.id,contactId:d.lead_id,pipe:si.pipe,stage:si.key,value:+d.credit_value||0,product:prodOf[d.lead_id],admin:'—',temp:cap1(d.temperature),owner:d.owner_user_id,
      entered:Math.max(0,Math.floor((Date.now()-new Date(d.stage_entered_at))/D)),lost:si.kind==='PERDIDA',reason:d.lost_reason||'',wonAt:d.won_at?new Date(d.won_at):null,createdAt:new Date(d.created_at)}});
  const tks=tasks.map(t=>{const ty=String(t.task_type||'').toLowerCase();
    return{id:t.id,title:t.title,type:TLABEL[ty]?ty:'whatsapp',due:t.due_at?new Date(t.due_at):new Date(Date.now()+D),done:t.status==='CONCLUIDA',owner:t.assigned_user_id,contactId:t.lead_id||null,dealId:t.deal_id||null,xp:5}});
  /* XP e ranking */
  const rules={};
  const g={};users.forEach(u=>g[u.id]={xp:0,cycleXp:0,streak:0,counters:{won:0,fast:0,fastWeek:0,docsClean:0,callsDone:0,teamCh:0,tidyDays:0,tasks:0},ach:[],caps:{},log:[]});
  const label=k=>(XP_RULES[k]&&XP_RULES[k].label)||k;
  xp.forEach(r=>{const x=g[r.user_id];if(!x)return;x.xp+=r.xp;if(String(r.occurred_on)>=cycleIso)x.cycleXp+=r.xp});
  xp.filter(r=>r.user_id===me.user.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,10).forEach(r=>g[me.user.id].log.push({t:new Date(r.created_at),label:label(r.action_key),xp:r.xp}));
  dls.filter(d=>d.pipe==='comercial'&&d.stage==='ganho'&&g[d.owner]).forEach(d=>g[d.owner].counters.won++);
  /* convites */
  const tname=Object.fromEntries(teams.map(t=>[t.id,t.name]));
  const invites=invs.filter(i=>i.status!=='ACEITO'&&i.status!=='REVOGADO').map(i=>({id:i.id,email:i.email,role:RK[i.role_key]||i.role_key,team:tname[i.team_id]||'—',
    status:(i.status==='PENDENTE'&&new Date(i.expires_at)>new Date())?'Pendente':'Expirado',sent:new Date(i.created_at)}));
  const goalSet=+org.goal_credit>0;
  return{id:org.id,name:org.name,sub:org.city||'',mark:(org.name||'?').trim().charAt(0).toUpperCase(),plan:PLANS[org.plan_key]?org.plan_key:'essencial',seats:org.seats,seed:0,nContacts:0,ddd:'',city:org.city||'',
    goal:goalSet?+org.goal_credit:1,goalSet,users,contacts,deals:dls,tasks:tks,convs:[],g,hist:[],spark:[[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]],invoices:[],perms,screens,invites,tickets:[],notifs:[],inst:[],
    teams:teams.map(t=>({id:t.id,name:t.name}))};
}
const stub=x=>({id:x.id,name:x.name,sub:'',mark:(x.name||'?').trim().charAt(0).toUpperCase(),plan:PLANS[x.plan]?x.plan:'essencial',users:[{id:ME,role:RK[x.role]||'Vendedor'}],contacts:[],deals:[],tasks:[],convs:[],notifs:[],inst:[],invites:[],tickets:[],invoices:[],hist:[],g:{},perms:{},teams:[]});

async function reload(){
  const b=await rpc('crm_boot',{p_org:S.orgId});
  S.orgs[S.orgId]=await loadOrg(S.orgId,b.me,b);LS.at=Date.now();
  refresh();redrawDrawer();
}

/* ----- entrada ----- */
async function enter(){
  $('#app').innerHTML='<div class="auth-load" role="status">Carregando…</div>';
  let me;
  try{const{data}=await sb.auth.getSession();const u=data&&data.session&&data.session.user;if(u&&u.user_metadata&&u.user_metadata.temp_pw)return showNewPassword(true)}catch(e){}
  try{
    const tok=inviteToken();
    if(tok){clearInvite();try{await rpc('crm_accept_invitation',{p_token:tok});LS.notice='Convite aceito. Bem-vindo(a)!'}catch(e){LS.notice=errMsg(e)}}
    const boot0=await rpc('crm_boot',{p_org:null});me=boot0.me;
    if(!me.linked||!me.active_org){showUnlinked(LS.notice&&!/aceito/.test(LS.notice)?LS.notice:'');LS.notice=null;return}
    ME=me.user.id;LS.orgList=me.organizations;LS.myRole=me.role;
    S.orgs={};me.organizations.forEach(x=>S.orgs[x.id]=stub(x));
    S.orgs[me.active_org]=await loadOrg(me.active_org,me,boot0);S.orgId=me.active_org;
  }catch(e){return showFatal(e)}
  resetViewState();LS.at=Date.now();
  boot();
  /* já busca, em segundo plano, os dados de Leads, Clientes e Financeiro para as telas abrirem na hora */
  setTimeout(()=>{try{flLoad();fcLoad();finLoad()}catch(e){}},50);
  if(!LS.started){LS.started=true;
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-LS.at>90000&&!S.ui.modal&&!S.ui.drawer&&!LS.busy)reload().catch(()=>{})});
  }
  if(LS.notice){toast(esc(LS.notice),{icon:'info',ms:6000});LS.notice=null}
}

/* ----- gravação: troca das ações locais pelas funções do banco ----- */
moveDeal=async function(id,stage,reason){
  const d=deal(id);if(!d||d.stage===stage)return;
  const st=stageOf(d.pipe,stage);if(!st)return;
  if(st.lost&&!reason)return loseDialog(id);
  await guarded(async()=>{
    const r=await rpc('crm_move_deal',{p_deal:id,p_stage:LS.stage[d.pipe][stage],p_lost_reason:reason||null});
    await reload();
    if(st.won&&d.pipe==='comercial')toast(`Venda efetivada · <b>${brlK(d.value)}</b>. Caso criado no pós-venda.`,{icon:'badge-check',ms:5200,act:'go',id:'funis',actLabel:'Ver'});
    else toast(`Negócio movido para <b>${esc(st.label)}</b>`,{icon:'arrow-right'});
    if(r&&r.xp>0)toast(`<b>+${r.xp} XP</b> pelo resultado`,{xp:1,icon:'zap'});
  });
};
winDeal=id=>moveDeal(id,'ganho');
loseDialog=id=>{
  const d=deal(id),ls=PIPES[d.pipe].stages.find(s=>s.lost);
  if(!ls)return toast('Este funil não tem etapa de perda.',{icon:'info'});
  dialog({title:'Marcar como perdido',sub:contact(d.contactId).name,submit:'Confirmar perda',
    body:`<label class="fld">Motivo<select class="in" name="reason"><option>Sem retorno do cliente</option><option>Optou por outra administradora</option><option>Sem renda comprovada</option><option>Preço acima do esperado</option><option>Desistiu do consórcio</option></select></label>
    <p class="sm muted">O negócio fica no funil, na coluna Perdido, e pode ser reaberto arrastando para outra etapa.</p>`,
    onSubmit:f=>{moveDeal(id,ls.id,f.reason)}});
};
award=()=>0;   // o XP agora é concedido pelo banco

ACT['task-done']=el=>{
  const t=O().tasks.find(x=>x.id===el.dataset.id);if(!t||t.done)return;const late=t.due<now();
  guarded(async()=>{
    const r=await rpc('crm_complete_task',{p_task:t.id});await reload();
    if(r&&r.xp>0)toast(`<b>+${r.xp} XP</b> · tarefa em dia`,{xp:1,icon:'zap'});
    else if(late)toast('Tarefa concluída fora do prazo. O XP vale só para tarefas em dia.',{icon:'check'});
    else toast('Tarefa concluída',{icon:'check'});
  });
};
ACT['new-task']=el=>{
  const o=O(),d=el.dataset.id&&deal(el.dataset.id),pre=el.dataset.cid||(d&&d.contactId)||'',tm=new Date(now().getTime()+2*H);
  dialog({title:'Nova tarefa',sub:o.name,submit:'Criar tarefa',body:`
   <label class="fld">Título<input class="in" name="title" required maxlength="90" placeholder="Ex.: Enviar simulação"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Tipo<select class="in" name="type">${Object.keys(TLABEL).map(k=>`<option value="${k}">${TLABEL[k]}</option>`).join('')}</select></label>
   <label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>
   <label class="fld">Data<input class="in" type="date" name="date" required value="${isoDay(tm)}"></label><label class="fld">Hora<input class="in" type="time" name="time" required value="${pad(tm.getHours())}:00"></label></div>
   <label class="fld">Contato<select class="in" name="contact"><option value="">Sem contato</option>${o.contacts.map(c=>`<option value="${c.id}" ${c.id===pre?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`,
   onSubmit:f=>{
     const due=new Date(f.date+'T'+f.time);if(isNaN(due)){toast('Data ou hora inválida',{icon:'x'});return false}
     return dlgAsync(async()=>{
       await rpc('crm_create_task',{p_org:S.orgId,p_title:f.title.trim(),p_due_at:due.toISOString(),p_task_type:f.type.toUpperCase(),p_deal:d?d.id:null,p_lead:f.contact||null,p_assignee:f.owner===ME?null:f.owner});
       await reload();toast('Tarefa criada',{icon:'list-checks'});
     })(f);
   }});
};
ACT['new-contact']=()=>{
  const o=O();
  dialog({title:'Novo contato',sub:o.name,submit:'Salvar contato',body:`
   <label class="fld">Nome completo<input class="in" name="name" required maxlength="80" placeholder="Ex.: Ana Beatriz Moreira"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Telefone<input class="in" name="phone" required placeholder="(65) 90000-0000"></label><label class="fld">E-mail<input class="in" name="email" type="email" placeholder="nome@exemplo.com.br"></label>
   <label class="fld">Origem<select class="in" name="origin">${ORIGINS.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>
   <label class="fld">Produto<select class="in" name="product"><option>Imóvel</option><option>Veículo</option><option>Pesados</option><option>Serviços</option></select></label><label class="fld">Crédito desejado (R$)<input class="in num" name="credit" type="number" min="0" step="5000" value="200000"></label></div>
   <label class="row sm"><input class="chk" type="checkbox" name="mkdeal" checked> Criar negócio no funil Comercial</label>`,
   onSubmit:dlgAsync(async f=>{
     const credit=+f.credit||0;
     const c=await rpc('crm_upsert_contact',{p_org:S.orgId,p_name:f.name.trim(),p_phone:f.phone,p_email:f.email||null,p_origin:f.origin,p_product_interest:f.product,p_desired_credit:credit,p_owner:f.owner===ME?null:f.owner});
     if(f.mkdeal)await rpc('crm_create_deal',{p_org:S.orgId,p_lead:c.id,p_pipeline_key:'comercial',p_credit:credit});
     await reload();
     toast(`Contato <b>${esc(c.name)}</b> salvo${f.mkdeal?' e negócio criado em Novo lead':''}`,{icon:'user-plus',act:'open-contact',id:c.id,actLabel:'Abrir'});
   })});
};
ACT['new-deal']=()=>{
  const o=O(),P=PIPES[S.v.pipe];
  if(!o.contacts.length)return toast('Cadastre um contato antes de criar um negócio.',{icon:'info',act:'new-contact',actLabel:'Novo contato'});
  dialog({title:'Novo negócio',sub:P.label,submit:'Criar negócio',body:`
   <label class="fld">Contato<select class="in" name="contact" required>${o.contacts.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
   <label class="fld">Valor do crédito (R$)<input class="in num" name="value" type="number" min="1000" step="1000" value="250000" required></label>
   <p class="sm muted">O negócio fica com o responsável pelo contato.</p>`,
   onSubmit:dlgAsync(async f=>{
     await rpc('crm_create_deal',{p_org:S.orgId,p_lead:f.contact,p_pipeline_key:S.v.pipe,p_credit:+f.value||0});
     await reload();const c=contact(f.contact);
     toast(`Negócio criado para <b>${esc(fname(c.name))}</b> em ${esc(P.stages[0].label)}`,{icon:'plus'});go('funis');
   })});
};
ACT.invite=()=>{
  const o=O();
  if(seatsFree()<=0)return dialog({title:'Assentos esgotados',sub:'Convidar usuário',submit:'Entendi',body:`<p class="sm">A organização usa todos os ${o.seats} assentos do plano (usuários ativos e convites pendentes).</p>`});
  dialog({title:'Convidar usuário',sub:`${seatsFree()} assentos livres`,submit:'Criar convite',body:`
   <label class="fld">E-mail<input class="in" type="email" name="email" required placeholder="pessoa@empresa.com.br"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Perfil<select class="in" name="role">${ROLES.filter(r=>r!=='Proprietário').map(r=>`<option ${r==='Vendedor'?'selected':''}>${r}</option>`).join('')}</select></label>
   <label class="fld">Equipe<select class="in" name="team"><option value="">Sem equipe</option>${(o.teams||[]).map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label></div>
   <p class="sm muted">O convite gera um link para você enviar à pessoa. Ela precisa entrar com este mesmo e-mail.</p>`,
   onSubmit:dlgAsync(async f=>{
     const em=f.email.trim().toLowerCase(),tok=await rpc('crm_create_invitation',{p_org:S.orgId,p_email:em,p_role_key:RKI[f.role],p_team_id:f.team||null});
     await reload();S.v.eqtab='convites';refresh();
     LS.after=()=>{
       const link=`${location.origin}${location.pathname}#convite=${tok}`;
       dialog({title:'Convite criado',sub:em,submit:'Copiar link',body:`<label class="fld">Link do convite<input class="in" readonly value="${esc(link)}" onfocus="this.select()"></label>
        <p class="sm muted">O link vale por 7 dias e só aparece agora. Envie por WhatsApp ou e-mail. Ele só funciona para <b>${esc(em)}</b>.</p>`,
        onSubmit:()=>{try{navigator.clipboard.writeText(link).then(()=>toast('Link copiado',{icon:'copy'}),()=>toast('Selecione o link e copie manualmente',{icon:'copy'}))}catch(e){toast('Selecione o link e copie manualmente',{icon:'copy'})}}});
     };
   })});
};
ACT['set-goals']=()=>{
  const o=O();
  dialog({title:'Meta do ciclo',sub:`Ciclo ${dm(CYCLE.start)} a ${dm(CYCLE.end)}`,submit:'Salvar meta',body:`
   <label class="fld">Meta de crédito vendido da organização (R$)<input class="in num" name="goal" type="number" min="50000" step="50000" ${o.goalSet?`value="${o.goal}"`:'placeholder="Ex.: 4000000"'} required></label>`,
   onSubmit:dlgAsync(async f=>{await rpc('crm_set_org_goal',{p_org:S.orgId,p_goal:+f.goal});await reload();toast(`Meta do ciclo atualizada para <b>${brlK(+f.goal)}</b>`,{icon:'target'})})});
};
ACT.org=async el=>{
  const id=el.dataset.id;S.ui.pop=null;if(id===S.orgId){renderPops();return}
  await guarded(async()=>{
    const b=await rpc('crm_boot',{p_org:id});if(!PV.on)LS.myRole=b.me.role;S.orgs[id]=await loadOrg(id,b.me,b);S.orgId=id;LS.at=Date.now();
    resetViewState();if(S.ui.drawer||S.ui.modal)closeAll();if(LV(S.view)===0)S.view='visao-geral';
    toast(`Organização: <b>${esc(O().name)}</b> · seu perfil: ${esc(ROLE())}`,{icon:'building-2'});refresh(true);
  });
};
ACT.logout=()=>{S.ui.pop=null;renderPops();signOut()};

/* ----- ainda sem gravação real: avisa em vez de fingir que salvou ----- */
['import-csv','new-challenge','inv-resend','inv-del','inv-copy','perm','perm-reset','u-toggle','u-reset','connect','inst-reconnect','inst-off','inst-cfg','cfg-auto','cfg-hours',
 'new-ticket','tk-resolve','tk-reopen','plan-change','buy-seats','pay-method','inv-dl','end-session','start-conv','conv-resolve','conv-deal','new-org','req-access'
].forEach(k=>{ACT[k]=()=>soon()});
['dealowner','dealtemp','bulkassign','bulktag','ucargo','tstatus','convassign','cfg-mode','cfg-pipe','cfg-away'].forEach(k=>{CHG[k]=el=>{soon();refresh()}});
['msg','ticket-reply','perfil'].forEach(k=>{FORMS[k]=()=>soon()});

const PV_OK=()=>['PROPRIETARIO','ADMINISTRADOR','GESTOR'].includes(PV.on?PV.realRole:LS.myRole);
function pvMenu(){
  if(!PV_OK())return'';
  const list=(LS.team||[]).filter(m=>m.id!==(PV.on?PV.realMe:ME)&&m.status==='ATIVO');
  return`<div style="border-top:1px solid var(--line);margin-top:6px;padding-top:4px"><h4>Ver como</h4>
   ${PV.on?`<button class="pi on" data-act="pv-stop">${ic('eye-off')}<span class="sm"><b>Sair da visualização</b><div class="xs muted">voltar para a sua visão</div></span></button>`:''}
   ${list.map(m=>`<button class="pi ${PV.on&&PV.id===m.id?'on':''}" data-act="pv-start" data-id="${esc(m.id)}">${avN(m.name,30)}<span class="grow" style="min-width:0"><span class="sm">${esc(m.name)}</span><div class="xs muted">${esc(RK[m.role]||m.role)}${m.team?' · '+esc(m.team):''}</div></span>${ic('eye')}</button>`).join('')||'<div class="xs muted" style="padding:8px 10px">Sem outros membros ativos.</div>'}
   <div class="xs muted" style="padding:6px 10px 8px">Mostra menu, telas e dados como a pessoa vê. Somente leitura.</div></div>`;
}
window.pvMenu=pvMenu;
function pvBar(){
  let b=$('#pvbar');const main=$('.main');if(!main)return;
  if(!PV.on){if(b)b.remove();return}
  if(!b){b=document.createElement('div');b.id='pvbar';main.insertBefore(b,main.firstChild)}
  b.innerHTML=`${ic('eye')}<span class="grow">Você está vendo o CRM como <b>${esc(PV.name)}</b> (${esc(RK[PV.roleKey]||PV.roleKey)}). Somente leitura.</span><button class="btn sm" data-act="pv-stop">Sair da visualização</button>`;icons();
}
function pvReset(){try{FL.loaded=false;FL.orgFor=null}catch(e){}try{FC.loaded=false;FC.orgFor=null}catch(e){}try{FIN.d=null;FIN.orgFor=null;FIN.tab=null}catch(e){}}
async function pvApply(){
  pvReset();S.ui.pop=null;closeAll();
  await reload();
  if(LV(S.view)===0)S.view='visao-geral';
  resetViewState();refresh(true);pvBar();
  setTimeout(()=>{try{flLoad();fcLoad();finLoad()}catch(e){}},30);
}
ACT['pv-start']=async el=>{
  if(!PV_OK())return;
  const m=(LS.team||[]).find(x=>x.id===el.dataset.id);if(!m)return;
  if(!PV.on){PV.realMe=ME;PV.realRole=LS.myRole}
  const scope=((LS.roles||[]).find(r=>r.role_key===m.role)||{}).data_scope||'PROPRIO';
  const perms={};(LS.permRows||[]).filter(r=>r.role_key===m.role).forEach(r=>perms[r.module]=r.level);
  PV.team={};(LS.team||[]).forEach(x=>PV.team[x.id]=x.team_id||null);
  Object.assign(PV,{on:true,id:m.id,name:m.name,roleKey:m.role,scope,perms});ME=m.id;
  await guarded(pvApply);
  toast(`Vendo como <b>${esc(m.name)}</b>. Para voltar: "Sair da visualização".`,{icon:'eye',ms:5000});
};
ACT['pv-stop']=async()=>{
  if(!PV.on)return;ME=PV.realMe;PV.on=false;PV.id=null;
  await guarded(pvApply);toast('De volta à sua visão.',{icon:'eye-off'});
};

/* ----- equipe: perfil e equipe de cada membro (dono/administrador) ----- */
CHG.urole=async el=>{const u=user(el.dataset.id),key=RKI[el.value];if(!key){redrawDrawer();return}
  const ok=await guarded(async()=>{await rpc('crm_member_update',{p_org:S.orgId,p_user:u.id,p_role:key,p_team:null});await reload()});
  if(ok)toast(`Perfil de <b>${esc(fname(u.name))}</b>: ${esc(el.value)}${key==='GESTOR'?' (equipe própria criada)':''}`,{icon:'shield'});redrawDrawer()};
CHG.uteam=async el=>{const u=user(el.dataset.id),t=(O().teams||[]).find(x=>x.name===el.value);
  const ok=await guarded(async()=>{await rpc('crm_member_update',{p_org:S.orgId,p_user:u.id,p_role:null,p_team:t?t.id:''});await reload()});
  if(ok)toast(`<b>${esc(fname(u.name))}</b> agora em: ${esc(t?t.name:'sem equipe')}`,{icon:'users'});redrawDrawer()};

/* ----- início ----- */
/* os módulos Leads, Clientes e Financeiro (06z_*) usam estas funções: precisam estar visíveis fora deste bloco */
/* envio de e-mails (função alvo-mail no Supabase; a chave do Resend fica lá) */
async function mailFn(body){
  if(PV.on&&body.action==='send')throw Object.assign(new Error(`Modo "Ver como": nada é enviado vendo como ${PV.name}.`),{code:'PV'});
  const{data,error}=await sb.functions.invoke('alvo-mail',{body});
  if(error){let m=error.message;try{const j=await error.context.json();if(j&&j.error)m=j.error}catch(e){}throw new Error(m)}
  if(data&&data.error)throw new Error(data.error);return data;
}
Object.assign(window,{rpc,fail,guarded,dlgAsync,fmtPhone,reload,LS,mailFn});
(async function(){
  if(!window.supabase||!CFG.url||!CFG.key){authShell('<h1>Configuração ausente</h1><p class="sm">Não foi possível carregar a biblioteca de acesso. Recarregue a página.</p>');return}
  sb=window.supabase.createClient(CFG.url,CFG.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce'}});
  window.__sb=sb;
  sb.auth.onAuthStateChange((ev)=>{
    if(ev==='PASSWORD_RECOVERY')setTimeout(showNewPassword,0);
    else if(ev==='SIGNED_OUT'&&LS.started)setTimeout(()=>location.reload(),0);
  });
  loadPrefs();applyPrefs();
  $('#app').innerHTML='<div class="auth-load" role="status">Carregando…</div>';
  let sess=null;try{sess=(await sb.auth.getSession()).data.session}catch(e){}
  if(sess)await enter();else showLogin();
})();
})();
