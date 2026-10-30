// Gera mediakit-v4-pt.html e mediakit-v4-en.html a partir da redação final (doc 05). Node ≥ 18. Uso: node build.js
const fs=require("fs"),path=require("path");
const A="../assets";
const CSS=`
@font-face{font-family:Inter;font-weight:400;src:url(fonts/inter-latin-400-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:500;src:url(fonts/inter-latin-500-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:600;src:url(fonts/inter-latin-600-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:700;src:url(fonts/inter-latin-700-normal.woff2) format("woff2")}
@font-face{font-family:Inter;font-weight:800;src:url(fonts/inter-latin-800-normal.woff2) format("woff2")}
:root{--blue:#2F3CFF;--black:#0B0B14;--body:#3A3F52;--sec:#5B6070;--border:#E3E6F0;--surf:#F4F6FA;--lav:#E9ECFF;--b300:#8E97FF;--b200:#AEB5FF;--b100:#E4E7FF;--warn:#D95A00}
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
html,body{background:#E5E5E5}
body{font-family:Inter,system-ui,sans-serif;color:var(--body);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:595pt;height:842pt;padding:42pt;background:#fff;display:flex;flex-direction:column;gap:16pt;margin:0 auto 12pt;page-break-after:always;break-after:page;overflow:hidden;position:relative}
@media print{html,body{background:#fff}.page{margin:0}}
a{color:inherit;text-decoration:none}
.hdr{display:flex;justify-content:space-between;align-items:center}
.hdr img{height:17.2pt;width:auto}
.eyebrow{font-size:8pt;line-height:10pt;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--blue)}
.eyebrow.sec{color:var(--sec)}
.display{font-size:50pt;line-height:52pt;font-weight:800;letter-spacing:-.025em;color:var(--black)}
.h1{font-size:30pt;line-height:34pt;font-weight:800;letter-spacing:-.015em;color:var(--black)}
.numXL{font-size:44pt;line-height:46pt;font-weight:800;letter-spacing:-.02em;color:var(--blue)}
.numL{font-size:28pt;line-height:30pt;font-weight:800;letter-spacing:-.02em;color:var(--blue)}
.numM{font-size:17pt;line-height:20pt;font-weight:800;letter-spacing:-.01em;color:var(--black)}
.ptile .numM{font-size:14pt;line-height:18pt;white-space:nowrap}
.subL{font-size:12.5pt;line-height:18pt}
.subM{font-size:11pt;line-height:14pt;font-weight:600;color:var(--black)}
.body{font-size:9.5pt;line-height:13.5pt}
.bodyB{font-size:9.5pt;line-height:13.5pt;font-weight:600;color:var(--black)}
.label{font-size:8pt;line-height:10.5pt;font-weight:500;color:var(--sec)}
.note{font-size:8pt;line-height:11pt;color:var(--sec)}
.warn{color:var(--warn)}
.blue{color:var(--blue)}.black{color:var(--black)}
.title{display:flex;flex-direction:column;gap:10pt;padding-top:22pt}
.ftr{margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:16pt}
.ftr .note{width:430pt}
.hero{display:flex;flex-direction:column;gap:14pt;padding-top:44pt}
.row{display:flex;gap:28pt;padding-top:14pt}
.col{display:flex;flex-direction:column;gap:14pt;flex:1}
.creator{display:flex;gap:4pt;align-items:center}
.ind{display:flex;gap:12pt;padding-top:6pt}
.ind .numL{white-space:nowrap;font-size:27pt}
.tile{flex:1;background:var(--surf);border-radius:10pt;padding:12pt;display:flex;flex-direction:column;gap:4pt}
.portrait{width:200pt;height:250pt;border-radius:16pt;background:var(--lav);overflow:hidden;flex:none}
.portrait img{width:100%;height:100%;object-fit:cover;object-position:top}
.plat{display:flex;gap:8pt}
.ptile{flex:1;border:1pt solid var(--border);border-radius:10pt;padding:9pt 8pt;display:flex;flex-direction:column;gap:3pt}
.dot{display:inline-block;width:8pt;height:8pt;border-radius:50%;margin-right:5pt;vertical-align:-1pt}
.card{background:var(--surf);border-radius:12pt;padding:18pt 20pt;display:flex;gap:24pt;align-items:center}
.card .l{width:200pt;display:flex;flex-direction:column;gap:2pt}
.card .r{flex:1;display:flex;flex-direction:column;gap:6pt}
.bul::before{content:"";display:inline-block;width:5pt;height:5pt;border-radius:50%;background:var(--blue);margin-right:6pt;vertical-align:1.5pt}
.bands{display:flex;gap:12pt}
.band{flex:1;display:flex;flex-direction:column;gap:6pt}
.dots{display:flex;gap:4pt}
.dots i{width:10pt;height:10pt;border-radius:50%;display:block}
.rings{display:flex;gap:28pt}
.ring{display:flex;gap:10pt;align-items:center}
.ring .lbl{width:88pt;font-size:9.5pt;line-height:13.5pt}
.sec-block{display:flex;flex-direction:column;gap:8pt}
.strip{display:flex;justify-content:space-between;align-items:center;gap:8pt}
.brand{display:flex;gap:6pt;align-items:center;font-size:8pt;font-weight:500;color:var(--black)}
.brand img{width:22pt;height:22pt;border-radius:5pt;object-fit:cover}
.main{background:var(--surf);border-radius:12pt;padding:14pt;display:flex;gap:16pt}
.main .frame{width:110pt;height:196pt;border-radius:8pt;overflow:hidden;flex:none;background:var(--b100)}
.main .frame img,.comp .img img{width:100%;height:100%;object-fit:cover}
.main .txt{display:flex;flex-direction:column;gap:7pt;flex:1}
.comps{display:flex;gap:12pt}
.comp{flex:1;display:flex;flex-direction:column;gap:6pt}
.comp .img{height:82pt;border-radius:8pt;overflow:hidden;background:var(--b100)}
.steps{display:flex;gap:12pt}
.step{flex:1;display:flex;gap:8pt;align-items:flex-start}
.step.v{flex-direction:column;gap:6pt}
.num{width:22pt;height:22pt;border-radius:50%;background:var(--blue);color:#fff;font-size:12pt;font-weight:700;display:flex;align-items:center;justify-content:center;flex:none}
.chips{display:flex;flex-wrap:wrap;gap:6pt}
.chip{background:var(--surf);border-radius:20pt;padding:4pt 9pt;font-size:8pt;font-weight:500}
.cards{display:flex;gap:10pt;align-items:stretch}
.pack{flex:1;border:1pt solid var(--border);border-radius:10pt;padding:12pt;display:flex;flex-direction:column;gap:6pt;background:#fff}
.pack.rec{background:var(--lav);border:1.5pt solid var(--blue)}
.pack .price{margin-top:auto;padding-top:6pt}
.terms{display:flex;gap:12pt}
.term{flex:1;display:flex;flex-direction:column;gap:3pt}
.cta{background:var(--black);border-radius:12pt;padding:22pt 24pt;display:flex;flex-direction:column;gap:10pt;color:#fff}
.cta .t{font-size:30pt;line-height:32pt;font-weight:800;letter-spacing:-.02em;color:#fff}
.cta .s{font-size:12.5pt;line-height:18pt;color:var(--b200)}
.contacts{display:flex;gap:22pt;padding-top:8pt}
.contact{display:flex;flex-direction:column;gap:3pt}
.contact .eyebrow{color:var(--b300)}
.contact .v{font-size:9.5pt;line-height:13.5pt;font-weight:600;color:#fff}
`;
const PT={lang:"pt-BR",logoAlt:"CloserTech",p1:{header:"MEDIA KIT · OUTUBRO 2026",eyebrow:"CRIADOR DE CONTEÚDO · TECNOLOGIA E IA",headline:"Tecnologia e IA,<br>funcionando na tela.",sub:"Tutoriais com demonstração real, em português, para quem acompanha, testa e escolhe ferramentas de tecnologia.",delivery:"Roteiro aprovado antes de gravar · Interface real do produto · Estúdio próprio · Entrega em 4K e 1080p",creator:"Antônio Louback · Vitória, ES ·",ind:[["379 mil","seguidores no Instagram, o canal principal"],["≈ 920 mil","seguidores somando cinco perfis*"],["7 marcas","com conteúdo produzido em outubro de 2026"]],foot:"Seguidores lidos nos perfis públicos em 29/10/2026. *Instagram, TikTok, Facebook, YouTube e Threads; há sobreposição de pessoas entre plataformas.",num:"01 / 04"},
p2:{header:"AUDIÊNCIA",eyebrow:"QUEM ASSISTE",title:"Uma audiência que já está no seu mercado.",plcap:"Seguidores · leitura pública em 29/10/2026",platforms:[["Instagram","379 mil","#E1306C"],["TikTok","236,7 mil","#0B0B14"],["Facebook","247 mil","#1877F2"],["YouTube","31,2 mil","#FF0000"],["Threads","25,7 mil","#3A3F52"]],pllabel:"seguidores",med:"21 mil",medl:"views por Reel, na mediana",medsub:"25 Reels não fixados · Instagram · 1 a 29/10/2026",lines:["16 dos 25 passam de 10 mil views","7 passam de 50 mil","Pico de 452 mil","Fixados (3,5 mi e 2,3 mi) excluídos da conta"],dtitle:"Distribuição dos 25 Reels por faixa de views",bands:[[9,"9 Reels · abaixo de 10 mil","var(--b200)"],[9,"9 Reels · entre 10 mil e 50 mil","var(--b300)"],[7,"7 Reels · acima de 50 mil","var(--blue)"]],dcap:"Cada marcador é um Reel. Views públicas em 29/10/2026.",gtitle:"Perfil do público",rings:[[89,"89%","no Brasil"],[82,"82%","entre 18 e 44 anos"],[87,"87%","homens"]],gsrc:"Instagram · Insights · {período} · base: {seguidores ou contas alcançadas}",foot:"Fontes: seguidores lidos nos perfis públicos em 29/10/2026; views públicas dos 25 Reels não fixados do Instagram, publicados de 1 a 29/10/2026; público: Instagram Insights, {período}.",num:"02 / 04"},
p3:{header:"TRABALHOS",eyebrow:"OUTUBRO DE 2026",title:"O produto funcionando, para 7 marcas em um mês.",strip:"Conteúdo produzido em outubro de 2026 para:",mtag:"CASE PRINCIPAL",mtitle:"Dola · Seedance 2.0",mblocks:[["IDEIA","Uma minissérie de suspense criada do prompt à cena, com o gancho nos primeiros segundos."],["ENTREGA","Dois vídeos verticais, roteiro aprovado pela marca, interface real do app com o nome do modelo legível, tutorial passo a passo e chamada para testar."],["APLICAÇÃO","Para apps de criação com IA que precisam mostrar fluxo completo e resultado, sem simulação."]],mlink:"Assista em @closertech1",murl:"{URL do Reel · a confirmar}",comp:[["CapCut","Tutorial: editar um vídeo inteiro com um pedido no ChatGPT, com a tela real do app. Entrega: dois vídeos e capa para YouTube.","frames/thumb-youtube-capcut.jpg"],["Wav","Música e trilha com IA em três passos, com a interface da ferramenta na tela.","frames/frame-wav-ui-v3.jpg"],["Meshy","Personagem 3D gerado do prompt ao resultado em 4K, com o logo da marca na abertura.","frames/frame-meshy-4k.jpg"]],mettitle:"Como cada vídeo é construído",steps:[["1","Gancho","nos três primeiros segundos"],["2","Demonstração","com a tela real do produto"],["3","Chamada para ação","link, cupom ou palavra no comentário"]],caps:["Roteiro e direção","Estúdio próprio","Interface real","3D e motion","Edição e áudio","4K e 1080p"],foot:"Trabalhos de outubro de 2026. Quadros dos vídeos produzidos pelo CloserTech; marcas e logos pertencem aos respectivos titulares. Sem métricas de resultado publicadas até 30/10/2026.",num:"03 / 04"},
p4:{header:"PARCERIA",eyebrow:"COMO TRABALHAMOS",title:"Do briefing à publicação, sem complicar.",steps:[["1","Briefing","Objetivo, produto e mensagem da marca."],["2","Roteiro","Proposta de ideia e fala, aprovada antes de gravar."],["3","Produção","Gravação, 3D e edição no nosso estúdio."],["4","Aprovação","A marca revisa o vídeo antes de publicar."]],ftitle:"Formatos",formats:[["ESSENCIAL","1 Reel","Uma ideia, um recurso, uma demonstração. Para lançamento ou destaque de uma função, no Instagram.","Valor sob consulta",false],["RECOMENDADO","Série de 3 Reels","Três vídeos em sequência: apresentar o produto, demonstrar na tela, converter com a oferta. A audiência vê a marca três vezes no mês.","Valor sob consulta",true],["MULTIPLATAFORMA","Reel + Shorts + TikTok","Uma produção, três entregas nativas: o mesmo vídeo adaptado em corte, legenda e capa para Instagram, YouTube Shorts e TikTok.","Valor sob consulta",false]],extra:"Também fazemos unboxings, reviews, stories e posts no feed.",terms:[["Divulgação transparente","Conteúdo patrocinado sinalizado conforme as regras de cada plataforma."],["Direitos combinados","Uso, anúncio pago e exclusividade definidos antes de gravar."],["Prazo e revisão","Cronograma combinado no briefing, com rodada de ajustes."]],ctitle:"Vamos mostrar o seu produto funcionando?",ctext:"Envie o produto e o objetivo da campanha. Respondemos com proposta e uma ideia de roteiro.",contacts:[["E-MAIL","contatoclosertech1@gmail.com","mailto:contatoclosertech1@gmail.com"],["INSTAGRAM","@closertech1","https://www.instagram.com/closertech1"],["LINKS","linktr.ee/closertech1","https://linktr.ee/closertech1"],["BASE","Vitória · ES, Brasil",null]],foot:"Media kit v4 · outubro de 2026 · dados lidos em 29/10/2026.",num:"04 / 04"}};
const EN=JSON.parse(JSON.stringify(PT));Object.assign(EN,{lang:"en"});
Object.assign(EN.p1,{header:"MEDIA KIT · OCTOBER 2026",eyebrow:"CONTENT CREATOR · TECH & AI",headline:"Tech and AI,<br>working on screen.",sub:"Hands-on tutorials in Brazilian Portuguese, for people who follow, test and choose technology tools.",delivery:"Script approved before shooting · Real product interface · In-house studio · 4K and 1080p delivery",creator:"Antônio Louback · Vitória, Brazil ·",ind:[["379K","Instagram followers, the main channel"],["≈ 920K","followers across five profiles*"],["7 brands","with content produced in October 2026"]],foot:"Follower counts read on public profiles on Oct 29, 2026. *Instagram, TikTok, Facebook, YouTube and Threads; audiences overlap across platforms."});
Object.assign(EN.p2,{header:"AUDIENCE",eyebrow:"WHO WATCHES",title:"An audience that is already in your market.",plcap:"Followers · public read on Oct 29, 2026",platforms:[["Instagram","379K","#E1306C"],["TikTok","236.7K","#0B0B14"],["Facebook","247K","#1877F2"],["YouTube","31.2K","#FF0000"],["Threads","25.7K","#3A3F52"]],pllabel:"followers",med:"21K",medl:"median views per Reel",medsub:"25 non-pinned Reels · Instagram · Oct 1–29, 2026",lines:["16 of 25 above 10K views","7 above 50K","Peak of 452K","Pinned Reels (3.5M and 2.3M) excluded"],dtitle:"Distribution of the 25 Reels by views band",bands:[[9,"9 Reels · under 10K","var(--b200)"],[9,"9 Reels · 10K to 50K","var(--b300)"],[7,"7 Reels · above 50K","var(--blue)"]],dcap:"Each marker is one Reel. Public views on Oct 29, 2026.",gtitle:"Audience profile",rings:[[89,"89%","in Brazil"],[82,"82%","aged 18–44"],[87,"87%","men"]],gsrc:"Instagram · Insights · {period} · base: {followers or accounts reached}",foot:"Sources: follower counts read on public profiles on Oct 29, 2026; public views of the 25 non-pinned Instagram Reels published Oct 1–29, 2026; audience: Instagram Insights, {period}."});
Object.assign(EN.p3,{header:"WORK",eyebrow:"OCTOBER 2026",title:"The product working on screen, for 7 brands in one month.",strip:"Content produced in October 2026 for:",mtag:"MAIN CASE",mblocks:[["IDEA","A suspense mini-series created from prompt to scene, with the hook in the first seconds."],["DELIVERY","Two vertical videos, brand-approved script, real app interface with the model name legible, step-by-step tutorial and a call to try it."],["FIT","For AI creation apps that need to show the full flow and the result, with no simulation."]],mlink:"Watch at @closertech1",murl:"{Reel URL · to confirm}",comp:[["CapCut","Tutorial: edit a whole video with one ChatGPT request, with the real app on screen. Delivery: two videos and a YouTube cover.","frames/thumb-youtube-capcut.jpg"],["Wav","AI music and soundtrack in three steps, with the tool's interface on screen.","frames/frame-wav-ui-v3.jpg"],["Meshy","3D character generated from prompt to 4K result, with the brand logo in the opening.","frames/frame-meshy-4k.jpg"]],mettitle:"How each video is built",steps:[["1","Hook","in the first three seconds"],["2","Demo","with the real product screen"],["3","Call to action","link, coupon or comment keyword"]],caps:["Script and direction","In-house studio","Real interface","3D and motion","Editing and audio","4K and 1080p"],foot:"Work from October 2026. Video frames produced by CloserTech; brands and logos belong to their owners. No performance metrics published as of Oct 30, 2026."});
Object.assign(EN.p4,{header:"PARTNERSHIP",eyebrow:"HOW WE WORK",title:"From briefing to publishing, without friction.",steps:[["1","Briefing","Goal, product and brand message."],["2","Script","Idea and voice-over proposal, approved before shooting."],["3","Production","Filming, 3D and editing in our studio."],["4","Approval","The brand reviews the video before it goes live."]],ftitle:"Formats",formats:[["ESSENTIAL","1 Reel","One idea, one feature, one demo. For a launch or a single-feature highlight, on Instagram.","Pricing on request",false],["RECOMMENDED","3-Reel series","Three videos in sequence: introduce the product, demo it on screen, convert with the offer. The audience sees the brand three times in a month.","Pricing on request",true],["MULTI-PLATFORM","Reel + Shorts + TikTok","One production, three native deliveries: the same video adapted in cut, captions and cover for Instagram, YouTube Shorts and TikTok.","Pricing on request",false]],extra:"We also do unboxings, reviews, stories and feed posts.",terms:[["Clear disclosure","Sponsored content labeled according to each platform's rules."],["Agreed rights","Usage, paid media and exclusivity defined before shooting."],["Timeline and revision","Schedule agreed at briefing, with a revision round."]],ctitle:"Shall we show your product working?",ctext:"Send us the product and the campaign goal. We reply with a proposal and a first script idea.",contacts:[["EMAIL","contatoclosertech1@gmail.com","mailto:contatoclosertech1@gmail.com"],["INSTAGRAM","@closertech1","https://www.instagram.com/closertech1"],["LINKS","linktr.ee/closertech1","https://linktr.ee/closertech1"],["BASED IN","Vitória, Brazil",null]],foot:"Media kit v4 · October 2026 · data read on Oct 29, 2026."});
const BRANDS=[["CapCut","logos-marcas/logo-capcut.png"],["Dreamina","logos-marcas/logo-dreamina.png"],["Wav","logos-marcas/logo-wav.png"],["Dola","logos-marcas/logo-dola.png"],["Freebeat","logos-marcas/logo-freebeat.png"],["Runable","logos-marcas/logo-runable.svg"],["Meshy","logos-marcas/logo-meshy.png"]];
const IG="https://www.instagram.com/closertech1";
const hdr=(L,t)=>`<div class="hdr"><img src="${A}/logo-closertech-2026.svg" alt="${L.logoAlt}"><span class="eyebrow">${t}</span></div>`;
const ftr=(n,p)=>`<div class="ftr"><p class="note">${n}</p><span class="label">${p}</span></div>`;
const title=(p)=>`<div class="title"><span class="eyebrow">${p.eyebrow}</span><h2 class="h1">${p.title}</h2></div>`;
const ring=([p,v,l])=>{const r=24,c=2*Math.PI*r;return `<div class="ring"><svg width="56" height="56" viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="#E4E7FF" stroke-width="8"/><circle cx="28" cy="28" r="${r}" fill="none" stroke="#2F3CFF" stroke-width="8" stroke-dasharray="${(c*p/100).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 28 28)"/><text x="28" y="32" text-anchor="middle" font-family="Inter" font-size="12" font-weight="700" fill="#0B0B14">${v}</text></svg><span class="lbl">${l}</span></div>`;};
function page1(L){const p=L.p1;return `<section class="page">${hdr(L,p.header)}
<div class="hero"><span class="eyebrow">${p.eyebrow}</span><h1 class="display">${p.headline}</h1></div>
<div class="row"><div class="col"><p class="subL">${p.sub}</p><p class="bodyB" style="color:var(--sec)">${p.delivery}</p>
<p class="creator"><span class="bodyB">${p.creator}</span><a class="bodyB blue" href="${IG}">@closertech1</a></p>
</div>
<div class="portrait"><img src="${A}/antonio-retrato-recorte.png" alt="Antônio Louback"></div></div>
<div class="ind">${p.ind.map(([n,l])=>`<div class="tile"><span class="numL">${n}</span><span class="label">${l}</span></div>`).join("")}</div>
${ftr(p.foot,p.num)}</section>`;}
function page2(L){const p=L.p2;return `<section class="page">${hdr(L,p.header)}${title(p)}
<div class="sec-block"><span class="label">${p.plcap}</span><div class="plat">${p.platforms.map(([n,v,c])=>`<div class="ptile"><span class="subM"><i class="dot" style="background:${c}"></i>${n}</span><span class="numM">${v}</span><span class="note">${p.pllabel}</span></div>`).join("")}</div></div>
<div class="card"><div class="l"><span class="numXL">${p.med}</span><span class="subM">${p.medl}</span><span class="note">${p.medsub}</span></div><div class="r">${p.lines.map(s=>`<span class="body bul">${s}</span>`).join("")}</div></div>
<div class="sec-block"><span class="subM">${p.dtitle}</span><div class="bands">${p.bands.map(([n,l,c])=>`<div class="band"><div class="dots">${Array(n).fill('<i style="background:'+c+'"></i>').join('')}</div><span class="label" style="color:var(--body)">${l}</span></div>`).join("")}</div><span class="note">${p.dcap}</span></div>
<div class="sec-block" style="gap:10pt"><span class="subM">${p.gtitle}</span><div class="rings">${p.rings.map(ring).join("")}</div><span class="note warn">${p.gsrc}</span></div>
${ftr(p.foot,p.num)}</section>`;}
function page3(L){const p=L.p3;return `<section class="page" style="gap:14pt">${hdr(L,p.header)}${title(p)}
<div class="sec-block"><span class="label">${p.strip}</span><div class="strip">${BRANDS.map(([n,s])=>`<span class="brand"><img src="${A}/${s}" alt="${n}">${n}</span>`).join("")}</div></div>
<div class="main"><div class="frame"><img src="${A}/frames/frame-dola-seedance-v3.jpg" alt="Dola · Seedance 2.0"></div><div class="txt"><span class="eyebrow">${p.mtag}</span><span class="numM">${p.mtitle}</span>${p.mblocks.map(([a,b])=>`<div><span class="eyebrow sec">${a}</span><p class="body">${b}</p></div>`).join("")}<p><a class="bodyB blue" href="${IG}">${p.mlink}</a> <span class="note warn">${p.murl}</span></p></div></div>
<div class="comps">${p.comp.map(([n,t,img])=>`<div class="comp"><div class="img"><img src="${A}/${img}" alt="${n}"></div><span class="bodyB">${n}</span><p class="note" style="color:var(--body)">${t}</p></div>`).join("")}</div>
<div class="sec-block"><span class="subM">${p.mettitle}</span><div class="steps">${p.steps.map(([n,a,b])=>`<div class="step"><span class="num">${n}</span><div><div class="bodyB">${a}</div><div class="note">${b}</div></div></div>`).join("")}</div></div>
<div class="chips">${p.caps.map(c=>`<span class="chip">${c}</span>`).join("")}</div>
${ftr(p.foot,p.num)}</section>`;}
function page4(L){const p=L.p4;return `<section class="page" style="gap:14pt">${hdr(L,p.header)}${title(p)}
<div class="steps">${p.steps.map(([n,a,b])=>`<div class="step v"><span class="num">${n}</span><div class="bodyB">${a}</div><div class="note">${b}</div></div>`).join("")}</div>
<div class="sec-block"><span class="subM">${p.ftitle}</span><div class="cards">${p.formats.map(([tag,ti,tx,pr,rec])=>`<div class="pack${rec?" rec":""}"><span class="eyebrow">${tag}</span><span class="numM">${ti}</span><p class="body">${tx}</p><span class="label price">${pr}</span></div>`).join("")}</div><span class="body" style="color:var(--sec)">${p.extra}</span></div>
<div class="terms">${p.terms.map(([a,b])=>`<div class="term"><span class="bodyB">${a}</span><span class="note">${b}</span></div>`).join("")}</div>
<div class="cta"><p class="t">${p.ctitle}</p><p class="s">${p.ctext}</p><div class="contacts">${p.contacts.map(([a,b,u])=>`<div class="contact"><span class="eyebrow">${a}</span>${u?`<a class="v" href="${u}">${b}</a>`:`<span class="v">${b}</span>`}</div>`).join("")}</div></div>
${ftr(p.foot,p.num)}</section>`;}
for(const [L,f] of [[PT,"mediakit-v4-pt.html"],[EN,"mediakit-v4-en.html"]]){
  const html=`<!doctype html><html lang="${L.lang}"><head><meta charset="utf-8"><title>CloserTech · Media Kit v4 (${L.lang})</title><style>${CSS}</style></head><body>${page1(L)}${page2(L)}${page3(L)}${page4(L)}</body></html>`;
  fs.writeFileSync(path.join(__dirname,f),html);console.log("ok",f,html.length);}
