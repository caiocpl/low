// Nó: "Montar resposta (IA)" (Code · Run Once for All Items)
// Consolida as mensagens geradas pelo Agente de IA e aplica as proteções (guardrails) de conformidade:
//   1. IA falhou ou devolveu texto vazio            -> usa a mensagem-template (fallback)
//   2. IA prometeu/garantiu retorno ("retorno garantido", "sem risco"...) -> usa a mensagem-template
//   3. IA esqueceu o aviso "não constitui recomendação" -> mantém o texto da IA e anexa o aviso padrão
// O fluxo nunca fica sem resposta e nenhuma mensagem sai sem o aviso legal.
//
// Entrada : 1 item por cliente, vindo do "Agente de IA" ({ output } ou erro)
// Saída   : 1 item -> { resumo: { recebidos, processados, ignorados, viaIA, viaTemplate }, mensagens, ignorados }

const AVISO = 'Esta mensagem é informativa e não constitui recomendação de investimento; rentabilidade passada não garante resultado futuro.';
const TEM_AVISO = /n[ãa]o\s+constitui\s+recomenda[çc][ãa]o\s+de\s+investimento/i;
const PROMETE_RETORNO = /(retorno|rentabilidade|lucro|ganho)s?\s+garantid|garant(o|imos|e-se)\s+(o\s+|a\s+|um\s+|uma\s+)?(retorno|rentabilidade|lucro|ganho)|sem\s+(nenhum\s+)?risco|risco\s+zero|100\s*%\s+segur[oa]/i;

const base = $('Cruzar clientes x investimentos').all().map((item) => item.json);
const saidas = $input.all().map((item) => item.json);
const { recebidos, ignorados } = $('Validar clientes').first().json;

// O Agente processa 1 item por cliente, na mesma ordem em que recebeu.
const mensagens = base.map((cliente, i) => {
  const textoIA = typeof saidas[i]?.output === 'string' ? saidas[i].output.trim() : '';
  const usarIA = textoIA !== '' && !PROMETE_RETORNO.test(textoIA);
  const mensagemIA = TEM_AVISO.test(textoIA) ? textoIA : `${textoIA}\n\n${AVISO}`;
  return {
    ...cliente,
    mensagemTemplate: cliente.mensagem,
    mensagem: usarIA ? mensagemIA : cliente.mensagem,
    geradoPor: usarIA ? 'ia' : 'template (fallback)',
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
