// Renderiza PDF A4 e PNGs de revisão com o Chromium do Playwright. Uso: node render.js
const {chromium}=require("playwright");const path=require("path");const fs=require("fs");
(async()=>{const b=await chromium.launch();const out=path.join(__dirname,"..","revisao");fs.mkdirSync(out,{recursive:true});
for(const lang of ["pt","en"]){const pg=await b.newPage({viewport:{width:900,height:1200},deviceScaleFactor:2});
 await pg.goto("file://"+path.join(__dirname,`mediakit-v4-${lang}.html`),{waitUntil:"networkidle"});await pg.evaluate(()=>document.fonts.ready);
 const ov=await pg.evaluate(()=>[...document.querySelectorAll(".page")].map(p=>({h:p.scrollHeight,ch:p.clientHeight,over:p.scrollHeight>p.clientHeight+1})));
 await pg.pdf({path:path.join(out,`CloserTech-MediaKit-v4-${lang.toUpperCase()}.pdf`),format:"A4",printBackground:true,preferCSSPageSize:true,margin:{top:0,right:0,bottom:0,left:0}});
 const pages=await pg.$$(".page");for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:path.join(out,`v4-${lang}-0${i+1}.png`)});
 console.log(lang,JSON.stringify(ov));await pg.close();}
await b.close();})();
