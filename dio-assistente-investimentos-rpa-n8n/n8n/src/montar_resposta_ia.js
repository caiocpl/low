// Nó: "Montar resposta (IA)" (Code · Run Once for All Items)
// Consolida as mensagens geradas pelo Agente de IA e aplica as proteções (guardrails) de conformidade:
//   1. IA falhou ou devolveu texto vazio            -> usa a mensagem-template (fallback)
//   2. IA prometeu/garantiu retorno ("retorno garantido", "sem risco"...) -> usa a mensagem-template
//   2b. cliente sem nenhum produto elegível       -> usa a mensagem-template (a IA não tem o que recomendar)
//   3. IA esqueceu o aviso "não constitui recomendação" -> mantém o texto da IA e anexa o aviso padrão
// O fluxo nunca fica sem resposta e nenhuma mensagem sai sem o aviso legal.
//
// ATENÇÃO: o filtro de promessas (item 2) é HEURÍSTICO — reduz, não elimina, o risco. Ele não substitui
// a regra 3 do prompt do agente nem a revisão humana antes do envio ao cliente (ver DOCUMENTACAO.md).
// Cobertura medida em tests/fixtures/frases_ia.json (frases legítimas x promessas, com negação).
//
// Entrada : 1 item por cliente, vindo do "Agente de IA" ({ output } ou erro)
// Saída   : 1 item -> { resumo: { recebidos, processados, ignorados, viaIA, viaTemplate }, mensagens, ignorados }

const AVISO = 'Esta mensagem é informativa e não constitui recomendação de investimento; rentabilidade passada não garante resultado futuro.';
const TEM_AVISO = /n[ãa]o\s+(constitu(i|em)|[ée]|representa(m)?)\s+(uma\s+)?recomenda[çc][ãõa]\w*\s+de\s+investimento/i;
// Filtro HEURÍSTICO (por oração, ciente de negação) — reduz, não elimina, o risco de promessa de retorno.
const NEG = /\b(n[ãa]o|nunca|jamais|nem|nenhum[a]?|evite|desconfie)\b/i;
const NEGAVEL = /(retorno|rentabilidade|rendimento|lucro|ganho|juro|remunera[çc][ãa]o)s?\b[^.!?\n]{0,40}?\b(garantid|assegurad|cert[oa]s?\b)|\b(garantia|assegur\w+)\s+de\s+(retorno|rentabilidade|lucro|ganho|rendimento)|\bgarant(o|imos|e-se)\b[^.!?\n]{0,40}\b(retorno|rentabilidade|lucro|ganho|rendimento)s?|\bgarant(o|imos)\s+que\s+voc[êe]\s+(vai|ir[áa]|ter[áa])|\bdinheiro\s+garantid/gi;
const SEM_RISCO = /\b(sem|livre\s+de|isento\s+de)\s+(nenhum\s+|qualquer\s+|algum\s+)?riscos?\b(?!\s+(de\s+ficar|de\s+perder\s+o\s+sono|desnecess))/i;
const GENERICO_NEGADO = /\b(n[ãa]o|nenhum[a]?|nem|nunca|jamais)\b[^.!?\n]{0,40}\b(investiment|aplica[çc]|produto|ativo)\w*[^.!?\n]{0,15}\b(sem|isent\w*\s+de|livre\s+de)\s+(\w+\s+)?riscos?/i;
const FORTE = /risco\s+(zero|nulo)|100\s*%\s*(segur|protegid|garantid)|(100\s*por\s*cento|cem\s+por\s+cento)\s+(segur|protegid)|infal[íi]vel|totalmente\s+segur|voc[êe]\s+(vai|ir[áa])\s+(ganhar|lucrar|dobrar)|certeza\s+de\s+(lucro|ganho|retorno)|sem\s+chance\s+de\s+perd|n[ãa]o\s+(h[áa]|existe|tem)\s+(qualquer\s+|nenhum\s+)?risco|voc[êe]\s+(n[ãa]o\s+vai|nunca)\s+perde|nunca\s+perde|dobrar\s+(o\s+|seu\s+)?(seu\s+)?dinheiro|\bganhe\s+\d/i;
function semNegacao(oracao) {
  for (const m of oracao.matchAll(NEGAVEL)) {
    const antes = oracao.slice(0, m.index).split(/[,:;]/).pop().slice(-40);
    if (!NEG.test(antes + m[0])) return true;
  }
  return false;
}
function prometeRetorno(texto) {
  return texto.replace(/[\s-]+/g, ' ').split(/[.!?;]+/).some((o) =>
    FORTE.test(o) || semNegacao(o) || (SEM_RISCO.test(o) && !GENERICO_NEGADO.test(o)));
}

const base = $('Cruzar clientes x investimentos').all().map((item) => item.json);
const saidas = $input.all().map((item) => item.json);
const { recebidos, ignorados } = $('Validar clientes').first().json;

// O Agente processa 1 item por cliente, na mesma ordem em que recebeu.
const mensagens = base.map((cliente, i) => {
  const textoIA = typeof saidas[i]?.output === 'string' ? saidas[i].output.trim() : '';
  // Sem produto elegível não há o que a IA recomendar: o texto dela poderia inventar produtos -> template (exato)
  const semProdutos = !Array.isArray(cliente.produtosRecomendados) || cliente.produtosRecomendados.length === 0;
  const usarIA = textoIA !== '' && !semProdutos && !prometeRetorno(textoIA);
  const mensagemIA = TEM_AVISO.test(textoIA) ? textoIA : `${textoIA}\n\n${AVISO}`;
  return {
    ...cliente,
    mensagemTemplate: cliente.mensagem,
    mensagem: usarIA ? mensagemIA : cliente.mensagem,
    geradoPor: usarIA ? 'ia' : semProdutos ? 'template (sem produtos elegíveis)' : 'template (fallback)',
  };
});

const viaIA = mensagens.filter((m) => m.geradoPor === 'ia').length;

return [
  {
    json: {
      resumo: {
        recebidos,
        processados: mensagens.length,
        ignorados: ignorados.length,
        viaIA,
        viaTemplate: mensagens.length - viaIA,
      },
      mensagens,
      ignorados,
    },
  },
];
