// Nó: "Montar resposta" (Code · Run Once for All Items)
// Consolida as mensagens em um único JSON — é o que o Webhook devolve ao script de RPA.
//
// Entrada : 1 item por cliente (saída de "Cruzar clientes x investimentos")
// Saída   : 1 item -> { resumo: { recebidos, processados, ignorados }, mensagens: [...], ignorados: [...] }

const mensagens = $input.all().map((item) => item.json);
const { recebidos, ignorados } = $('Validar clientes').first().json;

return [
  {
    json: {
      resumo: { recebidos, processados: mensagens.length, ignorados: ignorados.length },
      mensagens,
      ignorados,
    },
  },
];
