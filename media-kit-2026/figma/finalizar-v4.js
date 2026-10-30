// Finalizar Media Kit v4 · CloserTech
// Como usar: no Figma, Recursos → Plugins → "Scripter" → Executar. Apague o conteúdo do editor,
// cole este arquivo inteiro e clique em ▶ (Run). Pré-requisito: as imagens (retrato, frames Dola/Wav/Meshy,
// capa YouTube) e os dois SVGs (logotipo e Runable) colados na página "03 · Diagnóstico…".
// Se os três frames 9:16 não estiverem nomeados dola / wav / meshy, assume a ordem em que foram colados.

const out = (m) => { try { print(m); } catch (e) { console.log(m); } };

async function main() {
  const root = figma.root;
  try { if (figma.loadAllPagesAsync) await figma.loadAllPagesAsync(); } catch (e) {}
  const P = root.children.find(p => p.name.startsWith("01"));
  const A = root.children.find(p => p.name.startsWith("03"));
  if (!P || !A) { out("Páginas 01/03 não encontradas."); return; }
  for (const s of ["Regular", "Medium", "Semi Bold", "Bold", "Extra Bold"]) await figma.loadFontAsync({ family: "Inter", style: s });

  // 1 · Textos: altura automática (corrige sobreposição)
  let fixed = 0;
  for (const t of P.findAll(n => n.type === "TEXT")) {
    if (t.textAutoResize === "NONE" && !(t.parent && t.parent.name === "Anel")) { t.textAutoResize = "HEIGHT"; fixed++; }
  }

  // 2 · Imagens coladas na página 03
  const isImg = n => "fills" in n && Array.isArray(n.fills) && n.fills.some(f => f.type === "IMAGE");
  const tops = A.children.filter(n => !(n.name.startsWith("Assets") || n.name.startsWith("_staging")));
  const imgs = tops.filter(isImg), vecs = tops.filter(n => !isImg(n));
  const H = { _frames: [] };
  for (const n of imgs) {
    const r = n.height / n.width, nm = n.name.toLowerCase();
    const hash = n.fills.find(f => f.type === "IMAGE").imageHash;
    if (/retrato|antonio|portrait/.test(nm) || (r > 1.15 && r < 1.45)) H.retrato = hash;
    else if (r < 1) H.thumb = hash;
    else if (/dola/.test(nm)) H.dola = hash;
    else if (/wav/.test(nm)) H.wav = hash;
    else if (/meshy/.test(nm)) H.meshy = hash;
    else H._frames.push(hash);
  }
  for (const k of ["dola", "wav", "meshy"]) if (!H[k] && H._frames.length) H[k] = H._frames.shift();
  const map = { "img:retrato": H.retrato, "img:frame-dola": H.dola, "img:frame-wav": H.wav, "img:frame-meshy": H.meshy, "img:thumb-capcut": H.thumb };
  const filled = [];
  for (const [name, hash] of Object.entries(map)) {
    if (!hash) { filled.push(name + ": NÃO ENCONTRADA"); continue; }
    let c = 0;
    for (const r of P.findAll(n => n.name === name)) { r.fills = [{ type: "IMAGE", imageHash: hash, scaleMode: "FILL" }]; c++; }
    filled.push(name + ": " + c + " molduras");
  }

  // 3 · Logotipo e Runable (SVGs colados) → componentes → instâncias no lugar das molduras
  const logoSrc = vecs.find(n => n.width / n.height > 4);
  const runSrc = vecs.find(n => Math.abs(n.width / n.height - 1) < 0.2);
  function place(src, compName, phName, w) {
    if (!src) return phName + ": SVG não encontrado";
    const comp = src.type === "COMPONENT" ? src : figma.createComponentFromNode(src);
    comp.name = compName;
    let c = 0;
    for (const ph of P.findAll(n => n.name === phName)) {
      const inst = comp.createInstance();
      const parent = ph.parent, idx = parent.children.indexOf(ph);
      parent.insertChild(idx, inst);
      inst.rescale(w / inst.width);
      inst.name = phName;
      ph.remove(); c++;
    }
    return phName + ": " + c + " instâncias";
  }
  const l1 = place(logoSrc, "Marca/Logotipo", "logo:closertech", 104);
  const l2 = place(runSrc, "Logo marca/Runable", "logo:runable", 22);

  // 4 · Capa do arquivo e limpeza
  const cover = P.children.find(n => n.name === "PT · 01 Posicionamento");
  if (cover) { try { await figma.setFileThumbnailNodeAsync(cover); } catch (e) {} }
  const st = A.children.find(n => n.name.startsWith("_staging"));
  if (st && st.children.length === 0) st.remove();

  out("Textos corrigidos: " + fixed);
  out(filled.join("\n"));
  out(l1 + "\n" + l2);
  out("Concluído. Confira a página 01.");
}
main();
