// HISTÓRICO: localiza fatos. Lista compacta; detalhe ao tocar.

import { visao } from '../dados.js';
import { cabecalho, abrirFolha, vazio } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, moeda, normalizar, dia, hojeDia, diaSemana, hora } from '../util.js';
import { refBRL, infoViagem, somaVazia, somarDespesa, soReais } from '../calculos.js';
import { textoSoma } from '../valores.js';
import { abrirDetalheDespesa } from './detalhe.js';

const filtro = {
  busca: '',
  periodo: 'tudo',
  categoria: '',
  responsavel: '',
  quemPagou: '',
  moeda: '',
  cartao: ''
};

const PERIODOS = [
  { valor: 'tudo', rotulo: 'Toda a viagem' },
  { valor: 'hoje', rotulo: 'Hoje' },
  { valor: '7dias', rotulo: 'Últimos 7 dias' },
  { valor: 'antes', rotulo: 'Antes da viagem' },
  { valor: 'durante', rotulo: 'Durante a viagem' }
];

const DIMENSOES = [
  { campo: 'categoria', rotulo: 'Categoria' },
  { campo: 'responsavel', rotulo: 'De quem' },
  { campo: 'quemPagou', rotulo: 'Quem pagou' },
  { campo: 'moeda', rotulo: 'Moeda' },
  { campo: 'cartao', rotulo: 'Cartão' }
];

function aplicarFiltros(v) {
  const termo = normalizar(filtro.busca);
  const hoje = hojeDia();
  const seteDias = new Date();
  seteDias.setDate(seteDias.getDate() - 6);
  const limite7 = dia(seteDias);
  const inicio = v.config.viagemInicio;

  return v.despesas.filter(d => {
    const diaD = dia(d.dataCompra);

    if (filtro.periodo === 'hoje' && diaD !== hoje) return false;
    if (filtro.periodo === '7dias' && diaD < limite7) return false;
    if (filtro.periodo === 'antes' && !(inicio && diaD < inicio)) return false;
    if (filtro.periodo === 'durante' && !(inicio && diaD >= inicio)) return false;

    for (const dim of DIMENSOES) {
      if (filtro[dim.campo] && normalizar(d[dim.campo]) !== normalizar(filtro[dim.campo])) return false;
    }

    if (termo) {
      const texto = normalizar([d.descricao, d.local, d.observacao, d.categoria, d.cartao, d.quemPagou, d.responsavel, String(d.valorOriginal).replace('.', ',')].join(' '));
      if (!texto.includes(termo)) return false;
    }

    return true;
  }).sort((a, b) => String(b.dataCompra).localeCompare(String(a.dataCompra)));
}

function seloDespesa(d) {
  if (d._fila === 'recusada') return '<span class="selo selo-erro">' + icone('alerta', 12, 2.6) + 'Recusada</span>';
  if (d._avisoEdicaoRecusada) return '<span class="selo selo-erro">' + icone('alerta', 12, 2.6) + 'Alteração recusada</span>';
  if (d._fila) return '<span class="selo selo-alerta">' + icone('relogio', 12, 2.6) + 'Na fila de envio</span>';

  const status = normalizar(d.status);
  if (status.includes('saldo insuficiente')) return '<span class="selo selo-erro">Sem saldo em espécie</span>';
  if (status.includes('indisponivel')) return '<span class="selo selo-neutro">Cotação pendente</span>';
  return '';
}

function rotuloDia(diaISO, inicio) {
  const hoje = hojeDia();
  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);
  const prefixo = diaISO === hoje ? 'HOJE · ' : diaISO === dia(ontem) ? 'ONTEM · ' : inicio && diaISO < inicio ? 'ANTES DA VIAGEM · ' : '';
  return prefixo + diaSemana(diaISO).toUpperCase();
}

function htmlLista(v) {
  const lista = aplicarFiltros(v);
  const total = lista.reduce((s, d) => somarDespesa(s, d, v.cotacoes), somaVazia());

  if (!lista.length) {
    return '<p class="resumo-filtro">Nenhuma despesa encontrada</p>' +
      vazio('busca', 'Nada por aqui', algumFiltro() ? 'Experimente limpar a busca ou os filtros.' : 'As despesas lançadas aparecem aqui.');
  }

  const grupos = new Map();
  for (const d of lista) {
    const chave = dia(d.dataCompra);
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(d);
  }

  let html = '<p class="resumo-filtro">' + lista.length + (lista.length === 1 ? ' despesa' : ' despesas') + ' · ' + esc(textoSoma(total)) +
    (!soReais(total) ? ' <span class="suave">(≈ ' + esc(moeda(total.ref)) + ')</span>' : '') + '</p>';

  for (const [chave, itens] of grupos) {
    const soma = itens.reduce((s, d) => somarDespesa(s, d, v.cotacoes), somaVazia());
    html += '<section class="grupo-dia">' +
      '<div class="grupo-topo"><h2>' + esc(rotuloDia(chave, v.config.viagemInicio)) + '</h2><span>' + esc(textoSoma(soma)) + '</span></div>' +
      '<ul class="lista">' +
      itens.map(d => {
        const terceiro = (v.pessoas || []).find(p => normalizar(p.nome) === normalizar(d.quemPagou) && p.geraAcerto);
        return '<li><button type="button" class="item" data-despesa="' + esc(d.id) + '">' +
          '<span class="item-ic">' + iconeCategoria(d.categoria, 20) + '</span>' +
          '<span class="item-meio">' +
            '<span class="item-titulo">' + esc(d.descricao) + '</span>' +
            '<span class="item-sub">' + (hora(d.dataCompra) !== '00:00' ? esc(hora(d.dataCompra)) + ' · ' : '') + 'pagou ' + esc(d.quemPagou) + ' · ' + esc(d.responsavel) + '</span>' +
            (terceiro ? '<span class="selo selo-neutro">Gera acerto com ' + esc(terceiro.nome) + '</span>' : '') +
            seloDespesa(d) +
          '</span>' +
          '<span class="item-dir">' +
            '<span class="item-valor">' + esc(moeda(d.valorOriginal, d.moeda)) + '</span>' +
            (d.moeda !== 'BRL' ? '<span class="item-sub">≈ ' + esc(moeda(refBRL(d, v.cotacoes).valor)) + '</span>' : '') +
          '</span>' +
        '</button></li>';
      }).join('') +
      '</ul></section>';
  }

  return html;
}

function algumFiltro() {
  return filtro.busca || filtro.periodo !== 'tudo' || DIMENSOES.some(d => filtro[d.campo]);
}

function htmlChips() {
  const periodo = PERIODOS.find(p => p.valor === filtro.periodo);
  return '<div class="chips">' +
    '<button type="button" class="chip' + (filtro.periodo !== 'tudo' ? ' ativo' : '') + '" data-filtro="periodo">' + esc(periodo.rotulo) + icone('baixo', 14, 2.4) + '</button>' +
    DIMENSOES.map(dim =>
      '<button type="button" class="chip' + (filtro[dim.campo] ? ' ativo' : '') + '" data-filtro="' + dim.campo + '">' +
      esc(filtro[dim.campo] ? dim.rotulo + ': ' + filtro[dim.campo] : dim.rotulo) + icone('baixo', 14, 2.4) + '</button>'
    ).join('') +
    (algumFiltro() ? '<button type="button" class="chip chip-limpar" data-limpar>' + icone('fechar', 14, 2.4) + 'Limpar</button>' : '') +
  '</div>';
}

function abrirEscolha(raiz, campo) {
  const v = visao();
  let opcoes;
  let titulo;

  if (campo === 'periodo') {
    titulo = 'Período';
    opcoes = PERIODOS;
  } else {
    const dim = DIMENSOES.find(d => d.campo === campo);
    titulo = dim.rotulo;
    const valores = Array.from(new Set(v.despesas.map(d => d[campo]).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    opcoes = [{ valor: '', rotulo: 'Todos' }].concat(valores.map(x => ({ valor: x, rotulo: x })));
  }

  abrirFolha({
    titulo,
    html: '<div class="opcoes">' + opcoes.map(o =>
      '<button type="button" class="opcao' + (String(filtro[campo]) === String(o.valor) ? ' ativo' : '') + '" data-valor="' + esc(o.valor) + '">' +
      '<span>' + esc(o.rotulo) + '</span>' + (String(filtro[campo]) === String(o.valor) ? icone('check', 20, 2.6) : '') + '</button>'
    ).join('') + '</div>',
    montar: (corpo, fechar) => {
      corpo.addEventListener('click', ev => {
        const b = ev.target.closest('[data-valor]');
        if (!b) return;
        filtro[campo] = b.getAttribute('data-valor');
        fechar();
        atualizar(raiz);
      });
    }
  });
}

function atualizar(raiz) {
  const v = visao();
  raiz.querySelector('#chips').innerHTML = htmlChips();
  raiz.querySelector('#lista-historico').innerHTML = htmlLista(v);
}

export const telaHistorico = {
  aba: 'historico',

  render() {
    const v = visao();
    return cabecalho({ titulo: 'Histórico', sobre: infoViagem(v.config).rotulo }) +
      '<div class="busca">' + icone('busca', 18, 2.2) +
        '<input type="search" id="busca" aria-label="Buscar despesas" placeholder="Buscar descrição, local ou valor" value="' + esc(filtro.busca) + '" autocomplete="off">' +
      '</div>' +
      '<div id="chips">' + htmlChips() + '</div>' +
      '<div id="lista-historico">' + htmlLista(v) + '</div>';
  },

  montar(raiz) {
    const busca = raiz.querySelector('#busca');
    let espera = null;
    busca.addEventListener('input', () => {
      filtro.busca = busca.value;
      clearTimeout(espera);
      espera = setTimeout(() => {
        raiz.querySelector('#lista-historico').innerHTML = htmlLista(visao());
        raiz.querySelector('#chips').innerHTML = htmlChips();
      }, 180);
    });

    raiz.addEventListener('click', ev => {
      const item = ev.target.closest('[data-despesa]');
      if (item) return abrirDetalheDespesa(item.getAttribute('data-despesa'));

      const chip = ev.target.closest('[data-filtro]');
      if (chip) return abrirEscolha(raiz, chip.getAttribute('data-filtro'));

      if (ev.target.closest('[data-limpar]')) {
        filtro.busca = '';
        filtro.periodo = 'tudo';
        DIMENSOES.forEach(d => { filtro[d.campo] = ''; });
        busca.value = '';
        atualizar(raiz);
      }
    });
  },

  aoMudarDados(raiz) {
    if (!raiz || !raiz.querySelector('#lista-historico')) return;
    atualizar(raiz);
  }
};

