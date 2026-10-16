// Testes automatizados da LÓGICA dos nós Code do workflow n8n.
//
// Sem dependências: usa apenas o runner embutido do Node (node:test + node:assert).
// Cada n8n/src/*.js é carregado com fs.readFileSync + new Function e recebe um stub
// dos globais do n8n ($input e $('Nome do nó')).
//
// Uso:  node --test tests/n8n_nodes.test.js

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const SRC = path.join(RAIZ, 'n8n', 'src');

// ---------------------------------------------------------------------------
// Infraestrutura: stub dos globais do n8n
// ---------------------------------------------------------------------------

const CODIGO = {
  validar: fs.readFileSync(path.join(SRC, 'validar_clientes.js'), 'utf8'),
  cruzar: fs.readFileSync(path.join(SRC, 'cruzar_clientes.js'), 'utf8'),
  montar: fs.readFileSync(path.join(SRC, 'montar_resposta.js'), 'utf8'),
  montarIA: fs.readFileSync(path.join(SRC, 'montar_resposta_ia.js'), 'utf8'),
};

const N_VALIDAR = 'Validar clientes';
const N_AGRUPAR = 'Agrupar produtos';
const N_CRUZAR = 'Cruzar clientes x investimentos';

/** Itens do n8n: [{ json }] */
const itens = (jsons) => jsons.map((json) => ({ json }));

/**
 * Executa o corpo de um nó Code (que usa `return` no nível superior).
 * @param {string} codigo   código-fonte do nó
 * @param {object[]} entrada itens de entrada ($input), no formato [{json}]
 * @param {Object<string, object[]>} nos saídas de outros nós, lidas via $('Nome')
 */
function executarNo(codigo, entrada, nos = {}) {
  const wrap = (lista) => ({ first: () => lista[0], all: () => lista });
  const $input = wrap(entrada);
  const $ = (nome) => {
    if (!(nome in nos)) throw new Error(`Nó "${nome}" não está disponível neste teste`);
    return wrap(nos[nome]);
  };
  const fn = new Function('$input', '$', codigo);
  return fn($input, $);
}

/** CSV simples -> lista de objetos com TODOS os valores como string (como o Extract From File). */
function parseCsv(texto) {
  const linhas = texto.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  const cab = linhas[0].split(',');
  return linhas.slice(1).map((linha) => {
    const cols = linha.split(',');
    return Object.fromEntries(cab.map((c, i) => [c, cols[i] ?? '']));
  });
}

const CSV_REAL = fs.readFileSync(path.join(RAIZ, 'docs', 'data.csv'), 'utf8');
const PRODUTOS_REAIS = parseCsv(CSV_REAL);

/** Extrai os clientes de docs/index.html (tabela #clientes) como o robô de RPA faria. */
function clientesDoHtml() {
  const html = fs.readFileSync(path.join(RAIZ, 'docs', 'index.html'), 'utf8');
  const tabela = html.slice(html.indexOf('<table id="clientes"'));
  const corpo = tabela.slice(tabela.indexOf('<tbody'), tabela.indexOf('</tbody>'));
  const celula = (tr, cls) => {
    const m = tr.match(new RegExp(`<td class="${cls}">([^<]*)</td>`));
    return m ? m[1].trim() : '';
  };
  return [...corpo.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => ({
    nome: celula(m[1], 'nome'),
    email: celula(m[1], 'email'),
    saldo: celula(m[1], 'saldo'),
    perfil: celula(m[1], 'perfil'),
  }));
}

/** Webhook -> Validar clientes. Devolve o objeto json de saída do nó. */
function validar(payload) {
  const entrada = payload === undefined ? [{ json: {} }] : [{ json: payload }];
  const saida = executarNo(CODIGO.validar, entrada);
  assert.equal(saida.length, 1, 'o nó validar deve devolver exatamente 1 item');
  return saida[0].json;
}

/** Atalho: validar a partir de uma lista de clientes (body.clientes). */
const validarLista = (clientes) => validar({ body: { clientes } });

/** Executa Validar -> Cruzar. Devolve { v, itens (json[]) , bruto }. */
function validarECruzar(clientes, produtos = PRODUTOS_REAIS) {
  const v = validarLista(clientes);
  const bruto = executarNo(
    CODIGO.cruzar,
    [{ json: { produtos } }],
    { [N_VALIDAR]: [{ json: v }] },
  );
  return { v, bruto, itens: bruto.map((i) => i.json) };
}

/** Executa Validar -> Cruzar -> Montar resposta. */
function fluxoMVP(clientes, produtos = PRODUTOS_REAIS) {
  const { v, bruto, itens: msgs } = validarECruzar(clientes, produtos);
  const saida = executarNo(CODIGO.montar, bruto, { [N_VALIDAR]: [{ json: v }] });
  assert.equal(saida.length, 1);
  return { v, mensagens: msgs, resposta: saida[0].json };
}

/** Executa Validar -> Cruzar -> Montar resposta (IA) com saídas simuladas do Agente. */
function fluxoIA(clientes, saidasAgente, produtos = PRODUTOS_REAIS) {
  const { v, bruto, itens: base } = validarECruzar(clientes, produtos);
  const saida = executarNo(CODIGO.montarIA, itens(saidasAgente), {
    [N_VALIDAR]: [{ json: v }],
    [N_CRUZAR]: bruto,
  });
  assert.equal(saida.length, 1);
  return { v, base, resposta: saida[0].json };
}

const cliente = (nome, email, saldo, perfil) => ({ nome, email, saldo, perfil });
const nomesProdutos = (msg) => msg.produtosRecomendados.map((p) => p.produto);
const AVISO_RE = /não constitui recomendação de investimento/;

// ---------------------------------------------------------------------------
// 0. Sanidade dos insumos
// ---------------------------------------------------------------------------

test('insumos: docs/data.csv tem 9 produtos (3 por perfil) e todos os campos são string', () => {
  assert.equal(PRODUTOS_REAIS.length, 9);
  for (const perfil of ['Conservador', 'Moderado', 'Arrojado']) {
    assert.equal(PRODUTOS_REAIS.filter((p) => p.perfil === perfil).length, 3, perfil);
  }
  for (const p of PRODUTOS_REAIS) {
    for (const v of Object.values(p)) assert.equal(typeof v, 'string');
  }
});

test('insumos: docs/index.html tem os 10 clientes esperados', () => {
  const c = clientesDoHtml();
  assert.equal(c.length, 10);
  assert.deepEqual(c[0], cliente('Ana Silva', 'ana@email.com', 'R$ 12.500,00', 'Conservador'));
  assert.deepEqual(c.map((x) => x.nome.split(' ')[0]), [
    'Ana', 'Bruno', 'Carla', 'Daniel', 'Elena', 'Felipe', 'Gabriela', 'Henrique', 'Isabela', 'João',
  ]);
});

test('insumos: os nós n8n/src estão sincronizados com workflow.json e workflow-ia.json', () => {
  const carregar = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', f), 'utf8'));
  const esperado = (arq) => arq.replace(/\s+$/, '') + '\n';
  const checar = (arquivo, nomeNo, codigo) => {
    const wf = carregar(arquivo);
    const no = wf.nodes.find((n) => n.name === nomeNo);
    assert.ok(no, `nó "${nomeNo}" não existe em ${arquivo}`);
    assert.equal(no.parameters.jsCode, esperado(codigo), `${arquivo} / ${nomeNo} está desatualizado (rode python3 n8n/build.py)`);
  };
  checar('workflow.json', 'Validar clientes', CODIGO.validar);
  checar('workflow.json', N_CRUZAR, CODIGO.cruzar);
  checar('workflow.json', 'Montar resposta', CODIGO.montar);
  checar('workflow-ia.json', 'Validar clientes', CODIGO.validar);
  checar('workflow-ia.json', N_CRUZAR, CODIGO.cruzar);
  checar('workflow-ia.json', 'Montar resposta (IA)', CODIGO.montarIA);
});

test('insumos: todo $("Nome do nó") usado nos .js existe nos workflows', () => {
  const nomesNo = (f) => new Set(JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', f), 'utf8')).nodes.map((n) => n.name));
  const usados = (codigo) => [...codigo.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
  for (const [arq, wf] of [
    [CODIGO.cruzar, 'workflow.json'], [CODIGO.montar, 'workflow.json'],
    [CODIGO.cruzar, 'workflow-ia.json'], [CODIGO.montarIA, 'workflow-ia.json'],
  ]) {
    for (const nome of usados(arq)) assert.ok(nomesNo(wf).has(nome), `"${nome}" não existe em ${wf}`);
  }
});

// ---------------------------------------------------------------------------
// 1. Gabarito dos 10 clientes de docs/index.html (fluxo MVP completo)
// ---------------------------------------------------------------------------

const GABARITO = {
  'Ana Silva': { saldo: 12500, perfil: 'Conservador', produtos: ['Poupança', 'CDB Liquidez Diária', 'Tesouro Selic'] },
  'Bruno Lima': { saldo: 3200, perfil: 'Moderado', produtos: ['CDB Prefixado', 'Tesouro IPCA+'] },
  'Carla Souza': { saldo: 28900, perfil: 'Arrojado', produtos: ['Ações ETF', 'Fundo de Ações', 'Criptomoedas'] },
  'Daniel Oliveira': { saldo: 850, perfil: 'Conservador', produtos: ['Poupança', 'Tesouro Selic'] },
  'Elena Rodrigues': { saldo: 45000, perfil: 'Arrojado', produtos: ['Ações ETF', 'Fundo de Ações', 'Criptomoedas'] },
  'Felipe Santos': { saldo: 7800, perfil: 'Moderado', produtos: ['CDB Prefixado', 'Fundo Multimercado', 'Tesouro IPCA+'] },
  'Gabriela Costa': { saldo: 1500, perfil: 'Conservador', produtos: ['Poupança', 'CDB Liquidez Diária', 'Tesouro Selic'] },
  'Henrique Alves': { saldo: 22300, perfil: 'Moderado', produtos: ['CDB Prefixado', 'Fundo Multimercado', 'Tesouro IPCA+'] },
  'Isabela Martins': { saldo: 500, perfil: 'Conservador', produtos: ['Poupança', 'Tesouro Selic'] },
  'João Pereira': { saldo: 15000, perfil: 'Arrojado', produtos: ['Ações ETF', 'Fundo de Ações', 'Criptomoedas'] },
};

test('gabarito: os 10 clientes de docs/index.html geram os produtos esperados', () => {
  const { resposta, mensagens } = fluxoMVP(clientesDoHtml());
  assert.deepEqual(resposta.resumo, { recebidos: 10, processados: 10, ignorados: 0 });
  assert.deepEqual(resposta.ignorados, []);
  assert.equal(mensagens.length, 10);
  for (const m of resposta.mensagens) {
    const esperado = GABARITO[m.nome];
    assert.ok(esperado, `cliente inesperado ${m.nome}`);
    assert.equal(m.perfil, esperado.perfil, m.nome);
    assert.equal(m.saldo, esperado.saldo, m.nome);
    assert.deepEqual(nomesProdutos(m), esperado.produtos, m.nome);
  }
});

test('gabarito: a ordem das mensagens segue a ordem dos clientes de entrada', () => {
  const entrada = clientesDoHtml();
  const { resposta } = fluxoMVP(entrada);
  assert.deepEqual(resposta.mensagens.map((m) => m.email), entrada.map((c) => c.email));
});

test('gabarito: Isabela (500) -> mínimo do Tesouro Selic (500) é inclusivo', () => {
  const { itens: [m] } = validarECruzar([cliente('Isabela Martins', 'isabela@email.com', 'R$ 500,00', 'Conservador')]);
  assert.deepEqual(nomesProdutos(m), ['Poupança', 'Tesouro Selic']);
});

test('gabarito: cada produto recomendado traz minimo, minimoFormatado e rentabilidade', () => {
  const { itens: [m] } = validarECruzar([cliente('Ana Silva', 'ana@email.com', 'R$ 12.500,00', 'Conservador')]);
  assert.deepEqual(m.produtosRecomendados, [
    { produto: 'Poupança', minimo: 100, minimoFormatado: 'R$ 100,00', rentabilidade: '6.2%', rentabilidadeFormatada: '6,2%' },
    { produto: 'CDB Liquidez Diária', minimo: 1000, minimoFormatado: 'R$ 1.000,00', rentabilidade: '12.5%', rentabilidadeFormatada: '12,5%' },
    { produto: 'Tesouro Selic', minimo: 500, minimoFormatado: 'R$ 500,00', rentabilidade: '13.0%', rentabilidadeFormatada: '13,0%' },
  ]);
});

test('gabarito: o contrato de campos da mensagem e da resposta é respeitado', () => {
  const { resposta } = fluxoMVP(clientesDoHtml());
  assert.deepEqual(Object.keys(resposta).sort(), ['ignorados', 'mensagens', 'resumo']);
  assert.deepEqual(Object.keys(resposta.resumo).sort(), ['ignorados', 'processados', 'recebidos']);
  const campos = ['assunto', 'email', 'geradoPor', 'mensagem', 'nome', 'perfil', 'produtosRecomendados', 'saldo', 'saldoFormatado'];
  for (const m of resposta.mensagens) {
    assert.deepEqual(Object.keys(m).sort(), campos);
    assert.equal(m.geradoPor, 'template');
  }
  // tem que sobreviver a JSON (é o que o Webhook devolve)
  assert.deepEqual(JSON.parse(JSON.stringify(resposta)), resposta);
});

// ---------------------------------------------------------------------------
// 2. Fronteira saldo == mínimo (inclusive) e logo abaixo
// ---------------------------------------------------------------------------

test('fronteira: saldo == mínimo é elegível; saldo 1 centavo abaixo não é', () => {
  const casos = [
    // [perfil, saldo, produtos esperados]
    ['Conservador', 100, ['Poupança']],
    ['Conservador', 99.99, []],
    ['Conservador', 499.99, ['Poupança']],
    ['Conservador', 500, ['Poupança', 'Tesouro Selic']],
    ['Conservador', 999.99, ['Poupança', 'Tesouro Selic']],
    ['Conservador', 1000, ['Poupança', 'CDB Liquidez Diária', 'Tesouro Selic']],
    ['Moderado', 999.99, []],
    ['Moderado', 1000, ['CDB Prefixado', 'Tesouro IPCA+']],
    ['Moderado', 4999.99, ['CDB Prefixado', 'Tesouro IPCA+']],
    ['Moderado', 5000, ['CDB Prefixado', 'Fundo Multimercado', 'Tesouro IPCA+']],
    ['Arrojado', 99.99, []],
    ['Arrojado', 100, ['Criptomoedas']],
    ['Arrojado', 500, ['Ações ETF', 'Criptomoedas']],
    ['Arrojado', 9999.99, ['Ações ETF', 'Criptomoedas']],
    ['Arrojado', 10000, ['Ações ETF', 'Fundo de Ações', 'Criptomoedas']],
  ];
  for (const [perfil, saldo, esperado] of casos) {
    const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', saldo, perfil)]);
    assert.deepEqual(nomesProdutos(m), esperado, `${perfil} saldo ${saldo}`);
  }
});

test('fronteira: saldo informado como texto pt-BR "R$ 1.000,00" == mínimo 1000', () => {
  const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', 'R$ 1.000,00', 'Moderado')]);
  assert.deepEqual(nomesProdutos(m), ['CDB Prefixado', 'Tesouro IPCA+']);
});

// ---------------------------------------------------------------------------
// 3. Validação: motivos de "ignorados"
// ---------------------------------------------------------------------------

const OK = () => cliente('Ana Silva', 'ana@email.com', 'R$ 12.500,00', 'Conservador');

test('validar: cliente válido é padronizado (trim, e-mail minúsculo, perfil canônico, saldo numérico)', () => {
  const v = validarLista([cliente('  Ana Silva  ', '  ANA@Email.COM ', 'R$ 12.500,00', 'conservador')]);
  assert.deepEqual(v.validos, [{ nome: 'Ana Silva', email: 'ana@email.com', perfil: 'Conservador', saldo: 12500 }]);
  assert.deepEqual(v.ignorados, []);
  assert.equal(v.recebidos, 1);
});

test('validar: não vaza campos extras (ex.: cpf) para os válidos', () => {
  const v = validarLista([{ ...OK(), cpf: '123.456.789-00', senha: 'x' }]);
  assert.deepEqual(Object.keys(v.validos[0]).sort(), ['email', 'nome', 'perfil', 'saldo']);
});

test('validar: não altera o payload de entrada', () => {
  const payload = { body: { clientes: [cliente('  Ana ', 'ANA@email.com', 'R$ 1,00', 'MODERADO')] } };
  const copia = JSON.parse(JSON.stringify(payload));
  validar(payload);
  assert.deepEqual(payload, copia);
});

test('validar: motivo "nome ausente" (ausente, vazio, só espaços, null)', () => {
  const casos = [
    { email: 'a@e.com', saldo: 10, perfil: 'Moderado' },
    cliente('', 'b@e.com', 10, 'Moderado'),
    cliente('   \t ', 'c@e.com', 10, 'Moderado'),
    cliente(null, 'd@e.com', 10, 'Moderado'),
  ];
  const v = validarLista(casos);
  assert.equal(v.validos.length, 0);
  assert.equal(v.ignorados.length, 4);
  v.ignorados.forEach((ig, i) => {
    assert.equal(ig.indice, i);
    assert.equal(ig.nome, null);
    assert.deepEqual(ig.motivos, ['nome ausente']);
  });
});

test('validar: motivo "e-mail inválido" (ausente, vazio, sem @, sem domínio, com espaço, null)', () => {
  const ruins = [undefined, '', '   ', 'semarroba', 'a@b', '@e.com', 'a@', 'a b@e.com', 'a@e .com', null, 123];
  const v = validarLista(ruins.map((email, i) => ({ nome: `N${i}`, email, saldo: 10, perfil: 'Moderado' })));
  assert.equal(v.validos.length, 0, JSON.stringify(v.validos));
  assert.equal(v.ignorados.length, ruins.length);
  for (const ig of v.ignorados) assert.deepEqual(ig.motivos, ['e-mail inválido']);
});

test('validar: e-mails de formatos comuns são aceitos', () => {
  const bons = ['a@e.com', 'nome.sobrenome@empresa.com.br', 'x+tag@gmail.com', 'A_B-C@sub.dominio.org'];
  const v = validarLista(bons.map((email, i) => ({ nome: `N${i}`, email, saldo: 10, perfil: 'Moderado' })));
  assert.equal(v.validos.length, bons.length);
});

test('validar: motivo "e-mail duplicado no lote" (igual, caixa diferente, espaços); o primeiro é mantido', () => {
  const v = validarLista([
    cliente('Ana', 'ana@email.com', 100, 'Conservador'),
    cliente('Ana 2', 'ANA@email.com', 100, 'Conservador'),
    cliente('Ana 3', '  ana@email.com  ', 100, 'Conservador'),
    cliente('Bruno', 'bruno@email.com', 100, 'Conservador'),
  ]);
  assert.deepEqual(v.validos.map((c) => c.nome), ['Ana', 'Bruno']);
  assert.deepEqual(v.ignorados.map((i) => [i.indice, i.nome, i.motivos]), [
    [1, 'Ana 2', ['e-mail duplicado no lote']],
    [2, 'Ana 3', ['e-mail duplicado no lote']],
  ]);
});

test('validar: o 2o cliente com e-mail repetido de um 1o INVÁLIDO não é tratado como duplicado', () => {
  const v = validarLista([
    cliente('Ana', 'ana@email.com', 100, 'Agressivo'),
    cliente('Ana', 'ana@email.com', 100, 'Conservador'),
  ]);
  assert.equal(v.validos.length, 1);
  assert.equal(v.validos[0].perfil, 'Conservador');
  assert.equal(v.ignorados.length, 1);
  assert.equal(v.ignorados[0].indice, 0);
});

test('validar: e-mail inválido repetido não vira "duplicado" (só "inválido")', () => {
  const v = validarLista([cliente('A', 'xx', 1, 'Moderado'), cliente('B', 'xx', 1, 'Moderado')]);
  assert.deepEqual(v.ignorados.map((i) => i.motivos), [['e-mail inválido'], ['e-mail inválido']]);
});

test('validar: motivo "perfil desconhecido" (ausente, vazio, outro texto, número, null)', () => {
  const ruins = [undefined, '', '   ', 'Agressivo', 'Conservadores', 'Cons', 7, null, 'Moderado Arrojado'];
  const v = validarLista(ruins.map((perfil, i) => ({ nome: `N${i}`, email: `n${i}@e.com`, saldo: 10, perfil })));
  assert.equal(v.validos.length, 0, JSON.stringify(v.validos));
  for (const ig of v.ignorados) {
    assert.equal(ig.motivos.length, 1);
    assert.match(ig.motivos[0], /^perfil desconhecido/);
  }
  assert.equal(v.ignorados.length, ruins.length);
});

test('validar: perfil é aceito sem diferenciar caixa nem acento, e normalizado para o nome canônico', () => {
  const variantes = {
    Conservador: ['conservador', 'CONSERVADOR', 'Conservador', ' conservador ', 'Conservadór', 'CÓNSERVADOR'],
    Moderado: ['moderado', 'MODERADO', 'Moderado', '\tModerado\n', 'Módérado'],
    Arrojado: ['arrojado', 'ARROJADO', 'Arrojado', 'ArRoJaDo', 'Àrrojado'],
  };
  for (const [canonico, lista] of Object.entries(variantes)) {
    lista.forEach((perfil, i) => {
      const v = validarLista([{ nome: 'Teste', email: `t${i}@e.com`, saldo: 10, perfil }]);
      assert.equal(v.validos.length, 1, `"${perfil}" deveria ser aceito`);
      assert.equal(v.validos[0].perfil, canonico, `"${perfil}"`);
    });
  }
});

test('validar: perfil com acento em forma decomposta (NFD) também é aceito', () => {
  const v = validarLista([{ nome: 'T', email: 't@e.com', saldo: 10, perfil: 'Conservadór'.normalize('NFD') }]);
  assert.equal(v.validos.length, 1);
  assert.equal(v.validos[0].perfil, 'Conservador');
});

test('validar: motivo "saldo inválido" (ausente, vazio, texto, negativo, NaN, Infinity, null, objeto)', () => {
  const ruins = [undefined, '', '   ', 'abc', 'R$', 'R$ -10,00', '-1', -0.01, -500, NaN, Infinity, -Infinity, null, {}, true, '1.2.3'];
  const v = validarLista(ruins.map((saldo, i) => ({ nome: `N${i}`, email: `n${i}@e.com`, saldo, perfil: 'Moderado' })));
  assert.equal(v.validos.length, 0, JSON.stringify(v.validos));
  assert.equal(v.ignorados.length, ruins.length);
  for (const ig of v.ignorados) assert.deepEqual(ig.motivos, ['saldo inválido']);
});

test('validar: vários motivos no mesmo cliente são acumulados, na ordem nome/e-mail/perfil/saldo', () => {
  const v = validarLista([{ nome: '', email: 'x', perfil: 'foo', saldo: 'abc' }]);
  assert.equal(v.ignorados.length, 1);
  const { motivos, nome, indice } = v.ignorados[0];
  assert.equal(indice, 0);
  assert.equal(nome, null);
  assert.equal(motivos.length, 4);
  assert.equal(motivos[0], 'nome ausente');
  assert.equal(motivos[1], 'e-mail inválido');
  assert.match(motivos[2], /^perfil desconhecido/);
  assert.equal(motivos[3], 'saldo inválido');
});

test('validar: ignorado preserva o nome (aparado) e o índice original no lote', () => {
  const v = validarLista([OK(), cliente('  Zé  ', 'ze@e.com', 'abc', 'Moderado'), cliente('Bia', 'bia@e.com', 5, 'Arrojado')]);
  assert.deepEqual(v.validos.map((c) => c.nome), ['Ana Silva', 'Bia']);
  assert.deepEqual(v.ignorados, [{ indice: 1, nome: 'Zé', motivos: ['saldo inválido'] }]);
  assert.equal(v.recebidos, 3);
});

// ---------------------------------------------------------------------------
// 4. Saldo em vários formatos
// ---------------------------------------------------------------------------

test('validar: saldo em formatos aceitos é convertido para número', () => {
  const casos = [
    ['R$ 12.500,00', 12500],
    ['R$ 1.234,56', 1234.56],
    ['R$ 1.234.567,89', 1234567.89],
    ['R$ 850,00', 850],
    ['  R$ 12.500,00  ', 12500],
    ['R$ 12.500,00', 12500],
    ['850', 850],
    ['0', 0],
    ['R$ 0,00', 0],
    ['12,5', 12.5],
    ['1234.56', 1234.56],
    ['1.234', 1234], // ponto seguido de exatamente 3 dígitos = milhar pt-BR
    ['12.500', 12500],
    ['1.234.567', 1234567],
    [1200.5, 1200.5],
    [850, 850],
    [0, 0],
    [12500, 12500],
  ];
  for (const [saldo, esperado] of casos) {
    const v = validarLista([{ nome: 'T', email: 't@e.com', saldo, perfil: 'Moderado' }]);
    assert.equal(v.validos.length, 1, `saldo ${JSON.stringify(saldo)} deveria ser aceito`);
    assert.equal(v.validos[0].saldo, esperado, `saldo ${JSON.stringify(saldo)}`);
  }
});

test('validar: saldo "R$ 12.500,00" vira exatamente 12500 (número, não string)', () => {
  const v = validarLista([OK()]);
  assert.strictEqual(v.validos[0].saldo, 12500);
});

test('validar: saldo 0 é válido (>= 0) e recomenda nada, informando a porta de entrada', () => {
  const { itens: [m] } = validarECruzar([cliente('Zero', 'z@e.com', 'R$ 0,00', 'Conservador')]);
  assert.equal(m.saldo, 0);
  assert.equal(m.saldoFormatado, 'R$ 0,00');
  assert.deepEqual(m.produtosRecomendados, []);
  assert.match(m.mensagem, /faltam R\$ 100,00/);
});

// ---------------------------------------------------------------------------
// 5. Payload malformado
// ---------------------------------------------------------------------------

test('payload: sem body / body null / body string -> recebidos 0, nada válido, sem exceção', () => {
  for (const payload of [undefined, {}, { body: null }, { body: 'texto' }, { body: 42 }, { headers: {} }]) {
    const v = validar(payload);
    assert.deepEqual(v, { recebidos: 0, validos: [], ignorados: [] }, JSON.stringify(payload));
  }
});

test('payload: sem clientes / clientes null / não-array -> tratado como lista vazia', () => {
  for (const body of [{}, { clientes: null }, { clientes: 'abc' }, { clientes: 123 }, { clientes: {} }, { clientes: { 0: OK() } }, { clientes: true }]) {
    const v = validar({ body });
    assert.deepEqual(v, { recebidos: 0, validos: [], ignorados: [] }, JSON.stringify(body));
  }
});

test('payload: clientes = [] -> recebidos 0', () => {
  assert.deepEqual(validarLista([]), { recebidos: 0, validos: [], ignorados: [] });
});

test('payload: itens null / número / string / array / undefined viram ignorados com todos os motivos (sem exceção)', () => {
  const v = validarLista([null, undefined, 42, 'texto', [], [1, 2], true, OK()]);
  assert.equal(v.recebidos, 8);
  assert.equal(v.validos.length, 1);
  assert.equal(v.ignorados.length, 7);
  for (const ig of v.ignorados) {
    assert.equal(ig.nome, null);
    assert.equal(ig.motivos.length, 4);
    assert.deepEqual(ig.motivos.slice(0, 2), ['nome ausente', 'e-mail inválido']);
  }
  assert.deepEqual(v.ignorados.map((i) => i.indice), [0, 1, 2, 3, 4, 5, 6]);
});

test('payload: campos com tipos inesperados (número/objeto) não causam exceção', () => {
  assert.doesNotThrow(() => validarLista([{ nome: {}, email: [], saldo: [], perfil: {} }]));
  assert.doesNotThrow(() => validarLista([{ nome: 123, email: 123, saldo: Symbol.iterator.description, perfil: 123 }]));
});

test('payload: lote grande (5000 clientes) é processado rapidamente e sem perda', () => {
  const lote = Array.from({ length: 5000 }, (_, i) => cliente(`Cliente ${i}`, `c${i}@e.com`, `R$ ${i},00`, ['Conservador', 'Moderado', 'Arrojado'][i % 3]));
  const t0 = Date.now();
  const v = validarLista(lote);
  assert.ok(Date.now() - t0 < 2000, 'validação demorou demais');
  assert.equal(v.validos.length, 5000);
  assert.equal(v.recebidos, 5000);
});

// ---------------------------------------------------------------------------
// 6. Cruzamento: saldo abaixo de qualquer mínimo
// ---------------------------------------------------------------------------

test('cruzar: saldo abaixo de todos os mínimos -> produtosRecomendados vazio, porta de entrada e quanto falta', () => {
  const casos = [
    // perfil, saldo, produto de entrada, mínimo, falta
    ['Conservador', 50, 'Poupança', 'R$ 100,00', 'R$ 50,00'],
    ['Conservador', 99.5, 'Poupança', 'R$ 100,00', 'R$ 0,50'],
    ['Conservador', 0, 'Poupança', 'R$ 100,00', 'R$ 100,00'],
    ['Arrojado', 50, 'Criptomoedas', 'R$ 100,00', 'R$ 50,00'],
    ['Moderado', 400, 'CDB Prefixado', 'R$ 1.000,00', 'R$ 600,00'], // empate (1000): fica o primeiro do CSV
    ['Moderado', 999.99, 'CDB Prefixado', 'R$ 1.000,00', 'R$ 0,01'],
  ];
  for (const [perfil, saldo, entrada, minimo, falta] of casos) {
    const { itens: [m] } = validarECruzar([cliente('Maria Souza', 'm@e.com', saldo, perfil)]);
    const rotulo = `${perfil} ${saldo}`;
    assert.deepEqual(m.produtosRecomendados, [], rotulo);
    assert.ok(m.mensagem.includes(`A porta de entrada é ${entrada}`), rotulo + '\n' + m.mensagem);
    assert.ok(m.mensagem.includes(`aporte mínimo de ${minimo}`), rotulo + '\n' + m.mensagem);
    assert.ok(m.mensagem.includes(`faltam ${falta}`), rotulo + '\n' + m.mensagem);
    assert.ok(!m.mensagem.includes('•'), 'não deve listar produtos com bullet');
    assert.match(m.mensagem, AVISO_RE, rotulo);
  }
});

test('cruzar: a "porta de entrada" é o produto de MENOR mínimo do perfil, independentemente da ordem do CSV', () => {
  const produtos = [
    { perfil: 'Arrojado', produto: 'Caro', minimo: '5000', rentabilidade: 'Variável' },
    { perfil: 'Arrojado', produto: 'Barato', minimo: '200', rentabilidade: 'Variável' },
    { perfil: 'Arrojado', produto: 'Médio', minimo: '900', rentabilidade: 'Variável' },
  ];
  const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', 150, 'Arrojado')], produtos);
  assert.match(m.mensagem, /A porta de entrada é Barato, com aporte mínimo de R\$ 200,00 \(faltam R\$ 50,00\)\./);
});

test('cruzar: a mensagem de saldo insuficiente não cita produtos de outro perfil', () => {
  const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', 10, 'Conservador')]);
  for (const outro of ['CDB Prefixado', 'Fundo Multimercado', 'Ações ETF', 'Fundo de Ações', 'Criptomoedas', 'Tesouro IPCA+']) {
    assert.ok(!m.mensagem.includes(outro), outro);
  }
});

test('cruzar: saldo é arredondado a centavos na validação — elegibilidade e texto sempre coerentes', () => {
  // 99,999 -> R$ 100,00 (>= mínimo 100 da Criptomoedas): elegível e mostrado como R$ 100,00, sem "faltam R$ 0,00"
  const { itens: [a] } = validarECruzar([cliente('Teste', 't@e.com', 99.999, 'Arrojado')]);
  assert.equal(a.saldo, 100);
  assert.deepEqual(a.produtosRecomendados.map((p) => p.produto), ['Criptomoedas']);
  assert.ok(!/faltam/.test(a.mensagem), 'mensagem incoerente:\n' + a.mensagem);
  // 99,994 -> R$ 99,99 (< 100): inelegível, e o texto mostra saldo e diferença coerentes
  const { itens: [b] } = validarECruzar([cliente('Teste', 'u@e.com', 99.994, 'Arrojado')]);
  assert.equal(b.saldo, 99.99);
  assert.deepEqual(b.produtosRecomendados, []);
  assert.match(b.mensagem, /saldo atual é R\$ 99,99/);
  assert.match(b.mensagem, /faltam R\$ 0,01/);
});

// ---------------------------------------------------------------------------
// 7. Perfil sem produtos no CSV
// ---------------------------------------------------------------------------

test('cruzar: perfil sem produtos no CSV -> mensagem "sem opções cadastradas", sem exceção', () => {
  const soConservador = PRODUTOS_REAIS.filter((p) => p.perfil === 'Conservador');
  const { itens: msgs } = validarECruzar(
    [cliente('Carla Souza', 'c@e.com', 'R$ 28.900,00', 'Arrojado'), cliente('Ana Silva', 'a@e.com', 'R$ 12.500,00', 'Conservador')],
    soConservador,
  );
  assert.deepEqual(msgs[0].produtosRecomendados, []);
  assert.match(msgs[0].mensagem, /No momento não há opções cadastradas para o seu perfil\./);
  assert.ok(!msgs[0].mensagem.includes('porta de entrada'));
  assert.ok(!/faltam/.test(msgs[0].mensagem));
  assert.match(msgs[0].mensagem, AVISO_RE);
  assert.equal(msgs[1].produtosRecomendados.length, 3);
});

test('cruzar: CSV vazio / produtos ausente -> todos os clientes recebem mensagem "sem opções", sem exceção', () => {
  const entradas = [{ produtos: [] }, {}, { produtos: null }];
  for (const entrada of entradas) {
    const v = validarLista([OK()]);
    const saida = executarNo(CODIGO.cruzar, [{ json: entrada }], { [N_VALIDAR]: [{ json: v }] });
    assert.equal(saida.length, 1, JSON.stringify(entrada));
    assert.deepEqual(saida[0].json.produtosRecomendados, []);
    assert.match(saida[0].json.mensagem, /não há opções cadastradas/);
  }
});

test('cruzar: nenhum cliente válido -> devolve lista vazia (o IF do workflow já desvia para o 422)', () => {
  const { bruto } = validarECruzar([cliente('', 'x', 'abc', 'foo')]);
  assert.deepEqual(bruto, []);
});

test('cruzar: linhas do CSV inválidas (sem perfil/produto, mínimo não numérico) são descartadas', () => {
  const produtos = [
    { perfil: '', produto: 'Sem perfil', minimo: '10', rentabilidade: '1%' },
    { perfil: 'Moderado', produto: '', minimo: '10', rentabilidade: '1%' },
    { perfil: 'Moderado', produto: 'Min inválido', minimo: 'abc', rentabilidade: '1%' },
    { perfil: 'Moderado', produto: 'Bom', minimo: '10', rentabilidade: '1.5%' },
    {},
  ];
  const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', 1000, 'Moderado')], produtos);
  assert.deepEqual(nomesProdutos(m), ['Bom']);
});

test('cruzar: perfil do CSV com caixa/acento/espaços diferentes ainda casa com o do cliente', () => {
  const produtos = [{ perfil: ' CONSERVADÓR ', produto: 'X', minimo: ' 10 ', rentabilidade: ' 5.5% ' }];
  const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', 100, 'Conservador')], produtos);
  assert.deepEqual(m.produtosRecomendados, [
    { produto: 'X', minimo: 10, minimoFormatado: 'R$ 10,00', rentabilidade: '5.5%', rentabilidadeFormatada: '5,5%' },
  ]);
});

test('cruzar: mínimo com vírgula decimal no CSV ("100,50") é interpretado corretamente', () => {
  const produtos = [{ perfil: 'Moderado', produto: 'Y', minimo: '100,50', rentabilidade: '1%' }];
  const { itens: [m] } = validarECruzar([cliente('T', 't@e.com', 100.5, 'Moderado')], produtos);
  assert.deepEqual(nomesProdutos(m), ['Y']);
  assert.equal(m.produtosRecomendados[0].minimoFormatado, 'R$ 100,50');
});

test('cruzar: produto com mínimo VAZIO no CSV não deve virar "aporte mínimo R$ 0,00" para todos', () => {
  // Number('') === 0 em JS: uma célula vazia vira mínimo 0 e o produto é recomendado a qualquer saldo.
  const produtos = [
    { perfil: 'Conservador', produto: 'Produto sem mínimo', minimo: '', rentabilidade: '5%' },
    { perfil: 'Conservador', produto: 'Poupança', minimo: '100', rentabilidade: '6.2%' },
  ];
  const { itens: [m] } = validarECruzar([cliente('Pobre', 'p@e.com', 10, 'Conservador')], produtos);
  assert.ok(!nomesProdutos(m).includes('Produto sem mínimo'), 'célula de mínimo vazia foi tratada como R$ 0,00: ' + JSON.stringify(m.produtosRecomendados));
});

test('cruzar: produto com mínimo AUSENTE (undefined/null) no CSV não deve virar mínimo R$ 0,00', () => {
  const produtos = [
    { perfil: 'Conservador', produto: 'Sem campo', rentabilidade: '5%' },
    { perfil: 'Conservador', produto: 'Nulo', minimo: null, rentabilidade: '5%' },
  ];
  const { itens: [m] } = validarECruzar([cliente('Pobre', 'p@e.com', 10, 'Conservador')], produtos);
  assert.deepEqual(nomesProdutos(m), [], JSON.stringify(m.produtosRecomendados));
});

// ---------------------------------------------------------------------------
// 8. Formatação pt-BR
// ---------------------------------------------------------------------------

test('formatação: saldoFormatado em pt-BR (milhar com ponto, decimais com vírgula)', () => {
  const casos = [
    [12500, 'R$ 12.500,00'],
    [1234567.89, 'R$ 1.234.567,89'],
    [0, 'R$ 0,00'],
    [5, 'R$ 5,00'],
    [999, 'R$ 999,00'],
    [1000, 'R$ 1.000,00'],
    [100000, 'R$ 100.000,00'],
    [1234.5, 'R$ 1.234,50'],
    [0.5, 'R$ 0,50'],
    [1000000, 'R$ 1.000.000,00'],
    [999999.99, 'R$ 999.999,99'],
    [1234567890.12, 'R$ 1.234.567.890,12'],
  ];
  for (const [saldo, esperado] of casos) {
    const { itens: [m] } = validarECruzar([cliente('T', 't@e.com', saldo, 'Moderado')]);
    assert.equal(m.saldoFormatado, esperado, String(saldo));
    assert.ok(m.mensagem.includes(`o seu saldo atual é ${esperado}.`), `mensagem de ${saldo}:\n${m.mensagem}`);
  }
});

test('formatação: a string de saldo vinda do HTML ("R$ 12.500,00") faz ida e volta idêntica', () => {
  for (const c of clientesDoHtml()) {
    const { itens: [m] } = validarECruzar([c]);
    assert.equal(m.saldoFormatado, c.saldo, c.nome);
  }
});

test('formatação: mínimos na lista de produtos em pt-BR (R$ 1.000,00 / R$ 10.000,00)', () => {
  const { itens: [m] } = validarECruzar([cliente('Carla', 'c@e.com', 28900, 'Arrojado')]);
  assert.ok(m.mensagem.includes('• Ações ETF — aporte mínimo R$ 500,00 — rentabilidade Variável'));
  assert.ok(m.mensagem.includes('• Fundo de Ações — aporte mínimo R$ 10.000,00 — rentabilidade Variável'));
  assert.ok(m.mensagem.includes('• Criptomoedas — aporte mínimo R$ 100,00 — rentabilidade Variável'));
});

test('rentabilidade: ponto decimal vira vírgula (6.2% -> 6,2%; IPCA+6.0% -> IPCA+6,0%); "Variável" intacto', () => {
  const { itens: msgs } = validarECruzar([
    cliente('Ana', 'a@e.com', 12500, 'Conservador'),
    cliente('Bruno', 'b@e.com', 3200, 'Moderado'),
    cliente('Carla', 'c@e.com', 28900, 'Arrojado'),
  ]);
  const [ana, bruno, carla] = msgs;
  assert.ok(ana.mensagem.includes('• Poupança — aporte mínimo R$ 100,00 — rentabilidade 6,2%'));
  assert.ok(ana.mensagem.includes('rentabilidade 12,5%'));
  assert.ok(ana.mensagem.includes('rentabilidade 13,0%'));
  assert.ok(bruno.mensagem.includes('• Tesouro IPCA+ — aporte mínimo R$ 1.000,00 — rentabilidade IPCA+6,0%'));
  assert.ok(bruno.mensagem.includes('rentabilidade 14,0%'));
  assert.ok(carla.mensagem.includes('rentabilidade Variável'));
  assert.equal(carla.produtosRecomendados[0].rentabilidadeFormatada, 'Variável');
  // nenhuma rentabilidade com ponto decimal na mensagem
  for (const m of msgs) assert.ok(!/\d\.\d+%/.test(m.mensagem), 'ponto decimal na mensagem:\n' + m.mensagem);
});

test('rentabilidade: valores com 2 casas ("12.55%") também são convertidos', () => {
  const produtos = [{ perfil: 'Moderado', produto: 'Z', minimo: '1', rentabilidade: '12.55%' }];
  const { itens: [m] } = validarECruzar([cliente('T', 't@e.com', 10, 'Moderado')], produtos);
  assert.equal(m.produtosRecomendados[0].rentabilidadeFormatada, '12,55%');
});

// ---------------------------------------------------------------------------
// 9. Mensagem: saudação, perfil, saldo, aviso legal, nomes
// ---------------------------------------------------------------------------

test('mensagem: tem saudação com primeiro nome, perfil, saldo, produtos e aviso (todos os 10 clientes)', () => {
  const { resposta } = fluxoMVP(clientesDoHtml());
  for (const m of resposta.mensagens) {
    const primeiro = m.nome.split(' ')[0];
    assert.ok(m.mensagem.startsWith(`Olá, ${primeiro}!`), m.mensagem);
    assert.ok(m.mensagem.includes(`Seu perfil de investidor é ${m.perfil}`), m.nome);
    assert.ok(m.mensagem.includes(m.saldoFormatado), m.nome);
    for (const p of m.produtosRecomendados) assert.ok(m.mensagem.includes(`• ${p.produto} —`), `${m.nome} / ${p.produto}`);
    assert.match(m.mensagem, AVISO_RE, m.nome);
    assert.ok(m.assunto.startsWith(`${primeiro}, `), m.assunto);
    assert.ok(m.assunto.includes(m.perfil));
  }
});

test('mensagem: aviso legal presente em TODA mensagem de template (3 perfis x elegível/insuficiente/sem produtos)', () => {
  const clientes = [];
  for (const perfil of ['Conservador', 'Moderado', 'Arrojado']) {
    clientes.push(cliente(`${perfil} rico`, `${perfil}-rico@e.com`, 1e6, perfil));
    clientes.push(cliente(`${perfil} pobre`, `${perfil}-pobre@e.com`, 1, perfil));
  }
  const cenarios = [PRODUTOS_REAIS, [], PRODUTOS_REAIS.filter((p) => p.perfil === 'Moderado')];
  for (const produtos of cenarios) {
    const { itens: msgs } = validarECruzar(clientes, produtos);
    assert.equal(msgs.length, 6);
    for (const m of msgs) {
      assert.match(m.mensagem, AVISO_RE, `${m.nome} (${produtos.length} produtos)`);
      assert.ok(m.mensagem.includes('rentabilidade passada não garante resultado futuro'));
    }
  }
});

test('mensagem: cada perfil tem aviso de risco próprio', () => {
  const { itens: [con, mod, arr] } = validarECruzar([
    cliente('A', 'a@e.com', 5000, 'Conservador'),
    cliente('B', 'b@e.com', 5000, 'Moderado'),
    cliente('C', 'c@e.com', 5000, 'Arrojado'),
  ]);
  assert.match(con.mensagem, /Rentabilidade e liquidez variam/);
  assert.match(mod.mensagem, /oscilar no curto prazo/);
  assert.match(arr.mensagem, /perdas, inclusive do capital investido/);
});

test('nomes: primeiro nome com acento (João), uma só palavra, espaços extras, tabs', () => {
  const casos = [
    ['João Pereira', 'João'],
    ['João', 'João'],
    ['Maria', 'Maria'],
    ['  Maria   da   Silva  ', 'Maria'],
    ['\tÁgata Cristie', 'Ágata'], // nbsp: split(/\s+/) cobre; trim() também
    ['Ana-Clara Souza', 'Ana-Clara'],
    ["D'Ávila Neto", "D'Ávila"],
    ['Zé', 'Zé'],
  ];
  casos.forEach(([nome, primeiro], i) => {
    const { itens: [m] } = validarECruzar([cliente(nome, `n${i}@e.com`, 1000, 'Moderado')]);
    assert.ok(m.mensagem.startsWith(`Olá, ${primeiro}!\n`), `${JSON.stringify(nome)} -> ${m.mensagem.split('\n')[0]}`);
    assert.ok(m.assunto.startsWith(`${primeiro}, veja opções`), m.assunto);
    assert.equal(m.nome, nome.trim().replace(/\s+/g, ' '));
  });
});

test('nomes: nome de uma só palavra não gera "undefined" nem vírgulas soltas', () => {
  const { itens: [m] } = validarECruzar([cliente('Madonna', 'm@e.com', 50, 'Conservador')]);
  assert.ok(!/undefined|null|NaN|\[object/.test(m.mensagem + m.assunto), m.mensagem);
  assert.equal(m.assunto, 'Madonna, veja opções de investimento para o seu perfil Conservador');
});

test('mensagem: nunca contém "undefined", "NaN" ou "[object Object]" em nenhum cenário', () => {
  const clientes = [
    cliente('A', 'a@e.com', 0, 'Conservador'),
    cliente('B', 'b@e.com', 12500, 'Moderado'),
    cliente('C', 'c@e.com', 1e9, 'Arrojado'),
    cliente('D', 'd@e.com', '0,01', 'Arrojado'),
  ];
  for (const produtos of [PRODUTOS_REAIS, []]) {
    for (const m of validarECruzar(clientes, produtos).itens) {
      assert.ok(!/undefined|NaN|null|\[object/.test(m.mensagem + m.assunto + m.saldoFormatado), m.mensagem);
    }
  }
});

test('mensagem: com produtos elegíveis fecha com o texto do perfil; sem elegíveis usa o texto de espera', () => {
  const { itens: [rico, pobre] } = validarECruzar([
    cliente('Rico', 'r@e.com', 5000, 'Conservador'),
    cliente('Pobre', 'p@e.com', 5, 'Conservador'),
  ]);
  assert.match(rico.mensagem, /Concentrar sua carteira em renda fixa/);
  assert.ok(!/Quando o saldo permitir/.test(rico.mensagem));
  assert.match(pobre.mensagem, /Quando o saldo permitir/);
  assert.ok(!/Concentrar sua carteira/.test(pobre.mensagem));
});

// ---------------------------------------------------------------------------
// 10. Montar resposta (MVP)
// ---------------------------------------------------------------------------

test('montar_resposta: resumo conta recebidos/processados/ignorados corretamente num lote misto', () => {
  const { resposta } = fluxoMVP([
    OK(),
    cliente('', 'x', 'abc', 'foo'), // 4 motivos
    cliente('Bruno Lima', 'bruno@email.com', 'R$ 3.200,00', 'Moderado'),
    cliente('Dup', 'ana@email.com', 10, 'Conservador'), // duplicado
    null,
  ]);
  assert.deepEqual(resposta.resumo, { recebidos: 5, processados: 2, ignorados: 3 });
  assert.equal(resposta.mensagens.length, 2);
  assert.deepEqual(resposta.ignorados.map((i) => i.indice), [1, 3, 4]);
  assert.equal(resposta.ignorados[0].motivos.length, 4);
  assert.deepEqual(resposta.ignorados[1].motivos, ['e-mail duplicado no lote']);
});

test('montar_resposta: invariante recebidos == processados + ignorados', () => {
  const lotes = [
    clientesDoHtml(),
    [OK(), OK(), null, 5, cliente('X', 'x@e.com', -1, 'Moderado')],
    [OK()],
  ];
  for (const lote of lotes) {
    const { resposta: { resumo } } = fluxoMVP(lote);
    assert.equal(resumo.recebidos, resumo.processados + resumo.ignorados);
  }
});

test('montar_resposta: as mensagens da resposta são exatamente as saídas do nó de cruzamento', () => {
  const { resposta, mensagens } = fluxoMVP(clientesDoHtml());
  assert.deepEqual(resposta.mensagens, mensagens);
});

// ---------------------------------------------------------------------------
// 11. Montar resposta (IA): saídas simuladas do Agente
// ---------------------------------------------------------------------------

const AVISO_PADRAO = 'Esta mensagem é informativa e não constitui recomendação de investimento; rentabilidade passada não garante resultado futuro.';
const comAviso = (texto) => `${texto}\n\n${AVISO_PADRAO}`; // o nó anexa o aviso quando a IA o esquece

const DOIS = () => [
  cliente('Ana Silva', 'ana@email.com', 'R$ 12.500,00', 'Conservador'),
  cliente('Bruno Lima', 'bruno@email.com', 'R$ 3.200,00', 'Moderado'),
];

test('IA: saída {output:"texto"} -> usa o texto da IA, guarda o template e marca geradoPor "ia"', () => {
  const { resposta, base } = fluxoIA(DOIS(), [{ output: 'Texto da IA 1' }, { output: 'Texto da IA 2' }]);
  assert.deepEqual(resposta.resumo, { recebidos: 2, processados: 2, ignorados: 0, viaIA: 2, viaTemplate: 0 });
  resposta.mensagens.forEach((m, i) => {
    assert.equal(m.mensagem, comAviso(`Texto da IA ${i + 1}`));
    assert.equal(m.geradoPor, 'ia');
    assert.equal(m.mensagemTemplate, base[i].mensagem);
    assert.match(m.mensagemTemplate, AVISO_RE);
    // demais campos preservados
    assert.equal(m.nome, base[i].nome);
    assert.equal(m.saldoFormatado, base[i].saldoFormatado);
    assert.deepEqual(m.produtosRecomendados, base[i].produtosRecomendados);
  });
});

test('IA: saída {output:""} -> fallback para o template', () => {
  const { resposta, base } = fluxoIA(DOIS(), [{ output: '' }, { output: '' }]);
  assert.deepEqual(resposta.resumo, { recebidos: 2, processados: 2, ignorados: 0, viaIA: 0, viaTemplate: 2 });
  resposta.mensagens.forEach((m, i) => {
    assert.equal(m.mensagem, base[i].mensagem);
    assert.equal(m.geradoPor, 'template (fallback)');
  });
});

test('IA: saída só com espaços/quebras de linha -> fallback; texto com espaços nas pontas é aparado', () => {
  const { resposta, base } = fluxoIA(DOIS(), [{ output: '  \n\t ' }, { output: '  Olá, Bruno!  \n' }]);
  assert.equal(resposta.mensagens[0].geradoPor, 'template (fallback)');
  assert.equal(resposta.mensagens[0].mensagem, base[0].mensagem);
  assert.equal(resposta.mensagens[1].geradoPor, 'ia');
  assert.equal(resposta.mensagens[1].mensagem, comAviso('Olá, Bruno!'));
});

test('IA: guardrail — texto que já traz o aviso legal não é duplicado', () => {
  const texto = `Olá, Ana! Veja as opções. ${AVISO_PADRAO}`;
  const { resposta } = fluxoIA(DOIS(), [{ output: texto }, { output: texto }]);
  resposta.mensagens.forEach((m) => {
    assert.equal(m.mensagem, texto);
    assert.equal(m.geradoPor, 'ia');
    assert.equal((m.mensagem.match(/não constitui recomendação/g) || []).length, 1);
  });
});

test('IA: guardrail — promessa/garantia de retorno é descartada e vira o template', () => {
  const promessas = [
    'Olá, Ana! Invista tudo em Criptomoedas, retorno garantido.',
    'Rentabilidade garantida de 20% ao ano!',
    'Garanto um lucro alto para você.',
    'Aplicação sem risco e com ganho certo.',
    'Investimento com RISCO ZERO.',
    'Opção 100% segura para o seu dinheiro.',
  ];
  for (const texto of promessas) {
    const { resposta, base } = fluxoIA(DOIS(), [{ output: texto }, { output: texto }]);
    assert.equal(resposta.resumo.viaIA, 0, texto);
    resposta.mensagens.forEach((m, i) => {
      assert.equal(m.mensagem, base[i].mensagem, texto);
      assert.equal(m.geradoPor, 'template (fallback)');
      assert.match(m.mensagem, AVISO_RE);
    });
  }
});

test('IA: guardrail — o próprio aviso padrão ("não garante resultado futuro") não é confundido com promessa', () => {
  const { resposta } = fluxoIA(DOIS(), [{ output: 'Olá!' }, { output: 'Olá!' }]);
  assert.ok(resposta.mensagens.every((m) => m.geradoPor === 'ia'));
});

test('IA: erro sem campo "output" (continueOnFail) -> fallback, sem exceção', () => {
  const erros = [{ error: 'Rate limit' }, { error: { message: 'x', stack: 'y' } }, {}, { text: 'campo errado' }];
  for (const erro of erros) {
    const { resposta, base } = fluxoIA(DOIS(), [erro, erro]);
    assert.equal(resposta.resumo.viaIA, 0, JSON.stringify(erro));
    assert.equal(resposta.resumo.viaTemplate, 2);
    resposta.mensagens.forEach((m, i) => {
      assert.equal(m.mensagem, base[i].mensagem);
      assert.equal(m.geradoPor, 'template (fallback)');
    });
  }
});

test('IA: output não-string (objeto, número, null, array, boolean) -> fallback', () => {
  for (const output of [{ a: 1 }, 42, null, undefined, ['texto'], true]) {
    const { resposta } = fluxoIA(DOIS(), [{ output }, { output }]);
    assert.equal(resposta.resumo.viaIA, 0, JSON.stringify(output));
    assert.ok(resposta.mensagens.every((m) => m.geradoPor === 'template (fallback)'));
  }
});

test('IA: saída do Agente mais curta que a base -> clientes restantes caem no template, sem exceção', () => {
  const lote = [...DOIS(), cliente('Carla Souza', 'carla@email.com', 28900, 'Arrojado')];
  const { resposta, base } = fluxoIA(lote, [{ output: 'só o primeiro' }]);
  assert.equal(resposta.mensagens.length, 3, 'nenhum cliente pode ser perdido');
  assert.equal(resposta.mensagens[0].geradoPor, 'ia');
  assert.equal(resposta.mensagens[1].mensagem, base[1].mensagem);
  assert.equal(resposta.mensagens[2].mensagem, base[2].mensagem);
  assert.equal(resposta.mensagens[2].geradoPor, 'template (fallback)');
  assert.deepEqual(resposta.resumo, { recebidos: 3, processados: 3, ignorados: 0, viaIA: 1, viaTemplate: 2 });
});

test('IA: Agente devolveu lista vazia -> todos no template', () => {
  const { resposta } = fluxoIA(DOIS(), []);
  assert.equal(resposta.mensagens.length, 2);
  assert.ok(resposta.mensagens.every((m) => m.geradoPor === 'template (fallback)'));
});

test('IA: saída do Agente mais longa que a base -> extras são ignorados', () => {
  const { resposta } = fluxoIA(DOIS(), [{ output: 'a' }, { output: 'b' }, { output: 'c' }, { output: 'd' }]);
  assert.equal(resposta.mensagens.length, 2);
  assert.deepEqual(resposta.mensagens.map((m) => m.mensagem), [comAviso('a'), comAviso('b')]);
});

test('IA: mistura IA / vazio / erro -> viaIA e viaTemplate somam processados; ordem preservada', () => {
  const lote = clientesDoHtml().slice(0, 6);
  const saidas = [{ output: 'ok0' }, { output: '' }, { error: 'x' }, { output: 'ok3' }, { output: ' ' }, { output: 'ok5' }];
  const { resposta, base } = fluxoIA(lote, saidas);
  assert.deepEqual(resposta.mensagens.map((m) => m.geradoPor), ['ia', 'template (fallback)', 'template (fallback)', 'ia', 'template (fallback)', 'ia']);
  assert.deepEqual(resposta.mensagens.map((m) => m.email), base.map((b) => b.email));
  assert.equal(resposta.resumo.viaIA + resposta.resumo.viaTemplate, resposta.resumo.processados);
  assert.equal(resposta.resumo.viaIA, 3);
});

test('IA: resumo inclui ignorados/recebidos do nó de validação', () => {
  const { resposta } = fluxoIA([OK(), cliente('', 'x', 'abc', 'foo'), null], [{ output: 'texto' }]);
  assert.deepEqual(resposta.resumo, { recebidos: 3, processados: 1, ignorados: 2, viaIA: 1, viaTemplate: 0 });
  assert.equal(resposta.ignorados.length, 2);
});

test('IA: a resposta continua serializável em JSON e com o contrato de campos esperado', () => {
  const { resposta } = fluxoIA(DOIS(), [{ output: 'x' }, { error: 'y' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(resposta)), resposta);
  assert.deepEqual(Object.keys(resposta).sort(), ['ignorados', 'mensagens', 'resumo']);
  for (const m of resposta.mensagens) {
    for (const campo of ['nome', 'email', 'perfil', 'saldo', 'saldoFormatado', 'produtosRecomendados', 'assunto', 'mensagem', 'geradoPor']) {
      assert.ok(campo in m, `campo ${campo} ausente`);
    }
  }
});

test('IA: toda mensagem final (inclusive as geradas pela IA) deve conter o aviso de "não é recomendação de investimento"', () => {
  // Regra de negócio: "A mensagem tem ... um aviso de que não é recomendação de investimento."
  // Se a IA ignorar a regra 8 do prompt, nada no código reforça o aviso.
  const { resposta } = fluxoIA(DOIS(), [{ output: 'Olá, Ana! Invista tudo em Criptomoedas, retorno garantido.' }, { output: 'Olá, Bruno!' }]);
  for (const m of resposta.mensagens) {
    assert.match(m.mensagem, AVISO_RE, `mensagem da IA sem aviso legal: "${m.mensagem}"`);
  }
});

// ---------------------------------------------------------------------------
// 12. Correções pós-verificação (regressão)
// ---------------------------------------------------------------------------

test('cruzar: cabeçalho do CSV com BOM, espaços e maiúsculas ("\\uFEFFPerfil") ainda cruza corretamente', () => {
  const comBom = PRODUTOS_REAIS.map((p) => ({
    '﻿Perfil': p.perfil, ' Produto ': p.produto, MINIMO: p.minimo, Rentabilidade: p.rentabilidade,
  }));
  const { itens: [m] } = validarECruzar([cliente('Ana Silva', 'a@e.com', 'R$ 12.500,00', 'Conservador')], comBom);
  assert.deepEqual(nomesProdutos(m), ['Poupança', 'CDB Liquidez Diária', 'Tesouro Selic']);
});

test('cruzar: mínimo negativo no CSV é descartado (não recomenda produto "com desconto")', () => {
  const csv = [{ perfil: 'Moderado', produto: 'Produto Estranho', minimo: '-100', rentabilidade: '9%' }, ...PRODUTOS_REAIS];
  const { itens: [m] } = validarECruzar([cliente('Bruno', 'b@e.com', 10, 'Moderado')], csv);
  assert.ok(!nomesProdutos(m).includes('Produto Estranho'));
});

test('validar: saldo "1e3" ou com letras é inválido (antes virava 13)', () => {
  for (const saldo of ['1e3', '12abc', 'R$ 10 reais', '1,2,3x']) {
    const v = validarLista([cliente('Teste', 't@e.com', saldo, 'Moderado')]);
    assert.equal(v.validos.length, 0, saldo);
    assert.ok(v.ignorados[0].motivos.includes('saldo inválido'), saldo);
  }
  // formatos válidos continuam aceitos
  for (const [saldo, esperado] of [['R$ 12.500,00', 12500], ['850', 850], [' R$ 1.234,56 ', 1234.56], [0, 0], ['1.234', 1234]]) {
    const v = validarLista([cliente('Teste', 't@e.com', saldo, 'Moderado')]);
    assert.equal(v.validos[0]?.saldo, esperado, String(saldo));
  }
});

test('estrutura: workflows têm id próprio (obrigatório no import:workflow), webhooks e ids de nó distintos', () => {
  const carregar = (f) => JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', f), 'utf8'));
  const mvp = carregar('workflow.json');
  const ia = carregar('workflow-ia.json');
  for (const wf of [mvp, ia]) {
    assert.match(wf.id, /^[A-Za-z0-9]{8,36}$/, 'id do workflow ausente/ inválido');
    assert.equal(new Set(wf.nodes.map((n) => n.name)).size, wf.nodes.length, 'nomes de nó duplicados');
    assert.equal(new Set(wf.nodes.map((n) => n.id)).size, wf.nodes.length, 'ids de nó duplicados');
  }
  assert.notEqual(mvp.id, ia.id);
  const webhook = (wf) => wf.nodes.find((n) => n.type === 'n8n-nodes-base.webhook');
  assert.notEqual(webhook(mvp).parameters.path, webhook(ia).parameters.path, 'dois workflows ativos disputariam o mesmo path');
  assert.notEqual(webhook(mvp).webhookId, webhook(ia).webhookId);
  const idsMvp = new Set(mvp.nodes.map((n) => n.id));
  assert.ok(ia.nodes.every((n) => !idsMvp.has(n.id)), 'MVP e IA compartilham ids de nó');
});

test('estrutura: falha ao baixar o data.csv desvia para "Responder 502" (nunca 200 vazio)', () => {
  for (const f of ['workflow.json', 'workflow-ia.json']) {
    const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', f), 'utf8'));
    const baixar = wf.nodes.find((n) => n.name === 'Baixar data.csv');
    assert.equal(baixar.onError, 'continueErrorOutput', f);
    const saidas = wf.connections['Baixar data.csv'].main;
    assert.equal(saidas[0][0].node, 'Ler CSV', f);
    assert.equal(saidas[1][0].node, 'Responder 502', f);
    const resp = wf.nodes.find((n) => n.name === 'Responder 502');
    assert.equal(resp.parameters.options.responseCode, 502, f);
    assert.equal(resp.type, 'n8n-nodes-base.respondToWebhook', f);
  }
});

test('estrutura: todas as conexões apontam para nós existentes e o Agente de IA não usa retry', () => {
  for (const f of ['workflow.json', 'workflow-ia.json']) {
    const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', f), 'utf8'));
    const nomes = new Set(wf.nodes.map((n) => n.name));
    for (const [origem, tipos] of Object.entries(wf.connections)) {
      assert.ok(nomes.has(origem), `origem inexistente: ${origem}`);
      for (const saidas of Object.values(tipos)) {
        for (const lista of saidas) for (const dest of lista) assert.ok(nomes.has(dest.node), `${f}: destino inexistente ${dest.node}`);
      }
    }
  }
  const ia = JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', 'workflow-ia.json'), 'utf8'));
  const agente = ia.nodes.find((n) => n.name === 'Agente de IA');
  assert.equal(agente.onError, 'continueRegularOutput');
  assert.equal(agente.retryOnFail, undefined, 'retry reexecutaria o lote inteiro de clientes');
});

// ---------------------------------------------------------------------------
// 13. Segunda rodada de correções (revisão adversarial do diff)
// ---------------------------------------------------------------------------

const FRASES = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'frases_ia.json'), 'utf8'));

/** Passa uma frase pelo "Montar resposta (IA)" e devolve a mensagem do 1º cliente. */
const filtrarFrase = (frase) => fluxoIA([OK()], [{ output: frase }]).resposta.mensagens[0];

test('IA guardrail: frases legítimas (inclusive com negação e FGC) NÃO são descartadas', () => {
  assert.ok(FRASES.manter.length >= 40);
  const descartadas = FRASES.manter.filter((f) => filtrarFrase(f).geradoPor !== 'ia');
  assert.deepEqual(descartadas, [], 'falsos positivos do guardrail');
});

test('IA guardrail: promessas de retorno/garantia/risco nulo SÃO descartadas e viram o template', () => {
  assert.ok(FRASES.descartar.length >= 60);
  const passaram = FRASES.descartar.filter((f) => filtrarFrase(f).geradoPor === 'ia');
  assert.deepEqual(passaram, [], 'falsos negativos do guardrail (promessa que passou)');
});

test('IA guardrail: frases ambíguas podem ir para qualquer lado, mas a mensagem final sempre leva o aviso legal', () => {
  for (const frase of FRASES.tolerados) assert.match(filtrarFrase(frase).mensagem, AVISO_RE, frase);
});

test('IA guardrail: nenhuma frase da bateria produz mensagem sem aviso legal', () => {
  for (const frase of [...FRASES.manter, ...FRASES.descartar, ...FRASES.tolerados]) {
    assert.match(filtrarFrase(frase).mensagem, AVISO_RE, frase);
  }
});

test('IA guardrail: promessa escondida no meio de um texto longo e quebra de linha entre as palavras', () => {
  const longo = 'Olá, Ana! Veja as opções abaixo.\n• Tesouro Selic — aporte mínimo R$ 500,00\nEsse produto tem retorno\ngarantido e você vai amar.';
  assert.equal(filtrarFrase(longo).geradoPor, 'template (fallback)');
});

test('IA guardrail: variantes do aviso legal não são duplicadas', () => {
  for (const aviso of ['Isto não é uma recomendação de investimento.', 'Não constitui recomendação de investimentos.', 'Não representa recomendação de investimento.']) {
    const m = filtrarFrase(`Olá, Ana! Veja as opções. ${aviso}`);
    assert.equal(m.geradoPor, 'ia', aviso);
    assert.equal((m.mensagem.match(/recomenda[çc][ãõa]\w* de investimento/gi) || []).length, 1, `aviso duplicado: ${m.mensagem}`);
  }
});

test('validar: saldo em formato en-US ("12,500.00", "1,234.56") é REJEITADO, não lido como R$ 12,50', () => {
  for (const saldo of ['1,234.56', '12,500.00', 'R$ 12,500.00', '1.234,567', '1,005', '1,2,3']) {
    const v = validarLista([cliente('Teste', 't@e.com', saldo, 'Moderado')]);
    assert.equal(v.validos.length, 0, saldo);
    assert.ok(v.ignorados[0].motivos.includes('saldo inválido'), saldo);
  }
  for (const [saldo, esperado] of [['12,5', 12.5], ['1.000,50', 1000.5], ['0,5', 0.5], ['850,00', 850], ['R$ 1 000,00', 1000], ['1234.56', 1234.56]]) {
    assert.equal(validarLista([cliente('Teste', 't@e.com', saldo, 'Moderado')]).validos[0]?.saldo, esperado, saldo);
  }
});

test('validar: saldo astronômico, infinito, negativo ínfimo e -0', () => {
  for (const saldo of [1e21, 1e13, Infinity, -Infinity, NaN, '1e21', -0.004, '-R$ 0,01', true, [], {}]) {
    const v = validarLista([cliente('Teste', `x${String(saldo).length}@e.com`, saldo, 'Moderado')]);
    assert.equal(v.validos.length, 0, String(saldo));
  }
  for (const entrada of [-0, '-R$ 0,00']) {
    const zero = validarLista([cliente('Teste', 'z@e.com', entrada, 'Moderado')]).validos[0];
    assert.ok(Object.is(zero.saldo, 0), `saldo ${entrada} deve virar +0`);
  }
  assert.equal(validarLista([cliente('Teste', 'k@e.com', 1e12, 'Moderado')]).validos.length, 1, 'o limite (1e12) ainda é válido');
});

test('cruzar: mínimo "1e3", "0x10" e "1.000" no CSV são descartados; "1000,5" e "100" valem', () => {
  const linha = (minimo) => ({ perfil: 'Moderado', produto: `P${minimo}`, minimo, rentabilidade: '9%' });
  const csv = ['1e3', '0x10', '1.000', '1000,5', '100', 100].map(linha);
  const { itens: [m] } = validarECruzar([cliente('Bruno', 'b@e.com', 5000, 'Moderado')], csv);
  assert.deepEqual(nomesProdutos(m).sort(), ['P100', 'P100', 'P1000,5'].sort());
});

test('cruzar: rentabilidade com mais de um ponto decimal é formatada em todas as ocorrências', () => {
  const csv = [{ perfil: 'Moderado', produto: 'X', minimo: '10', rentabilidade: 'CDI 1.5% + 0.3%' }];
  const { itens: [m] } = validarECruzar([cliente('Bruno', 'b@e.com', 5000, 'Moderado')], csv);
  assert.equal(m.produtosRecomendados[0].rentabilidadeFormatada, 'CDI 1,5% + 0,3%');
});

test('cruzar: o texto do perfil nunca cita produto que o cliente não pode contratar (grade perfil x saldo)', () => {
  // [termo no texto, produto que o justifica]: o termo só pode aparecer se o produto é oferecido a este cliente
  const proibidos = [[/multimercado/i, /multimercado/i], [/fundos? de a[çc][õo]es/i, /fundo de a[çc][õo]es/i], [/\bETFs?\b/, /ETF/],
    [/cripto/i, /cripto/i], [/poupan[çc]a/i, /poupan[çc]a/i], [/\bCDB\b/, /CDB/], [/tesouro/i, /tesouro/i]];
  for (const perfil of ['Conservador', 'Moderado', 'Arrojado']) {
    for (const saldo of [0, 50, 100, 499, 500, 999, 1000, 3200, 4999, 5000, 9999, 10000, 45000]) {
      const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', saldo, perfil)]);
      const permitidos = PRODUTOS_REAIS.filter((p) => p.perfil === perfil).map((p) => p.produto);
      // só linhas de produto (•) e a frase da "porta de entrada" podem citar nomes de produto
      const texto = m.mensagem.split('\n').filter((l) => !l.startsWith('•') && !l.includes('porta de entrada')).join('\n');
      const entrada = (m.mensagem.match(/porta de entrada é ([^,]+),/) || [])[1] || ''; // produto citado como entrada
      for (const [re, produto] of proibidos) {
        if (m.produtosRecomendados.some((p) => produto.test(p.produto)) || produto.test(entrada)) continue;
        assert.ok(!re.test(texto), `${perfil} R$ ${saldo}: texto cita ${re} sem oferecer o produto:\n${m.mensagem}`);
      }
      assert.ok(permitidos.length > 0);
    }
  }
});

test('fontes: nenhum caractere invisível literal (BOM, diacríticos combinantes, zero-width) nos nós Code', () => {
  for (const [nome, codigo] of Object.entries(CODIGO)) {
    const achados = [...codigo].filter((ch) => /[̀-ͯ﻿​-‏⁠]/.test(ch)).map((ch) => 'U+' + ch.codePointAt(0).toString(16));
    assert.deepEqual(achados, [], `${nome}.js tem caracteres invisíveis literais; use escapes \\uXXXX`);
  }
});

test('estrutura: "Ler CSV" sempre emite um item (CSV sem linhas não deixa o Webhook sem resposta)', () => {
  for (const f of ['workflow.json', 'workflow-ia.json']) {
    const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', f), 'utf8'));
    assert.equal(wf.nodes.find((n) => n.name === 'Ler CSV').alwaysOutputData, true, f);
  }
});

test('cruzar: CSV sem linhas (1 item vazio, como gera o alwaysOutputData) -> mensagens "sem opções", sem exceção', () => {
  const v = validarLista([OK()]);
  const saida = executarNo(CODIGO.cruzar, [{ json: { produtos: [{}] } }], { [N_VALIDAR]: [{ json: v }] });
  assert.equal(saida.length, 1);
  assert.match(saida[0].json.mensagem, /No momento não há opções cadastradas/);
});

test('estrutura: o corpo do 502 tolera "error" como string ou objeto e limita o tamanho do detalhe', () => {
  for (const f of ['workflow.json', 'workflow-ia.json']) {
    const wf = JSON.parse(fs.readFileSync(path.join(RAIZ, 'n8n', f), 'utf8'));
    const corpo = wf.nodes.find((n) => n.name === 'Responder 502').parameters.responseBody;
    assert.match(corpo, /typeof \$json\.error === 'string'/, f);
    assert.match(corpo, /\.slice\(0, 200\)/, f);
  }
});

// ---------------------------------------------------------------------------
// 14. Ajustes finais (pontos de atenção da última verificação em N8N real)
// ---------------------------------------------------------------------------

test('cruzar: se a mensagem cita Criptomoedas como "porta de entrada", o aviso de volatilidade acompanha', () => {
  const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', 50, 'Arrojado')]);
  assert.deepEqual(m.produtosRecomendados, []);
  assert.match(m.mensagem, /porta de entrada é Criptomoedas/);
  assert.match(m.mensagem, /Criptomoedas têm volatilidade muito alta/);
});

test('cruzar: sem citar criptomoedas (Conservador/Moderado ou Arrojado que já pode comprar só ETF), não há aviso de cripto', () => {
  for (const [saldo, perfil] of [[10, 'Conservador'], [10, 'Moderado'], [850, 'Conservador']]) {
    const { itens: [m] } = validarECruzar([cliente('Teste', 't@e.com', saldo, perfil)]);
    assert.ok(!/cripto/i.test(m.mensagem), `${perfil} R$ ${saldo}:\n${m.mensagem}`);
  }
});

test('IA: cliente SEM produto elegível nunca usa o texto da IA (poderia inventar produtos) -> template exato', () => {
  const { resposta, base } = fluxoIA(
    [cliente('Pobre', 'p@e.com', 10, 'Moderado'), cliente('Ana Silva', 'a@e.com', 12500, 'Conservador')],
    [{ output: 'Olá! Recomendo o Fundo XPTO com 30% ao ano.' }, { output: 'Olá, Ana! Veja as opções.' }],
  );
  const [semProdutos, comProdutos] = resposta.mensagens;
  assert.equal(semProdutos.geradoPor, 'template (sem produtos elegíveis)');
  assert.equal(semProdutos.mensagem, base[0].mensagem);
  assert.ok(!/XPTO/.test(semProdutos.mensagem));
  assert.equal(comProdutos.geradoPor, 'ia');
  assert.deepEqual(resposta.resumo, { recebidos: 2, processados: 2, ignorados: 0, viaIA: 1, viaTemplate: 1 });
});

test('IA: CSV só com cabeçalho (ninguém tem produto elegível) -> todos no template, nenhum texto de IA vaza', () => {
  const { resposta } = fluxoIA(DOIS(), [{ output: 'Invista no Fundo Inventado.' }, { output: 'Invista no Fundo Inventado.' }], [{}]);
  assert.equal(resposta.resumo.viaIA, 0);
  assert.ok(resposta.mensagens.every((m) => !/Inventado/.test(m.mensagem) && m.geradoPor === 'template (sem produtos elegíveis)'));
});
