// RELATÓRIOS: as despesas uma a uma, agrupadas, com subtotais.
//
// Resumo mostra totais; relatório lista. Decisões do usuário
// (03/10/2026): quatro relatórios prontos (extrato completo, por
// pessoa, por cartão, dívidas e pagamentos) + um montado na hora com
// filtros. Só na tela (sem PDF). Mesmo formato do resto do app:
// cada grupo é um card curto com o subtotal; tocar abre os itens.

import { visao } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, renderizar, vazio } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, moeda, num, arred2, dia, diaSemana, dataCurta, normalizar, mesmaPessoa } from '../util.js';
import {
  despesasValidas, refBRL, somaVazia, somarDespesa, ORDEM_MOEDAS,
  obrigacoesDoGrupo, origemDaObrigacao
} from '../calculos.js';
import { htmlSomaGrande, htmlSomaCompacta } from '../valores.js';
import { abrirDetalheDespesa } from './detalhe.js';
import { abrirPagamento } from './pagamento.js';

const abertos = new Set();          // grupos abertos (chave = relatório + grupo)
let pessoaSel = '';                 // relatório por pessoa
let cartaoSel = '';                 // relatório por cartão
let filtrosAbertos = true;      // card de filtros do relatório montado
const filtro = { de: '', ate: '', pessoa: '', pagou: '', categoria: '', cartao: '', moeda: '', agrupar: 'dia' };

const NOMES_MOEDA = { USD: 'Dólar', BRL: 'Real', PYG: 'Guarani' };

/* =================== Lista dos relatórios =================== */

const PRONTOS = [
  ['/relatorio/extrato', 'Extrato completo', 'Todas as despesas, dia a dia, com o subtotal de cada dia.', 'historico', 'ceu'],
  ['/relatorio/pessoa', 'Por pessoa', 'O que é de cada um, com a metade das compartilhadas.', 'usuario', 'violeta'],
  ['/relatorio/cartao', 'Por cartão', 'As compras de cada cartão, para conferir a fatura.', 'contas', 'mar'],
  ['/relatorio/dividas', 'Dívidas e pagamentos', 'Cada conta como um extrato: o que gerou, o que foi pago e quanto falta.', 'maos', 'ambar'],
  ['/relatorio/montar', 'Montar relatório', 'Escolha período, pessoa, categoria, cartão e moeda.', 'busca', 'ardosia']
];

export const telaRelatorios = {
  aba: 'resumo',
  render() {
    return cabecalho({ titulo: 'Relatórios', voltarPara: '/resumo' }) +
      PRONTOS.map(([rota, titulo, texto, ic, tom]) =>
        '<a href="#' + rota + '" class="cartao card-link rel-item tom-' + tom + '">' +
          '<span class="item-ic">' + icone(ic, 20) + '</span>' +
          '<span class="rel-item-meio"><span class="cartao-titulo">' + esc(titulo) + '</span><span class="rel-item-texto">' + esc(texto) + '</span></span>' +
          icone('direita', 20, 2.4) +
        '</a>'
      ).join('');
  }
};

/* =================== Peças comuns =================== */

/** Total do relatório: cada moeda à parte + quanto representou em reais. */
function cartaoTotal(titulo, s, extra = '') {
  return '<section class="cartao rel-total">' +
    '<div class="rotulo">' + esc(titulo) + ' · ' + s.quantidade + (s.quantidade === 1 ? ' despesa' : ' despesas') + '</div>' +
    htmlSomaGrande(s, { classe: 'sv-rel' }) +
    extra +
  '</section>';
}

/** Linha de uma despesa dentro de um grupo. fator = 0,5 nas compartilhadas do relatório por pessoa. */
function linhaDespesa(d, cot, { sub = '', valorTexto = '' } = {}) {
  const r = refBRL(d, cot);
  return '<li><button type="button" class="item item-compacto" data-despesa="' + esc(d.id) + '">' +
    '<span class="item-ic">' + iconeCategoria(d.categoria, 18) + '</span>' +
    '<span class="item-meio"><span class="item-titulo">' + esc(d.descricao) + '</span>' +
    '<span class="item-sub">' + esc(sub) + '</span></span>' +
    '<span class="item-dir"><span class="item-valor">' + esc(valorTexto || moeda(d.valorOriginal, d.moeda)) + '</span>' +
    (d.moeda !== 'BRL' && !valorTexto ? '<span class="item-sub">≈ ' + esc(moeda(r.valor)) + '</span>' : '') +
    '</span></button></li>';
}

/** Card de grupo: cabeçalho com subtotal; tocando, abre os itens. */
function cartaoGrupo(chave, titulo, s, itensHtml, { icone: ic = '', sub = '' } = {}) {
  const aberto = abertos.has(chave);
  return '<section class="cartao rel-grupo' + (aberto ? ' aberto' : '') + '">' +
    '<button type="button" class="rel-grupo-topo" data-grupo="' + esc(chave) + '" aria-expanded="' + aberto + '">' +
      (ic ? '<span class="rel-grupo-ic">' + ic + '</span>' : '') +
      '<span class="rel-grupo-meio"><span class="rel-grupo-titulo">' + esc(titulo) + '</span>' +
      '<span class="rel-grupo-sub">' + (sub || (s.quantidade + (s.quantidade === 1 ? ' despesa' : ' despesas'))) + '</span></span>' +
      htmlSomaCompacta(s, { classe: 'rel-grupo-valor' }) +
      icone(aberto ? 'baixo' : 'direita', 18, 2.4) +
    '</button>' +
    (aberto ? '<ul class="lista lista-simples rel-itens">' + itensHtml + '</ul>' : '') +
  '</section>';
}

function ligarGrupos(raiz) {
  raiz.addEventListener('click', ev => {
    const g = ev.target.closest('[data-grupo]');
    if (g) {
      const chave = g.getAttribute('data-grupo');
      if (abertos.has(chave)) abertos.delete(chave);
      else abertos.add(chave);
      renderizar(true);
      return;
    }
    const d = ev.target.closest('[data-despesa]');
    if (d) { abrirDetalheDespesa(d.getAttribute('data-despesa')); return; }
    const p = ev.target.closest('[data-pagamento]');
    if (p) abrirPagamento(p.getAttribute('data-pagamento'));
  });
}

function ordenarPorData(lista) {
  return lista.slice().sort((a, b) => String(a.dataCompra).localeCompare(String(b.dataCompra)));
}

/** Agrupa despesas por uma chave, mantendo a ordem de chegada das chaves. */
function agrupar(lista, chaveDe) {
  const mapa = new Map();
  for (const d of lista) {
    const k = chaveDe(d);
    if (!mapa.has(k)) mapa.set(k, []);
    mapa.get(k).push(d);
  }
  return mapa;
}

function somaDe(lista, cot) {
  return lista.reduce((s, d) => somarDespesa(s, d, cot), somaVazia());
}

function subDespesa(d, { comData = false } = {}) {
  return [
    comData ? dataCurta(d.dataCompra) : '',
    'pagou ' + d.quemPagou,
    normalizar(d.responsavel) === 'compartilhada' ? 'compartilhada' : 'de ' + d.responsavel
  ].filter(Boolean).join(' · ');
}

/* =================== 1. Extrato completo =================== */

export const telaRelExtrato = {
  aba: 'resumo',
  vivo: true,
  render() {
    const v = visao();
    const lista = ordenarPorData(despesasValidas(v));
    const inicio = v.config.viagemInicio || '';
    const grupos = agrupar(lista, d => dia(d.dataCompra));

    return cabecalho({ titulo: 'Extrato completo', sobre: 'RELATÓRIO', voltarPara: '/relatorios' }) +
      cartaoTotal('TOTAL DA VIAGEM', somaDe(lista, v.cotacoes)) +
      (lista.length
        ? Array.from(grupos.entries()).map(([chave, itens]) =>
            cartaoGrupo('extrato|' + chave,
              diaSemana(chave) + (inicio && chave < inicio ? ' · antes da viagem' : ''),
              somaDe(itens, v.cotacoes),
              itens.map(d => linhaDespesa(d, v.cotacoes, { sub: d.categoria + ' · ' + subDespesa(d) })).join(''))
          ).join('')
        : vazio('historico', 'Nenhuma despesa ainda', ''));
  },
  montar: ligarGrupos
};

/* =================== 2. Por pessoa =================== */

/** A parte da pessoa numa despesa, pela regra do motor (metade João, resto Norma). */
function parteDe(d, pessoa) {
  if (normalizar(d.responsavel) === 'compartilhada') {
    const v = num(d.valorOriginal);
    const joao = arred2(v / 2);
    return mesmaPessoa(pessoa, 'João') ? joao : mesmaPessoa(pessoa, 'Norma') ? arred2(v - joao) : 0;
  }
  return mesmaPessoa(d.responsavel, pessoa) ? num(d.valorOriginal) : 0;
}

export const telaRelPessoa = {
  aba: 'resumo',
  vivo: true,
  render() {
    const v = visao();
    if (!pessoaSel) pessoaSel = 'João';
    const lista = ordenarPorData(despesasValidas(v)).filter(d => parteDe(d, pessoaSel) > 0);

    // Despesa "fatiada": só a parte da pessoa entra nas somas.
    const fatias = lista.map(d => {
      const parte = parteDe(d, pessoaSel);
      const fator = num(d.valorOriginal) > 0 ? parte / num(d.valorOriginal) : 0;
      return { d, parte, fator };
    });
    const somar = itens => itens.reduce((s, f) => somarDespesa(s, f.d, v.cotacoes, f.fator), somaVazia());
    const grupos = new Map();
    fatias.forEach(f => {
      const k = f.d.categoria || 'Outros';
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(f);
    });
    const ordem = Array.from(grupos.entries()).sort((a, b) => somar(b[1]).ref - somar(a[1]).ref);

    return cabecalho({ titulo: 'Por pessoa', sobre: 'RELATÓRIO', voltarPara: '/relatorios' }) +
      segmento('pessoa-rel', ['João', 'Norma'], pessoaSel) +
      cartaoTotal('PARTE DE ' + pessoaSel.toUpperCase(), somar(fatias),
        '<p class="nota-pequena">Inclui tudo o que é de ' + esc(pessoaSel) + ' e a metade das despesas compartilhadas, antes e durante a viagem.</p>') +
      (ordem.length
        ? ordem.map(([cat, itens]) =>
            cartaoGrupo('pessoa|' + pessoaSel + '|' + cat, cat, somar(itens),
              itens.map(f => {
                const compart = normalizar(f.d.responsavel) === 'compartilhada';
                return linhaDespesa(f.d, v.cotacoes, {
                  sub: dataCurta(f.d.dataCompra) + ' · pagou ' + f.d.quemPagou + (compart ? ' · metade de ' + moeda(f.d.valorOriginal, f.d.moeda) : ''),
                  valorTexto: compart ? moeda(f.parte, f.d.moeda) : ''
                });
              }).join(''),
              { icone: iconeCategoria(cat, 18) })
          ).join('')
        : vazio('usuario', 'Nada para ' + pessoaSel, ''));
  },
  montar(raiz) {
    ligarSegmento(raiz, 'pessoa-rel', valor => { pessoaSel = valor; renderizar(true); });
    ligarGrupos(raiz);
  }
};

/* =================== 3. Por cartão =================== */

function ehCartao(d) {
  return normalizar(d.formaPagamento).includes('cartao');
}

export const telaRelCartao = {
  aba: 'resumo',
  vivo: true,
  render() {
    const v = visao();
    const comCartao = ordenarPorData(despesasValidas(v)).filter(ehCartao);
    const cartoes = Array.from(new Set(comCartao.map(d => d.cartao || 'Cartão não informado')));
    if (!cartoes.includes(cartaoSel)) cartaoSel = cartoes[0] || '';
    const lista = comCartao.filter(d => (d.cartao || 'Cartão não informado') === cartaoSel);
    const grupos = agrupar(lista, d => dia(d.dataCompra));

    const faturaInformada = lista.filter(d => num(d.valorEfetivo) > 0 && d.moeda !== 'BRL');
    const somaFatura = arred2(faturaInformada.reduce((s, d) => s + num(d.valorEfetivo), 0));

    return cabecalho({ titulo: 'Por cartão', sobre: 'RELATÓRIO', voltarPara: '/relatorios' }) +
      (cartoes.length
        ? '<div class="rel-escolha"><label class="rotulo" for="rel-cartao">CARTÃO</label>' +
            '<div class="selecao"><select id="rel-cartao" class="entrada">' +
            cartoes.map(c => '<option' + (c === cartaoSel ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
            '</select>' + icone('baixo', 18, 2.2) + '</div></div>' +
          cartaoTotal('COMPRAS NESTE CARTÃO', somaDe(lista, v.cotacoes),
            faturaInformada.length
              ? '<p class="nota-pequena">Valor da fatura já informado em ' + faturaInformada.length + (faturaInformada.length === 1 ? ' compra' : ' compras') + ': <strong>' + esc(moeda(somaFatura)) + '</strong>.</p>'
              : '<p class="nota-pequena">Quando a fatura chegar, informe o valor de cada compra no detalhe dela.</p>') +
          Array.from(grupos.entries()).map(([chave, itens]) =>
            cartaoGrupo('cartao|' + cartaoSel + '|' + chave, diaSemana(chave), somaDe(itens, v.cotacoes),
              itens.map(d => linhaDespesa(d, v.cotacoes, {
                sub: d.categoria + ' · ' + subDespesa(d) + (num(d.valorEfetivo) > 0 && d.moeda !== 'BRL' ? ' · fatura ' + moeda(d.valorEfetivo) : '')
              })).join(''))
          ).join('')
        : vazio('contas', 'Nenhuma compra no cartão', 'As despesas pagas com cartão aparecem aqui, separadas por cartão.'));
  },
  montar(raiz) {
    const sel = raiz.querySelector('#rel-cartao');
    if (sel) sel.addEventListener('change', () => { cartaoSel = sel.value; renderizar(true); });
    ligarGrupos(raiz);
  }
};

/* =================== 4. Dívidas e pagamentos =================== */

/** Extrato de uma conta: dívidas (+) e pagamentos (−) em ordem, com o saldo. */
function extratoDaConta(v, g) {
  const obrigs = obrigacoesDoGrupo(v, g);
  const ids = new Set(obrigs.map(o => o.id));
  const mov = [];

  obrigs.forEach(o => {
    const origem = origemDaObrigacao(v, o);
    mov.push({ data: String(o.dataOrigem || ''), tipo: 'divida', valor: num(o.valorOriginal), titulo: origem.titulo, despesa: o.tipoOrigem === 'Despesa' ? o.origemId : '' });
  });

  const porAcerto = new Map();
  (v.aplicacoes || []).filter(x => ids.has(x.obrigacaoId)).forEach(x => {
    porAcerto.set(x.acertoId, arred2((porAcerto.get(x.acertoId) || 0) + num(x.valorAplicado)));
  });
  porAcerto.forEach((valor, acertoId) => {
    const a = (v.acertos || []).find(x => x.id === acertoId);
    mov.push({
      data: String(a ? a.data : ''), tipo: 'pagamento', valor, acertoId,
      titulo: a ? a.recursosDe + ' pagou ' + moeda(a.valorPago, a.moedaPagamento) + ' (' + a.descricao + ')' : 'Pagamento'
    });
  });

  mov.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === 'divida' ? -1 : 1));
  let saldo = 0;
  mov.forEach(m => {
    saldo = arred2(saldo + (m.tipo === 'divida' ? m.valor : -m.valor));
    m.saldo = saldo;
  });
  return mov;
}

export const telaRelDividas = {
  aba: 'resumo',
  vivo: true,
  render() {
    const v = visao();
    const grupos = (v.saldosConta || [])
      .filter(g => num(g.originado) > 0)
      // Em aberto primeiro; entre elas, a maior em reais (as moedas são diferentes).
      .sort((a, b) => (num(b.saldo) > 0.004) - (num(a.saldo) > 0.004) || num(b.refSaldo || b.refOriginada) - num(a.refSaldo || a.refOriginada));

    return cabecalho({ titulo: 'Dívidas e pagamentos', sobre: 'RELATÓRIO', voltarPara: '/relatorios' }) +
      '<p class="secao-ajuda">Cada conta funciona como um extrato: a dívida soma, o pagamento abate, na moeda da dívida.</p>' +
      (grupos.length
        ? grupos.map(g => {
            const chave = 'dividas|' + g.devedor + '|' + g.credor + '|' + g.moeda;
            const aberto = abertos.has(chave);
            const quitada = !(num(g.saldo) > 0.004);
            const mov = aberto ? extratoDaConta(v, g) : [];
            return '<section class="cartao rel-grupo' + (aberto ? ' aberto' : '') + '">' +
              '<button type="button" class="rel-grupo-topo" data-grupo="' + esc(chave) + '" aria-expanded="' + aberto + '">' +
                '<span class="rel-grupo-meio"><span class="rel-grupo-titulo">' + esc(g.devedor) + ' deve a ' + esc(g.credor) + '</span>' +
                '<span class="rel-grupo-sub">' + (quitada ? 'quitada' : 'pago ' + esc(moeda(g.liquidado, g.moeda)) + ' de ' + esc(moeda(g.originado, g.moeda))) + '</span></span>' +
                '<span class="svc rel-grupo-valor"><span class="svc-1">' + esc(quitada ? 'quitada' : moeda(g.saldo, g.moeda)) + '</span>' +
                (!quitada ? '<span class="svc-ref">falta</span>' : '') + '</span>' +
                icone(aberto ? 'baixo' : 'direita', 18, 2.4) +
              '</button>' +
              (aberto
                ? '<div class="extrato">' +
                    '<div class="extrato-cab"><span>Data · lançamento</span><span>Valor</span><span>Saldo</span></div>' +
                    mov.map(m =>
                      '<button type="button" class="extrato-linha extrato-' + m.tipo + '"' +
                        (m.despesa ? ' data-despesa="' + esc(m.despesa) + '"' : m.acertoId ? ' data-pagamento="' + esc(m.acertoId) + '"' : ' disabled') + '>' +
                        '<span class="extrato-desc"><span class="extrato-data">' + esc(dataCurta(m.data)) + '</span>' + esc(m.titulo) + '</span>' +
                        '<span class="extrato-valor">' + (m.tipo === 'divida' ? '+ ' : '− ') + esc(moeda(m.valor, g.moeda)) + '</span>' +
                        '<span class="extrato-saldo">' + esc(moeda(m.saldo, g.moeda)) + '</span>' +
                      '</button>'
                    ).join('') +
                  '</div>'
                : '') +
            '</section>';
          }).join('')
        : vazio('check', 'Nenhuma dívida nesta viagem', ''));
  },
  montar: ligarGrupos
};

/* =================== 5. Montar relatório =================== */

function opcoesSelect(lista, atual, rotuloTodos) {
  return '<option value="">' + esc(rotuloTodos) + '</option>' +
    lista.map(([valor, rotulo]) => '<option value="' + esc(valor) + '"' + (valor === atual ? ' selected' : '') + '>' + esc(rotulo) + '</option>').join('');
}

function campoSelect(id, rotulo, html) {
  return '<div class="rel-campo"><label class="rotulo" for="' + id + '">' + esc(rotulo) + '</label>' +
    '<div class="selecao"><select id="' + id + '" class="entrada">' + html + '</select>' + icone('baixo', 18, 2.2) + '</div></div>';
}

function aplicarFiltro(v) {
  return ordenarPorData(despesasValidas(v)).filter(d => {
    const dd = dia(d.dataCompra);
    if (filtro.de && dd < filtro.de) return false;
    if (filtro.ate && dd > filtro.ate) return false;
    if (filtro.pessoa && normalizar(d.responsavel) !== normalizar(filtro.pessoa)) return false;
    if (filtro.pagou && !mesmaPessoa(d.quemPagou, filtro.pagou)) return false;
    if (filtro.categoria && d.categoria !== filtro.categoria) return false;
    if (filtro.cartao && d.cartao !== filtro.cartao) return false;
    if (filtro.moeda && d.moeda !== filtro.moeda) return false;
    return true;
  });
}

function quantosFiltros() {
  return ['de', 'ate', 'pessoa', 'pagou', 'categoria', 'cartao', 'moeda'].filter(k => filtro[k]).length;
}

export const telaRelMontar = {
  aba: 'resumo',
  vivo: true,
  render() {
    const v = visao();
    const todas = despesasValidas(v);
    const pessoas = (v.pessoas || []).filter(p => p.ativo).map(p => p.nome);
    const categorias = Array.from(new Set((v.categorias || []).concat(todas.map(d => d.categoria)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const cartoes = Array.from(new Set(todas.map(d => d.cartao).filter(Boolean)));
    const lista = aplicarFiltro(v);

    const chaves = {
      dia: d => dia(d.dataCompra),
      categoria: d => d.categoria || 'Outros',
      pessoa: d => d.responsavel || '—',
      cartao: d => ehCartao(d) ? (d.cartao || 'Cartão não informado') : (d.formaPagamento || '—')
    };
    const grupos = agrupar(lista, chaves[filtro.agrupar] || chaves.dia);
    const tituloGrupo = k => filtro.agrupar === 'dia' ? diaSemana(k) : k;
    const n = quantosFiltros();

    const resumoFiltros = [
      filtro.de || filtro.ate ? (filtro.de ? dataCurta(filtro.de + 'T12:00:00') : '…') + ' a ' + (filtro.ate ? dataCurta(filtro.ate + 'T12:00:00') : '…') : '',
      filtro.pessoa ? 'de ' + filtro.pessoa : '',
      filtro.pagou ? 'pagou ' + filtro.pagou : '',
      filtro.categoria, filtro.cartao, filtro.moeda
    ].filter(Boolean).join(' · ') || 'Nenhum filtro: todas as despesas';
    const nomesAgrupar = { dia: 'dia', categoria: 'categoria', pessoa: 'pessoa', cartao: 'pagamento' };

    return cabecalho({ titulo: 'Montar relatório', sobre: 'RELATÓRIO', voltarPara: '/relatorios' }) +
      '<section class="cartao rel-filtros' + (filtrosAbertos ? ' aberto' : '') + '">' +
        '<button type="button" class="rel-filtros-topo" data-filtros aria-expanded="' + filtrosAbertos + '">' +
          '<span class="rel-grupo-meio"><span class="cartao-titulo">Filtros' + (n ? ' (' + n + ')' : '') + '</span>' +
          '<span class="rel-grupo-sub">' + esc(resumoFiltros) + ' · agrupado por ' + nomesAgrupar[filtro.agrupar] + '</span></span>' +
          icone(filtrosAbertos ? 'baixo' : 'direita', 18, 2.4) +
        '</button>' +
        (filtrosAbertos
          ? '<div class="rel-filtros-corpo">' +
              '<div class="rel-datas">' +
                '<div class="rel-campo"><label class="rotulo" for="f-de">DE</label><input id="f-de" class="entrada" type="date" value="' + esc(filtro.de) + '"></div>' +
                '<div class="rel-campo"><label class="rotulo" for="f-ate">ATÉ</label><input id="f-ate" class="entrada" type="date" value="' + esc(filtro.ate) + '"></div>' +
              '</div>' +
              campoSelect('f-pessoa', 'DE QUEM É', opcoesSelect([['João', 'João'], ['Norma', 'Norma'], ['Compartilhada', 'Compartilhada']], filtro.pessoa, 'Todas')) +
              campoSelect('f-pagou', 'QUEM PAGOU', opcoesSelect(pessoas.map(p => [p, p]), filtro.pagou, 'Todos')) +
              campoSelect('f-categoria', 'CATEGORIA', opcoesSelect(categorias.map(c => [c, c]), filtro.categoria, 'Todas')) +
              campoSelect('f-cartao', 'CARTÃO', opcoesSelect(cartoes.map(c => [c, c]), filtro.cartao, 'Todos')) +
              campoSelect('f-moeda', 'MOEDA', opcoesSelect(ORDEM_MOEDAS.map(m => [m, NOMES_MOEDA[m] + ' (' + m + ')']), filtro.moeda, 'Todas')) +
              '<div class="rotulo rotulo-espaco">AGRUPAR POR</div>' +
              segmento('agrupar', [
                { valor: 'dia', rotulo: 'Dia' }, { valor: 'categoria', rotulo: 'Categoria' },
                { valor: 'pessoa', rotulo: 'Pessoa' }, { valor: 'cartao', rotulo: 'Pagamento' }
              ], filtro.agrupar, 'seg-pequeno seg-quebra') +
              '<div class="rel-filtros-acoes">' +
                (n ? '<button type="button" class="botao botao-secundario" data-limpar-filtros>Limpar filtros</button>' : '') +
                '<button type="button" class="botao botao-primario" data-ver-resultado>Ver resultado</button>' +
              '</div>' +
            '</div>'
          : '') +
      '</section>' +
      cartaoTotal('RESULTADO', somaDe(lista, v.cotacoes)) +
      (lista.length
        ? Array.from(grupos.entries()).map(([k, itens]) =>
            cartaoGrupo('montar|' + filtro.agrupar + '|' + k, tituloGrupo(k), somaDe(itens, v.cotacoes),
              itens.map(d => linhaDespesa(d, v.cotacoes, { sub: subDespesa(d, { comData: filtro.agrupar !== 'dia' }) })).join(''),
              filtro.agrupar === 'categoria' ? { icone: iconeCategoria(k, 18) } : {})
          ).join('')
        : vazio('busca', 'Nada com esses filtros', 'Tente tirar algum filtro.'));
  },
  montar(raiz) {
    const ligar = (id, campo) => {
      const el = raiz.querySelector('#' + id);
      if (el) el.addEventListener('change', () => { filtro[campo] = el.value; renderizar(true); });
    };
    ligar('f-de', 'de'); ligar('f-ate', 'ate'); ligar('f-pessoa', 'pessoa'); ligar('f-pagou', 'pagou');
    ligar('f-categoria', 'categoria'); ligar('f-cartao', 'cartao'); ligar('f-moeda', 'moeda');
    ligarSegmento(raiz, 'agrupar', valor => { filtro.agrupar = valor; renderizar(true); });
    const topo = raiz.querySelector('[data-filtros]');
    if (topo) topo.addEventListener('click', () => { filtrosAbertos = !filtrosAbertos; renderizar(true); });
    const ver = raiz.querySelector('[data-ver-resultado]');
    if (ver) ver.addEventListener('click', () => {
      filtrosAbertos = false;
      renderizar(true);
      const alvo = document.querySelector('.rel-total');
      if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    const limpar = raiz.querySelector('[data-limpar-filtros]');
    if (limpar) limpar.addEventListener('click', () => {
      Object.assign(filtro, { de: '', ate: '', pessoa: '', pagou: '', categoria: '', cartao: '', moeda: '' });
      renderizar(true);
    });
    ligarGrupos(raiz);
  }
};
