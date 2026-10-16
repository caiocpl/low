// Nó: "Cruzar clientes x investimentos" (Code · Run Once for All Items)
// Cruza cada cliente validado com as opções do data.csv e gera a mensagem (template por perfil).
//
// Entrada : 1 item do nó "Agrupar produtos" -> { produtos: [{ perfil, produto, minimo, rentabilidade }] }
//           + clientes validados, lidos do nó "Validar clientes"
// Saída   : 1 item por cliente -> { nome, email, perfil, saldo, produtosRecomendados, assunto, mensagem, geradoPor }

const semAcento = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// 12500 -> "R$ 12.500,00" (formatação manual: não depende do ICU do servidor)
const brl = (n) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// "6.2%" -> "6,2%" | "IPCA+6.0%" -> "IPCA+6,0%" | "Variável" -> "Variável"
const rentabilidadePtBr = (texto) => String(texto).trim().replace(/(\d)\.(?=\d)/g, '$1,');

// Texto de cada perfil (MVP: mensagens estáticas, conforme o roteiro do desafio).
// Os textos são GENÉRICOS de propósito: não citam produtos, pois o cliente só vê os que o saldo permite.
const PERFIS = {
  conservador: {
    abertura: 'Seu perfil prioriza segurança e liquidez, por isso selecionamos opções de renda fixa com menor risco.',
    fechamento: 'Concentrar sua carteira em renda fixa ajuda a proteger o patrimônio e a manter sua reserva disponível quando precisar.',
    risco: 'Rentabilidade e liquidez variam conforme o produto e o emissor.',
  },
  moderado: {
    abertura: 'Seu perfil busca equilíbrio entre segurança e crescimento, por isso combinamos opções de menor oscilação com alternativas de maior potencial de retorno.',
    fechamento: 'Combinar diferentes tipos de investimento permite buscar retorno maior sem abrir mão de estabilidade.',
    risco: 'Os produtos deste perfil podem oscilar no curto prazo.',
  },
  arrojado: {
    abertura: 'Seu perfil aceita oscilações em troca de maior potencial de retorno, por isso destacamos opções de renda variável.',
    fechamento: 'Diversificar entre diferentes ativos reduz a concentração de risco; mantenha também uma reserva de liquidez.',
    risco: 'Investimentos de renda variável podem gerar perdas, inclusive do capital investido.',
  },
};

const AVISO = 'Esta mensagem é informativa e não constitui recomendação de investimento; rentabilidade passada não garante resultado futuro.';

// ---------- 1. Entradas ----------
const { validos } = $('Validar clientes').first().json;

// Cabeçalhos tolerantes: ignora BOM (CSV salvo pelo Excel), espaços e maiúsculas ("\uFEFFPerfil" -> "perfil")
const chaves = (linha) =>
  Object.fromEntries(Object.entries(linha ?? {}).map(([k, v]) => [k.replace(/^\uFEFF/, '').trim().toLowerCase(), v]));

// Mínimo vazio/ausente NÃO vale zero: Number('') === 0 recomendaria o produto a qualquer saldo.
// Só aceita "1000", "1000.50" ou "1000,50": "1e3", "0x10" e "1.000" (ambíguo) são descartados.
const paraMinimo = (texto) =>
  /^\d+([.,]\d{1,2})?$/.test(String(texto ?? '').trim()) ? Number(String(texto).trim().replace(',', '.')) : NaN;

const produtos = ($input.first().json.produtos ?? [])
  .map(chaves)
  .map((p) => ({
    perfil: semAcento(p.perfil),
    produto: String(p.produto ?? '').trim(),
    minimo: paraMinimo(p.minimo),
    rentabilidade: String(p.rentabilidade ?? '').trim(),
  }))
  .filter((p) => p.perfil && p.produto && Number.isFinite(p.minimo) && p.minimo >= 0);

// ---------- 2. Cruzamento + mensagem ----------
const itens = validos.map((cliente) => {
  const chave = semAcento(cliente.perfil);
  const texto = PERFIS[chave];
  const primeiroNome = cliente.nome.split(/\s+/)[0];

  const doPerfil = produtos.filter((p) => p.perfil === chave);
  const elegiveis = doPerfil
    .filter((p) => p.minimo <= cliente.saldo)
    .map((p) => ({
      produto: p.produto,
      minimo: p.minimo,
      minimoFormatado: brl(p.minimo),
      rentabilidade: p.rentabilidade,
      rentabilidadeFormatada: rentabilidadePtBr(p.rentabilidade),
    }));

  let blocoProdutos;
  let citados = elegiveis.map((p) => p.produto); // produtos que a mensagem menciona (oferecidos ou 'porta de entrada')
  if (elegiveis.length) {
    blocoProdutos =
      'Opções compatíveis com o seu perfil e o seu saldo:\n' +
      elegiveis
        .map((p) => `• ${p.produto} — aporte mínimo ${p.minimoFormatado} — rentabilidade ${p.rentabilidadeFormatada}`)
        .join('\n');
  } else if (doPerfil.length) {
    const menor = doPerfil.reduce((a, b) => (b.minimo < a.minimo ? b : a));
    citados = [menor.produto];
    blocoProdutos =
      `Hoje o seu saldo ainda não alcança o aporte mínimo das opções do seu perfil. ` +
      `A porta de entrada é ${menor.produto}, com aporte mínimo de ${brl(menor.minimo)} ` +
      `(faltam ${brl(menor.minimo - cliente.saldo)}).`;
  } else {
    blocoProdutos = 'No momento não há opções cadastradas para o seu perfil.';
  }

  // Aviso extra sempre que a mensagem menciona o produto de maior volatilidade (oferecido ou como 'porta de entrada')
  const riscoExtra = citados.some((produto) => /cripto/i.test(produto))
    ? ' Criptomoedas têm volatilidade muito alta e podem perder valor rapidamente.'
    : '';

  const mensagem = [
    `Olá, ${primeiroNome}!`,
    '',
    `Seu perfil de investidor é ${cliente.perfil} e o seu saldo atual é ${brl(cliente.saldo)}.`,
    texto.abertura,
    '',
    blocoProdutos,
    '',
    elegiveis.length
      ? texto.fechamento
      : doPerfil.length
        ? 'Quando o saldo permitir, teremos prazer em apresentar as melhores alternativas.'
        : 'Assim que houver opções disponíveis para o seu perfil, entraremos em contato.',
    '',
    `${AVISO} ${texto.risco}${riscoExtra}`,
  ].join('\n');

  return {
    json: {
      nome: cliente.nome,
      email: cliente.email,
      perfil: cliente.perfil,
      saldo: cliente.saldo,
      saldoFormatado: brl(cliente.saldo),
      produtosRecomendados: elegiveis,
      assunto: `${primeiroNome}, veja opções de investimento para o seu perfil ${cliente.perfil}`,
      mensagem,
      geradoPor: 'template',
    },
  };
});

return itens;
