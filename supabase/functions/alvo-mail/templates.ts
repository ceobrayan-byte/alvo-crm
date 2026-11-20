// Modelos de e-mail da ALVO · identidade visual (verde-profundo + dourado + marfim), logo, faixa da jornada e botão de ação.
// Textos-base vindos do Floot (helpers/journeyEmailTemplates.tsx e sellerNoticeTemplates.tsx). Nunca presumir contemplação, quitação ou atraso.
// HTML em tabelas e estilos inline (Gmail, Outlook e celular).
export type Kind = 'payment-reminder'|'payment-last-day'|'assembly-today'|'assembly-feedback'|'birthday'|'news'|'overdue-one'|'overdue-two'|'pre-cancel'|'cancelled'|'churn'|'referral'|'campaign';
type Model = {id: Kind; title: string; trigger: string; promotional?: boolean; needsRef?: boolean; subject: string; body: string;
  icon: string; eyebrow: string; step?: number; quote: string; cta?: 'boleto'|'suporte'|'indicar'|'none'};
export const catalog: Model[] = [
 {id:'campaign',title:'Disparo / campanha',trigger:'Campanhas e ofertas para a base autorizada',promotional:true,icon:'✨',eyebrow:'CONDIÇÃO ESPECIAL ALVO',subject:'Uma oportunidade pensada para o seu próximo passo.',body:'Preparamos uma condição especial para quem quer acelerar a conquista do próximo patrimônio.',quote:'Grandes conquistas começam com uma decisão.',cta:'suporte'},
 {id:'payment-reminder',title:'Lembrete de pagamento',trigger:'Antes do vencimento confirmado',icon:'📅',eyebrow:'LEMBRETE DE PARCELA',step:1,subject:'Seu sonho merece esse compromisso.',body:'A data de sua próxima parcela está chegando. Cada compromisso cumprido é mais um passo em direção ao seu patrimônio. Estamos aqui para acompanhar você.',quote:'Constância é o que transforma planos em patrimônio.',cta:'boleto'},
 {id:'payment-last-day',title:'Último dia para pagamento',trigger:'Dia do vencimento confirmado',icon:'⏰',eyebrow:'SUA PARCELA VENCE HOJE',step:1,subject:'Seu sonho merece atenção. Hoje é o dia do seu compromisso.',body:'Hoje é o dia do vencimento da sua parcela. Se você já realizou o pagamento, por favor, desconsidere esta mensagem. Nosso compromisso é ajudar você a não perder uma data importante, porque levamos seus projetos tão a sério quanto você.',quote:'Cada parcela em dia mantém sua cota pronta para a contemplação.',cta:'boleto'},
 {id:'assembly-today',title:'Assembleia é HOJE',trigger:'Dia oficial da assembleia',icon:'🎯',eyebrow:'DIA DE ASSEMBLEIA',step:2,subject:'É hoje! Mais uma etapa da sua jornada.',body:'Hoje acontece a assembleia do seu grupo. A ALVO acompanhará os resultados oficiais para manter você informado sobre cada etapa do seu planejamento.',quote:'Quem se mantém no jogo está sempre perto da próxima conquista.',cta:'suporte'},
 {id:'assembly-feedback',title:'Feedback de assembleia',trigger:'Resultado oficial conferido',needsRef:true,icon:'📊',eyebrow:'RESULTADO DA ASSEMBLEIA',step:2,subject:'O resultado da sua assembleia chegou!',body:'Preparamos o resumo da assembleia do seu grupo. Abaixo você confere as contemplações e os indicadores informados oficialmente pela administradora. Resultados gerais do grupo não comprovam contemplação individual.',quote:'Informação clara é o melhor aliado de uma boa estratégia.',cta:'suporte'},
 {id:'birthday',title:'Feliz aniversário',trigger:'Data de nascimento confirmada',icon:'🎉',eyebrow:'HOJE O DIA É SEU',subject:'Hoje celebramos você!',body:'Desejamos um novo ciclo repleto de saúde, realizações e conquistas. Que seus sonhos encontrem novas oportunidades de se tornarem realidade. Feliz aniversário!',quote:'Que este novo ano seja o ano da sua próxima grande conquista.',cta:'none'},
 {id:'news',title:'Novidades e comunicados',trigger:'Sob demanda',promotional:true,icon:'📣',eyebrow:'NOVIDADES ALVO',subject:'Novidades da ALVO para você.',body:'Preparamos uma novidade importante para compartilhar com você. Conte com a ALVO para manter seus projetos em movimento.',quote:'Seguimos evoluindo para levar você mais longe.',cta:'suporte'},
 {id:'overdue-one',title:'Parcela atrasada · 1 mês',trigger:'Somente após confirmação da pendência',needsRef:true,icon:'🤝',eyebrow:'ESTAMOS COM VOCÊ',step:1,subject:'Podemos ajudar você a colocar seu plano em dia?',body:'Identificamos uma pendência que merece sua atenção. Sabemos que imprevistos acontecem e estamos à disposição para orientar você sobre as possibilidades previstas no seu contrato.',quote:'Todo plano pode ser retomado. O importante é não parar.',cta:'boleto'},
 {id:'overdue-two',title:'Parcela atrasada · 2 meses',trigger:'Somente após confirmação da pendência',needsRef:true,icon:'🤝',eyebrow:'VAMOS CUIDAR DISSO JUNTOS',step:1,subject:'Vamos cuidar da continuidade do seu consórcio?',body:'Seu planejamento merece atenção neste momento. Podemos ajudar você a entender a situação de sua cota e quais são os próximos passos possíveis.',quote:'Seu objetivo continua valendo a pena.',cta:'boleto'},
 {id:'pre-cancel',title:'Pré-cancelamento',trigger:'Risco confirmado pela administradora',needsRef:true,icon:'🛡️',eyebrow:'ATENÇÃO À SUA COTA',step:1,subject:'Uma informação importante sobre sua cota.',body:'Recebemos uma atualização que exige atenção sobre seu consórcio. Nossa equipe está à disposição para orientar você com base no contrato e nas informações oficiais.',quote:'Ainda dá tempo de proteger o que você construiu.',cta:'suporte'},
 {id:'cancelled',title:'Cota cancelada',trigger:'Cancelamento confirmado oficialmente',needsRef:true,icon:'📄',eyebrow:'ATUALIZAÇÃO DA SUA COTA',subject:'Atualização importante sobre sua cota.',body:'Gostaríamos de conversar com você sobre uma atualização oficial na situação da sua cota. Conte conosco para esclarecer procedimentos e direitos previstos no contrato.',quote:'Estamos aqui para orientar cada passo.',cta:'suporte'},
 {id:'churn',title:'Follow-up de recuperação',trigger:'Acompanhamento após saída',promotional:true,needsRef:true,icon:'🌱',eyebrow:'NOVOS CAMINHOS',subject:'Podemos ajudar você a retomar seus planos?',body:'Os caminhos podem mudar, mas seus objetivos continuam importantes. Se fizer sentido para você, podemos apresentar alternativas para reorganizar seus projetos.',quote:'Recomeçar também é avançar.',cta:'suporte'},
 {id:'referral',title:'Prêmio Indicador',trigger:'Campanha com regras aprovadas',promotional:true,needsRef:true,icon:'🏆',eyebrow:'PRÊMIO INDICADOR',subject:'Uma indicação pode abrir novas oportunidades.',body:'Conhece alguém que também deseja realizar um projeto? Pergunte sobre nossa campanha de indicações e suas condições. Eventuais benefícios dependem das regras de elegibilidade e validação da campanha.',quote:'Sonhos compartilhados chegam mais longe.',cta:'indicar'}
];
export const noticeCategories = ['Aviso geral','Reunião','Metas e campanhas','Orientações comerciais','Comunicado urgente','Outros'];
const NOTICE_ICON: Record<string,string> = {'Aviso geral':'📣','Reunião':'📅','Metas e campanhas':'🏆','Orientações comerciais':'🧭','Comunicado urgente':'⚡','Outros':'💬'};
const NOTICE_QUOTE: Record<string,string> = {'Metas e campanhas':'Meta clara, rotina forte, resultado inevitável.','Reunião':'Alinhados, vamos mais longe.','Orientações comerciais':'Excelência é um hábito diário.','Comunicado urgente':'Contamos com a sua atenção.'};
export const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c));
const dateBr = (v?: string) => v && /^\d{4}-\d\d-\d\d$/.test(v) ? v.slice(8,10)+'/'+v.slice(5,7)+'/'+v.slice(0,4) : 'Não informado';
export type Recipient = {name: string; email: string; administrator: string; group: string; quota: string; eventDate?: string};
export type Campaign = {eyebrow?: string; headline?: string; subtitle?: string; highlights?: string[]; ctaLabel?: string; ctaUrl?: string};

// ---------- identidade ----------
const C = {deep:'#06261F', green:'#0F4A3C', green2:'#1A5E4C', gold:'#C48A2C', gold2:'#E2BE84', ivory:'#F7F4EE', paper:'#FFFFFF', ink:'#16201C', ink2:'#43514A', muted:'#7A867F', line:'#ECE6DB'};
let ASSETS = 'https://crm.alvoinvestimentos.com.br';
export const setAssetBase = (u: string) => { ASSETS = u; };
const logo = (w = 150) => '<img src="'+ASSETS+'/brand/logo-ivory.png" width="'+w+'" height="'+Math.round(w*84/300)+'" alt="ALVO Investimentos" style="display:block;border:0;outline:none;width:'+w+'px;height:auto">';
const F = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const SERIF = "font-family:Georgia,'Times New Roman',serif";

function button(label: string, href: string) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 auto"><tr><td align="center" bgcolor="'+C.gold+'" style="border-radius:12px;background:'+C.gold+';background-image:linear-gradient(135deg,'+C.gold2+','+C.gold+')">'+
    '<a href="'+esc(href)+'" style="display:inline-block;padding:16px 34px;'+F+';font-size:15px;font-weight:700;color:'+C.deep+';text-decoration:none;border-radius:12px;letter-spacing:.3px">'+esc(label)+' &rarr;</a></td></tr></table>';
}
function journey(step: number) {
  const steps = ['Adesão','Parcelas em dia','Assembleias','Contemplação','Conquista'];
  const cell = (s: string, i: number) => {
    const done = i < step, cur = i === step;
    const dot = done ? '<div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:'+C.gold+';color:'+C.deep+';font-weight:700;font-size:14px;margin:0 auto">&#10003;</div>'
      : cur ? '<div style="width:26px;height:26px;line-height:26px;border-radius:50%;border:2px solid '+C.gold+';background:'+C.deep+';color:'+C.gold2+';font-weight:700;font-size:13px;margin:0 auto;box-shadow:0 0 0 4px rgba(196,138,44,.25)">'+(i+1)+'</div>'
      : '<div style="width:28px;height:28px;line-height:28px;border-radius:50%;border:1px solid #D9D2C4;background:#FFFFFF;color:#B3AA99;font-size:13px;margin:0 auto">'+(i+1)+'</div>';
    return '<td align="center" valign="top" width="20%" style="'+F+';padding:0 2px">'+dot+'<div style="font-size:11px;line-height:1.3;margin-top:7px;color:'+(cur?C.green:done?C.ink2:'#A39C8E')+';font-weight:'+(cur?'700':'400')+'">'+s+'</div></td>';
  };
  const pct = Math.round(step/4*100);
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 6px;background:'+C.ivory+';border-radius:16px"><tr><td style="padding:18px 14px 16px">'+
    '<div style="'+F+';font-size:11px;letter-spacing:2px;color:'+C.gold+';font-weight:700;text-align:center;margin-bottom:12px">SUA JORNADA ATÉ A CONQUISTA</div>'+
    '<div style="height:4px;background:#E6DFD1;border-radius:4px;margin:0 9% 12px"><div style="height:4px;width:'+pct+'%;background:'+C.gold+';border-radius:4px"></div></div>'+
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'+steps.map(cell).join('')+'</tr></table></td></tr></table>';
}
function facts(list: [string,string][]) {
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr>'+list.map(([a,b]) =>
    '<td valign="top" width="'+Math.floor(100/list.length)+'%" style="padding:4px"><div style="border:1px solid '+C.line+';border-top:3px solid '+C.gold+';border-radius:12px;padding:12px 14px;background:#FFFFFF">'+
    '<div style="'+F+';font-size:10.5px;letter-spacing:1.4px;color:'+C.muted+';text-transform:uppercase">'+a+'</div><div style="'+F+';font-size:16px;font-weight:700;color:'+C.green+';margin-top:4px">'+b+'</div></div></td>').join('')+'</tr></table>';
}
const quote = (q: string) => '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td style="border-left:4px solid '+C.gold+';background:'+C.ivory+';border-radius:0 14px 14px 0;padding:18px 22px;'+SERIF+';font-style:italic;font-size:18px;line-height:1.5;color:'+C.green+'">&ldquo;'+esc(q)+'&rdquo;</td></tr></table>';
const para = (t: string) => t.split(/\n\s*\n/).map(p => '<p style="margin:0 0 16px;'+F+';font-size:16px;line-height:1.75;color:'+C.ink2+'">'+esc(p).replace(/\n/g,'<br>')+'</p>').join('');

function shell(o: {subject: string; preheader: string; eyebrow: string; icon: string; title: string; subtitle?: string; content: string; footerNote: string; unsub?: string}) {
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>'+esc(o.subject)+'</title></head>'+
  '<body style="margin:0;padding:0;background:#ECE7DC;-webkit-text-size-adjust:100%">'+
  '<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">'+esc(o.preheader)+'&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>'+
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#ECE7DC" style="background:#ECE7DC"><tr><td align="center" style="padding:28px 12px">'+
  '<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;background:#FFFFFF;border-radius:22px;overflow:hidden;box-shadow:0 18px 50px rgba(6,38,31,.16)">'+
  // topo
  '<tr><td bgcolor="'+C.deep+'" style="background:'+C.deep+';background-image:linear-gradient(140deg,'+C.deep+' 0%,'+C.green+' 62%,'+C.green2+' 100%);padding:26px 36px 0">'+
   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>'+logo(140)+'</td><td align="right" style="'+F+';font-size:10.5px;font-weight:700;letter-spacing:2.4px;color:'+C.gold2+'">'+esc(o.eyebrow)+'</td></tr></table>'+
   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:34px 0 34px">'+
    '<div style="width:62px;height:62px;line-height:62px;text-align:center;border-radius:18px;background:rgba(226,190,132,.14);border:1px solid rgba(226,190,132,.45);font-size:30px">'+o.icon+'</div>'+
    '<h1 style="margin:20px 0 0;'+SERIF+';font-weight:400;font-size:32px;line-height:1.2;color:#FFF9EC">'+esc(o.title)+'</h1>'+
    (o.subtitle ? '<p style="margin:12px 0 0;'+F+';font-size:16px;line-height:1.6;color:#CFE2D9">'+esc(o.subtitle)+'</p>' : '')+
   '</td></tr></table></td></tr>'+
  '<tr><td style="height:5px;line-height:5px;font-size:0;background:'+C.gold+';background-image:linear-gradient(90deg,'+C.gold+','+C.gold2+','+C.gold+')">&nbsp;</td></tr>'+
  // conteúdo
  '<tr><td style="padding:34px 36px 36px">'+o.content+'</td></tr>'+
  // rodapé
  '<tr><td bgcolor="'+C.deep+'" style="background:'+C.deep+';padding:28px 36px">'+
   '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td valign="middle">'+logo(110)+'<div style="'+F+';font-size:12px;color:'+C.gold2+';margin-top:10px;letter-spacing:.5px">Estratégia. Capital. Crescimento.</div></td>'+
   '<td align="right" valign="middle" style="'+F+';font-size:12px;line-height:1.7;color:#BFD3C9">Atendimento<br><a href="mailto:suporte@alvoinvestimentos.com" style="color:#FFF9EC;text-decoration:none;font-weight:600">suporte@alvoinvestimentos.com</a></td></tr></table>'+
   '<div style="border-top:1px solid rgba(226,190,132,.2);margin-top:18px;padding-top:14px;'+F+';font-size:11px;line-height:1.6;color:#8FB0A4">'+o.footerNote+
   (o.unsub ? '<br>Não quer mais receber campanhas? <a href="'+esc(o.unsub)+'" style="color:'+C.gold2+'">Cancelar inscrição</a>.' : '')+'</div>'+
  '</td></tr></table>'+
  '<div style="'+F+';font-size:11px;color:#9A9384;margin-top:14px">© ALVO Investimentos</div>'+
  '</td></tr></table></body></html>';
}

export function journeyEmail(kind: Kind, r: Recipient, customBody?: string, unsubscribeUrl?: string, camp?: Campaign) {
  const model = catalog.find(x => x.id === kind); if (!model) throw new Error('Modelo inválido.');
  const first = esc((r.name || '').trim().split(/\s+/)[0] || 'Cliente');
  const pay = model.cta === 'boleto';
  const bodyText = customBody?.trim() || model.body;
  let content = '<p style="margin:0 0 16px;'+F+';font-size:17px;color:'+C.ink+'">Olá, <b>'+first+'</b>!</p>'+para(bodyText);
  let subject = model.subject, title = model.subject, subtitle: string | undefined, eyebrow = model.eyebrow;
  if (kind === 'campaign') {
    title = (camp?.headline || '').trim() || model.subject; subject = title; subtitle = (camp?.subtitle || '').trim() || undefined; eyebrow = ((camp?.eyebrow || '').trim() || model.eyebrow).toUpperCase();
    const hl = (camp?.highlights || []).map(s => String(s).trim()).filter(Boolean).slice(0, 3);
    if (hl.length) content += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 6px">'+hl.map((h, i) => {
      const [t, ...rest] = h.split(/\s[—–-]\s/); const d = rest.join(' — ');
      return '<tr><td style="padding:6px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:'+C.ivory+';border-radius:14px"><tr>'+
        '<td width="54" valign="top" style="padding:16px 0 16px 16px"><div style="width:36px;height:36px;line-height:36px;text-align:center;border-radius:10px;background:'+C.deep+';color:'+C.gold2+';'+F+';font-weight:700;font-size:15px">'+(i+1)+'</div></td>'+
        '<td valign="middle" style="padding:14px 18px 14px 12px;'+F+'"><div style="font-size:15.5px;font-weight:700;color:'+C.green+'">'+esc(t)+'</div>'+(d?'<div style="font-size:14px;line-height:1.55;color:'+C.ink2+';margin-top:3px">'+esc(d)+'</div>':'')+'</td></tr></table></td></tr>';
    }).join('')+'</table>';
    const url = (camp?.ctaUrl || '').trim();
    content += '<div style="margin:28px 0 4px">'+button((camp?.ctaLabel || '').trim() || 'Quero saber mais', url || 'mailto:suporte@alvoinvestimentos.com?subject='+encodeURIComponent('Interesse: '+title))+'</div>';
    content += quote(model.quote);
  } else {
    if (model.step != null) content += journey(model.step);
    const f: [string,string][] = [['Administradora',esc(r.administrator)],['Grupo',esc(r.group)],['Cota',esc(r.quota)]];
    if (r.eventDate && kind.startsWith('payment')) f.push(['Vencimento', dateBr(r.eventDate)]);
    if (r.eventDate && kind.startsWith('assembly')) f.push(['Assembleia', dateBr(r.eventDate)]);
    if (kind !== 'birthday') content += facts(f);
    if (kind === 'payment-last-day') content += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0"><tr><td style="background:#FBF6EA;border:1px solid #EFDDB7;border-radius:12px;padding:14px 16px;'+F+';font-size:13.5px;line-height:1.6;color:'+C.ink2+'"><b style="color:'+C.green+'">Um lembrete com responsabilidade:</b> caso já tenha pago, desconsidere este aviso. Não se trata de confirmação de inadimplência.</td></tr></table>';
    if (model.cta !== 'none') {
      const label = pay ? 'Solicitar meu boleto' : model.cta === 'indicar' ? 'Quero indicar alguém' : 'Falar com a ALVO';
      const subj = pay ? 'Segunda via — '+r.administrator+' '+r.group+'/'+r.quota : model.cta === 'indicar' ? 'Prêmio Indicador — quero indicar' : 'Atendimento ALVO';
      content += '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:26px 0 0"><tr><td align="center" style="border:1px solid '+C.line+';border-radius:16px;padding:24px 18px">'+
        '<div style="'+SERIF+';font-size:19px;color:'+C.green+';margin-bottom:16px">'+(pay ? 'Precisa da segunda via do boleto?' : model.cta === 'indicar' ? 'Tem alguém em mente?' : 'Ficou com alguma dúvida?')+'</div>'+
        button(label, 'mailto:suporte@alvoinvestimentos.com?subject='+encodeURIComponent(subj))+'</td></tr></table>';
    }
    content += quote(model.quote);
  }
  content += '<p style="margin:26px 0 0;'+F+';font-size:15px;color:'+C.ink2+'">Seguimos juntos, um compromisso de cada vez.<br><b style="color:'+C.green+'">Equipe de Relacionamento ALVO</b></p>';
  const html = shell({subject, preheader: kind === 'campaign' ? (subtitle || bodyText).slice(0, 120) : bodyText.slice(0, 120), eyebrow, icon: model.icon, title, subtitle, content,
    footerNote: model.promotional ? 'Você recebe esta comunicação porque autorizou o contato da ALVO Investimentos.' : 'Você recebe este e-mail porque possui uma cota acompanhada pela ALVO Investimentos.',
    unsub: model.promotional ? unsubscribeUrl : undefined});
  const text = 'Olá, '+r.name+'!\n\n'+(kind === 'campaign' ? title+'\n'+(subtitle ? subtitle+'\n' : '')+'\n' : '')+bodyText+
    (kind === 'campaign' ? ((camp?.highlights || []).filter(Boolean).map(h => '\n• '+h).join('')+(camp?.ctaUrl ? '\n\n'+(camp?.ctaLabel || 'Saiba mais')+': '+camp.ctaUrl : '')) : '\n\n'+r.administrator+' · Grupo '+r.group+' · Cota '+r.quota)+
    '\n\nEquipe de Relacionamento ALVO\nsuporte@alvoinvestimentos.com'+(model.promotional && unsubscribeUrl ? '\n\nCancelar comunicações promocionais: '+unsubscribeUrl : '');
  return {subject, html, text};
}

export function noticeEmail(sellerName: string, category: string, subject: string, body: string) {
  const first = esc((sellerName.trim().split(/\s+/)[0] || 'Time'));
  const content = '<p style="margin:0 0 16px;'+F+';font-size:17px;color:'+C.ink+'">Olá, <b>'+first+'</b>!</p>'+para(body)+
    quote(NOTICE_QUOTE[category] || 'Juntos, vamos mais longe.')+
    '<p style="margin:26px 0 0;'+F+';font-size:15px;color:'+C.ink2+'">Conte com a gente.<br><b style="color:'+C.green+'">Diretoria e Suporte · ALVO Investimentos</b></p>';
  const html = shell({subject, preheader: body.slice(0, 120), eyebrow: 'COMUNICADO INTERNO · '+category.toUpperCase(), icon: NOTICE_ICON[category] || '📣', title: subject, content,
    footerNote: 'Comunicado interno destinado à equipe comercial da ALVO Investimentos. Não encaminhe a clientes.'});
  const text = 'Comunicado interno ALVO · '+category+'\n\n'+subject+'\n\nOlá, '+first+'!\n\n'+body+'\n\nDiretoria e Suporte · ALVO Investimentos\nsuporte@alvoinvestimentos.com';
  return {html, text};
}
