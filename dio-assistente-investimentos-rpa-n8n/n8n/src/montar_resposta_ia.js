// Nó: "Montar resposta (IA)" (Code · Run Once for All Items)
// Consolida as mensagens geradas pelo Agente de IA. Se a IA falhar ou devolver texto vazio
// para um cliente, usa a mensagem-template como fallback — o fluxo nunca fica sem resposta.
//
// Entrada : 1 item por cliente, vindo do "Agente de IA" ({ output } ou erro)
// Saída   : 1 item -> { resumo: { recebidos, processados, ignorados, viaIA, viaTemplate }, mensagens, ignorados }

const base = $('Cruzar clientes x investimentos').all().map((item) => item.json);
const saidas = $input.all().map((item) => item.json);
const { recebidos, ignorados } = $('Validar clientes').first().json;

// O Agente processa 1 item por cliente, na mesma ordem em que recebeu.
const mensagens = base.map((cliente, i) => {
  const textoIA = typeof saidas[i]?.output === 'string' ? saidas[i].output.trim() : '';
  return {
    ...cliente,
    mensagemTemplate: cliente.mensagem,
    mensagem: textoIA || cliente.mensagem,
    geradoPor: textoIA ? 'ia' : 'template (fallback)',
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
