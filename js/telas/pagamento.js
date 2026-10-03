// PAGAMENTO LIGADO ÀS DÍVIDAS.
//
// Quem paga informa só quanto pagou (em geral em reais), o quê,
// para quem e a foto. O MOTOR converte pela cotação do dia para a
// moeda da dívida (em geral dólar) e abate pelo FIFO, a mais
// antiga primeiro. Este card mostra essa ligação:
//   pagou R$ → virou US$ → quais dívidas abateu → quanto falta.

import { visao } from '../dados.js';
import { abrirFolha } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, moeda, dataCurta, simboloMoeda, numeroBR } from '../util.js';
import { efeitoDoPagamento, converter } from '../calculos.js';
import { carregarFoto, abrirDetalheDespesa } from './detalhe.js';

/** Situação do pagamento, do ponto de vista de quem olha. */
export function situacaoPagamento(a) {
  if (a._fila === 'recusada') return { classe: 'selo-erro', texto: 'Recusado', pronto: false };
  if (a._fila) return { classe: 'selo-alerta', texto: 'Na fila', pronto: false };
  if (a.status === 'Processado') return { classe: 'selo-ok', texto: 'Aplicado', pronto: true };
  if (a.status === 'Erro') return { classe: 'selo-erro', texto: 'Erro', pronto: false };
  return { classe: 'selo-neutro', texto: 'Aguardando cálculo', pronto: false };
}

function nomeDivida(a) {
  const dev = !a.porConta || a.porConta === 'Ambos' ? 'João e Norma' : a.porConta;
  return dev + ' com ' + a.credor;
}

/** "US$ 1 = R$ 5,3340" a partir da cotação gravada pelo motor. */
function textoCotacao(ef, a) {
  if (!(ef.cotacao > 0)) return '';
  return simboloMoeda(ef.moedaDivida) + ' 1 = ' + simboloMoeda(a.moedaPagamento) + ' ' + numeroBR(ef.cotacao, 4);
}

/* ---------------- Resumo do pagamento (dentro da lista de Contas) ---------------- */

/** Linha curta e visível na tela: pagou X → abateu Y → quitou N dívidas. */
export function htmlLigacaoCurta(v, a) {
  const sit = situacaoPagamento(a);
  const ef = efeitoDoPagamento(v, a);
  const pago = moeda(a.valorPago, a.moedaPagamento);

  if (!sit.pronto) {
    const est = converter(a.valorPago, a.moedaPagamento, a.moedaObrigacao, v.cotacoes);
    return '<div class="lig-curta">' +
      '<span class="lig-pago">' + esc(pago) + '</span>' + icone('seta', 16, 2.4) +
      '<span class="lig-abateu lig-pendente">' +
        (a.moedaPagamento !== a.moedaObrigacao && Number.isFinite(est)
          ? '≈ ' + esc(moeda(est, a.moedaObrigacao)) + ' <span class="suave">(estimado)</span>'
          : esc(sit.texto === 'Recusado' ? 'não aplicado' : 'a planilha vai calcular')) +
      '</span></div>';
  }

  const quitadas = ef.aplic.filter(x => x.quitou).length;
  return '<div class="lig-curta">' +
    '<span class="lig-pago">' + esc(pago) + '</span>' + icone('seta', 16, 2.4) +
    '<span class="lig-abateu">abateu <strong>' + esc(moeda(ef.liquidado, ef.moedaDivida)) + '</strong></span>' +
    '</div>' +
    '<div class="lig-curta-sub">' +
      (ef.aplic.length
        ? ef.aplic.length + (ef.aplic.length === 1 ? ' dívida' : ' dívidas') +
          (quitadas ? ' · ' + quitadas + (quitadas === 1 ? ' quitada' : ' quitadas') : '')
        : 'nenhuma dívida abatida') +
      (ef.temGrupo
        ? ' · ' + (ef.saldoHoje > 0.004 ? 'hoje falta ' + esc(moeda(ef.saldoHoje, ef.moedaDivida)) : 'dívida quitada')
        : '') +
    '</div>';
}

/* ---------------- Card completo ---------------- */

export function abrirPagamento(id) {
  const v = visao();
  const a = (v.acertos || []).find(x => x.id === id);
  if (!a) return;

  const sit = situacaoPagamento(a);
  const ef = efeitoDoPagamento(v, a);
  const convertido = a.moedaPagamento && a.moedaObrigacao && a.moedaPagamento !== a.moedaObrigacao;

  // 1) O que foi informado por quem pagou.
  const blocoPago =
    '<div class="lig-bloco">' +
      '<div class="rotulo">' + esc(String(a.recursosDe).toUpperCase()) + ' PAGOU</div>' +
      '<div class="lig-grande">' + esc(moeda(a.valorPago, a.moedaPagamento)) + '</div>' +
      '<div class="lig-linhas">' +
        '<div><span class="suave">O quê</span><span>' + esc(a.descricao) + '</span></div>' +
        (a.destinatario ? '<div><span class="suave">Para quem</span><span>' + esc(a.destinatario) + '</span></div>' : '') +
        '<div><span class="suave">Data</span><span>' + esc(dataCurta(a.data)) + '</span></div>' +
        '<div><span class="suave">Dívida</span><span>' + esc(nomeDivida(a)) + '</span></div>' +
      '</div>' +
    '</div>';

  // 2) A conversão feita pelo motor.
  let blocoConversao;
  if (sit.pronto) {
    blocoConversao =
      '<div class="lig-elo">' + icone('baixo', 18, 2.4) +
        '<span>' + (convertido
          ? 'A planilha converteu pela cotação oficial do dia' + (textoCotacao(ef, a) ? ': <strong>' + esc(textoCotacao(ef, a)) + '</strong>' : '')
          : 'Mesma moeda da dívida: não precisou converter') + '</span>' +
      '</div>' +
      '<div class="lig-bloco lig-bloco-destaque">' +
        '<div class="rotulo">ABATEU NA DÍVIDA EM ' + esc(nomeMoeda(ef.moedaDivida)) + '</div>' +
        '<div class="lig-grande">' + esc(moeda(ef.liquidado, ef.moedaDivida)) + '</div>' +
      '</div>';
  } else {
    const est = converter(a.valorPago, a.moedaPagamento, a.moedaObrigacao, v.cotacoes);
    blocoConversao =
      '<div class="lig-elo">' + icone('baixo', 18, 2.4) +
        '<span>' + (a.status === 'Erro'
          ? 'A planilha não conseguiu aplicar este pagamento' + (a.observacao ? ': ' + esc(a.observacao) : '.')
          : a._fila === 'recusada'
            ? 'A planilha recusou este pagamento' + (a._motivo ? ': ' + esc(a._motivo) : '.')
            : 'A planilha ainda vai converter e abater. ' +
              (convertido && Number.isFinite(est) ? 'Estimativa pelo aparelho: cerca de <strong>' + esc(moeda(est, a.moedaObrigacao)) + '</strong>.' : '')) +
        '</span>' +
      '</div>';
  }

  // 3) As dívidas abatidas, na ordem do FIFO.
  const blocoDividas = sit.pronto && ef.aplic.length
    ? '<div class="lig-bloco">' +
        '<div class="rotulo">DÍVIDAS ABATIDAS (A MAIS ANTIGA PRIMEIRO)</div>' +
        '<ul class="lista lista-simples">' +
        ef.aplic.map(x => {
          const ic = x.origem.icone ? icone(x.origem.icone, 18) : iconeCategoria(x.origem.categoria, 18);
          const temDespesa = x.ob && x.ob.tipoOrigem === 'Despesa';
          const tag = temDespesa ? 'button type="button" data-despesa="' + esc(x.ob.origemId) + '"' : 'div';
          return '<li><' + tag + ' class="item item-compacto' + (temDespesa ? '' : ' item-estatico') + '">' +
            '<span class="item-ic">' + ic + '</span>' +
            '<span class="item-meio"><span class="item-titulo">' + esc(x.origem.titulo) + '</span>' +
            '<span class="item-sub">' + esc(dataCurta(x.origem.data)) +
              (a.porConta === 'Ambos' ? ' · de ' + esc(x.ap.devedor) : '') + '</span></span>' +
            '<span class="item-dir"><span class="item-valor">− ' + esc(moeda(x.ap.valorAplicado, x.ap.moeda)) + '</span>' +
              (x.quitou
                ? '<span class="selo selo-ok">quitada</span>'
                : '<span class="selo selo-alerta">falta ' + esc(moeda(x.ap.saldoPosterior, x.ap.moeda)) + '</span>') +
            '</span>' +
          '</' + (temDespesa ? 'button' : 'div') + '></li>';
        }).join('') +
        '</ul>' +
      '</div>'
    : '';

  // 4) O que mais o motor registrou por causa deste pagamento.
  const extras = [];
  ef.internas.forEach(o => extras.push(
    '<strong>' + esc(o.devedor) + '</strong> passou a dever <strong>' + esc(moeda(o.valorOriginal, o.moeda)) + '</strong> a ' + esc(o.credor) +
    ', porque ' + esc(o.credor) + ' pagou essa parte no lugar.'));
  ef.credito.forEach(o => extras.push(
    'Pagou a mais: <strong>' + esc(o.devedor) + '</strong> passou a dever <strong>' + esc(moeda(o.valorOriginal, o.moeda)) + '</strong> a ' + esc(o.credor) + ' (crédito).'));
  const blocoExtras = extras.length
    ? '<div class="lig-bloco lig-bloco-aviso">' + extras.map(t => '<p>' + t + '</p>').join('') + '</div>'
    : '';

  // 5) Como a dívida está hoje.
  const blocoHoje = sit.pronto && ef.temGrupo
    ? '<div class="lig-hoje' + (ef.saldoHoje > 0.004 ? '' : ' lig-hoje-ok') + '">' +
        '<span>Dívida de ' + esc(nomeDivida(a)) + ' hoje</span>' +
        '<strong>' + (ef.saldoHoje > 0.004 ? 'falta ' + esc(moeda(ef.saldoHoje, ef.moedaDivida)) : icone('check', 16, 2.6) + ' quitada') + '</strong>' +
      '</div>'
    : '';

  const html =
    '<div class="lig-topo"><span class="selo ' + sit.classe + '">' + sit.texto + '</span>' +
      (a.lancadoPor ? '<span class="suave">lançado por ' + esc(a.lancadoPor) + '</span>' : '') + '</div>' +
    blocoPago + blocoConversao + blocoDividas + blocoExtras + blocoHoje +
    (a.comprovante
      ? '<div class="det-bloco"><div class="rotulo">COMPROVANTE</div><div class="det-foto" id="det-foto"><span class="suave">' +
        icone('atualizar', 16, 2.2, ' data-gira="1"') + ' Carregando…</span></div></div>'
      : '<p class="nota-pequena">Sem foto do comprovante.</p>') +
    (a.observacao && a.status !== 'Erro' ? '<p class="nota-pequena">Observação: ' + esc(a.observacao) + '</p>' : '') +
    '<p class="det-id">Pagamento ' + esc(a.id) + '</p>';

  abrirFolha({
    titulo: 'Pagamento',
    html,
    montar: (corpo, fechar) => {
      if (a.comprovante) carregarFoto(corpo, a.comprovante);
      corpo.addEventListener('click', ev => {
        const b = ev.target.closest('[data-despesa]');
        if (!b) return;
        fechar();
        abrirDetalheDespesa(b.getAttribute('data-despesa'));
      });
    }
  });
}

function nomeMoeda(m) {
  return { USD: 'DÓLAR', BRL: 'REAIS', PYG: 'GUARANI' }[m] || m;
}
