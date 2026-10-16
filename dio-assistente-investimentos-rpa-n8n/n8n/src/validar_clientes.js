// Nó: "Validar clientes" (Code · Run Once for All Items)
// Valida e padroniza os clientes enviados pelo RPA antes de qualquer cruzamento.
//
// Entrada : 1 item do Webhook  -> { body: { clientes: [{ nome, email, saldo, perfil }] } }
// Saída   : 1 item             -> { recebidos, validos: [...], ignorados: [{ indice, nome, motivos }] }

const PERFIS_VALIDOS = { conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado' };
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const semAcento = (texto) =>
  String(texto ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// "R$ 12.500,00" -> 12500 | "850" -> 850 | 1200.5 -> 1200.5 | inválido -> NaN
function paraNumero(valor) {
  if (typeof valor === 'number') return valor;
  const limpo = String(valor ?? '').replace(/[^\d,.-]/g, '');
  if (!limpo) return NaN;
  if (limpo.includes(',')) return Number(limpo.replace(/\./g, '').replace(',', '.'));
  if (/^-?\d{1,3}(\.\d{3})+$/.test(limpo)) return Number(limpo.replace(/\./g, ''));
  return Number(limpo);
}

const body = $input.first().json.body ?? {};
const lista = Array.isArray(body.clientes) ? body.clientes : [];

const validos = [];
const ignorados = [];
const emailsVistos = new Set();

lista.forEach((cliente, indice) => {
  const c = cliente && typeof cliente === 'object' ? cliente : {};
  const motivos = [];

  const nome = String(c.nome ?? '').trim();
  const email = String(c.email ?? '').trim().toLowerCase();
  const perfil = PERFIS_VALIDOS[semAcento(c.perfil)];
  const saldo = paraNumero(c.saldo);

  if (!nome) motivos.push('nome ausente');
  if (!EMAIL_REGEX.test(email)) motivos.push('e-mail inválido');
  else if (emailsVistos.has(email)) motivos.push('e-mail duplicado no lote');
  if (!perfil) motivos.push('perfil desconhecido (use Conservador, Moderado ou Arrojado)');
  if (!Number.isFinite(saldo) || saldo < 0) motivos.push('saldo inválido');

  if (motivos.length) {
    ignorados.push({ indice, nome: nome || null, motivos });
    return;
  }
  emailsVistos.add(email);
  validos.push({ nome, email, perfil, saldo });
});

return [{ json: { recebidos: lista.length, validos, ignorados } }];
