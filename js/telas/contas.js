// CONTAS: quem deve a quem, sempre na moeda original.

import { estado, visao } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, vazio, renderizar } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, moeda, num, dataCurta, mesmaPessoa } from '../util.js';
import {
  gruposAbertos, gruposLiquidados, obrigacoesDoGrupo, origemDaObrigacao, posicaoDoUsuario
} from '../calculos.js';
import { abrirDetalheDespesa } from './detalhe.js';

let aba = 'abertas';
const expandidos = new Set();

function avatar(nome) {
  const n = String(nome || '?');
  const chave = n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const classe = chave === 'joao' ? 'av-joao' : chave === 'norma' ? 'av-norma' : 'av-outro';
  const letras = chave === 'joao' || chave === 'norma' ? n[0] : n.slice(0, 2);
  return '<span class="avatar ' + classe + '" aria-hidden="true">' + esc(letras) + '</span>';
}

function linhasMoeda(mapa) {
  const itens = Object.entries(mapa).filter(([, v]) => v > 0.004);
  if (!itens.length) return '<div class="pos-valor pos-zero">Nada</div>';
  return itens.map(([cod, v]) => '<div class="pos-valor">' + esc(moeda(v, cod)) + '</div>').join('');
}

function htmlGrupo(v, g, aberta) {
  const chave = g.devedor + '|' + g.credor + '|' + g.moeda;
  const obrigs = obrigacoesDoGrupo(v, g);
  const pct = num(g.originado) > 0 ? Math.round(num(g.liquidado) / num(g.originado) * 100) : 0;
  const expandido = expandidos.has(chave);
  const minha = mesmaPessoa(g.devedor, estado.usuario) || mesmaPessoa(g.credor, estado.usuario);

  return '<article class="cartao conta' + (minha ? ' conta-minha' : '') + '">' +
    '<div class="conta-topo">' +
      avatar(g.devedor) + icone('seta', 18, 2.2) + avatar(g.credor) +
      '<div class="conta-titulos">' +
        '<h2 class="conta-titulo">' + esc(g.devedor) + ' deve a ' + esc(g.credor) + '</h2>' +
        '<div class="suave">' + num(g.quantidade) + (num(g.quantidade) === 1 ? ' dívida' : ' dívidas') +
        (num(g.refSaldo) > 0 && g.moeda !== 'BRL' ? ' · ref. ' + esc(moeda(g.refSaldo)) : '') + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="conta-valor">' + esc(moeda(aberta ? g.saldo : g.originado, g.moeda)) + '</div>' +
    '<div class="conta-prog"><span>' + (aberta ? 'Falta pagar' : 'Quitada') + '</span><span>Pago ' + esc(moeda(g.liquidado, g.moeda)) + ' de ' + esc(moeda(g.originado, g.moeda)) + '</span></div>' +
    '<div class="conta-barra"><div style="width:' + Math.min(100, pct) + '%"></div></div>' +
    '<button type="button" class="botao-linha" data-expandir="' + esc(chave) + '" aria-expanded="' + expandido + '">' +
      (expandido ? 'Esconder as dívidas' : 'Ver as dívidas') + icone(expandido ? 'baixo' : 'direita', 16, 2.2) +
    '</button>' +
    (expandido
      ? '<ul class="lista lista-obrig">' + obrigs.map(o => {
          const origem = origemDaObrigacao(v, o);
          const temDespesa = o.tipoOrigem === 'Despesa';
          return '<li>' + (temDespesa ? '<button type="button" class="item item-compacto" data-despesa="' + esc(o.origemId) + '">' : '<div class="item item-compacto">') +
            '<span class="item-ic">' + (origem.icone ? icone(origem.icone, 18) : iconeCategoria(origem.categoria, 18)) + '</span>' +
            '<span class="item-meio"><span class="item-titulo">' + esc(origem.titulo) + '</span>' +
            '<span class="item-sub">' + esc(dataCurta(origem.data)) + ' · ' + esc(moeda(o.valorOriginal, o.moeda)) + '</span></span>' +
            '<span class="item-dir"><span class="selo ' + (o.status === 'Liquidada' ? 'selo-ok' : o.status === 'Parcial' ? 'selo-alerta' : 'selo-neutro') + '">' +
            esc(o.status === 'Parcial' ? 'falta ' + moeda(o.saldo, o.moeda) : o.status) + '</span></span>' +
            (temDespesa ? '</button>' : '</div>') + '</li>';
        }).join('') + '</ul>'
      : '') +
    (aberta ? '<a href="#/acerto/' + encodeURIComponent(chave) + '" class="botao botao-contorno">' + icone('maos', 18, 2) + ' Registrar pagamento</a>' : '') +
  '</article>';
}

function htmlAcertos(v) {
  const lista = v.acertos.slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));
  if (!lista.length) return '';

  return '<h2 class="secao-titulo">Pagamentos registrados</h2><ul class="lista lista-cartao">' +
    lista.map(a => {
      const status = a._fila === 'recusada' ? ['selo-erro', 'Recusado']
        : a._fila ? ['selo-alerta', 'Na fila']
        : a.status === 'Processado' ? ['selo-ok', 'Aplicado']
        : a.status === 'Erro' ? ['selo-erro', 'Erro']
        : ['selo-neutro', 'Aguardando cálculo'];

      const abateu = num(a.valorLiquidado) > 0 ? ' · abateu ' + moeda(a.valorLiquidado, a.moedaObrigacao) : '';
      const porConta = a.porConta && !mesmaPessoa(a.porConta, a.recursosDe)
        ? ' · dívida de ' + (a.porConta === 'Ambos' ? 'João e Norma' : a.porConta)
        : '';

      return '<li class="item item-estatico">' +
        '<span class="item-ic">' + icone('maos', 18) + '</span>' +
        '<span class="item-meio">' +
          '<span class="item-titulo">' + esc(a.recursosDe) + ' pagou ' + esc(a.credor) + '</span>' +
          '<span class="item-sub">' + esc(dataCurta(a.data)) + ' · ' + esc(a.descricao) + esc(porConta) + esc(abateu) + '</span>' +
          (a.status === 'Erro' && a.observacao ? '<span class="item-sub texto-erro">' + esc(a.observacao) + '</span>' : '') +
          (a._fila === 'recusada' ? '<span class="item-sub texto-erro">' + esc(a._motivo) + '</span>' : '') +
        '</span>' +
        '<span class="item-dir"><span class="item-valor">' + esc(moeda(a.valorPago, a.moedaPagamento)) + '</span>' +
        '<span class="selo ' + status[0] + '">' + status[1] + '</span></span>' +
      '</li>';
    }).join('') + '</ul>';
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
      ? '<div class="faixa faixa-alerta">' + icone('relogio', 18, 2.2) + '<span>' + naFila + (naFila === 1 ? ' pagamento aguarda' : ' pagamentos aguardam') + ' envio. Os saldos abaixo mudam depois que a planilha calcular.</span></div>'
      : '') +
    segmento('aba-contas', [
      { valor: 'abertas', rotulo: 'Em aberto (' + abertas.length + ')' },
      { valor: 'liquidadas', rotulo: 'Quitadas (' + liquidadas.length + ')' }
    ], aba, 'seg-abas') +
    (lista.length
      ? lista.map(g => htmlGrupo(v, g, aba === 'abertas')).join('')
      : vazio('check', aba === 'abertas' ? 'Nenhuma conta em aberto' : 'Nenhuma conta quitada ainda',
          aba === 'abertas' ? 'Quando alguém pagar algo que é de outra pessoa, a dívida aparece aqui.' : '')) +
    htmlAcertos(v) +
    (abertas.length
      ? '<div class="area-botao"><a href="#/acerto" class="botao botao-primario botao-grande">' + icone('maos', 20, 2) + ' Registrar pagamento</a></div>'
      : '');
  },

  montar(raiz) {
    ligarSegmento(raiz, 'aba-contas', valor => {
      aba = valor;
      renderizar(true);
    });

    raiz.addEventListener('click', ev => {
      const exp = ev.target.closest('[data-expandir]');
      if (exp) {
        const chave = exp.getAttribute('data-expandir');
        if (expandidos.has(chave)) expandidos.delete(chave);
        else expandidos.add(chave);
        renderizar(true);
        return;
      }
      const d = ev.target.closest('[data-despesa]');
      if (d) abrirDetalheDespesa(d.getAttribute('data-despesa'));
    });
  }
};
