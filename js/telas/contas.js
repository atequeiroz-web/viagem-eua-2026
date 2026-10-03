// CONTAS: quem deve a quem, sempre na moeda original.
//
// A tela principal mostra só uma linha curta por conta. Tocar na
// conta abre a tela dela: o que gerou a dívida, os pagamentos que a
// abateram e o botão de pagar. Os pagamentos registrados ficam num
// card próprio, que abre a lista (decisão do usuário: "cards que
// abrem", 03/10/2026).

import { estado, visao } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, vazio, renderizar } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, moeda, num, arred2, dataCurta, mesmaPessoa } from '../util.js';
import {
  gruposAbertos, gruposLiquidados, obrigacoesDoGrupo, origemDaObrigacao, posicaoDoUsuario
} from '../calculos.js';
import { abrirDetalheDespesa } from './detalhe.js';
import { abrirPagamento, htmlLigacaoCurta, situacaoPagamento } from './pagamento.js';

let aba = 'abertas';

function linhasMoeda(mapa) {
  const itens = Object.entries(mapa).filter(([, v]) => v > 0.004);
  if (!itens.length) return '<div class="pos-valor pos-zero">Nada</div>';
  return itens.map(([cod, v]) => '<div class="pos-valor">' + esc(moeda(v, cod)) + '</div>').join('');
}

function chaveDoGrupo(g) {
  return g.devedor + '|' + g.credor + '|' + g.moeda;
}

function grupoPelaChave(v, chave) {
  return (v.saldosConta || []).find(g => chaveDoGrupo(g) === chave) || null;
}

/** Pagamentos que abateram as dívidas de uma conta, com quanto abateu cada um. */
function pagamentosDoGrupo(v, obrigs) {
  const ids = new Set(obrigs.map(o => o.id));
  const porAcerto = new Map();
  (v.aplicacoes || []).filter(x => ids.has(x.obrigacaoId)).forEach(x => {
    porAcerto.set(x.acertoId, arred2((porAcerto.get(x.acertoId) || 0) + num(x.valorAplicado)));
  });
  return Array.from(porAcerto.entries())
    .map(([id, abatido]) => ({ a: v.acertos.find(x => x.id === id), abatido }))
    .filter(x => x.a)
    .sort((x, y) => String(y.a.data).localeCompare(String(x.a.data)));
}

/* =================== Tela principal: uma linha por conta =================== */

function linhaConta(g, aberta) {
  const minha = mesmaPessoa(g.devedor, estado.usuario) || mesmaPessoa(g.credor, estado.usuario);
  return '<a href="#/conta/' + encodeURIComponent(chaveDoGrupo(g)) + '" class="cartao conta-linha' + (minha ? ' conta-minha' : '') + '">' +
    '<span class="conta-linha-meio">' +
      '<span class="conta-linha-titulo">' + esc(g.devedor) + ' deve a ' + esc(g.credor) + '</span>' +
      '<span class="conta-linha-sub">' + (aberta
        ? (num(g.liquidado) > 0 ? 'já pagou <span class="nw">' + esc(moeda(g.liquidado, g.moeda)) + '</span>' : num(g.quantidade) + (num(g.quantidade) === 1 ? ' dívida' : ' dívidas'))
        : 'quitada') + '</span>' +
    '</span>' +
    '<span class="conta-linha-valor">' + esc(moeda(aberta ? g.saldo : g.originado, g.moeda)) + '</span>' +
    icone('direita', 18, 2.4) +
  '</a>';
}

function cardPagamentos(v) {
  const lista = v.acertos.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (!lista.length) return '';
  const ultimo = lista[0];
  const sit = situacaoPagamento(ultimo);

  return '<a href="#/pagamentos" class="cartao card-link">' +
    '<div class="card-link-topo"><h2 class="cartao-titulo">Pagamentos registrados</h2>' + icone('direita', 20, 2.4) + '</div>' +
    '<div class="card-link-corpo">' +
      '<div class="linha-curta"><span>Último: ' + esc(ultimo.recursosDe) + ' pagou ' + esc(moeda(ultimo.valorPago, ultimo.moedaPagamento)) + '</span>' +
      '<span class="selo ' + sit.classe + '">' + sit.texto + '</span></div>' +
      '<p class="card-link-rodape">' + lista.length + (lista.length === 1 ? ' pagamento' : ' pagamentos') + ' · toque para ver quanto cada um abateu</p>' +
    '</div>' +
  '</a>';
}

export const telaContas = {
  aba: 'contas',
  vivo: true,

  render() {
    const v = visao();
    const abertas = gruposAbertos(v);
    const liquidadas = gruposLiquidados(v);
    const pos = posicaoDoUsuario(v, estado.usuario);
    const naFila = estado.fila.filter(o => o.tipo === 'acerto.criar' && o.estado !== 'recusada').length;
    const lista = aba === 'abertas' ? abertas : liquidadas;

    return cabecalho({
      sobre: 'QUEM DEVE A QUEM',
      titulo: 'Contas',
      direita: '<button type="button" class="botao-icone" data-ir="/mais" aria-label="Mais opções">' + icone('menu', 24, 2.4) + '</button>'
    }) +
    '<div class="posicao">' +
      '<div class="pos pos-receber"><div class="pos-rotulo">' + esc(estado.usuario) + ' tem a receber</div>' + linhasMoeda(pos.receber) + '</div>' +
      '<div class="pos pos-pagar"><div class="pos-rotulo">' + esc(estado.usuario) + ' deve</div>' + linhasMoeda(pos.pagar) + '</div>' +
    '</div>' +
    (naFila
      ? '<div class="faixa faixa-alerta">' + icone('relogio', 18, 2.2) + '<span>' + naFila + (naFila === 1 ? ' pagamento aguarda' : ' pagamentos aguardam') + ' envio. Os saldos mudam depois que a planilha calcular.</span></div>'
      : '') +
    segmento('aba-contas', [
      { valor: 'abertas', rotulo: 'Em aberto (' + abertas.length + ')' },
      { valor: 'liquidadas', rotulo: 'Quitadas (' + liquidadas.length + ')' }
    ], aba, 'seg-abas') +
    (lista.length
      ? '<div class="contas-lista">' + lista.map(g => linhaConta(g, aba === 'abertas')).join('') + '</div>'
      : vazio('check', aba === 'abertas' ? 'Nenhuma conta em aberto' : 'Nenhuma conta quitada ainda',
          aba === 'abertas' ? 'Quando alguém pagar algo que é de outra pessoa, a dívida aparece aqui.' : '')) +
    cardPagamentos(v) +
    (abertas.length
      ? '<div class="area-botao"><a href="#/acerto" class="botao botao-primario botao-grande">' + icone('maos', 20, 2) + ' Registrar pagamento</a></div>'
      : '');
  },

  montar(raiz) {
    ligarSegmento(raiz, 'aba-contas', valor => {
      aba = valor;
      renderizar(true);
    });
  }
};

/* =================== Uma conta =================== */

export const telaConta = {
  aba: 'contas',
  vivo: true,

  render(params) {
    const v = visao();
    const g = grupoPelaChave(v, params.chave);
    if (!g) {
      return cabecalho({ titulo: 'Conta', voltarPara: '/contas' }) +
        vazio('check', 'Conta não encontrada', 'Ela pode ter sido quitada e recalculada. Volte para Contas.');
    }

    const aberta = num(g.saldo) > 0.004;
    const obrigs = obrigacoesDoGrupo(v, g);
    const pags = pagamentosDoGrupo(v, obrigs);
    const pct = num(g.originado) > 0 ? Math.round(num(g.liquidado) / num(g.originado) * 100) : 0;

    return cabecalho({ titulo: g.devedor + ' deve a ' + g.credor, sobre: 'CONTA', voltarPara: '/contas' }) +
      '<section class="cartao conta">' +
        '<div class="rotulo">' + (aberta ? 'FALTA PAGAR' : 'QUITADA') + '</div>' +
        '<div class="conta-valor">' + esc(moeda(aberta ? g.saldo : g.originado, g.moeda)) + '</div>' +
        '<div class="conta-prog"><span>Pago ' + esc(moeda(g.liquidado, g.moeda)) + ' de ' + esc(moeda(g.originado, g.moeda)) + '</span>' +
          (num(g.refSaldo) > 0 && g.moeda !== 'BRL' && aberta ? '<span>≈ ' + esc(moeda(g.refSaldo)) + '</span>' : '') + '</div>' +
        '<div class="conta-barra"><div style="width:' + Math.min(100, pct) + '%"></div></div>' +
        (aberta ? '<a href="#/acerto/' + encodeURIComponent(chaveDoGrupo(g)) + '" class="botao botao-primario botao-grande conta-pagar">' + icone('maos', 20, 2) + ' Registrar pagamento</a>' : '') +
      '</section>' +

      '<h2 class="secao-titulo">O que gerou a dívida</h2>' +
      '<ul class="lista">' + obrigs.map(o => {
        const origem = origemDaObrigacao(v, o);
        const temDespesa = o.tipoOrigem === 'Despesa';
        return '<li>' + (temDespesa ? '<button type="button" class="item item-compacto" data-despesa="' + esc(o.origemId) + '">' : '<div class="item item-compacto item-estatico">') +
          '<span class="item-ic">' + (origem.icone ? icone(origem.icone, 18) : iconeCategoria(origem.categoria, 18)) + '</span>' +
          '<span class="item-meio"><span class="item-titulo">' + esc(origem.titulo) + '</span>' +
          '<span class="item-sub">' + esc(dataCurta(origem.data)) + ' · ' + esc(moeda(o.valorOriginal, o.moeda)) + '</span></span>' +
          '<span class="item-dir"><span class="selo ' + (o.status === 'Liquidada' ? 'selo-ok' : o.status === 'Parcial' ? 'selo-alerta' : 'selo-neutro') + '">' +
          esc(o.status === 'Parcial' ? 'falta ' + moeda(o.saldo, o.moeda) : o.status) + '</span></span>' +
          (temDespesa ? '</button>' : '</div>') + '</li>';
      }).join('') + '</ul>' +

      (pags.length
        ? '<h2 class="secao-titulo">Pagamentos que abateram</h2>' +
          '<div class="conta-pags">' + pags.map(({ a, abatido }) =>
            '<button type="button" class="det-pag" data-pagamento="' + esc(a.id) + '">' + icone('maos', 16, 2) +
            '<span>' + esc(dataCurta(a.data)) + ': ' + esc(a.recursosDe) + ' pagou <span class="nw">' + esc(moeda(a.valorPago, a.moedaPagamento)) + '</span>' +
            ' → abateu <span class="nw">' + esc(moeda(abatido, g.moeda)) + '</span></span>' + icone('direita', 16, 2.2) + '</button>'
          ).join('') + '</div>'
        : '');
  },

  montar(raiz) {
    raiz.addEventListener('click', ev => {
      const pag = ev.target.closest('[data-pagamento]');
      if (pag) {
        abrirPagamento(pag.getAttribute('data-pagamento'));
        return;
      }
      const d = ev.target.closest('[data-despesa]');
      if (d) abrirDetalheDespesa(d.getAttribute('data-despesa'));
    });
  }
};

/* =================== Pagamentos registrados =================== */

export const telaPagamentos = {
  aba: 'contas',
  vivo: true,

  render() {
    const v = visao();
    const lista = v.acertos.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));

    return cabecalho({ titulo: 'Pagamentos', sobre: 'REGISTRADOS', voltarPara: '/contas' }) +
      (lista.length
        ? lista.map(a => {
            const sit = situacaoPagamento(a);
            return '<button type="button" class="cartao cartao-pag" data-pagamento="' + esc(a.id) + '">' +
              '<div class="pag-topo">' +
                '<span class="pag-titulos"><span class="item-titulo">' + esc(a.recursosDe) + ' pagou ' + esc(a.credor) + '</span>' +
                '<span class="item-sub">' + esc(dataCurta(a.data)) + ' · ' + esc(a.descricao) + '</span></span>' +
                '<span class="selo ' + sit.classe + '">' + sit.texto + '</span>' +
              '</div>' +
              htmlLigacaoCurta(v, a) +
              (a.status === 'Erro' && a.observacao ? '<div class="item-sub texto-erro">' + esc(a.observacao) + '</div>' : '') +
              (a._fila === 'recusada' ? '<div class="item-sub texto-erro">' + esc(a._motivo) + '</div>' : '') +
            '</button>';
          }).join('')
        : vazio('maos', 'Nenhum pagamento ainda', 'Os pagamentos de dívidas aparecem aqui.'));
  },

  montar(raiz) {
    raiz.addEventListener('click', ev => {
      const pag = ev.target.closest('[data-pagamento]');
      if (pag) abrirPagamento(pag.getAttribute('data-pagamento'));
    });
  }
};
