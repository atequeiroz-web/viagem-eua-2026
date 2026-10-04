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

/**
 * Referência em reais de uma despesa, CONGELADA no dia da compra.
 * É só informativa: o gasto vale na moeda original.
 *  - BRL: o próprio valor.
 *  - Já calculada pela planilha: "Valor BRL estimado" (cotação do
 *    dia da compra; no dinheiro em espécie, o custo médio dele).
 *  - Ainda na fila ou sem cotação na planilha: estimativa com a
 *    cotação guardada no aparelho (marcada como estimada).
 */
export function refBRL(d, cotacoes) {
  const original = num(d.valorOriginal);
  if (d.moeda === 'BRL') return { valor: arred2(original), estimada: false };

  if (!d._fila) {
    const estimado = num(d.valorEstimado);
    if (estimado > 0) return { valor: arred2(estimado), estimada: false };
    const cot = num(d.cotacao);
    if (cot > 0) return { valor: arred2(original * cot), estimada: false };
  }

  return { valor: estimarBRL(original, d.moeda, cotacoes), estimada: true };
}

/* ---------------- Somas por moeda ---------------- */

export const ORDEM_MOEDAS = ['USD', 'BRL', 'PYG'];

/** Uma soma separada por moeda + a soma das referências em reais. */
export function somaVazia() {
  return { USD: 0, BRL: 0, PYG: 0, ref: 0, refEstimada: 0, quantidade: 0 };
}

export function somarDespesa(s, d, cotacoes, fator = 1) {
  const r = refBRL(d, cotacoes);
  const moeda = ORDEM_MOEDAS.includes(d.moeda) ? d.moeda : 'BRL';
  s[moeda] = arred2(s[moeda] + num(d.valorOriginal) * fator);
  s.ref = arred2(s.ref + r.valor * fator);
  if (r.estimada) s.refEstimada = arred2(s.refEstimada + r.valor * fator);
  s.quantidade += 1;
  return s;
}

export function juntarSomas(...somas) {
  const t = somaVazia();
  for (const s of somas) {
    for (const k of ORDEM_MOEDAS) t[k] = arred2(t[k] + s[k]);
    t.ref = arred2(t.ref + s.ref);
    t.refEstimada = arred2(t.refEstimada + s.refEstimada);
    t.quantidade += s.quantidade;
  }
  return t;
}

/** Moedas com valor, na ordem US$, R$, ₲. */
export function moedasUsadas(s) {
  return ORDEM_MOEDAS.filter(k => Math.abs(s[k]) > 0.004);
}

/** Só reais? Então a referência é o próprio valor e não precisa aparecer. */
export function soReais(s) {
  const usadas = moedasUsadas(s);
  return usadas.length === 0 || (usadas.length === 1 && usadas[0] === 'BRL');
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
  return resumoDe(despesasValidas(v), v.cotacoes);
}

/** Separa as despesas em "antes da viagem" e "a partir do 1º dia". */
export function dividirPorFase(v) {
  const inicio = v.config && v.config.viagemInicio;
  const lista = despesasValidas(v);
  if (!inicio) return { antes: [], viagem: lista };
  return {
    antes: lista.filter(d => dia(d.dataCompra) < inicio),
    viagem: lista.filter(d => dia(d.dataCompra) >= inicio)
  };
}

/**
 * Parte de cada um: o que é dele mais metade do compartilhado
 * (mesma regra do motor: metade João, restante Norma).
 */
export function partePorPessoa(lista, cotacoes) {
  const partes = new Map();
  const de = nome => {
    if (!partes.has(nome)) partes.set(nome, somaVazia());
    return partes.get(nome);
  };

  for (const d of lista) {
    if (normalizar(d.responsavel) === 'compartilhada') {
      // Mesma regra do motor, moeda por moeda: metade arredondada para
      // o João, o restante para a Norma (a soma fecha sem sobra).
      const r = refBRL(d, cotacoes);
      const v = num(d.valorOriginal);
      const moeda = ORDEM_MOEDAS.includes(d.moeda) ? d.moeda : 'BRL';
      const vJoao = arred2(v / 2);
      const refJoao = arred2(r.valor / 2);
      [['João', vJoao, refJoao], ['Norma', arred2(v - vJoao), arred2(r.valor - refJoao)]].forEach(([nome, valor, ref]) => {
        const s = de(nome);
        s[moeda] = arred2(s[moeda] + valor);
        s.ref = arred2(s.ref + ref);
        if (r.estimada) s.refEstimada = arred2(s.refEstimada + ref);
        s.quantidade += 1;
      });
    } else {
      somarDespesa(de(d.responsavel || '—'), d, cotacoes);
    }
  }

  return partes;
}

/**
 * Resumo de uma lista de despesas. Nada é convertido: cada moeda é
 * somada separadamente; "ref" soma as referências em reais congeladas.
 */
export function resumoDe(lista, cot) {
  const r = {
    tot: somaVazia(),
    refPorMoeda: { USD: 0, BRL: 0, PYG: 0 },
    quantidade: lista.length,
    porResponsavel: new Map(),
    porPagador: new Map(),
    porCategoria: new Map(),
    porDia: new Map()
  };

  for (const d of lista) {
    somarDespesa(r.tot, d, cot);
    const m = ORDEM_MOEDAS.includes(d.moeda) ? d.moeda : 'BRL';
    r.refPorMoeda[m] = arred2(r.refPorMoeda[m] + refBRL(d, cot).valor);
    somarNoMapa(r.porResponsavel, d.responsavel || '—', d, cot);
    somarNoMapa(r.porPagador, d.quemPagou || '—', d, cot);
    somarNoMapa(r.porCategoria, d.categoria || 'Outros', d, cot);
    somarNoMapa(r.porDia, dia(d.dataCompra), d, cot);
  }

  return r;
}

function somarNoMapa(mapa, chave, d, cot) {
  if (!mapa.has(chave)) mapa.set(chave, somaVazia());
  somarDespesa(mapa.get(chave), d, cot);
}

/** Ordena um mapa de somas pela referência em reais (maior primeiro). */
export function ordenarMapa(mapa) {
  return Array.from(mapa.entries()).sort((a, b) => b[1].ref - a[1].ref);
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

/* ---------------- Cartões e pagadores ---------------- */

/** "Nubank (Norma)" → { nome: 'Nubank', dono: 'Norma' }. Sem parênteses, sem dono. */
export function separarCartao(texto) {
  const t = String(texto || '').trim();
  const m = t.match(/^(.*?)\s*\(([^()]+)\)\s*$/);
  return m ? { nome: m[1].trim(), dono: m[2].trim() } : { nome: t, dono: '' };
}

export function listaCartoes(v) {
  return ((v.config && v.config.cartoes) || []).map(separarCartao).filter(c => c.nome);
}

/** Cartões que aparecem para quem pagou: os dele e os ainda sem dono. */
export function cartoesDe(v, pessoa) {
  return listaCartoes(v).filter(c => !c.dono || mesmaPessoa(c.dono, pessoa)).map(c => c.nome);
}

/** Terceiro (Nice, Ana, outro): paga sempre em dinheiro e em dólar, e gera dívida. */
export function ehTerceiro(v, nome) {
  const p = (v.pessoas || []).find(x => mesmaPessoa(x.nome, nome));
  return Boolean(p && p.geraAcerto);
}

/** A ponte instalada já sabe cadastrar (1.1.0 ou mais nova)? */
export function ponteCadastra(v) {
  return ponteMinima(v, 1, 1);
}

/** A ponte instalada é pelo menos a versão maior.menor? */
export function ponteMinima(v, maior, menor) {
  const [a, b] = String(v.versaoApi || '0.0').split('.').map(Number);
  return a > maior || (a === maior && b >= menor);
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

/* ---------------- Pagamento ligado às dívidas ---------------- */

/**
 * Tudo o que o motor fez com um pagamento: a conversão para a moeda
 * da dívida e, pela ordem FIFO, cada dívida abatida.
 */
export function efeitoDoPagamento(v, a) {
  const aplic = (v.aplicacoes || [])
    .filter(x => x.acertoId === a.id)
    .map(x => {
      const ob = (v.obrigacoes || []).find(o => o.id === x.obrigacaoId) || null;
      return {
        ap: x,
        ob,
        origem: ob ? origemDaObrigacao(v, ob) : { titulo: 'Dívida ' + x.obrigacaoId, categoria: '', data: x.data },
        quitou: num(x.saldoPosterior) <= 0.004
      };
    })
    .sort((x, y) => String(x.origem.data).localeCompare(String(y.origem.data)));

  const moedaDivida = a.moedaObrigacao || (aplic[0] && aplic[0].ap.moeda) || '';
  const liquidado = num(a.valorLiquidado);
  const aplicado = arred2(aplic.reduce((s, x) => s + num(x.ap.valorAplicado), 0));
  const sobra = liquidado > 0 ? Math.max(0, arred2(liquidado - aplicado)) : 0;

  // Obrigações novas que o motor criou por causa deste pagamento.
  const geradas = (v.obrigacoes || []).filter(o => String(o.origemId || '').split(':')[0] === a.id);
  const internas = geradas.filter(o => normalizar(o.tipoOrigem) === 'pagamento por conta');
  const credito = geradas.filter(o => normalizar(o.tipoOrigem) === 'excesso de acerto');

  // Saldo de hoje das dívidas que este pagamento atingiu.
  const devedores = a.porConta === 'Ambos' || !a.porConta ? ['João', 'Norma'] : [a.porConta];
  const grupos = (v.saldosConta || []).filter(g =>
    mesmaPessoa(g.credor, a.credor) && g.moeda === moedaDivida && devedores.some(dv => mesmaPessoa(dv, g.devedor)));
  const saldoHoje = arred2(grupos.reduce((s, g) => s + num(g.saldo), 0));

  const convertido = a.moedaPagamento && moedaDivida && a.moedaPagamento !== moedaDivida;

  return {
    moedaDivida,
    liquidado,
    convertido,
    cotacao: num(a.cotacao),
    aplic,
    aplicado,
    sobra,
    internas,
    credito,
    saldoHoje,
    temGrupo: grupos.length > 0
  };
}

/** Pagamentos que abateram uma obrigação (para a ligação no outro sentido). */
export function pagamentosDaObrigacao(v, obrigacaoId) {
  return (v.aplicacoes || [])
    .filter(x => x.obrigacaoId === obrigacaoId)
    .map(x => ({ ap: x, acerto: (v.acertos || []).find(a => a.id === x.acertoId) || null }));
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
