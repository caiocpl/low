// Nó: "Validar clientes" (Code · Run Once for All Items)
// Valida e padroniza os clientes enviados pelo RPA antes de qualquer cruzamento.
//
// Entrada : 1 item do Webhook  -> { body: { clientes: [{ nome, email, saldo, perfil }] } }
// Saída   : 1 item             -> { recebidos, validos: [...], ignorados: [{ indice, nome, motivos }] }

const PERFIS_VALIDOS = { conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado' };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const semAcento = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

// "R$ 12.500,00" -> 12500 | "850" -> 850 | 1200.5 -> 1200.5 | inválido ("abc", "1e3") -> NaN
// Só aceita o formato brasileiro (vírgula decimal, ponto de milhar). O formato en-US "12,500.00" é REJEITADO:
// lê-lo como 12,5 mudaria a elegibilidade do cliente em silêncio.
function paraNumero(valor) {
  if (typeof valor === 'number') return valor;
  const semMoeda = String(valor ?? '').replace(/R\$/gi, '');
  if (/[^\d\s,.-]/.test(semMoeda)) return NaN; // qualquer letra/símbolo estranho invalida o valor
  const limpo = semMoeda.replace(/\s/g, '');
  if (!limpo) return NaN;
  if (limpo.includes(',')) {
    return /^-?(\d{1,3}(\.\d{3})*|\d+),\d{1,2}$/.test(limpo) ? Number(limpo.replace(/\./g, '').replace(',', '.')) : NaN;
  }
  if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) return Number(limpo.replace(/\./g, ''));
  return Number(limpo);
}

const SALDO_MAXIMO = 1e12; // acima disso o valor perde precisão e a formatação quebra: trata como erro de digitação

const body = $input.first().json.body ?? {};
const lista = Array.isArray(body.clientes) ? body.clientes : [];

const validos = [];
const ignorados = [];
const emailsVistos = new Set();

lista.forEach((cliente, indice) => {
  const c = cliente && typeof cliente === 'object' ? cliente : {};
  const motivos = [];

  const nome = String(c.nome ?? '').trim().replace(/\s+/g, ' ');
  const email = String(c.email ?? '').trim().toLowerCase();
  const perfil = PERFIS_VALIDOS[semAcento(c.perfil)];
  const bruto = paraNumero(c.saldo);
  const saldo = Math.round(bruto * 100) / 100 + 0; // centavos (evita "R$ 100,00, faltam R$ 0,00"); "+ 0" troca -0 por 0

  if (!nome) motivos.push('nome ausente');
  if (!EMAIL_REGEX.test(email)) motivos.push('e-mail inválido');
  else if (emailsVistos.has(email)) motivos.push('e-mail duplicado no lote');
  if (!perfil) motivos.push('perfil desconhecido (use Conservador, Moderado ou Arrojado)');
  if (!Number.isFinite(bruto) || bruto < 0 || bruto > SALDO_MAXIMO) motivos.push('saldo inválido');

  if (motivos.length) {
    ignorados.push({ indice, nome: nome || null, motivos });
    return;
  }
  emailsVistos.add(email);
  validos.push({ nome, email, perfil, saldo });
});

return [{ json: { recebidos: lista.length, validos, ignorados } }];
