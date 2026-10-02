// Cálculos de apresentação. O cálculo oficial é sempre o do
// motor na planilha; aqui só se estima o que ainda está na fila.

import { num, arred2, dia, hojeDia, diasEntre, mesmaPessoa, normalizar } from './util.js';

export function cotacaoBRL(moeda, cotacoes) {
  if (moeda === 'BRL') return 1;
  const c = cotacoes && cotacoes[moeda];
  return c && num(c.cotacao) > 0 ? num(c.cotacao) : 0;
}

export function estimarBRL(valor, moeda, cotacoes) {
  return arred2(num(valor) * cotacaoBRL(moeda, cotacoes));
}

/** Valor em reais de uma despesa: o da planilha ou, na fila, uma estimativa. */
export function valorBRL(d, cotacoes) {
  const efetivo = num(d.valorEfetivo);
  if (efetivo > 0) return efetivo;

  if (!d._fila) {
    const estimado = num(d.valorEstimado);
    if (estimado > 0) return estimado;
    const total = num(d.valorTotal);
    if (total > 0) return total;
  }

  return estimarBRL(d.valorOriginal, d.moeda, cotacoes);
}

export function converter(valor, de, para, cotacoes) {
  const a = cotacaoBRL(de, cotacoes);
  const b = cotacaoBRL(para, cotacoes);
  if (!(a > 0) || !(b > 0)) return NaN;
  return num(valor) * a / b;
}

/** Mesma regra do motor: compartilhada = metade João, resto Norma. */
export function previaObrigacoes({ valor, moeda, quemPagou, responsavel }) {
  const v = arred2(num(valor));
  if (!(v > 0) || !quemPagou || !responsavel) return [];

  let partes;
  if (normalizar(responsavel) === 'compartilhada') {
    const joao = arred2(v / 2);
    partes = [['João', joao], ['Norma', arred2(v - joao)]];
  } else {
    partes = [[responsavel, v]];
  }

  return partes
    .filter(([devedor, valorParte]) => !mesmaPessoa(devedor, quemPagou) && valorParte > 0)
    .map(([devedor, valorParte]) => ({ devedor, credor: quemPagou, valor: valorParte, moeda }));
}

/* ---------------- Viagem ---------------- */

export function infoViagem(config) {
  const inicio = config && config.viagemInicio;
  const fim = config && config.viagemFim;
  const hoje = hojeDia();

  if (!inicio || !fim) return { fase: 'sem-datas', rotulo: 'Viagem EUA 2026' };

  const total = diasEntre(inicio, fim) + 1;

  if (hoje < inicio) {
    const faltam = diasEntre(hoje, inicio);
    return { fase: 'antes', total, rotulo: faltam === 1 ? 'Falta 1 dia para a viagem' : 'Faltam ' + faltam + ' dias para a viagem' };
  }

  if (hoje > fim) return { fase: 'depois', total, rotulo: 'Viagem concluída' };

  const atual = diasEntre(inicio, hoje) + 1;
  return { fase: 'durante', total, atual, rotulo: 'Dia ' + atual + ' de ' + total };
}

export const MOMENTOS = ['Antes de viajar', 'Durante a viagem', 'Depois de voltar'];
export const ETAPAS = ['Ida', 'Estadia', 'Retorno'];

export function momentoEtapa(diaCompra, config) {
  const inicio = config && config.viagemInicio;
  const fim = config && config.viagemFim;
  if (!inicio || !fim || !diaCompra) return { momento: '', etapa: '' };
  if (diaCompra < inicio) return { momento: 'Antes de viajar', etapa: '' };
  if (diaCompra > fim) return { momento: 'Depois de voltar', etapa: '' };
  return {
    momento: 'Durante a viagem',
    etapa: diaCompra === inicio ? 'Ida' : diaCompra === fim ? 'Retorno' : 'Estadia'
  };
}

/* ---------------- Resumo ---------------- */

export function despesasValidas(v) {
  return v.despesas.filter(d => !(d._tipoOp === 'despesa.criar' && d._fila === 'recusada'));
}

export function resumo(v) {
  const cot = v.cotacoes;
  const lista = despesasValidas(v);

  const r = {
    total: 0,
    quantidade: lista.length,
    porMoeda: { BRL: 0, USD: 0, PYG: 0 },
    porResponsavel: new Map(),
    porPagador: new Map(),
    porCategoria: new Map(),
    porDia: new Map(),
    estimado: 0
  };

  for (const d of lista) {
    const brl = valorBRL(d, cot);
    r.total = arred2(r.total + brl);

    if (d._fila || !(num(d.valorEfetivo) > 0)) r.estimado = arred2(r.estimado + brl);
    if (r.porMoeda[d.moeda] !== undefined) r.porMoeda[d.moeda] = arred2(r.porMoeda[d.moeda] + num(d.valorOriginal));

    somar(r.porResponsavel, d.responsavel || '—', brl);
    somar(r.porPagador, d.quemPagou || '—', brl);
    somar(r.porCategoria, d.categoria || 'Outros', brl);
    somar(r.porDia, dia(d.dataCompra), brl);
  }

  return r;
}

function somar(mapa, chave, valor) {
  mapa.set(chave, arred2((mapa.get(chave) || 0) + valor));
}

export function ordenarMapa(mapa) {
  return Array.from(mapa.entries()).sort((a, b) => b[1] - a[1]);
}

/* ---------------- Registros ---------------- */

export const PROTEGIDOS = ['a01edddc'];

export function dadosParaEdicao(d) {
  return {
    id: d.id,
    dataCompra: d.dataCompra,
    dataUtilizacao: d.dataUtilizacao ? dia(d.dataUtilizacao) : '',
    momento: d.momento || '',
    etapa: d.etapa || '',
    local: d.local || '',
    categoria: d.categoria,
    descricao: d.descricao,
    formaPagamento: d.formaPagamento,
    cartao: d.cartao || '',
    quemPagou: d.quemPagou,
    responsavel: d.responsavel,
    observacao: d.observacao || '',
    gps: d.gps || '',
    moeda: d.moeda,
    valorOriginal: num(d.valorOriginal)
  };
}

export function obrigacoesDaDespesa(v, id) {
  return (v.obrigacoes || []).filter(o => normalizar(o.tipoOrigem) === 'despesa' && o.origemId === id);
}

/** A despesa já teve acerto aplicado em alguma das dívidas que gerou? */
export function despesaComAcerto(v, id) {
  const ids = new Set((v.aplicacoes || []).map(a => a.obrigacaoId));
  return obrigacoesDaDespesa(v, id).some(o => ids.has(o.id));
}

export function pessoaPropria(v, nome) {
  const p = (v.pessoas || []).find(x => mesmaPessoa(x.nome, nome));
  return Boolean(p && !p.geraAcerto);
}

/* ---------------- Contas ---------------- */

export function gruposAbertos(v) {
  return (v.saldosConta || [])
    .filter(g => num(g.saldo) > 0.004)
    .sort((a, b) => num(b.refSaldo) - num(a.refSaldo));
}

export function gruposLiquidados(v) {
  return (v.saldosConta || []).filter(g => !(num(g.saldo) > 0.004) && num(g.liquidado) > 0);
}

export function obrigacoesDoGrupo(v, g) {
  return (v.obrigacoes || [])
    .filter(o => mesmaPessoa(o.devedor, g.devedor) && mesmaPessoa(o.credor, g.credor) && o.moeda === g.moeda)
    .sort((a, b) => String(a.dataOrigem).localeCompare(String(b.dataOrigem)));
}

export function origemDaObrigacao(v, o) {
  const tipo = normalizar(o.tipoOrigem);

  if (tipo === 'despesa') {
    const d = v.despesas.find(x => x.id === o.origemId);
    return { titulo: d ? d.descricao : 'Despesa ' + o.origemId, categoria: d ? d.categoria : '', data: o.dataOrigem };
  }

  if (tipo === 'pagamento por conta') {
    const acertoId = String(o.origemId || '').split(':')[0];
    const a = v.acertos.find(x => x.id === acertoId);
    return { titulo: 'Pagamento feito por ' + o.credor + (a ? ': ' + a.descricao : ''), categoria: '', data: o.dataOrigem, icone: 'maos' };
  }

  if (tipo === 'excesso de acerto') {
    return { titulo: 'Pagamento a mais (crédito)', categoria: '', data: o.dataOrigem, icone: 'maos' };
  }

  return { titulo: o.observacao || o.tipoOrigem, categoria: '', data: o.dataOrigem };
}

/** Totais do ponto de vista de quem usa o aparelho. */
export function posicaoDoUsuario(v, usuario) {
  const receber = {};
  const pagar = {};

  for (const g of gruposAbertos(v)) {
    if (mesmaPessoa(g.credor, usuario)) receber[g.moeda] = arred2((receber[g.moeda] || 0) + num(g.saldo));
    if (mesmaPessoa(g.devedor, usuario)) pagar[g.moeda] = arred2((pagar[g.moeda] || 0) + num(g.saldo));
  }

  return { receber, pagar };
}

/**
 * Dívidas que podem ser pagas num acerto. Quando João e Norma
 * devem à mesma pessoa na mesma moeda, aparece também a opção
 * de pagar as duas de uma vez ("Ambos").
 */
export function opcoesDeDivida(v) {
  const abertos = gruposAbertos(v);
  const opcoes = abertos.map(g => ({
    chave: g.devedor + '|' + g.credor + '|' + g.moeda,
    devedor: g.devedor,
    porConta: g.devedor,
    credor: g.credor,
    moeda: g.moeda,
    saldo: num(g.saldo)
  }));

  const porCredor = new Map();
  for (const g of abertos) {
    const chave = g.credor + '|' + g.moeda;
    if (!porCredor.has(chave)) porCredor.set(chave, []);
    porCredor.get(chave).push(g);
  }

  for (const [chave, lista] of porCredor) {
    const devedores = lista.map(g => normalizar(g.devedor));
    if (devedores.includes('joao') && devedores.includes('norma')) {
      const [credor, moeda] = chave.split('|');
      const saldo = arred2(lista.filter(g => ['joao', 'norma'].includes(normalizar(g.devedor))).reduce((s, g) => s + num(g.saldo), 0));
      opcoes.push({ chave: 'Ambos|' + chave, devedor: 'João e Norma', porConta: 'Ambos', credor, moeda, saldo });
    }
  }

  return opcoes;
}
