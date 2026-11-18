'use strict';
/* ===== Dados fictícios coerentes (nenhum dado real da ALVO foi usado) ===== */
let ME='me', LIVE=false;
const MIN=6e4, H=36e5, D=864e5;
const NOW0=new Date(2026,10,17,9,42,0), T0=Date.now();           // terça, 17/11/2026 09:42
const now=()=>LIVE?new Date():new Date(NOW0.getTime()+(Date.now()-T0));
const at=ms=>new Date(NOW0.getTime()-ms);
const CYCLE={start:new Date(2026,10,15),end:new Date(2026,11,14),bdTotal:21,bdDone:2,dayN:3,dayTotal:30};
const rngf=seed=>{let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)};
const fname=n=>String(n).split(' ')[0];

const FIRST=['Ricardo','Luciana','Fernando','Helena','André','Patrícia','Sérgio','Marta','Otávio','Carolina','Diego','Renata','Marcelo','Vanessa','Leandro','Priscila','Rodrigo','Tatiane','Henrique','Mariana','Felipe','Adriana','Caio','Simone','Vinícius','Débora','Davi','Cláudia','Igor','Beatriz'];
const LAST=['Menezes','Torres','Bastos','Sá','Gomes','Kato','Nunes','Lins','Prates','Almeida','Barros','Cardoso','Dias','Esteves','Ferraz','Guedes','Holanda','Junqueira','Macedo','Neves','Oliveira','Pacheco','Queiroz','Rangel','Siqueira','Teixeira','Viana','Xavier','Amaral','Brito'];
const PRODS=[['Imóvel',[180,620],'Canopus'],['Veículo',[60,190],'Servopa'],['Imóvel',[200,480],'Âncora'],['Pesados',[220,520],'CNP'],['Serviços',[25,85],'Canopus']];
const ORIGINS=['Meta Ads','Google Ads','Indicação','WhatsApp orgânico','Site','Base fria'];
const TAGS=['Investidor','Primeira compra','Lance embutido','Pessoa jurídica','Indicação premium','Retorno agendado'];

const PIPES={
  comercial:{label:'Comercial',stages:[
    {id:'novo',label:'Novo lead',p:.05},{id:'call1',label:'Call 1 agendada',p:.2},{id:'noshow',label:'No-show / follow-up',p:.1},
    {id:'call2',label:'Call 2',p:.4},{id:'closer',label:'Closer',p:.6},{id:'fech',label:'Fechamento',p:.85},
    {id:'ganho',label:'Efetivada',p:1,won:true},{id:'perdido',label:'Perdido',p:0,lost:true}]},
  posvenda:{label:'Pós-venda e suporte',stages:[
    {id:'doc',label:'Documentação pendente',p:.7},{id:'form',label:'Em formalização',p:.85},{id:'corr',label:'Em correção',p:.75},{id:'efet',label:'Efetivado',p:1,won:true}]},
  reativacao:{label:'Reativação (base fria)',stages:[
    {id:'frio',label:'Base fria',p:.02},{id:'tent',label:'Tentativa de contato',p:.05},{id:'resp',label:'Respondeu',p:.2},{id:'recup',label:'Reativado',p:1,won:true}]},
};
const stageOf=(pipe,id)=>PIPES[pipe].stages.find(s=>s.id===id);

const SEQ=['comercial:novo','comercial:call1','comercial:closer','none','comercial:call2','comercial:fech','comercial:noshow','comercial:ganho','posvenda:doc','comercial:call1','reativacao:frio','comercial:novo','comercial:perdido','comercial:closer','comercial:ganho','comercial:call2','posvenda:form','none','comercial:novo','comercial:fech','reativacao:tent','comercial:call1','comercial:closer','posvenda:efet','comercial:call2','comercial:novo','comercial:noshow','comercial:perdido','comercial:call1','comercial:ganho','reativacao:resp','comercial:closer','comercial:fech','comercial:call2','comercial:novo','comercial:ganho','posvenda:corr','none'];
const SCR={
  novo:[['in','Boa tarde! Vi o anúncio no Instagram e queria entender como funciona o consórcio de {p}.'],['in','Tenho interesse numa carta de uns {v}.']],
  call1:[['out','Olá, {n}! Aqui é {o}, da ALVO. Confirmo nossa conversa de diagnóstico amanhã às 10h.'],['in','Confirmado, obrigado! Posso incluir meu cônjuge na chamada?'],['out','Pode sim. Envio o link meia hora antes.']],
  noshow:[['out','{n}, tudo bem? Não conseguimos nos falar hoje. Quer remarcar a call?'],['in','Desculpa, surgiu um imprevisto. Pode ser amanhã à tarde?']],
  call2:[['out','Segue a simulação: carta de {v}, prazo de 180 meses, parcela conforme o plano escolhido.'],['in','Pode ser com lance embutido?'],['out','Pode. Detalho as opções de lance na nossa próxima call.']],
  fech:[['out','{n}, para formalizar preciso do RG, comprovante de renda e de residência.'],['in','Enviei agora há pouco, confere por favor.'],['out','Recebi! Vou conferir e te retorno ainda hoje.']],
  pos:[['in','Quando sai o resultado da próxima assembleia?'],['out','A próxima é dia 25/11. Aviso você assim que o resultado sair.']],
  react:[['out','Oi, {n}, tudo bem? Retomando nossa conversa sobre consórcio de {p}. Ainda faz sentido pra você?'],['in','Oi! Ainda tenho interesse sim.']],
};
const SCRKEY={novo:'novo',none:'novo',call1:'call1',noshow:'noshow',perdido:'noshow',call2:'call2',closer:'call2',fech:'fech',ganho:'fech',doc:'pos',form:'pos',corr:'pos',efet:'pos',frio:'react',tent:'react',resp:'react',recup:'react'};
const TASKMAP={novo:['Primeiro contato','whatsapp',2],call1:['Call de diagnóstico','reuniao',25],noshow:['Reagendar call','ligacao',5],call2:['Apresentar simulação','reuniao',30],closer:['Enviar proposta final','email',4],fech:['Coletar documentos','documentos',8],doc:['Cobrar documentação','documentos',3],corr:['Corrigir cadastro','documentos',6],tent:['Nova tentativa de contato','ligacao',3],resp:['Qualificar interesse','whatsapp',1]};

const USERS1=[
  {id:'u0',name:'Henrique Barros',cargo:'Diretor comercial',team:'Diretoria',role:'Proprietário',sell:false},
  {id:'me',name:'Marina Couto',cargo:'Gerente comercial',team:'Gestão',role:'Administrador'},
  {id:'u2',name:'Rafael Lima',cargo:'Executivo de contas',team:'Alfa',role:'Vendedor'},
  {id:'u3',name:'Júlia Prado',cargo:'Executiva de contas',team:'Alfa',role:'Vendedor'},
  {id:'u4',name:'Pedro Alves',cargo:'SDR',team:'SDR',role:'Vendedor'},
  {id:'u5',name:'Camila Rocha',cargo:'Executiva de contas',team:'Beta',role:'Vendedor'},
  {id:'u6',name:'Bruno Tavares',cargo:'Executivo de contas',team:'Beta',role:'Vendedor'},
  {id:'u7',name:'Larissa Mendes',cargo:'Executiva de contas',team:'Alfa',role:'Vendedor'},
  {id:'u8',name:'Thiago Cardoso',cargo:'Coordenador regional',team:'Gestão',role:'Gestor'},
  {id:'u9',name:'Patrícia Nunes',cargo:'Suporte operacional',team:'Suporte',role:'Suporte',sell:false},
  {id:'u10',name:'Eduardo Faria',cargo:'Financeiro',team:'Financeiro',role:'Financeiro',sell:false},
  {id:'u11',name:'Aline Souza',cargo:'Executiva de contas',team:'Beta',role:'Vendedor'},
  {id:'u12',name:'Gustavo Reis',cargo:'Executivo de contas',team:'Alfa',role:'Vendedor'},
];
const USERS2=[
  {id:'me',name:'Marina Couto',cargo:'Gerente comercial',team:'Gestão',role:'Gestor'},
  {id:'v1',name:'Roberto Siqueira',cargo:'Diretor regional',team:'Diretoria',role:'Proprietário',sell:false},
  {id:'v2',name:'Daniela Furtado',cargo:'Administradora',team:'Gestão',role:'Administrador',sell:false},
  {id:'v3',name:'Matheus Pinheiro',cargo:'Executivo de contas',team:'Alfa',role:'Vendedor'},
  {id:'v4',name:'Isabela Moura',cargo:'Executiva de contas',team:'Alfa',role:'Vendedor'},
  {id:'v5',name:'Leonardo Brandão',cargo:'Executivo de contas',team:'Beta',role:'Vendedor'},
  {id:'v6',name:'Natália Cunha',cargo:'SDR',team:'Beta',role:'Vendedor'},
];
const USERS3=[
  {id:'me',name:'Marina Couto',cargo:'Consultora',team:'Alfa',role:'Vendedor'},
  {id:'w1',name:'Alberto Ferraz',cargo:'Sócio-diretor',team:'Diretoria',role:'Proprietário',sell:false},
  {id:'w2',name:'Cecília Duarte',cargo:'Gerente',team:'Gestão',role:'Administrador'},
  {id:'w3',name:'Samuel Tavares',cargo:'Consultor',team:'Alfa',role:'Vendedor'},
  {id:'w4',name:'Yasmin Lopes',cargo:'Consultora',team:'Alfa',role:'Vendedor'},
];
const ORGDEFS=[
  {id:'matriz',name:'ALVO Investimentos',sub:'Matriz · Cuiabá',mark:'A',plan:'corporativo',seats:24,seed:11,nContacts:38,ddd:'65',city:'Cuiabá',goal:4000000,users:USERS1,
   inst:[{id:'i1',name:'Comercial Matriz',kind:'oficial',phone:'+55 65 90000-0100',state:'conectada',quality:'Alta',tier:'10 mil/dia',since:'12/08/2026'},
         {id:'i2',name:'Atendimento Cuiabá',kind:'nao-oficial',phone:'+55 65 90000-0101',state:'conectada',since:'05/11/2026'},
         {id:'i3',name:'SDR Reativação',kind:'nao-oficial',phone:'+55 65 90000-0102',state:'desconectada',since:'28/10/2026'}]},
  {id:'centro-oeste',name:'ALVO Regional Centro-Oeste',sub:'Regional · Goiânia',mark:'C',plan:'equipe',seats:12,seed:23,nContacts:22,ddd:'62',city:'Goiânia',goal:2400000,users:USERS2,
   inst:[{id:'i1',name:'Comercial Goiânia',kind:'oficial',phone:'+55 62 90000-0200',state:'conectada',quality:'Média',tier:'1 mil/dia',since:'03/09/2026'},
         {id:'i2',name:'Atendimento Goiânia',kind:'nao-oficial',phone:'+55 62 90000-0201',state:'conectada',since:'20/10/2026'}]},
  {id:'horizonte',name:'Horizonte Consórcios',sub:'Parceiro · Campo Grande',mark:'H',plan:'essencial',seats:5,seed:37,nContacts:14,ddd:'67',city:'Campo Grande',goal:900000,users:USERS3,
   inst:[{id:'i1',name:'Atendimento Horizonte',kind:'nao-oficial',phone:'+55 67 90000-0300',state:'conectada',since:'14/10/2026'}]},
];
const MODS=[['visao-geral','Visão geral'],['funis','Funis'],['contatos','Contatos'],['tarefas','Tarefas'],['conversas','Conversas'],['whatsapp','WhatsApp'],['metas','Metas e conquistas'],['equipe','Equipe e permissões'],['planos','Planos e pagamentos'],['suporte','Suporte interno']];
const ROLES=['Proprietário','Administrador','Gestor','Vendedor','Suporte','Financeiro'];
const PERM0={'Proprietário':[3,3,3,3,3,3,3,3,3,3],'Administrador':[3,3,3,3,3,3,3,3,3,3],'Gestor':[3,3,3,3,3,2,3,2,0,2],'Vendedor':[1,2,2,2,2,0,1,0,0,2],'Suporte':[1,2,1,2,2,0,1,0,0,3],'Financeiro':[2,1,1,1,0,0,1,0,2,2]};
const PLANS={
  essencial:{name:'Essencial',price:59,users:5,wa:1,pipes:1,feat:['1 funil de vendas','1 instância de WhatsApp','Contatos, tarefas e conversas','Metas e ranking da equipe']},
  equipe:{name:'Equipe',price:99,users:15,wa:3,pipes:5,feat:['Até 5 funis','3 instâncias de WhatsApp','Permissões por perfil','Desafios e conquistas','Suporte interno com SLA']},
  corporativo:{name:'Corporativo',price:149,users:50,wa:10,pipes:99,feat:['Funis ilimitados','10 instâncias de WhatsApp','Múltiplas organizações','Relatórios e exportações','Gerente de conta dedicado']},
};
const XP_RULES={
  resposta:{label:'Resposta em menos de 5 min',xp:10,cap:60},
  tarefa:{label:'Tarefa concluída em dia',xp:5,cap:50},
  call:{label:'Call realizada',xp:15,cap:90},
  avanco:{label:'Negócio avançou de etapa',xp:10,cap:80},
  docs:{label:'Documentação completa de primeira',xp:30,cap:90},
  venda:{label:'Venda efetivada',xp:150,cap:0},
};
const LEVELS=[0,400,1000,1900,3100,4700,6800,9500];
const TITLES=['Associado','Consultor','Consultor sênior','Especialista','Estrategista','Referência','Mentor','Executivo'];
const ACH=[
  {id:'primeira-venda',name:'Primeira venda',desc:'Efetive a primeira venda na plataforma.',icon:'badge-check',tier:'I',key:'won',target:1},
  {id:'dupla',name:'Fechamento duplo',desc:'Duas vendas efetivadas na mesma semana.',icon:'layers',tier:'II',key:'doubleWeek',target:1},
  {id:'carteira',name:'Carteira saudável',desc:'Nenhuma parcela em atraso na carteira por um ciclo.',icon:'shield-check',tier:'II',key:'cleanWallet',target:1},
  {id:'agenda',name:'Agenda em dia',desc:'Cinco dias úteis sem tarefa atrasada.',icon:'calendar',tier:'I',key:'tidyDays',target:5},
  {id:'relampago',name:'Resposta relâmpago',desc:'50 primeiras respostas em menos de 5 minutos.',icon:'zap',tier:'II',key:'fast',target:50},
  {id:'consistencia',name:'Consistência',desc:'10 dias úteis seguidos cumprindo o contato mínimo.',icon:'flame',tier:'II',key:'streak',target:10},
  {id:'documentacao',name:'Documentação limpa',desc:'5 formalizações sem correção.',icon:'file-text',tier:'I',key:'docsClean',target:5},
  {id:'conversao',name:'Alta conversão',desc:'Conversão de lead em venda acima de 20% no ciclo.',icon:'trending-up',tier:'III',key:'conv20',target:1},
  {id:'ritmo',name:'Ritmo de ciclo',desc:'Bater 100% da meta individual do ciclo.',icon:'target',tier:'III',key:'goalHit',target:1},
  {id:'mentor',name:'Força de equipe',desc:'Concluir 3 desafios de equipe.',icon:'users',tier:'III',key:'teamCh',target:3},
];
const KB=[['Como conectar uma instância oficial do WhatsApp','4 min'],['Diferenças entre WhatsApp oficial e não oficial','3 min'],['Como funciona o XP e o ranking','2 min'],['Convidar usuários e definir permissões','3 min'],['Ciclo comercial 15–14: competência e corte','5 min'],['Boas práticas para primeira resposta','2 min']];
const TEMPLATES=[['boas_vindas_consorcio','Aprovado','Utilidade'],['confirmacao_call','Aprovado','Utilidade'],['lembrete_documentos','Aprovado','Utilidade'],['retomada_contato','Em análise','Marketing'],['resultado_assembleia','Aprovado','Utilidade']];
const QUICK=['Olá! Aqui é a Marina, da ALVO. Como posso ajudar?','Vou verificar e retorno em instantes.','Segue a simulação que combinamos. Qualquer dúvida, estou à disposição.','Pode me enviar RG e comprovante de renda por aqui?'];

function fill(t,c){return t.replace(/\{n\}/g,c.n).replace(/\{o\}/g,c.o).replace(/\{v\}/g,c.v).replace(/\{p\}/g,c.p)}
const brlK=v=>v>=1e6?'R$ '+(v/1e6).toFixed(2).replace('.',',').replace(/,?0$/,'')+' mi':v>=1e3?'R$ '+Math.round(v/1e3).toLocaleString('pt-BR')+' mil':'R$ '+Math.round(v);

function genOrg(def){
  const r=rngf(def.seed), pick=a=>a[Math.floor(r()*a.length)];
  const users=def.users.map(u=>({status:'Ativo',sell:true,email:u.name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ /g,'.')+'@exemplo.com.br',last:at((u.id==='me'?0:Math.floor(r()*3000))*MIN),...u}));
  const sellers=users.filter(u=>u.sell&&['Vendedor','Administrador','Gestor'].includes(u.role));
  const contacts=[],deals=[],tasks=[],convs=[];
  const live=def.inst.filter(i=>i.state==='conectada');
  for(let i=0;i<def.nContacts;i++){
    const seq=SEQ[i%SEQ.length];
    // "me" tem carteira própria (1 em cada 4 contatos) e a venda efetivada inicial; os demais se revezam
    const others=sellers.filter(x=>x.id!=='me'), meSeller=sellers.find(x=>x.id==='me');
    const mineWin=!!meSeller&&seq==='comercial:ganho'&&i<10;
    const owner=(meSeller&&(seq==='comercial:ganho'?i<10:i%4===1))?meSeller:(others.length?others[(i*5+def.seed)%others.length]:sellers[0]);
    const pr=PRODS[mineWin?1:(i*7+def.seed)%PRODS.length];
    const credit=Math.round((pr[1][0]+r()*(pr[1][1]-pr[1][0]))/5)*5*1000;
    const name=FIRST[(i*7+def.seed)%FIRST.length]+' '+LAST[(i*11+def.seed*3)%LAST.length];
    const origin=seq.startsWith('reativacao')?'Base fria':ORIGINS[(i*3+def.seed)%5];
    const c={id:'c'+(i+1),name,phone:`(${def.ddd}) 90000-${String(100+i).padStart(4,'0')}`,email:name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/ /g,'.')+'@exemplo.com.br',
      city:def.city,origin,product:pr[0],admin:pr[2],credit,owner:owner.id,tags:[TAGS[(i*5)%TAGS.length],...(i%4===0?[TAGS[(i*3+1)%TAGS.length]]:[])].filter((v,k,a)=>a.indexOf(v)===k),
      createdAt:at((2+Math.floor(r()*44))*D),lastInt:at((10+Math.floor(r()*3000))*MIN),notes:''};
    contacts.push(c);
    if(seq==='none')continue;
    const [pipe,stage]=seq.split(':'), won=stage==='ganho';
    const temp=({novo:'Morno',call1:'Quente',noshow:'Frio',call2:'Quente',closer:'Quente',fech:'Quente',perdido:'Frio'}[stage])||(pipe==='comercial'?'Morno':'Morno');
    const d={id:'d'+(deals.length+1),contactId:c.id,pipe,stage,value:credit,product:pr[0],admin:pr[2],temp,owner:owner.id,entered:won?0:Math.floor(r()*13),lost:stage==='perdido',reason:stage==='perdido'?pick(['Sem retorno do cliente','Optou por outra administradora','Sem renda comprovada','Preço acima do esperado']):'',wonAt:won?at((2+(i*7)%48)*H):null,createdAt:c.createdAt};
    deals.push(d);
    const tm=TASKMAP[stage];
    if(tm&&!d.lost){
      const late=d.entered>7;
      tasks.push({id:'t'+(tasks.length+1),title:`${tm[0]} · ${fname(c.name)}`,type:tm[1],due:late?at((d.entered-6)*D):new Date(NOW0.getTime()+tm[2]*H),done:false,owner:owner.id,contactId:c.id,dealId:d.id,xp:5});
    }
    if(won)tasks.push({id:'t'+(tasks.length+1),title:`Formalizar venda · ${fname(c.name)}`,type:'documentos',due:at(5*H),done:true,owner:owner.id,contactId:c.id,dealId:d.id,xp:5});
    if(i%3!==2&&live.length){
      const key=SCRKEY[stage], base=i===0?3:(18+(i*37)%1400), sc=SCR[key];
      const ctx={n:fname(name),o:fname(owner.name),v:brlK(credit),p:pr[0].toLowerCase()};
      const msgs=sc.map((m,k)=>({id:`m${i}_${k}`,dir:m[0],text:fill(m[1],ctx),t:at((base+(sc.length-1-k)*(6+(i%5)*7))*MIN),by:m[0]==='out'?owner.id:null}));
      const inst=i===0?live[0]:live[i%live.length], last=msgs[msgs.length-1];
      const lastIn=[...msgs].reverse().find(m=>m.dir==='in');
      convs.push({id:'v'+(i+1),contactId:c.id,instanceId:inst.id,assignee:(stage==='novo'&&i%2===0)?null:owner.id,unread:last.dir==='in'?1+(i%2):0,status:'aberta',msgs,lastInAt:lastIn?lastIn.t:null,firstReply:false});
    }
  }
  const pass=[], meXp={matriz:4236,'centro-oeste':2310,horizonte:690}[def.id]||0;
  users.forEach(u=>{
    const me=u.id==='me';
    pass.push([u.id,{xp:me?meXp:600+Math.floor(r()*5600),cycleXp:me?612:80+Math.floor(r()*620),streak:me?8:Math.floor(r()*12),
      counters:{won:me?9:Math.floor(r()*8),fast:me?44:Math.floor(r()*40),fastWeek:me?21:Math.floor(r()*20),docsClean:me?3:Math.floor(r()*5),callsDone:me?9:Math.floor(r()*14),teamCh:me?1:0,tidyDays:me?5:Math.floor(r()*5)},
      ach:me?['primeira-venda','dupla','carteira','agenda']:['primeira-venda'],caps:{},log:me?[{t:at(55*MIN),label:'Call realizada',xp:15},{t:at(3*H),label:'Tarefa concluída em dia',xp:5},{t:at(26*H),label:'Documentação completa de primeira',xp:30}]:[]}]);
  });
  const hist=['Jun','Jul','Ago','Set','Out'].map((l,i)=>({label:l,value:Math.round(def.goal*[.62,.71,.80,.88,.985][i]/1e4)*1e4,goal:Math.round(def.goal*[.85,.9,.93,.97,1][i]/1e4)*1e4}));
  const seeds=k=>Array.from({length:12},(_,i)=>Math.round(40+30*Math.sin(i/2+k)+r()*22));
  const inv=[];for(let m=0;m<6;m++){const dt=new Date(2026,10-m,25);const val=def.seats*PLANS[def.plan].price;inv.push({id:'F-2026-'+String(11-m).padStart(2,'0'),date:dt,amount:val,status:m===0?'Em aberto':'Pago',method:m%2?'Cartão final 4821':'Pix'});}
  return {...def,users,contacts,deals,tasks,convs,g:Object.fromEntries(pass),hist,spark:[seeds(1),seeds(2),seeds(3),seeds(4),seeds(5),seeds(6)],invoices:inv,
    perms:JSON.parse(JSON.stringify(PERM0)),
    invites:[{id:'iv1',email:'novo.sdr@exemplo.com.br',role:'Vendedor',team:'SDR',status:'Pendente',sent:at(26*H)},{id:'iv2',email:'financeiro2@exemplo.com.br',role:'Financeiro',team:'Financeiro',status:'Pendente',sent:at(3*D)},{id:'iv3',email:'consultor.ex@exemplo.com.br',role:'Vendedor',team:'Beta',status:'Expirado',sent:at(12*D)}].filter((()=>{let free=Math.max(0,def.seats-users.filter(u=>u.status==='Ativo').length);return i=>i.status!=='Pendente'||free-->0})()),
    tickets:[
      {id:'S-1048',title:'Instância do WhatsApp desconectou',cat:'WhatsApp',status:'Em atendimento',by:'me',prio:'Alta',opened:at(2*H),msgs:[{who:'me',text:'A instância SDR Reativação caiu hoje cedo e não volta a ler o QR code.',t:at(2*H)},{who:'sup',text:'Estamos verificando a sessão. Pode tentar gerar um novo QR code em WhatsApp > Reconectar?',t:at(95*MIN)}]},
      {id:'S-1044',title:'Erro ao anexar documento no negócio',cat:'Documentação',status:'Aguardando você',by:'me',prio:'Média',opened:at(1*D),msgs:[{who:'me',text:'Ao anexar o RG em PDF aparece erro de tamanho.',t:at(1*D)},{who:'sup',text:'O limite é de 10 MB por arquivo. Consegue comprimir e enviar de novo?',t:at(20*H)}]},
      {id:'S-1039',title:'Dúvida sobre competência da comissão',cat:'Comissões',status:'Aberto',by:'me',prio:'Baixa',opened:at(2*D),msgs:[{who:'me',text:'Vendas efetivadas no dia 15 entram em qual ciclo?',t:at(2*D)}]},
      {id:'S-1031',title:'Liberar acesso para novo SDR',cat:'Acesso',status:'Resolvido',by:'me',prio:'Média',opened:at(6*D),msgs:[{who:'me',text:'Preciso de acesso para o Pedro Alves no funil de reativação.',t:at(6*D)},{who:'sup',text:'Acesso liberado com perfil Vendedor.',t:at(6*D-3*H)}]},
    ],
    notifs:[
      {id:'n1',icon:'message-square',text:'Nova conversa sem responsável: '+(contacts[0]?contacts[0].name:'lead novo'),t:at(3*MIN),view:'conversas',read:false},
      {id:'n2',icon:'triangle-alert',text:'3 negócios sem contato há mais de 7 dias',t:at(40*MIN),view:'funis',read:false},
      {id:'n3',icon:'trophy',text:'Desafio “Resposta relâmpago”: faltam 9 respostas',t:at(2*H),view:'metas',read:false},
      {id:'n4',icon:'life-buoy',text:'Chamado S-1048 recebeu uma resposta',t:at(95*MIN),view:'suporte',read:true},
      {id:'n5',icon:'credit-card',text:'Fatura de novembro vence em 25/11',t:at(1*D),view:'planos',read:true},
    ]};
}
