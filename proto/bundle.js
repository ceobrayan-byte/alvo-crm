'use strict';
/* ===== Dados fictícios coerentes (nenhum dado real da ALVO foi usado) ===== */
const ME='me', MIN=6e4, H=36e5, D=864e5;
const NOW0=new Date(2026,10,17,9,42,0), T0=Date.now();           // terça, 17/11/2026 09:42
const now=()=>new Date(NOW0.getTime()+(Date.now()-T0));
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

/* ===== Estado, utilitários, componentes, gráficos e gamificação ===== */
const S={orgId:'matriz',orgs:{},view:'visao-geral',ui:{rail:false,mode:'comando',mnav:false,pop:null,drawer:null,modal:null,dlgSubmit:null},
  v:{pipe:'comercial',owner:'all',temp:'all',q:'',tag:'all',ctab:'minhas',conv:null,note:false,tasktab:'hoje',gtab:'metas',gscope:'indiv',rank:'ciclo',eqtab:'usuarios',billing:'mensal',sel:[],cchan:'all',stab:'tickets'}};
ORGDEFS.forEach(d=>{S.orgs[d.id]=genOrg(d)});
const O=()=>S.orgs[S.orgId];
const user=id=>O().users.find(u=>u.id===id);
const contact=id=>O().contacts.find(c=>c.id===id);
const deal=id=>O().deals.find(d=>d.id===id);
const conv=id=>O().convs.find(c=>c.id===id);
const inst=id=>O().inst.find(i=>i.id===id);
const ROLE=()=>user(ME).role;
const LV=mod=>{const i=MODS.findIndex(m=>m[0]===mod);return i<0?3:(O().perms[ROLE()][i]||0)};
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

/* ===== Visão geral, Funis, Contatos ===== */
const ACT={},FORMS={},CHG={},VIEWS={},FLUSH=new Set(['conversas']);
const sellersOf=()=>O().users.filter(u=>u.sell&&['Vendedor','Administrador','Gestor'].includes(u.role));
const ownerOpts=(sel,all)=>(all?`<option value="all">Todos os responsáveis</option>`:'')+sellersOf().map(u=>`<option value="${u.id}" ${sel===u.id?'selected':''}>${esc(u.name)}</option>`).join('');
const plu=(n,a,b)=>n===1?a:b;
const greet=()=>{const h=now().getHours();return h<12?'Bom dia':h<18?'Boa tarde':'Boa noite'};

VIEWS['visao-geral']=()=>{
  const m=metrics(),o=m.o,g=o.g[ME],L=lvl(g.xp);
  const fun=PIPES.comercial.stages.filter(s=>!s.lost).map(s=>{const ds=o.deals.filter(d=>d.pipe==='comercial'&&d.stage===s.id);return{s,n:ds.length,v:sum(ds.map(d=>d.value))}});
  const maxN=Math.max(...fun.map(f=>f.n),1);
  const cols=['#C48A2C','#3F8F77','#9CC5B5','#E2BE84','#5BA58E','#8F877A'];
  const origin=ORIGINS.map((k,i)=>({k,v:o.contacts.filter(c=>c.origin===k).length,c:cols[i]})).filter(x=>x.v);
  const rk=ranking(),pos=rk.findIndex(r=>r.u.id===ME),rshow=rk.slice(0,5);if(pos>4)rshow.push(rk[pos]);
  const dueToday=o.tasks.filter(t=>t.owner===ME&&!t.done&&sameDay(t.due,now())||t.owner===ME&&!t.done&&t.due<now()).slice(0,3);
  const doneToday=o.tasks.filter(t=>t.owner===ME&&t.done).length;
  const docs=o.deals.filter(d=>d.pipe==='posvenda'&&d.stage==='doc').length;
  const late=o.tasks.filter(t=>!t.done&&t.due<now()&&t.owner===ME).length;
  const unassigned=o.convs.filter(c=>!c.assignee&&c.status==='aberta').length;
  const alerts=[
    m.stale.length&&['timer',`${m.stale.length} ${plu(m.stale.length,'negócio sem contato','negócios sem contato')} há mais de 7 dias`,'Ver no funil','alert-go','funis'],
    m.risk.length&&['message-square-warning',`${m.risk.length} ${plu(m.risk.length,'conversa sem resposta além do prazo (SLA)','conversas sem resposta além do prazo (SLA)')}`,'Abrir conversas','go','conversas'],
    unassigned&&['inbox',`${unassigned} ${plu(unassigned,'conversa aguardando um responsável','conversas aguardando um responsável')}`,'Distribuir','go','conversas'],
    docs&&['file-text',`${docs} ${plu(docs,'caso com documentação pendente','casos com documentação pendente')}`,'Ver pós-venda','alert-pos','funis'],
    late&&['calendar-x',`${late} ${plu(late,'tarefa sua atrasada','tarefas suas atrasadas')}`,'Ver tarefas','alert-late','tarefas'],
  ].filter(Boolean);
  const hist=[...o.hist,{label:'Nov',value:m.credit,goal:o.goal,cur:true}];
  const kpi=(i,label,val,sub,sp)=>`<div class="card kpi"><span class="eyebrow">${label}</span><span class="v num">${val}</span><span class="d">${sub}</span>${spark(o.spark[sp])}</div>`;
  return`<div class="pg">
  <div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · ciclo ${dm(CYCLE.start)}–${dm(CYCLE.end)} · dia ${CYCLE.dayN} de ${CYCLE.dayTotal}</div><h2>${greet()}, ${esc(fname(user(ME).name))}</h2></div>
    <div class="row wrap"><button class="btn" data-act="new-contact">${ic('user-plus')}Novo contato</button><button class="btn" data-act="new-task">${ic('list-checks')}Nova tarefa</button><button class="btn pri" data-act="new-deal">${ic('plus')}Novo negócio</button></div></div>
  <div class="g g12">
   <section class="card hud s7" style="display:flex;flex-direction:column" aria-label="Pulso do ciclo"><div class="card-h"><div><span class="eyebrow">Pulso do ciclo</span><h3>Crédito vendido contra a meta</h3></div><span class="bd ${m.rhythm>=1?'ok':'warn'} end">${ic('gauge')}Ritmo ${m.rhythm.toFixed(1).replace('.',',')}×</span></div>
    <div class="row wrap" style="gap:28px;align-items:center;flex:1"><div class="ring">${ring(m.wpct,176)}<div class="mid"><span class="disp num" style="font-size:44px">${pct(m.wpct)}</span><span class="xs muted">da meta</span></div></div>
     <div class="grow col" style="min-width:230px;gap:14px">
      <div class="row sp"><span class="muted sm">Crédito vendido</span><b class="num">${brl(m.credit)}</b></div>
      <div class="row sp"><span class="muted sm">Meta do ciclo</span><b class="num">${brl(m.goal)}</b></div>
      <div class="row sp"><span class="muted sm">Faltam</span><b class="num">${brl(m.left)}</b></div>
      <div class="row sp"><span class="muted sm">Necessário por dia útil (${CYCLE.bdTotal-CYCLE.bdDone} restantes)</span><b class="num">${brlK(m.perDay)}</b></div>
      <div><div class="row sp xs muted" style="margin-bottom:5px"><span>Meta ${pct(m.wpct)}</span><span>Tempo do ciclo ${pct(m.elapsed)}</span></div>${bar(m.wpct)}<div style="height:6px"></div>${bar(m.elapsed,'background:var(--ink3)')}</div>
     </div></div></section>
   <section class="card s5" aria-label="Atenção agora"><div class="card-h"><div><span class="eyebrow">Atenção agora</span><h3>O que precisa de você</h3></div></div>
    <div class="list">${alerts.length?alerts.map(a=>`<div class="li">${ic(a[0],'')}<span class="grow sm">${a[1]}</span><button class="btn sm" data-act="${a[3]}" data-id="${a[4]}">${a[2]}</button></div>`).join(''):`<div class="empty">Tudo em dia por aqui.</div>`}</div></section>
  </div>
  <div class="g" style="grid-template-columns:repeat(auto-fit,minmax(168px,1fr))">
   ${kpi(0,'Conversas hoje',m.newToday,`<span class="up">+${Math.max(1,Math.round(m.newToday*.3))} vs. ontem</span>`,0)}
   ${kpi(1,'Conversas abertas',m.open.length,m.risk.length?`<span class="dn">${m.risk.length} fora do SLA</span>`:`<span class="up">SLA em dia</span>`,1)}
   ${kpi(2,'1ª resposta (média)','4m 12s','<span class="up">−18% na semana</span>',2)}
   ${kpi(3,'Negócios ativos',m.active.length,`${brlK(m.activeValue)} em carteira`,3)}
   ${kpi(4,'Conversão do ciclo',pct(m.conv,1),`${m.wonN} efetivadas de ${o.deals.filter(d=>d.pipe==='comercial').length} negócios`,4)}
   ${kpi(5,'Comissão estimada',brlK(m.commission),'<span class="muted" title="Demonstração: 1,5% sobre o crédito efetivado. As regras reais seguem o catálogo da administradora.">estimativa sobre suas vendas</span>',5)}
  </div>
  <div class="g g12">
   <section class="card s7"><div class="card-h"><div><span class="eyebrow">Histórico</span><h3>Crédito vendido por ciclo</h3></div><span class="xs muted end">tracejado = meta · valores em R$</span></div>${bars(hist)}</section>
   <section class="card s5"><div class="card-h"><div><span class="eyebrow">Funil comercial</span><h3>Negócios por etapa</h3></div></div>
    <div class="col" style="gap:9px">${fun.map(f=>`<button class="row" data-act="go-pipe" data-id="comercial" style="gap:10px;text-align:left"><span class="sm" style="width:130px">${esc(f.s.label)}</span><span class="grow bar" style="height:10px"><i style="width:${Math.max(3,f.n/maxN*100)}%"></i></span><b class="num sm" style="width:24px;text-align:right">${f.n}</b><span class="xs muted num" style="width:64px;text-align:right">${brlK(f.v)}</span></button>`).join('')}</div></section>
  </div>
  <div class="g g12">
   <section class="card s4"><div class="card-h"><div><span class="eyebrow">Missão do dia</span><h3>${doneToday} concluídas · ${dueToday.length} em foco</h3></div><span class="bd gold end">${ic('flame')}${g.streak} dias</span></div>
    <div class="list">${dueToday.length?dueToday.map(t=>`<div class="li"><button class="chk-b" data-act="task-done" data-id="${t.id}" aria-label="Concluir tarefa" style="width:22px;height:22px;border-radius:6px;border:1.5px solid var(--line2);flex:none"></button><div class="grow"><div class="sm" style="font-weight:600">${esc(t.title)}</div><div class="xs muted">${t.due<now()?'Atrasada · ':''}${dayLbl(t.due)} ${hm(t.due)}</div></div><span class="bd ok">+${t.xp} XP</span></div>`).join(''):`<div class="empty">Sem pendências para hoje.</div>`}</div></section>
   <section class="card s4"><div class="card-h"><div><span class="eyebrow">Ranking do ciclo</span><h3>Pontos de performance</h3></div><button class="btn sm ghost end" data-act="go" data-id="metas">Ver tudo</button></div>
    <div class="list">${rshow.map(r=>`<div class="li" style="${r.u.id===ME?'background:color-mix(in srgb,var(--gold) 10%,transparent);border-radius:10px;padding-left:8px;padding-right:8px':''}"><b class="num xs" style="width:20px">${rk.indexOf(r)+1}º</b>${avN(r.u.name,28)}<div class="grow"><div class="sm" style="font-weight:600">${esc(r.u.id===ME?'Você':r.u.name)}</div><div class="xs muted">${esc(r.lv.title)}</div></div><b class="num sm">${r.xp.toLocaleString('pt-BR')}</b></div>`).join('')}</div></section>
   <section class="card s4"><div class="card-h"><div><span class="eyebrow">Origem</span><h3>De onde vêm os contatos</h3></div></div>
    <div class="row" style="gap:18px">${donut(origin.map(x=>({v:x.v,c:x.c})),128)}<div class="col grow" style="gap:7px">${origin.map(x=>`<div class="row sm"><i style="width:9px;height:9px;border-radius:50%;background:${x.c}"></i><span class="grow">${x.k}</span><b class="num">${x.v}</b></div>`).join('')}</div></div></section>
  </div>
  <p class="demo">Demonstração com dados fictícios. Nenhuma informação real da ALVO é usada.</p></div>`;
};
ACT['alert-go']=()=>{S.v.pipe='comercial';S.v.owner='all';S.v.stale=true;go('funis')};
ACT['alert-pos']=()=>{S.v.pipe='posvenda';S.v.stale=false;go('funis')};
ACT['alert-late']=()=>{S.v.tasktab='atrasadas';go('tarefas')};
ACT['go-pipe']=el=>{S.v.pipe=el.dataset.id;S.v.stale=false;go('funis')};

/* ---------- Funis ---------- */
function dealCard(d){
  const c=contact(d.contactId),t=O().tasks.find(x=>x.dealId===d.id&&!x.done&&!x.title.startsWith('Formalizar'));
  const stale=d.entered>7&&!stageOf(d.pipe,d.stage).won&&!d.lost;
  return`<div class="kcard" draggable="true" data-deal="${d.id}" data-act="open-deal" data-id="${d.id}" tabindex="0" style="${stale?'border-left:3px solid var(--bad)':''}">
   <div class="row sp"><b class="sm">${esc(c.name)}</b>${tempDot(d.temp)}</div>
   <div class="row wrap" style="gap:6px"><span class="bd gold">${esc(d.product)}</span><span class="bd mute">${esc(d.admin)}</span>${stale?`<span class="bd bad">${d.entered} dias parado</span>`:''}</div>
   <div class="row sp"><b class="num">${brlK(d.value)}</b><span class="xs muted">${d.entered===0?'hoje':d.entered+' d na etapa'}</span></div>
   <div class="row">${av(d.owner,22)}<span class="xs muted grow" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t?esc(t.title.split(' · ')[0]):'Sem próxima ação'}</span></div></div>`;
}
VIEWS['funis']=()=>{
  const o=O(),P=PIPES[S.v.pipe],f=S.v;
  const all=o.deals.filter(d=>d.pipe===f.pipe&&(f.owner==='all'||d.owner===f.owner)&&(f.temp==='all'||d.temp===f.temp)&&(!f.stale||d.entered>7));
  const open=all.filter(d=>!d.lost&&!stageOf(d.pipe,d.stage).won);
  const wtd=sum(open.map(d=>d.value*stageOf(d.pipe,d.stage).p));
  return`<div class="pg" style="height:100%"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Funis de vendas</h2></div>
   <div class="seg" role="tablist">${Object.keys(PIPES).map(k=>`<button class="${f.pipe===k?'on':''}" data-act="pipe" data-id="${k}">${PIPES[k].label}</button>`).join('')}</div>
   <button class="btn pri" data-act="new-deal">${ic('plus')}Novo negócio</button></div>
   <div class="row wrap"><select class="in" style="width:220px" data-chg="fowner" aria-label="Responsável">${ownerOpts(f.owner,true)}</select>
    ${['all','Quente','Morno','Frio'].map(t=>`<button class="chip ${f.temp===t?'on':''}" data-act="ftemp" data-id="${t}">${t==='all'?'Todas as temperaturas':tempDot(t)+t}</button>`).join('')}
    ${f.stale?`<button class="chip on" data-act="fstale">${ic('timer')}Parados há 7+ dias ${ic('x')}</button>`:''}
    <span class="end sm muted">${open.length} em aberto · <b class="num mut2">${brlK(sum(open.map(d=>d.value)))}</b> · ponderado <b class="num mut2">${brlK(wtd)}</b></span></div>
   <div class="board" style="flex:1;min-height:420px">${P.stages.map(s=>{const ds=all.filter(d=>d.stage===s.id);return`<div class="kcol" data-stage="${s.id}"><div class="kcol-h"><b>${esc(s.label)}</b><span class="bd mute">${ds.length}</span><span class="xs muted end num">${brlK(sum(ds.map(d=>d.value)))}</span></div><div class="col" style="gap:9px">${ds.map(dealCard).join('')||`<div class="empty xs" style="padding:18px 6px">Arraste um cartão para cá</div>`}</div></div>`}).join('')}</div></div>`;
};
ACT.pipe=el=>{S.v.pipe=el.dataset.id;S.v.stale=false;refresh()};
ACT.ftemp=el=>{S.v.temp=el.dataset.id;refresh()};
ACT.fstale=()=>{S.v.stale=false;refresh()};
CHG.fowner=el=>{S.v.owner=el.value;refresh()};
function dealDrawer(id){
  const d=deal(id),c=contact(d.contactId),o=O(),st=stageOf(d.pipe,d.stage),cv=o.convs.find(x=>x.contactId===c.id);
  const ts=o.tasks.filter(t=>t.dealId===id);
  return`<div class="dr-h">${avN(c.name,44)}<div class="grow"><div class="eyebrow">${esc(PIPES[d.pipe].label)}</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(c.name)}</h3><div class="sm muted">${esc(d.product)} · ${esc(d.admin)} · <b class="num">${brl(d.value)}</b></div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b">
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Etapa<select class="in" data-chg="dealstage" data-id="${id}">${PIPES[d.pipe].stages.map(s=>`<option value="${s.id}" ${s.id===d.stage?'selected':''}>${esc(s.label)}</option>`).join('')}</select></label>
    <label class="fld">Responsável<select class="in" data-chg="dealowner" data-id="${id}">${ownerOpts(d.owner)}</select></label>
    <label class="fld">Temperatura<select class="in" data-chg="dealtemp" data-id="${id}">${['Quente','Morno','Frio'].map(t=>`<option ${t===d.temp?'selected':''}>${t}</option>`).join('')}</select></label>
    <div class="fld">Probabilidade<div class="row" style="height:38px"><b class="num">${pct(st.p)}</b><span class="muted xs">· ponderado ${brlK(d.value*st.p)}</span></div></div></div>
   ${d.lost?`<div class="card" style="padding:12px;border-color:var(--bad)"><b class="sm">Perdido:</b> <span class="sm">${esc(d.reason)}</span></div>`:''}
   <div><div class="eyebrow" style="margin-bottom:8px">Contato</div><div class="sm col" style="gap:4px"><span>${ic('phone','')} ${esc(c.phone)}</span><span>${ic('mail','')} ${esc(c.email)}</span><span>${ic('map-pin','')} ${esc(c.city)} · origem ${esc(c.origin)}</span></div></div>
   <div><div class="row sp" style="margin-bottom:6px"><div class="eyebrow">Próximas ações</div><button class="btn sm ghost" data-act="new-task" data-id="${id}">${ic('plus')}Tarefa</button></div>
    <div class="list">${ts.map(t=>`<div class="li"><span class="bd ${t.done?'ok':t.due<now()?'bad':'mute'}">${t.done?'Feita':t.due<now()?'Atrasada':dayLbl(t.due)+' '+hm(t.due)}</span><span class="sm grow">${esc(t.title)}</span></div>`).join('')||'<div class="xs muted">Nenhuma tarefa vinculada.</div>'}</div></div>
  </div>
  <div class="dr-f">${cv?`<button class="btn" data-act="open-conv" data-id="${cv.id}">${ic('message-square')}Abrir conversa</button>`:`<button class="btn" data-act="start-conv" data-id="${c.id}">${ic('message-square')}Iniciar conversa</button>`}
   ${!d.lost&&!st.won?`<button class="btn" data-act="lose-deal" data-id="${id}">${ic('x')}Perdido</button>`:''}${!d.lost&&!st.won&&d.pipe==='comercial'?`<button class="btn pri" data-act="win-deal" data-id="${id}">${ic('badge-check')}Efetivar venda</button>`:''}</div>`;
}
ACT['open-deal']=el=>openDrawer(()=>dealDrawer(el.dataset.id));
CHG.dealstage=el=>{moveDeal(el.dataset.id,el.value);redrawDrawer()};
CHG.dealowner=el=>{deal(el.dataset.id).owner=el.value;toast('Responsável atualizado',{icon:'user'});refresh();redrawDrawer()};
CHG.dealtemp=el=>{deal(el.dataset.id).temp=el.value;refresh();redrawDrawer()};
ACT['win-deal']=el=>{winDeal(el.dataset.id);redrawDrawer()};
ACT['lose-deal']=el=>loseDialog(el.dataset.id);
ACT['new-deal']=el=>{
  const o=O(),P=PIPES[S.v.pipe];
  dialog({title:'Novo negócio',sub:P.label,submit:'Criar negócio',body:`
   <label class="fld">Contato<select class="in" name="contact" required>${o.contacts.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Valor do crédito (R$)<input class="in num" name="value" type="number" min="1000" step="1000" value="250000" required></label>
   <label class="fld">Produto<select class="in" name="product"><option>Imóvel</option><option>Veículo</option><option>Pesados</option><option>Serviços</option></select></label></div>
   <label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>`,
   onSubmit:f=>{const c=contact(f.contact);o.deals.push({id:'d'+(o.deals.length+1),contactId:c.id,pipe:S.v.pipe,stage:P.stages[0].id,value:+f.value,product:f.product,admin:'Canopus',temp:'Morno',owner:f.owner,entered:0,lost:false,reason:'',wonAt:null,createdAt:now()});
     toast(`Negócio criado para <b>${esc(fname(c.name))}</b> em ${esc(P.stages[0].label)}`,{icon:'plus'});go('funis');refresh()}});
};

/* ---------- Contatos ---------- */
function dealOfContact(c){return O().deals.filter(d=>d.contactId===c.id).sort((a,b)=>(a.pipe==='comercial'?0:1)-(b.pipe==='comercial'?0:1))[0]}
function contactsTable(){
  const o=O(),f=S.v,q=f.q.trim().toLowerCase();
  const rows=o.contacts.filter(c=>(!q||c.name.toLowerCase().includes(q)||c.phone.includes(q)||c.email.includes(q))&&(f.tag==='all'||c.tags.includes(f.tag))&&(f.owner==='all'||c.owner===f.owner));
  return`<div class="tbl-wrap"><table class="tbl"><thead><tr><th style="width:36px"><input class="chk" type="checkbox" data-act="sel-all" aria-label="Selecionar todos"></th><th>Contato</th><th>Interesse</th><th>Etapa</th><th>Origem</th><th>Responsável</th><th>Última interação</th></tr></thead><tbody>${rows.map(c=>{
    const d=dealOfContact(c),st=d?stageOf(d.pipe,d.stage):null;
    return`<tr class="click ${f.sel.includes(c.id)?'sel':''}" data-act="open-contact" data-id="${c.id}"><td><input class="chk" type="checkbox" data-act="sel" data-id="${c.id}" ${f.sel.includes(c.id)?'checked':''} aria-label="Selecionar ${esc(c.name)}"></td>
    <td><div class="row">${avN(c.name,30)}<div><b>${esc(c.name)}</b><div class="xs muted">${esc(c.phone)}</div></div></div></td>
    <td><b class="num">${brlK(c.credit)}</b><div class="xs muted">${esc(c.product)} · ${esc(c.admin)}</div></td>
    <td>${st?bd(st.label,st.won?'ok':st.lost?'bad':'gold'):bd('Sem negócio','mute')}</td><td class="sm">${esc(c.origin)}</td>
    <td><div class="row">${av(c.owner,22)}<span class="sm">${esc(fname(user(c.owner).name))}</span></div></td><td class="sm muted">${rel(c.lastInt)}</td></tr>`}).join('')||`<tr><td colspan="7" class="empty">Nenhum contato encontrado.</td></tr>`}</tbody></table></div>
    <div class="xs muted" style="margin-top:8px">${rows.length} de ${o.contacts.length} contatos</div>`;
}
VIEWS['contatos']=()=>{
  const f=S.v,o=O();
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Contatos</h2></div>
   <button class="btn" data-act="import-csv">${ic('upload')}Importar CSV</button><button class="btn pri" data-act="new-contact">${ic('user-plus')}Novo contato</button></div>
   <div class="row wrap"><label class="search" style="min-width:280px;flex:1;max-width:420px">${ic('search')}<input class="in" style="border:0;background:transparent;height:34px;padding:0" id="cq" placeholder="Buscar por nome, telefone ou e-mail" value="${esc(f.q)}" aria-label="Buscar contatos"></label>
    <select class="in" style="width:210px" data-chg="fowner" aria-label="Responsável">${ownerOpts(f.owner,true)}</select>
    <div class="row wrap" style="gap:6px"><button class="chip ${f.tag==='all'?'on':''}" data-act="ftag" data-id="all">Todos</button>${TAGS.map(t=>`<button class="chip ${f.tag===t?'on':''}" data-act="ftag" data-id="${t}">${esc(t)}</button>`).join('')}</div></div>
   ${f.sel.length?`<div class="card row wrap" style="padding:10px 14px;border-color:var(--gold)"><b class="sm">${f.sel.length} selecionados</b><select class="in" style="width:200px" data-chg="bulkassign"><option value="">Atribuir a…</option>${ownerOpts('')}</select><select class="in" style="width:180px" data-chg="bulktag"><option value="">Adicionar etiqueta…</option>${TAGS.map(t=>`<option>${esc(t)}</option>`).join('')}</select><button class="btn sm ghost end" data-act="sel-clear">Limpar seleção</button></div>`:''}
   <div id="ctable">${contactsTable()}</div></div>`;
};
ACT.ftag=el=>{S.v.tag=el.dataset.id;refresh()};
ACT.sel=(el,ev)=>{ev.stopPropagation();const id=el.dataset.id,s=S.v.sel;const i=s.indexOf(id);i<0?s.push(id):s.splice(i,1);refresh()};
ACT['sel-all']=(el,ev)=>{ev.stopPropagation();const ids=$$('#ctable tr[data-id]').map(r=>r.dataset.id);S.v.sel=el.checked?ids:[];refresh()};
ACT['sel-clear']=()=>{S.v.sel=[];refresh()};
CHG.bulkassign=el=>{if(!el.value)return;S.v.sel.forEach(id=>contact(id).owner=el.value);toast(`${S.v.sel.length} contatos atribuídos a <b>${esc(fname(user(el.value).name))}</b>`,{icon:'user'});S.v.sel=[];refresh()};
CHG.bulktag=el=>{if(!el.value)return;S.v.sel.forEach(id=>{const c=contact(id);if(!c.tags.includes(el.value))c.tags.push(el.value)});toast(`Etiqueta “${esc(el.value)}” adicionada`,{icon:'tag'});S.v.sel=[];refresh()};
function contactDrawer(id){
  const c=contact(id),o=O(),ds=o.deals.filter(d=>d.contactId===id),cv=o.convs.find(x=>x.contactId===id),ts=o.tasks.filter(t=>t.contactId===id);
  const tl=[...(cv?cv.msgs.slice(-3).map(m=>({t:m.t,ic:m.dir==='in'?'arrow-down-left':'arrow-up-right',x:(m.dir==='in'?'Cliente: ':'Equipe: ')+m.text})):[]),{t:c.createdAt,ic:'user-plus',x:`Contato criado · origem ${c.origin}`}].sort((a,b)=>b.t-a.t);
  return`<div class="dr-h">${avN(c.name,48)}<div class="grow"><div class="eyebrow">Contato</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(c.name)}</h3><div class="sm muted">${esc(c.city)} · responsável ${esc(user(c.owner).name)}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b">
   <div class="row wrap">${cv?`<button class="btn" data-act="open-conv" data-id="${cv.id}">${ic('message-square')}Conversar</button>`:`<button class="btn" data-act="start-conv" data-id="${c.id}">${ic('message-square')}Iniciar conversa</button>`}<button class="btn" data-act="new-task" data-cid="${c.id}">${ic('list-checks')}Nova tarefa</button></div>
   <div class="sm col" style="gap:5px"><span>${ic('phone','')} ${esc(c.phone)}</span><span>${ic('mail','')} ${esc(c.email)}</span><span>${ic('wallet','')} Interesse: <b class="num">${brl(c.credit)}</b> em ${esc(c.product)} (${esc(c.admin)})</span></div>
   <div class="row wrap" style="gap:6px">${c.tags.map(t=>bd(t,'gold')).join('')}</div>
   <div><div class="eyebrow" style="margin-bottom:8px">Negócios</div>${ds.map(d=>`<button class="li click" style="width:100%;text-align:left" data-act="open-deal" data-id="${d.id}">${tempDot(d.temp)}<span class="grow sm"><b>${esc(PIPES[d.pipe].label)}</b> · ${esc(stageOf(d.pipe,d.stage).label)}</span><b class="num sm">${brlK(d.value)}</b></button>`).join('')||`<div class="xs muted" style="margin-bottom:8px">Sem negócios.</div><button class="btn sm" data-act="new-deal">${ic('plus')}Criar negócio</button>`}</div>
   <div><div class="eyebrow" style="margin-bottom:8px">Linha do tempo</div><div class="list">${tl.map(e=>`<div class="li" style="align-items:flex-start">${ic(e.ic)}<div class="grow sm">${esc(e.x)}</div><span class="xs muted">${rel(e.t)}</span></div>`).join('')}</div></div>
   <div><div class="eyebrow" style="margin-bottom:8px">Tarefas (${ts.length})</div>${ts.map(t=>`<div class="li"><span class="bd ${t.done?'ok':'mute'}">${t.done?'Feita':dayLbl(t.due)}</span><span class="sm grow">${esc(t.title)}</span></div>`).join('')||'<div class="xs muted">Nenhuma tarefa.</div>'}</div>
  </div>`;
}
ACT['open-contact']=el=>openDrawer(()=>contactDrawer(el.dataset.id));
ACT['new-contact']=()=>{
  const o=O();
  dialog({title:'Novo contato',sub:o.name,submit:'Salvar contato',body:`
   <label class="fld">Nome completo<input class="in" name="name" required maxlength="80" placeholder="Ex.: Ana Beatriz Moreira"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Telefone<input class="in" name="phone" required placeholder="(65) 90000-0000"></label><label class="fld">E-mail<input class="in" name="email" type="email" placeholder="nome@exemplo.com.br"></label>
   <label class="fld">Origem<select class="in" name="origin">${ORIGINS.map(x=>`<option>${x}</option>`).join('')}</select></label><label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>
   <label class="fld">Produto<select class="in" name="product"><option>Imóvel</option><option>Veículo</option><option>Pesados</option><option>Serviços</option></select></label><label class="fld">Crédito desejado (R$)<input class="in num" name="credit" type="number" min="0" step="5000" value="200000"></label></div>
   <label class="row sm"><input class="chk" type="checkbox" name="mkdeal" checked> Criar negócio no funil Comercial</label>`,
   onSubmit:f=>{const c={id:'c'+(o.contacts.length+1),name:f.name.trim(),phone:f.phone,email:f.email||'',city:o.city,origin:f.origin,product:f.product,admin:'Canopus',credit:+f.credit||0,owner:f.owner,tags:[],createdAt:now(),lastInt:now(),notes:''};
     o.contacts.unshift(c);if(f.mkdeal)o.deals.push({id:'d'+(o.deals.length+1),contactId:c.id,pipe:'comercial',stage:'novo',value:c.credit||1,product:c.product,admin:c.admin,temp:'Morno',owner:c.owner,entered:0,lost:false,reason:'',wonAt:null,createdAt:now()});
     toast(`Contato <b>${esc(c.name)}</b> salvo${f.mkdeal?' e negócio criado em Novo lead':''}`,{icon:'user-plus',act:'open-contact',id:c.id,actLabel:'Abrir'});refresh()}});
};
ACT['import-csv']=()=>{
  const o=O();window._csv=[];
  dialog({title:'Importar contatos',sub:'Arquivo CSV',submit:'Importar',body:`<p class="sm muted">Colunas aceitas: <b>Nome</b> e <b>Telefone</b> (obrigatórias), E-mail e Origem. Telefones já cadastrados são ignorados.</p>
   <label class="fld">Arquivo<input class="in" type="file" id="csvf" accept=".csv,text/csv" style="padding-top:7px"></label><div id="csvprev" class="card sm muted" style="padding:12px">Nenhum arquivo selecionado. Sem arquivo à mão? Clique em importar para ver um exemplo com 3 contatos.</div>`,
   onSubmit:()=>{const rows=window._csv.length?window._csv:[['Aline Peixoto','(65) 90000-0901'],['Wagner Santana','(65) 90000-0902'],['Bianca Leal','(65) 90000-0903']];
     const have=new Set(o.contacts.map(c=>c.phone));let n=0,dup=0;rows.forEach(r=>{if(have.has(r[1])){dup++;return}have.add(r[1]);n++;o.contacts.unshift({id:'c'+(o.contacts.length+1),name:r[0],phone:r[1],email:r[2]||'',city:o.city,origin:r[3]||'Importação',product:'Imóvel',admin:'Canopus',credit:0,owner:ME,tags:[],createdAt:now(),lastInt:now(),notes:''})});
     toast(`${n} contatos importados${dup?` · ${dup} duplicados ignorados`:''}`,{icon:'upload'});refresh()}});
};
CHG.csvf=el=>{const f=el.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{const lines=String(rd.result).split(/\r?\n/).filter(Boolean);const head=lines[0].toLowerCase().split(/[;,]/).map(s=>s.trim());const ni=head.indexOf('nome'),ti=head.indexOf('telefone'),ei=head.indexOf('e-mail'),oi=head.indexOf('origem');
  window._csv=ni<0||ti<0?[]:lines.slice(1).map(l=>{const p=l.split(/[;,]/).map(s=>s.trim());return[p[ni],p[ti],ei>=0?p[ei]:'',oi>=0?p[oi]:'']}).filter(r=>r[0]&&r[1]);
  $('#csvprev').innerHTML=window._csv.length?`<b>${window._csv.length}</b> linhas válidas em <b>${esc(f.name)}</b>. Primeira: ${esc(window._csv[0][0])} · ${esc(window._csv[0][1])}`:`Não encontrei as colunas Nome e Telefone em ${esc(f.name)}.`};rd.readAsText(f)};

/* ===== Tarefas, Conversas, WhatsApp ===== */
const TICON={ligacao:'phone',reuniao:'video',whatsapp:'message-circle',documentos:'file-text',email:'mail'};
const TLABEL={ligacao:'Ligação',reuniao:'Reunião',whatsapp:'WhatsApp',documentos:'Documentos',email:'E-mail'};

/* ---------- Tarefas ---------- */
VIEWS['tarefas']=()=>{
  const o=O(),f=S.v,n=now(),mine=f.tscope!=='equipe';
  const all=o.tasks.filter(t=>!mine||t.owner===ME);
  const sets={hoje:all.filter(t=>!t.done&&sameDay(t.due,n)&&t.due>=n||!t.done&&sameDay(t.due,n)),atrasadas:all.filter(t=>!t.done&&t.due<n&&!sameDay(t.due,n)),proximas:all.filter(t=>!t.done&&t.due>n&&!sameDay(t.due,n)),concluidas:all.filter(t=>t.done)};
  const labels={hoje:'Hoje',atrasadas:'Atrasadas',proximas:'Próximas',concluidas:'Concluídas'};
  const list=sets[f.tasktab].sort((a,b)=>f.tasktab==='concluidas'?b.due-a.due:a.due-b.due);
  const groups={};list.forEach(t=>{(groups[dayLbl(t.due)]=groups[dayLbl(t.due)]||[]).push(t)});
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)}</div><h2>Tarefas</h2></div>
   ${LV('tarefas')>=3?`<div class="seg"><button class="${mine?'on':''}" data-act="tscope" data-id="minhas">Minhas</button><button class="${!mine?'on':''}" data-act="tscope" data-id="equipe">Equipe</button></div>`:''}
   <button class="btn pri" data-act="new-task">${ic('plus')}Nova tarefa</button></div>
   <div class="tabs" role="tablist">${Object.keys(labels).map(k=>`<button class="${f.tasktab===k?'on':''}" data-act="ttab" data-id="${k}">${labels[k]} <span class="bd ${k==='atrasadas'&&sets[k].length?'bad':'mute'}" style="margin-left:6px">${sets[k].length}</span></button>`).join('')}</div>
   <div class="col" style="gap:16px">${Object.keys(groups).map(day=>`<section><div class="eyebrow" style="margin-bottom:6px">${day}</div><div class="card" style="padding:4px 16px"><div class="list">${groups[day].map(t=>{const c=contact(t.contactId);return`<div class="li"><button data-act="task-done" data-id="${t.id}" aria-label="${t.done?'Tarefa concluída':'Concluir tarefa'}" style="width:22px;height:22px;border-radius:6px;border:1.5px solid ${t.done?'var(--ok)':'var(--line2)'};background:${t.done?'var(--ok)':'transparent'};flex:none;display:grid;place-items:center;color:#06261F">${t.done?ic('check'):''}</button>
     <div class="grow" style="${t.done?'opacity:.55;text-decoration:line-through':''}"><div class="sm" style="font-weight:600">${esc(t.title)}</div><div class="xs muted">${c?`<a href="#contatos" data-act="open-contact" data-id="${c.id}" style="text-decoration:underline">${esc(c.name)}</a> · `:''}${esc(TLABEL[t.type])}</div></div>
     <span class="bd ${t.done?'ok':t.due<n?'bad':'mute'}">${ic(TICON[t.type])}${hm(t.due)}</span>${mine?'':av(t.owner,24)}${!t.done?`<span class="xs muted num">+${t.xp} XP</span>`:''}</div>`}).join('')}</div></div></section>`).join('')||`<div class="card empty">Nenhuma tarefa nesta lista.</div>`}</div></div>`;
};
ACT.ttab=el=>{S.v.tasktab=el.dataset.id;refresh()};
ACT.tscope=el=>{S.v.tscope=el.dataset.id;refresh()};
ACT['task-done']=el=>{
  const t=O().tasks.find(x=>x.id===el.dataset.id);if(!t||t.done)return;
  const late=t.due<now();t.done=true;
  if(t.owner===ME){const g=O().g[ME];g.counters.tasks=(g.counters.tasks||0)+1;if(!late)award('tarefa');else toast('Tarefa concluída fora do prazo. O XP vale só para tarefas em dia.',{icon:'check'})}else toast('Tarefa concluída',{icon:'check'});
  refresh();
};
ACT['new-task']=el=>{
  const o=O(),d=el.dataset.id&&deal(el.dataset.id),pre=el.dataset.cid||(d&&d.contactId)||'',tm=new Date(now().getTime()+2*H);
  dialog({title:'Nova tarefa',sub:o.name,submit:'Criar tarefa',body:`
   <label class="fld">Título<input class="in" name="title" required maxlength="90" placeholder="Ex.: Enviar simulação"></label>
   <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Tipo<select class="in" name="type">${Object.keys(TLABEL).map(k=>`<option value="${k}">${TLABEL[k]}</option>`).join('')}</select></label>
   <label class="fld">Responsável<select class="in" name="owner">${ownerOpts(ME)}</select></label>
   <label class="fld">Data<input class="in" type="date" name="date" required value="${tm.getFullYear()}-${pad(tm.getMonth()+1)}-${pad(tm.getDate())}"></label><label class="fld">Hora<input class="in" type="time" name="time" required value="${pad(tm.getHours())}:00"></label></div>
   <label class="fld">Contato<select class="in" name="contact"><option value="">Sem contato</option>${o.contacts.map(c=>`<option value="${c.id}" ${c.id===pre?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label>`,
   onSubmit:f=>{const due=new Date(f.date+'T'+f.time);if(isNaN(due)){toast('Data ou hora inválida',{icon:'x'});return false}
     o.tasks.push({id:'t'+(o.tasks.length+1),title:f.title.trim(),type:f.type,due,done:false,owner:f.owner,contactId:f.contact||null,dealId:d?d.id:null,xp:5});toast('Tarefa criada',{icon:'list-checks'});refresh();redrawDrawer()}});
};

/* ---------- Conversas ---------- */
const chIcon=c=>{const i=inst(c.instanceId);return i&&i.kind==='oficial'?bd('API oficial','gold'):bd('QR Code','warn')};
function convList(){
  const o=O(),f=S.v;
  let rows=o.convs.filter(c=>f.ctab==='resolvidas'?c.status==='resolvida':c.status==='aberta'&&(f.ctab==='todas'||(f.ctab==='minhas'?c.assignee===ME:!c.assignee)));
  if(f.cchan!=='all')rows=rows.filter(c=>inst(c.instanceId)&&inst(c.instanceId).kind===f.cchan);
  rows.sort((a,b)=>b.msgs[b.msgs.length-1].t-a.msgs[a.msgs.length-1].t);
  return rows;
}
VIEWS['conversas']=()=>{
  const o=O(),f=S.v,rows=convList(),cnt=k=>o.convs.filter(c=>k==='resolvidas'?c.status==='resolvida':c.status==='aberta'&&(k==='todas'||(k==='minhas'?c.assignee===ME:!c.assignee))).length;
  let cur=f.conv&&conv(f.conv);if(!cur||!rows.includes(cur)&&f.chatOpen!==true)cur=cur&&rows.includes(cur)?cur:(rows[0]||null);
  if(cur){f.conv=cur.id;cur.unread=0}
  const c=cur&&contact(cur.contactId),i=cur&&inst(cur.instanceId),d=c&&dealOfContact(c);
  const open=cur&&windowOpen(cur);
  return`<div class="chat ${f.chatOpen&&cur?'open':''}">
   <aside class="c-list" aria-label="Lista de conversas"><div style="padding:14px 14px 0"><div class="row sp" style="margin-bottom:10px"><h2 class="disp" style="font-size:26px">Conversas</h2><span class="bd ok">${ic('radio','')}${o.inst.filter(x=>x.state==='conectada').length} canais</span></div>
    <div class="tabs">${[['minhas','Minhas'],['nao','Fila'],['todas','Todas'],['resolvidas','Resolvidas']].map(([k,l])=>`<button class="${f.ctab===k?'on':''}" data-act="ctab" data-id="${k}" title="${k==='nao'?'Conversas sem responsável':l}" style="padding:0 9px;font-size:12px">${l}${k==='resolvidas'?'':` <span class="xs muted">${cnt(k)}</span>`}</button>`).join('')}</div>
    <div class="row" style="gap:6px;padding:10px 0">${[['all','Todos'],['oficial','Oficial'],['nao-oficial','QR Code']].map(([k,l])=>`<button class="chip ${f.cchan===k?'on':''}" data-act="cchan" data-id="${k}" style="height:26px;font-size:11.5px">${l}</button>`).join('')}</div></div>
    <div style="overflow:auto;flex:1">${rows.map(x=>{const cc=contact(x.contactId),last=x.msgs[x.msgs.length-1];return`<button class="c-item ${cur&&cur.id===x.id?'on':''}" data-act="open-conv" data-id="${x.id}">${avN(cc.name,38)}<div class="grow" style="min-width:0"><div class="row sp"><b class="sm" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cc.name)}</b><span class="xs muted" style="white-space:nowrap">${hm(last.t)}</span></div>
     <div class="row sp"><span class="xs muted" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${last.dir==='out'?'Você: ':''}${esc(last.text)}</span>${x.unread?`<span class="bd gold" style="padding:0 7px">${x.unread}</span>`:''}</div>
     <div class="row" style="gap:6px;margin-top:4px">${chIcon(x)}${slaRisk(x)?bd('SLA em risco','bad'):''}${!x.assignee?bd('Sem responsável','info'):''}</div></div></button>`}).join('')||`<div class="empty">Nenhuma conversa nesta lista.</div>`}</div></aside>
   <section class="c-thread" aria-label="Conversa">${cur?`
    <div class="row wrap" style="padding:12px 18px;border-bottom:1px solid var(--line)"><button class="ibtn back-c" data-act="chat-back" aria-label="Voltar">${ic('arrow-left')}</button>${avN(c.name,38)}<div style="flex:1 1 170px;min-width:150px"><b>${esc(c.name)}</b><div class="xs muted">${esc(c.phone)} · ${esc(i.name)}</div></div>
     <select class="in" style="width:150px" data-chg="convassign" data-id="${cur.id}" aria-label="Responsável"><option value="">Sem responsável</option>${ownerOpts(cur.assignee||'')}</select>
     <button class="btn sm" data-act="conv-deal" data-id="${cur.id}">${ic(d&&d.pipe==='comercial'?'kanban':'plus')}${d&&d.pipe==='comercial'?'Ver negócio':'Criar negócio'}</button><button class="btn sm" data-act="conv-resolve" data-id="${cur.id}">${ic('check')}${cur.status==='resolvida'?'Reabrir':'Resolver'}</button></div>
    <div class="msgs" id="msgs">${cur.msgs.map(m=>`<div class="m ${m.dir}">${m.dir==='note'?`<b class="xs">${ic('lock','')} Nota interna · ${esc(fname(user(m.by).name))}</b><br>`:''}${esc(m.text)}<span class="t">${hm(m.t)}${m.dir==='out'&&m.by?' · '+esc(fname(user(m.by).name)):''}</span></div>`).join('')}</div>
    <form class="composer" data-form="msg" data-id="${cur.id}">
     <div class="row sp"><div class="seg"><button type="button" class="${!f.note?'on':''}" data-act="note" data-id="0">Responder</button><button type="button" class="${f.note?'on':''}" data-act="note" data-id="1">Nota interna</button></div>
      <select class="in" style="width:200px" data-chg="quick" aria-label="Respostas rápidas"><option value="">Respostas rápidas</option>${QUICK.map((q,k)=>`<option value="${k}">${esc(q.slice(0,34))}…</option>`).join('')}</select></div>
     ${!open&&!f.note?`<div class="card row sm" style="padding:10px 12px;border-color:var(--warn)">${ic('clock')}<span class="grow">Janela de 24 h encerrada neste canal oficial. Só é possível enviar um modelo aprovado.</span><select class="in" style="width:200px" name="tpl" aria-label="Modelo">${TEMPLATES.filter(t=>t[1]==='Aprovado').map(t=>`<option>${t[0]}</option>`).join('')}</select></div>`:''}
     <div class="row" style="align-items:flex-end"><textarea class="in" name="text" rows="2" style="min-height:44px" placeholder="${f.note?'Nota visível só para a equipe…':open?'Escreva uma mensagem…':'Opcional: complemento ao modelo'}" ${!open&&!f.note?'':'required'} aria-label="Mensagem"></textarea><button class="btn pri" type="submit">${ic(f.note?'lock':'send')}${f.note?'Salvar nota':!open?'Enviar modelo':'Enviar'}</button></div></form>`:`<div class="empty" style="margin:auto">Selecione uma conversa.</div>`}</section>
   ${cur?`<aside class="c-info" aria-label="Detalhes do contato"><div class="col" style="align-items:center;text-align:center">${avN(c.name,56)}<b>${esc(c.name)}</b><span class="xs muted">${esc(c.city)} · ${esc(c.origin)}</span></div>
    <div class="sm col" style="gap:5px"><span>${ic('wallet','')} <b class="num">${brl(c.credit)}</b></span><span class="muted xs">${esc(c.product)} · ${esc(c.admin)}</span></div>
    ${d?`<div class="card" style="padding:12px"><div class="eyebrow">Negócio · ${esc(PIPES[d.pipe].label)}</div><div class="row sp" style="margin-top:6px"><b class="sm">${esc(stageOf(d.pipe,d.stage).label)}</b>${tempDot(d.temp)}</div><button class="btn sm" style="margin-top:10px;width:100%" data-act="open-deal" data-id="${d.id}">Abrir negócio</button></div>`:`<button class="btn sm" data-act="conv-deal" data-id="${cur.id}">${ic('plus')}Criar negócio</button>`}
    <div><div class="eyebrow" style="margin-bottom:6px">Canal</div><div class="sm">${esc(i.name)}</div><div class="xs muted">${i.kind==='oficial'?'API oficial · janela de 24 h '+(open?'aberta':'encerrada'):'Conexão por QR Code · sem modelos'}</div></div>
    <button class="btn sm" data-act="open-contact" data-id="${c.id}">${ic('contact')}Ver contato</button></aside>`:''}</div>`;
};
ACT.ctab=el=>{S.v.ctab=el.dataset.id;S.v.conv=null;S.v.chatOpen=false;refresh()};
ACT.cchan=el=>{S.v.cchan=el.dataset.id;refresh()};
ACT.note=el=>{S.v.note=el.dataset.id==='1';refresh()};
ACT['chat-back']=()=>{S.v.chatOpen=false;refresh()};
ACT['open-conv']=el=>{closeAll();const c=conv(el.dataset.id);S.v.conv=c.id;S.v.chatOpen=true;if(!convList().includes(c)){S.v.ctab=c.status==='resolvida'?'resolvidas':'todas'}go('conversas');refresh();const m=$('#msgs');if(m)m.scrollTop=m.scrollHeight};
ACT['start-conv']=el=>{
  const o=O(),c=contact(el.dataset.id),ex=o.convs.find(x=>x.contactId===c.id);if(ex)return ACT['open-conv']({dataset:{id:ex.id}});
  const i=o.inst.find(x=>x.state==='conectada');if(!i){toast('Nenhum canal conectado. Conecte uma instância em WhatsApp.',{icon:'wifi-off'});return}
  const nc={id:'v'+(o.convs.length+1),contactId:c.id,instanceId:i.id,assignee:ME,unread:0,status:'aberta',msgs:[{id:'s0',dir:'sys',text:'Conversa iniciada por '+user(ME).name,t:now()}],lastInAt:null,firstReply:false};
  o.convs.push(nc);S.v.ctab='minhas';ACT['open-conv']({dataset:{id:nc.id}});
};
CHG.convassign=el=>{const c=conv(el.dataset.id);c.assignee=el.value||null;if(c.assignee){c.msgs.push({id:'s'+c.msgs.length,dir:'sys',text:`Atribuída a ${user(c.assignee).name}`,t:now()})}toast(c.assignee?`Atribuída a <b>${esc(fname(user(c.assignee).name))}</b>`:'Conversa sem responsável',{icon:'user'});refresh()};
ACT['conv-resolve']=el=>{const c=conv(el.dataset.id);c.status=c.status==='resolvida'?'aberta':'resolvida';toast(c.status==='resolvida'?'Conversa resolvida':'Conversa reaberta',{icon:'check'});S.v.conv=null;S.v.chatOpen=false;refresh()};
ACT['conv-deal']=el=>{
  const o=O(),c=conv(el.dataset.id),ct=contact(c.contactId),ex=o.deals.find(d=>d.contactId===ct.id&&d.pipe==='comercial');
  if(ex)return openDrawer(()=>dealDrawer(ex.id));
  const d={id:'d'+(o.deals.length+1),contactId:ct.id,pipe:'comercial',stage:'novo',value:ct.credit||1,product:ct.product,admin:ct.admin,temp:'Morno',owner:c.assignee||ME,entered:0,lost:false,reason:'',wonAt:null,createdAt:now()};
  o.deals.push(d);o.tasks.push({id:'t'+(o.tasks.length+1),title:`Primeiro contato · ${fname(ct.name)}`,type:'whatsapp',due:new Date(now().getTime()+1*H),done:false,owner:d.owner,contactId:ct.id,dealId:d.id,xp:5});
  if(!c.assignee)c.assignee=ME;
  toast(`Negócio criado a partir da conversa com <b>${esc(fname(ct.name))}</b>`,{icon:'kanban',act:'go-pipe',id:'comercial',actLabel:'Ver no funil'});refresh();
};
CHG.quick=el=>{if(el.value==='')return;const ta=$('.composer textarea');if(ta){ta.value=QUICK[+el.value];ta.focus()}el.value=''};
const REPLIES=['Perfeito, obrigado!','Ótimo, aguardo então.','Pode ser sim, fico no aguardo.','Entendi. Vou conferir e te aviso.'];
FORMS.msg=(form,data)=>{
  const c=conv(form.dataset.id),f=S.v,text=(data.text||'').trim(),open=windowOpen(c);
  if(f.note){if(!text)return;c.msgs.push({id:'n'+c.msgs.length,dir:'note',text,t:now(),by:ME});refresh();return}
  if(!open){c.msgs.push({id:'o'+c.msgs.length,dir:'out',text:`[Modelo ${data.tpl}] ${text||'Olá! Podemos retomar nossa conversa?'}`,t:now(),by:ME});c.lastInAt=null;toast('Modelo enviado. A janela reabre quando o cliente responder.',{icon:'send'})}
  else{if(!text)return;const last=c.msgs[c.msgs.length-1];const fast=last&&last.dir==='in'&&(now()-last.t)<5*MIN&&!c.firstReply;
    c.msgs.push({id:'o'+c.msgs.length,dir:'out',text,t:now(),by:ME});if(!c.assignee)c.assignee=ME;
    if(fast){c.firstReply=true;const g=O().g[ME];g.counters.fast++;g.counters.fastWeek++;award('resposta')}}
  c.unread=0;refresh();
  if(!c.sim&&c.msgs.filter(m=>m.dir==='out').length>=1){c.sim=true;setTimeout(()=>{c.msgs.push({id:'r'+c.msgs.length,dir:'in',text:REPLIES[text.length%REPLIES.length],t:now(),by:null});c.lastInAt=now();c.unread=S.view==='conversas'&&S.v.conv===c.id?0:1;if(S.view==='conversas')refresh();else{renderNav();toast(`Nova mensagem de <b>${esc(fname(contact(c.contactId).name))}</b>`,{icon:'message-square',act:'open-conv',id:c.id,actLabel:'Abrir'})}},2400)}
};

/* ---------- WhatsApp ---------- */
function qrSvg(seed){const r=rngf(seed),n=25,s=6;let out='';const fin=(x,y)=>`<rect x="${x*s}" y="${y*s}" width="${7*s}" height="${7*s}" fill="#06261F"/><rect x="${(x+1)*s}" y="${(y+1)*s}" width="${5*s}" height="${5*s}" fill="#fff"/><rect x="${(x+2)*s}" y="${(y+2)*s}" width="${3*s}" height="${3*s}" fill="#06261F"/>`;
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){const inF=(x<8&&y<8)||(x>n-9&&y<8)||(x<8&&y>n-9);if(!inF&&r()>.52)out+=`<rect x="${x*s}" y="${y*s}" width="${s}" height="${s}" fill="#06261F"/>`}
  return`<svg class="qr" viewBox="0 0 ${n*s} ${n*s}" role="img" aria-label="QR Code de demonstração"><rect width="100%" height="100%" fill="#fff"/>${out}${fin(0,0)}${fin(n-7,0)}${fin(0,n-7)}</svg>`}
VIEWS['whatsapp']=()=>{
  const o=O(),pl=PLANS[o.plan],used=o.inst.length;
  return`<div class="pg"><div class="pg-h"><div class="grow"><div class="eyebrow">${esc(o.name)} · canais</div><h2>WhatsApp</h2></div><span class="sm muted">${used} de ${pl.wa} instâncias do plano ${esc(pl.name)}</span><button class="btn pri" data-act="connect">${ic('plus')}Conectar instância</button></div>
   <div class="g" style="grid-template-columns:repeat(auto-fill,minmax(310px,1fr))">${o.inst.map(i=>`<section class="card ${i.state==='conectada'?'hud':''}"><div class="row" style="align-items:flex-start"><div class="org-mark" style="width:38px;height:38px">${ic('smartphone')}</div><div class="grow"><b>${esc(i.name)}</b><div class="xs muted">${esc(i.phone)}</div></div>${bd(i.state==='conectada'?'Conectada':'Desconectada',i.state==='conectada'?'ok':'bad')}</div>
    <div class="row wrap" style="margin:14px 0 4px;gap:6px">${i.kind==='oficial'?bd('API oficial · Cloud API','gold','badge-check'):bd('Não oficial · QR Code','warn','triangle-alert')}${i.kind==='oficial'?bd('Qualidade '+i.quality,i.quality==='Alta'?'ok':'warn'):''}</div>
    <div class="sm muted" style="min-height:40px">${i.kind==='oficial'?`Limite de ${i.tier}. Modelos aprovados pela Meta para iniciar conversas.`:'Sessão do aparelho conectado. Sem modelos oficiais; sujeita a bloqueio pela Meta.'}</div>
    <div class="row" style="margin-top:12px"><button class="btn sm" data-act="inst-cfg" data-id="${i.id}">${ic('sliders-horizontal')}Configurar</button>${i.state!=='conectada'?`<button class="btn sm pri" data-act="inst-reconnect" data-id="${i.id}">${ic('qr-code')}Reconectar</button>`:`<button class="btn sm ghost" data-act="inst-off" data-id="${i.id}">Desconectar</button>`}</div></section>`).join('')}</div>
   <section class="card"><div class="card-h"><div><span class="eyebrow">Qual usar</span><h3>API oficial ou conexão por QR Code</h3></div></div><div class="tbl-wrap" style="border:0"><table class="tbl cmp" style="min-width:620px"><thead><tr><th></th><th>API oficial (WhatsApp Business Platform)</th><th>Não oficial (QR Code)</th></tr></thead><tbody>
    <tr><td>Conformidade</td><td>Dentro dos termos da Meta</td><td>Fora dos termos; a conta pode ser bloqueada sem aviso</td></tr>
    <tr><td>Primeiro contato</td><td>Por modelo aprovado; conversa livre por 24 h após a resposta do cliente</td><td>Mensagem livre, sem modelos</td></tr>
    <tr><td>Mensagens em lote</td><td>Só com modelo aprovado e consentimento (opt-in) do contato</td><td>Evite: é o principal motivo de bloqueio</td></tr>
    <tr><td>Estabilidade</td><td>Alta; não depende de aparelho</td><td>Depende do aparelho e da sessão; pode cair</td></tr>
    <tr><td>Custo</td><td>A Meta cobra por mensagem de modelo (marketing sempre é cobrado). Resposta livre dentro de 24 h não é cobrada</td><td>Sem cobrança da Meta</td></tr>
    <tr><td>Indicado para</td><td>Operação principal, retomadas, avisos</td><td>Atendimento receptivo de baixo volume ou teste</td></tr></tbody></table></div></section>
   <p class="demo">Conexão simulada: nenhuma mensagem real é enviada ou recebida nesta demonstração.</p></div>`;
};
function connectDialog(kind,step){
  const o=O(),pl=PLANS[o.plan];S.v.wa={kind,step};
  if(o.inst.length>=pl.wa){return dialog({title:'Limite do plano atingido',sub:'WhatsApp',submit:'Ver planos',body:`<p class="sm">O plano <b>${esc(pl.name)}</b> inclui ${pl.wa} instância${pl.wa>1?'s':''}, e todas já estão em uso. Para conectar outra, mude de plano ou remova uma instância.</p>`,onSubmit:()=>{go('planos')}})}
  if(!kind){return dialog({title:'Conectar instância',sub:'Passo 1 de 2 · tipo de conexão',submit:'Continuar',body:`<div class="col"><label class="card row" style="cursor:pointer;align-items:flex-start"><input type="radio" name="kind" value="oficial" checked class="chk" style="margin-top:3px"><div><b>API oficial</b><div class="sm muted">Número verificado na WhatsApp Business Platform. Estável, com modelos e dentro dos termos da Meta. Recomendado.</div></div></label>
    <label class="card row" style="cursor:pointer;align-items:flex-start"><input type="radio" name="kind" value="nao-oficial" class="chk" style="margin-top:3px"><div><b>Não oficial (QR Code)</b><div class="sm muted">Conecta um aparelho por QR Code. Rápido para testar, mas pode ser bloqueado pela Meta e não tem modelos.</div></div></label></div>`,onSubmit:f=>{setTimeout(()=>connectDialog(f.kind,2),0)}})}
  if(kind==='oficial')return dialog({title:'Dados da API oficial',sub:'Passo 2 de 2',submit:'Verificar e conectar',body:`<label class="fld">Nome da instância<input class="in" name="name" required placeholder="Ex.: Comercial Goiânia"></label>
    <div class="g" style="grid-template-columns:1fr 1fr"><label class="fld">Número com DDI<input class="in" name="phone" required placeholder="+55 65 90000-0000"></label><label class="fld">ID do número (Phone Number ID)<input class="in" name="pid" required placeholder="1029384756"></label></div>
    <label class="fld">Token de acesso permanente<input class="in" type="password" name="tok" required autocomplete="off" placeholder="Guardado com criptografia; nunca exibido novamente"></label>`,
    onSubmit:f=>{o.inst.push({id:'i'+(o.inst.length+1),name:f.name,kind:'oficial',phone:f.phone,state:'conectada',quality:'Alta',tier:'1 mil/dia',since:dm(now())+'/2026'});toast(`Instância <b>${esc(f.name)}</b> verificada e conectada`,{icon:'badge-check'});refresh()}});
  return dialog({title:'Conectar por QR Code',sub:'Passo 2 de 2',submit:'Já escaneei',body:`<label class="fld">Nome da instância<input class="in" name="name" required placeholder="Ex.: Atendimento Goiânia"></label>
    <div class="row wrap" style="gap:20px;align-items:center">${qrSvg(o.inst.length+7)}<div class="col grow sm" style="min-width:220px"><span>1. Abra o WhatsApp no aparelho.</span><span>2. Toque em <b>Aparelhos conectados</b>.</span><span>3. Aponte a câmera para o QR Code.</span><span class="xs muted">QR Code de demonstração. Ele expira em 60 s em uma conexão real.</span></div></div>
    <label class="row sm" style="align-items:flex-start"><input class="chk" type="checkbox" name="ok" required style="margin-top:3px"><span>Entendo que esta conexão não é oficial, pode ser bloqueada pela Meta e não deve ser usada para disparos em massa.</span></label>`,
    onSubmit:f=>{o.inst.push({id:'i'+(o.inst.length+1),name:f.name,kind:'nao-oficial',phone:'+55 '+o.ddd+' 90000-09'+pad(o.inst.length),state:'conectada',since:dm(now())+'/2026'});toast(`Instância <b>${esc(f.name)}</b> conectada`,{icon:'smartphone'});refresh()}});
}
ACT.connect=()=>connectDialog(null,1);
ACT['inst-reconnect']=el=>{const i=inst(el.dataset.id);dialog({title:'Reconectar '+i.name,sub:'QR Code',submit:'Já escaneei',body:`<div class="row wrap" style="gap:20px;align-items:center">${qrSvg(+el.dataset.id.slice(1)+3)}<div class="col grow sm"><span>Escaneie com o aparelho de <b>${esc(i.phone)}</b>.</span><span class="xs muted">QR Code de demonstração.</span></div></div>`,onSubmit:()=>{i.state='conectada';toast(`<b>${esc(i.name)}</b> reconectada`,{icon:'wifi'});refresh()}})};
ACT['inst-off']=el=>{const i=inst(el.dataset.id);i.state='desconectada';toast(`<b>${esc(i.name)}</b> desconectada`,{icon:'wifi-off'});refresh()};
ACT['inst-cfg']=el=>{const i=inst(el.dataset.id);i.cfg=i.cfg||{auto:true,mode:'rodizio',hours:true,away:'Olá! Nosso atendimento retorna às 8h. Deixe sua mensagem que respondemos em breve.',pipe:'comercial'};openDrawer(()=>instDrawer(i.id))};
function instDrawer(id){
  const i=inst(id),c=i.cfg;
  return`<div class="dr-h"><div class="org-mark">${ic('smartphone')}</div><div class="grow"><div class="eyebrow">${i.kind==='oficial'?'API oficial':'Não oficial'}</div><h3 class="disp" style="font-size:26px;margin-top:2px">${esc(i.name)}</h3><div class="sm muted">${esc(i.phone)} · desde ${esc(i.since)}</div></div><button class="ibtn" data-act="close" aria-label="Fechar">${ic('x')}</button></div>
  <div class="dr-b"><div class="row sp"><div><b class="sm">Distribuição automática</b><div class="xs muted">Novas conversas são atribuídas sozinhas.</div></div>${sw(c.auto,'cfg-auto',id)}</div>
   <label class="fld">Regra de distribuição<select class="in" data-chg="cfg-mode" data-id="${id}"><option value="rodizio" ${c.mode==='rodizio'?'selected':''}>Rodízio entre vendedores</option><option value="equipe" ${c.mode==='equipe'?'selected':''}>Por equipe</option><option value="manual" ${c.mode==='manual'?'selected':''}>Manual (fila)</option></select></label>
   <label class="fld">Funil de destino<select class="in" data-chg="cfg-pipe" data-id="${id}">${Object.keys(PIPES).map(k=>`<option value="${k}" ${c.pipe===k?'selected':''}>${PIPES[k].label}</option>`).join('')}</select></label>
   <div class="row sp"><div><b class="sm">Horário de atendimento</b><div class="xs muted">Seg a sex, 8h às 18h</div></div>${sw(c.hours,'cfg-hours',id)}</div>
   <label class="fld">Mensagem de ausência<textarea class="in" data-chg="cfg-away" data-id="${id}" rows="3">${esc(c.away)}</textarea></label>
   <label class="fld">URL do webhook (somente leitura)<input class="in" readonly value="https://api.alvocrm.exemplo/hooks/${esc(S.orgId)}/${esc(id)}"></label>
   ${i.kind==='oficial'?`<div><div class="eyebrow" style="margin-bottom:8px">Modelos de mensagem</div><div class="list">${TEMPLATES.map(t=>`<div class="li"><span class="sm grow" style="font-family:monospace">${t[0]}</span><span class="xs muted">${t[2]}</span>${bd(t[1],t[1]==='Aprovado'?'ok':'warn')}</div>`).join('')}</div></div>`:`<div class="card sm" style="border-color:var(--warn)">${ic('triangle-alert')} Conexões por QR Code não têm modelos oficiais e podem ser bloqueadas. Use para atendimento receptivo.</div>`}</div>`;
}
ACT['cfg-auto']=el=>{const c=inst(el.dataset.id).cfg;c.auto=!c.auto;redrawDrawer()};
ACT['cfg-hours']=el=>{const c=inst(el.dataset.id).cfg;c.hours=!c.hours;redrawDrawer()};
CHG['cfg-mode']=el=>{inst(el.dataset.id).cfg.mode=el.value;toast('Regra de distribuição salva',{icon:'check'})};
CHG['cfg-pipe']=el=>{inst(el.dataset.id).cfg.pipe=el.value;toast('Funil de destino salvo',{icon:'check'})};
CHG['cfg-away']=el=>{inst(el.dataset.id).cfg.away=el.value;toast('Mensagem de ausência salva',{icon:'check'})};

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
   <td><div class="row" style="justify-content:flex-end;gap:6px"><button class="btn sm" data-act="inv-resend" data-id="${i.id}">${ic('send')}Reenviar</button><button class="ibtn" style="width:30px;height:30px" data-act="inv-copy" data-id="${i.id}" aria-label="Copiar link do convite">${ic('copy')}</button><button class="ibtn" style="width:30px;height:30px" data-act="inv-del" data-id="${i.id}" aria-label="Revogar convite">${ic('trash-2')}</button></div></td></tr>`).join('')||`<tr><td colspan="6" class="empty">Nenhum convite enviado.</td></tr>`}</tbody></table></div>
   <p class="sm muted">Convites expiram em 7 dias. A pessoa define a própria senha ao aceitar e entra com o perfil escolhido aqui.</p>`;
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
  const o=O(),u=user(id),g=o.g[id],can=LV('equipe')>=3,locked=!can||u.role==='Proprietário',L=g&&lvl(g.xp),teams=[...new Set(o.users.map(x=>x.team))];
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

/* ===== Shell, roteador, eventos e inicialização ===== */
const LOGO_IVORY='data:image/png;base64,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';
const MAC=/Mac|iPhone|iPad/.test((navigator.platform||'')+(navigator.userAgent||''));
S.prefs={nConv:true,nSla:true,nTasks:true,nAch:true,digest:false,reduce:false,rail:false,pause:false,rankVis:true,twofa:true};
S.v.tfilter='abertos';

/* ----- preferências (só conveniência por navegador; falha silenciosa) ----- */
function savePrefs(){try{localStorage.setItem('alvo-crm-demo-v1',JSON.stringify({p:S.prefs,mode:S.ui.mode,rail:S.ui.rail}))}catch(e){}}
function loadPrefs(){try{const r=JSON.parse(localStorage.getItem('alvo-crm-demo-v1')||'null');if(r){Object.assign(S.prefs,r.p||{});S.ui.mode=r.mode==='claro'?'claro':'comando';S.ui.rail=!!r.rail}}catch(e){}}
function applyPrefs(){document.body.dataset.mode=S.ui.mode;document.body.dataset.motion=S.prefs.reduce?'reduce':'';document.body.dataset.rail=S.ui.rail?'1':'0';S.prefs.rail=S.ui.rail;const a=$('.app');if(a){a.classList.toggle('rail',S.ui.rail);a.classList.toggle('mnav',S.ui.mnav)}}
function setTheme(m){S.ui.mode=m;savePrefs();applyPrefs();refresh()}

/* ----- navegação ----- */
const NAV=[['Operação',[['visao-geral','layout-dashboard','V'],['funis','kanban','F'],['contatos','contact','C'],['tarefas','list-checks','T'],['conversas','message-square','M'],['whatsapp','smartphone','W']]],
  ['Desempenho',[['metas','trophy','M']]],['Gestão',[['equipe','users','E'],['planos','credit-card','P'],['suporte','life-buoy','S']]]];
const vlabel=v=>v==='perfil'?'Meu perfil':(MODS.find(m=>m[0]===v)||[0,v])[1];
const VIC=Object.fromEntries(NAV.flatMap(g=>g[1].map(i=>[i[0],i[1]])));
function miniRing(p,n){const r=16,c=2*Math.PI*r;return`<span class="mini-ring"><svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="${r}" fill="none" stroke="rgba(243,238,228,.18)" stroke-width="3"/><circle cx="20" cy="20" r="${r}" fill="none" stroke="#C48A2C" stroke-width="3" stroke-linecap="round" stroke-dasharray="${(c*p).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 20 20)"/></svg><b>${n}</b></span>`}
function renderNav(){
  const o=O(),g=o.g[ME],L=lvl(g.xp),un=o.convs.filter(c=>c.status==='aberta'&&c.unread>0).length,late=o.tasks.filter(t=>!t.done&&t.owner===ME&&t.due<now()).length;
  const cnt={conversas:un,tarefas:late};
  $('#sb').innerHTML=`<div class="sb-top"><img src="${LOGO_IVORY}" alt="ALVO"><span class="ptag">Plataforma<br>Comercial</span><span class="mono" aria-hidden="true">A</span></div>
   <button class="orgbtn" data-act="pop" data-id="org" aria-label="Trocar de organização" aria-haspopup="true"><span class="org-mark">${esc(o.mark)}</span><span class="meta grow" style="min-width:0"><div class="t">${esc(o.name)}</div><div class="s">${esc(o.sub)}</div></span>${ic('chevrons-up-down')}</button>
   <nav class="nav" aria-label="Seções">${NAV.map(gr=>`<div class="grp-t">${gr[0]}</div>${gr[1].map(([v,icn,fb])=>{const lock=LV(v)===0,label=vlabel(v);return`<a href="#${v}" class="${S.view===v?'on':''} ${lock?'lock':''}" data-act="nav" data-id="${v}" title="${esc(label)}${lock?' (sem acesso)':''}" ${S.view===v?'aria-current="page"':''}>${ic(icn,'',fb)}<span class="lbl">${esc(label)}</span>${lock?`<span class="cnt" style="background:transparent;color:inherit;padding:0">${ic('lock')}</span>`:cnt[v]?`<span class="cnt">${cnt[v]}</span>`:''}</a>`}).join('')}`).join('')}</nav>
   <div class="sb-foot"><button class="lvl-card" data-act="go" data-id="metas" aria-label="Nível ${L.n}, ${esc(L.title)}. Abrir metas e conquistas">${miniRing(L.pct,L.n)}<span class="txt grow"><div class="t">${esc(L.title)}</div><div class="s num">${g.xp.toLocaleString('pt-BR')} XP${S.prefs.pause?' · pausa':''}</div><div class="bar" style="margin-top:6px;height:4px">${'<i style="width:'+Math.max(3,L.pct*100)+'%"></i>'}</div></span></button>
    <button class="collapse" data-act="rail" aria-label="${S.ui.rail?'Expandir':'Recolher'} menu">${ic('chevrons-left')}<span class="lbl">Recolher menu</span></button></div>`;
  icons();
}
function renderTop(){
  const o=O(),unread=o.notifs.filter(n=>!n.read).length,u=user(ME);
  $('#top').innerHTML=`<button class="ibtn burger" data-act="burger" aria-label="Abrir menu">${ic('menu')}</button>
   <div class="grow" style="min-width:0"><div class="crumb">${esc(o.name)} <span aria-hidden="true">/</span> ${esc(vlabel(S.view))}</div><h1 class="sr-only">${esc(vlabel(S.view))}</h1></div>
   <button class="search" data-act="cmd" aria-label="Buscar e executar comandos">${ic('search')}<span class="t search-lbl">Buscar contatos, telas e ações</span><span class="kbd">${MAC?'⌘K':'Ctrl K'}</span></button>
   <button class="ibtn" data-act="theme-toggle" aria-label="Alternar entre tema Comando e Claro">${ic(S.ui.mode==='claro'?'moon':'sun')}</button>
   <button class="ibtn" data-act="pop" data-id="notif" aria-label="Notificações${unread?`, ${unread} novas`:''}" aria-haspopup="true">${ic('bell')}${unread?'<span class="dot"></span>':''}</button>
   <button class="ibtn" data-act="pop" data-id="user" aria-label="Menu do usuário" aria-haspopup="true" style="border:0;width:auto">${avN(u.name,34)}</button>`;
  renderPops();
}
function renderPops(){
  const o=O(),p=S.ui.pop,u=user(ME);let h='';
  if(p==='notif')h=`<div class="pop" role="dialog" aria-label="Notificações" style="position:fixed;top:60px"><div class="row sp"><h4>Notificações</h4><button class="btn sm ghost" data-act="read-all">Marcar como lidas</button></div>${o.notifs.map(n=>`<button class="pi" data-act="notif" data-id="${n.id}">${ic(n.icon)}<span class="grow"><span class="sm" style="${n.read?'':'font-weight:600'}">${esc(n.text)}</span><br><span class="xs muted">${rel(n.t)}</span></span>${n.read?'':'<span class="temp" style="background:var(--gold);margin-top:6px"></span>'}</button>`).join('')||'<div class="empty">Sem notificações.</div>'}</div>`;
  else if(p==='user')h=`<div class="pop" role="dialog" aria-label="Menu do usuário" style="position:fixed;top:60px"><div class="row" style="padding:10px">${avN(u.name,40)}<div><b>${esc(u.name)}</b><div class="xs muted">${esc(u.role)} · ${esc(o.name)}</div></div></div>
    <button class="pi" data-act="go" data-id="perfil">${ic('user-round')}<span class="sm">Meu perfil</span></button><button class="pi" data-act="go" data-id="metas">${ic('trophy')}<span class="sm">Metas e conquistas</span></button><button class="pi" data-act="theme-toggle">${ic(S.ui.mode==='claro'?'moon':'sun')}<span class="sm">Tema ${S.ui.mode==='claro'?'Comando (escuro)':'Claro'}</span></button>
    <div style="padding:10px;border-top:1px solid var(--line);margin-top:6px"><label class="fld">Ver como (demonstração)<select class="in" data-chg="asrole">${ROLES.map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></label><div class="xs muted" style="margin-top:6px;font-weight:400">Mostra como menu e telas mudam para cada perfil.</div></div>
    <button class="pi" data-act="logout">${ic('log-out')}<span class="sm">Sair</span></button></div>`;
  else if(p==='org'){const left=window.innerWidth<=900?12:(S.ui.rail?84:12);h=`<div class="pop left" role="dialog" aria-label="Organizações" style="position:fixed;top:112px;left:${left}px"><h4>Organizações</h4>${Object.values(S.orgs).map(x=>`<button class="pi ${x.id===S.orgId?'on':''}" data-act="org" data-id="${x.id}"><span class="org-mark" style="width:30px;height:30px;font-size:16px">${esc(x.mark)}</span><span class="grow"><b class="sm">${esc(x.name)}</b><br><span class="xs muted">${esc(x.sub)} · ${esc(PLANS[x.plan].name)} · você é ${esc(x.users.find(y=>y.id===ME).role)}</span></span>${x.id===S.orgId?ic('check'):''}</button>`).join('')}
    <button class="pi" data-act="new-org" style="border-top:1px solid var(--line);margin-top:6px">${ic(o.plan==='corporativo'?'plus':'lock')}<span class="sm">Nova organização${o.plan==='corporativo'?'':' (plano Corporativo)'}</span></button></div>`}
  $('#pops').innerHTML=h;icons();
}
function resetViewState(){Object.assign(S.v,{conv:null,sel:[],owner:'all',temp:'all',stale:false,q:'',tag:'all',chatOpen:false,ctab:'minhas',cchan:'all',pipe:'comercial',tscope:'minhas'})}
function deny(v){toast(`O perfil <b>${esc(ROLE())}</b> não tem acesso a ${esc(vlabel(v))}.`,{icon:'lock',act:'req-access',id:v,actLabel:'Solicitar acesso'})}
function refresh(top){
  const v=$('#view');if(!VIEWS[S.view])S.view='visao-geral';
  const st=v.scrollTop,ta=$('.composer textarea'),keep=ta?{v:ta.value,f:document.activeElement===ta}:null;
  v.className='view'+(FLUSH.has(S.view)?' flush':'');v.innerHTML=VIEWS[S.view]();v.scrollTop=top?0:st;
  if(keep){const n=$('.composer textarea');if(n&&keep.v){n.value=keep.v;if(keep.f)n.focus()}}
  renderNav();renderTop();icons();
  if(S.view==='conversas'){const m=$('#msgs');if(m)m.scrollTop=m.scrollHeight}
}
function go(v){
  if(!VIEWS[v])return;if(LV(v)===0){deny(v);return}
  const was=S.view;S.view=v;S.ui.mnav=false;S.ui.pop=null;if(S.ui.drawer||S.ui.modal)closeAll();
  try{if(location.hash!=='#'+v){S.hashSet=true;location.hash=v}}catch(e){}
  applyPrefs();refresh(was!==v);
}
window.addEventListener('hashchange',()=>{if(S.hashSet){S.hashSet=false;return}const v=location.hash.slice(1);if(VIEWS[v]&&v!==S.view)go(v)});

/* ----- ações do shell ----- */
ACT.nav=el=>go(el.dataset.id);
ACT.go=el=>go(el.dataset.id);
ACT.close=()=>closeAll();
ACT['close-modal']=()=>{S.ui.cmd=null;closeModal()};
ACT.pop=el=>{const k=el.dataset.id;S.ui.pop=S.ui.pop===k?null:k;renderPops()};
ACT.burger=()=>{S.ui.mnav=!S.ui.mnav;applyPrefs()};
ACT.rail=()=>{S.ui.rail=!S.ui.rail;savePrefs();applyPrefs();renderNav()};
ACT['theme-toggle']=()=>{S.ui.pop=null;setTheme(S.ui.mode==='claro'?'comando':'claro')};
ACT.theme=el=>setTheme(el.dataset.id);
ACT.logout=()=>{S.ui.pop=null;renderPops();toast('Demonstração: não há sessão real para encerrar.',{icon:'log-out'})};
ACT['req-access']=el=>{toast(`Pedido de acesso a ${esc(vlabel(el.dataset.id))} enviado aos administradores.`,{icon:'send'})};
ACT.notif=el=>{const n=O().notifs.find(x=>x.id===el.dataset.id);if(n){n.read=true;S.ui.pop=null;go(n.view)}};
ACT['read-all']=()=>{O().notifs.forEach(n=>n.read=true);renderTop()};
ACT.org=el=>{
  const id=el.dataset.id;S.ui.pop=null;if(id===S.orgId){renderPops();return}
  S.orgId=id;resetViewState();if(S.ui.drawer||S.ui.modal)closeAll();
  if(LV(S.view)===0)S.view='visao-geral';
  toast(`Organização: <b>${esc(O().name)}</b> · seu perfil: ${esc(ROLE())}`,{icon:'building-2'});refresh(true);
};
ACT['new-org']=()=>{
  S.ui.pop=null;renderPops();
  if(O().plan!=='corporativo'){toast('Múltiplas organizações fazem parte do plano Corporativo.',{icon:'lock',act:'go',id:'planos',actLabel:'Ver planos'});return}
  dialog({title:'Nova organização',sub:'Múltiplas organizações',submit:'Criar organização',body:`<label class="fld">Nome<input class="in" name="name" required maxlength="50" placeholder="Ex.: ALVO Sul"></label><label class="fld">Cidade<input class="in" name="city" required maxlength="40" placeholder="Ex.: Rondonópolis"></label><p class="sm muted">Você entra como administrador, no plano Essencial e com dados de exemplo. Equipe, funis e WhatsApp são independentes dos de outras organizações.</p>`,
   onSubmit:f=>{const n=Object.keys(S.orgs).length+1,id='org'+n,nm=f.name.trim(),ct=f.city.trim();
     const def={id,name:nm,sub:'Nova · '+ct,mark:nm[0].toUpperCase(),plan:'essencial',seats:5,seed:50+n,nContacts:8,ddd:'65',city:ct,goal:500000,users:[{id:'me',name:user(ME).name,cargo:'Administradora',team:'Gestão',role:'Administrador'}],inst:[]};
     ORGDEFS.push(def);const o=genOrg(def);const g=o.g[ME];g.ach=[];g.streak=0;g.cycleXp=0;g.log=[];Object.keys(g.counters).forEach(k=>g.counters[k]=0);
     Object.assign(o,{tickets:[],invites:[],invoices:[],hist:[],notifs:[{id:'n1',icon:'party-popper',text:'Organização criada. Convide a equipe e conecte um WhatsApp.',t:now(),view:'equipe',read:false}]});S.orgs[id]=o;ACT.org({dataset:{id}})}});
};
CHG.asrole=el=>{user(ME).role=el.value;S.ui.pop=null;toast(`Visualizando como <b>${esc(el.value)}</b>`,{icon:'eye'});if(LV(S.view)===0)go('visao-geral');else refresh()};

/* ----- paleta de comandos ----- */
const norm=s=>String(s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
function cmdItems(q){
  const o=O(),n=norm(q.trim()),items=[];
  const add=(grp,label,icon,run,sub='')=>items.push({grp,label,icon,run,sub,k:norm(label+' '+sub)});
  MODS.forEach(m=>{if(LV(m[0])>0)add('Telas','Ir para '+m[1],VIC[m[0]]||'arrow-right',()=>go(m[0]))});
  add('Telas','Ir para Meu perfil','user-round',()=>go('perfil'));
  if(LV('contatos')>=2)add('Ações','Novo contato','user-plus',()=>ACT['new-contact']());
  if(LV('tarefas')>=2)add('Ações','Nova tarefa','list-checks',()=>ACT['new-task']({dataset:{}}));
  if(LV('funis')>=2)add('Ações','Novo negócio','plus',()=>ACT['new-deal']({dataset:{}}));
  if(LV('whatsapp')>=2)add('Ações','Conectar instância de WhatsApp','smartphone',()=>ACT.connect());
  if(LV('equipe')>=3)add('Ações','Convidar usuário','user-plus',()=>ACT.invite());
  add('Ações','Abrir chamado de suporte','life-buoy',()=>ACT['new-ticket']());
  add('Ações','Alternar tema (Comando e Claro)',S.ui.mode==='claro'?'moon':'sun',()=>ACT['theme-toggle']());
  add('Ações',S.ui.rail?'Expandir menu lateral':'Recolher menu lateral','chevrons-left',()=>ACT.rail());
  Object.values(S.orgs).filter(x=>x.id!==S.orgId).forEach(x=>add('Organizações','Trocar para '+x.name,'building-2',()=>ACT.org({dataset:{id:x.id}}),x.sub));
  if(LV('contatos')>0)o.contacts.forEach(c=>add('Contatos',c.name,'contact',()=>ACT['open-contact']({dataset:{id:c.id}}),c.phone+' · '+c.product));
  if(!n)return items.filter(i=>i.grp!=='Contatos').slice(0,9);
  const hit=items.filter(i=>i.k.includes(n));
  return[...hit.filter(i=>i.grp!=='Contatos'),...hit.filter(i=>i.grp==='Contatos').slice(0,6)].slice(0,12);
}
function cmdRes(){
  const c=S.ui.cmd;c.items=cmdItems(c.q);c.i=Math.min(c.i,Math.max(0,c.items.length-1));let last='',h='';
  c.items.forEach((it,i)=>{if(it.grp!==last){h+=`<div class="eyebrow" style="padding:10px 10px 4px">${it.grp}</div>`;last=it.grp}
    h+=`<button class="pi ${i===c.i?'on':''}" data-act="cmd-run" data-id="${i}">${ic(it.icon)}<span class="grow sm"><b>${esc(it.label)}</b>${it.sub?`<span class="xs muted"> · ${esc(it.sub)}</span>`:''}</span></button>`});
  return h||'<div class="empty">Nada encontrado.</div>';
}
function openCmd(){S.ui.cmd={q:'',i:0,items:[]};openModal(()=>`<div class="dlg cmd" role="dialog" aria-modal="true" aria-label="Busca e comandos"><input id="cmdq" placeholder="Buscar contatos, telas e ações…" autocomplete="off" aria-label="Buscar"><div class="res" id="cmdres">${cmdRes()}</div><div class="row xs muted" style="padding:9px 16px;border-top:1px solid var(--line);gap:16px"><span>↑ ↓ navegar</span><span>Enter abrir</span><span>Esc fechar</span></div></div>`)}
ACT.cmd=()=>openCmd();
ACT['cmd-run']=el=>{const it=S.ui.cmd&&S.ui.cmd.items[+el.dataset.id];S.ui.cmd=null;closeModal();if(it)setTimeout(it.run,0)};

/* ----- eventos (delegação) ----- */
document.addEventListener('click',ev=>{
  const t=ev.target;if(!t.closest)return;
  if(t.id==='modal'){S.ui.cmd=null;closeModal();return}
  if(t.id==='scrim'){S.ui.cmd=null;closeAll();return}
  const el=t.closest('[data-act]');
  if(S.ui.pop&&!t.closest('.pop')&&!(el&&el.dataset.act==='pop')){S.ui.pop=null;renderPops()}
  if(S.ui.mnav&&!t.closest('.sb')&&!(el&&el.dataset.act==='burger')){S.ui.mnav=false;applyPrefs()}
  if(!el||el.disabled)return;const f=ACT[el.dataset.act];if(!f)return;
  if(el.tagName==='A')ev.preventDefault();
  f(el,ev);
});
document.addEventListener('change',ev=>{const t=ev.target;if(!t||!t.dataset)return;if(t.id==='csvf'){CHG.csvf(t);return}const k=t.dataset.chg;if(k&&CHG[k])CHG[k](t)});
document.addEventListener('input',ev=>{const t=ev.target;
  if(t.id==='cq'){S.v.q=t.value;const c=$('#ctable');if(c){c.innerHTML=contactsTable();icons()}}
  else if(t.id==='cmdq'&&S.ui.cmd){S.ui.cmd.q=t.value;S.ui.cmd.i=0;$('#cmdres').innerHTML=cmdRes();icons()}});
document.addEventListener('submit',ev=>{
  const form=ev.target.closest&&ev.target.closest('form[data-form]');if(!form)return;ev.preventDefault();
  const name=form.dataset.form,data=Object.fromEntries(new FormData(form).entries());
  if(name==='dlg'){const r=S.ui.dlgSubmit&&S.ui.dlgSubmit(data);if(r!==false)closeModal();return}
  if(name==='msg'||name==='ticket-reply')form.reset();
  if(FORMS[name])FORMS[name](form,data);
});
document.addEventListener('keydown',ev=>{
  const t=ev.target;
  if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();if(S.ui.cmd){S.ui.cmd=null;closeModal()}else openCmd();return}
  if(ev.key==='Escape'){if(S.ui.pop){S.ui.pop=null;renderPops()}else if(S.ui.modal){S.ui.cmd=null;closeModal()}else if(S.ui.drawer)closeAll();else if(S.ui.mnav){S.ui.mnav=false;applyPrefs()}return}
  if(t.id==='cmdq'&&S.ui.cmd){const c=S.ui.cmd;
    if(ev.key==='ArrowDown'||ev.key==='ArrowUp'){ev.preventDefault();c.i=(c.i+(ev.key==='ArrowDown'?1:-1)+c.items.length)%Math.max(1,c.items.length);$('#cmdres').innerHTML=cmdRes();icons();const on=$('#cmdres .pi.on');on&&on.scrollIntoView({block:'nearest'})}
    else if(ev.key==='Enter'){ev.preventDefault();const b=$('#cmdres .pi.on');b&&b.click()}return}
  if((ev.key==='Enter'||ev.key===' ')&&t.classList&&t.classList.contains('kcard')){ev.preventDefault();t.click()}
});
/* arrastar e soltar no funil (o seletor de etapa no painel é a alternativa por teclado e toque) */
document.addEventListener('dragstart',ev=>{const k=ev.target.closest&&ev.target.closest('.kcard');if(!k)return;S.drag=k.dataset.deal;k.classList.add('drag');ev.dataTransfer.effectAllowed='move';try{ev.dataTransfer.setData('text/plain',S.drag)}catch(e){}});
document.addEventListener('dragend',()=>{S.drag=null;$$('.kcard.drag,.kcol.over').forEach(x=>x.classList.remove('drag','over'))});
document.addEventListener('dragover',ev=>{const c=ev.target.closest&&ev.target.closest('.kcol');if(c&&S.drag){ev.preventDefault();$$('.kcol.over').forEach(x=>x!==c&&x.classList.remove('over'));c.classList.add('over')}});
document.addEventListener('drop',ev=>{const c=ev.target.closest&&ev.target.closest('.kcol');if(c&&S.drag){ev.preventDefault();const id=S.drag;S.drag=null;c.classList.remove('over');moveDeal(id,c.dataset.stage)}});
ACT.skip=()=>{const v=$('#view');v&&v.focus()};

/* ----- mensagem recebida simulada, para a demonstração do chat compartilhado ----- */
function simInbound(){
  if(document.hidden)return setTimeout(simInbound,15000);
  const o=O(),c=o.convs.find(x=>x.status==='aberta'&&x.msgs[x.msgs.length-1].dir==='out'&&x.assignee);if(!c)return;
  const txt=['Consegue me ligar ainda hoje?','Fechado, pode seguir com a proposta.','Minha esposa quer ver as parcelas de novo.'][c.id.length%3];
  c.msgs.push({id:'sim'+c.msgs.length,dir:'in',text:txt,t:now(),by:null});c.lastInAt=now();c.unread=(c.unread||0)+1;
  const ct=contact(c.contactId);o.notifs.unshift({id:'n'+Date.now(),icon:'message-square',text:`Nova mensagem de ${ct.name}`,t:now(),view:'conversas',read:false});
  if(S.view==='conversas')refresh();else{renderNav();renderTop()}
  toast(`Nova mensagem de <b>${esc(fname(ct.name))}</b>: ${esc(txt)}`,{icon:'message-square',act:'open-conv',id:c.id,actLabel:'Abrir',ms:7000});
}

/* ----- início ----- */
(function init(){
  loadPrefs();
  $('#app').innerHTML=`<button class="skip" data-act="skip">Ir para o conteúdo</button><div class="app"><aside class="sb" id="sb" aria-label="Menu principal"></aside><div class="main"><header class="top" id="top"></header><main class="view" id="view" tabindex="-1"></main></div></div>`;
  const h=(location.hash||'').slice(1);if(VIEWS[h]&&LV(h)>0)S.view=h;
  applyPrefs();refresh(true);
  setTimeout(simInbound,24000);
})();

