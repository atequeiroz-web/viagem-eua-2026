// RESUMO: responde às perguntas principais, sem rolar listas.

import { estado, visao } from '../dados.js';
import { cabecalho } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, moeda, num, dia, hojeDia, diasEntre, diaSemana, tempoRelativo, mesmaPessoa, numeroBR } from '../util.js';
import { resumo, ordenarMapa, infoViagem, gruposAbertos } from '../calculos.js';

const CORES = {
  compartilhada: 'var(--c-compartilhada)',
  joao: 'var(--c-joao)',
  norma: 'var(--c-norma)'
};

function corPessoa(nome, i) {
  const chave = String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return CORES[chave] || ['var(--c-extra1)', 'var(--c-extra2)', 'var(--c-extra3)'][i % 3];
}

const compacto = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

let todasCategorias = false;

export const telaResumo = {
  aba: 'resumo',
  vivo: true,

  render() {
    const v = visao();
    const r = resumo(v);
    const viagem = infoViagem(v.config);
    const orcamento = num(v.config.orcamentoBRL);

    return cabecalho({
      sobre: viagem.rotulo,
      titulo: 'Resumo',
      direita: '<button type="button" class="botao-icone" data-ir="/mais" aria-label="Mais opções">' + icone('menu', 24, 2.4) + '</button>'
    }) +
    cartaoTotal(r, orcamento) +
    cartaoMoedas(r) +
    cartaoPendencias(v) +
    cartaoResponsavel(r) +
    cartaoCategorias(r) +
    cartaoDias(r, v.config, viagem) +
    cartaoEspecie(v) +
    '<p class="rodape-dados">' + icone('nuvem', 15, 2) + ' Planilha lida ' + esc(tempoRelativo(estado.ultimaSync)) + '</p>';
  },

  montar(raiz) {
    const botao = raiz.querySelector('[data-todas-categorias]');
    if (botao) {
      botao.addEventListener('click', () => {
        todasCategorias = !todasCategorias;
        const alvo = raiz.querySelector('#cartao-categorias');
        alvo.outerHTML = cartaoCategorias(resumo(visao()));
        telaResumo.montar(raiz);
      });
    }
  }
};

function cartaoTotal(r, orcamento) {
  let barra = '';

  if (orcamento > 0) {
    const pct = Math.round(r.total / orcamento * 100);
    const restante = orcamento - r.total;
    barra =
      '<div class="total-orc"><span>Orçamento ' + esc(moeda(orcamento)) + '</span><span>' + pct + '%</span></div>' +
      '<div class="total-barra"><div style="width:' + Math.min(100, pct) + '%"></div></div>' +
      '<div class="total-resto">' + (restante >= 0
        ? 'Ainda pode gastar <strong>' + esc(moeda(restante)) + '</strong>'
        : 'Passou <strong>' + esc(moeda(-restante)) + '</strong> do orçamento') + '</div>';
  }

  return '<section class="cartao-total" aria-label="Gasto total">' +
    '<div class="total-rotulo">Gasto total da viagem</div>' +
    '<div class="total-valor">' + esc(moeda(r.total)) + '</div>' +
    '<div class="total-info">' + r.quantidade + (r.quantidade === 1 ? ' despesa' : ' despesas') + ' · em reais</div>' +
    (r.estimado > 0.009
      ? '<div class="total-nota">' + icone('info', 14, 2.2) + ' Inclui ' + esc(moeda(r.estimado)) + ' estimados pela cotação do dia</div>'
      : '') +
    barra +
  '</section>';
}

function cartaoMoedas(r) {
  const itens = [['USD', 'Dólar', 'US$'], ['BRL', 'Real', 'R$'], ['PYG', 'Guarani', '₲']];
  return '<section class="grade-moedas" aria-label="Valores na moeda original">' +
    itens.map(([cod, nome, simbolo]) =>
      '<div class="mini"><div class="mini-rotulo">' + nome + ' · ' + simbolo + '</div><div class="mini-valor">' + esc(numeroBR(r.porMoeda[cod], cod === 'PYG' ? 0 : 2)) + '</div></div>'
    ).join('') +
  '</section>';
}

function cartaoPendencias(v) {
  const grupos = gruposAbertos(v);
  if (!grupos.length) return '';

  const linhas = grupos.slice(0, 5).map(g => {
    const minha = mesmaPessoa(g.devedor, estado.usuario) || mesmaPessoa(g.credor, estado.usuario);
    return '<div class="pend-linha' + (minha ? ' pend-minha' : '') + '"><span>' + esc(g.devedor) + ' deve a ' + esc(g.credor) + '</span><strong>' + esc(moeda(g.saldo, g.moeda)) + '</strong></div>';
  }).join('');

  return '<section class="cartao cartao-pend">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">Contas em aberto</h2>' +
    '<a href="#/contas" class="link-forte">Ver contas' + icone('direita', 16, 2.2) + '</a></div>' +
    linhas +
    (grupos.length > 5 ? '<div class="pend-mais">e mais ' + (grupos.length - 5) + '</div>' : '') +
  '</section>';
}

function cartaoResponsavel(r) {
  if (!r.total) return '';

  const resp = ordenarMapa(r.porResponsavel);
  const pag = ordenarMapa(r.porPagador);

  const barra = '<div class="pilha" role="img" aria-label="Divisão por responsável">' +
    resp.map(([nome, valor], i) =>
      '<div style="width:' + (valor / r.total * 100).toFixed(2) + '%;background:' + corPessoa(nome, i) + '"></div>'
    ).join('') + '</div>';

  const lista = resp.map(([nome, valor], i) =>
    '<div class="leg-linha"><span class="leg-cor" style="background:' + corPessoa(nome, i) + '"></span>' +
    '<span class="leg-nome">' + esc(nome) + '</span><span class="leg-valor">' + esc(moeda(valor)) + '</span>' +
    '<span class="leg-pct">' + Math.round(valor / r.total * 100) + '%</span></div>'
  ).join('');

  const pagadores = pag.map(([nome, valor]) =>
    '<div class="linha-simples"><span>' + esc(nome) + '</span><strong>' + esc(moeda(valor)) + '</strong></div>'
  ).join('');

  return '<section class="cartao">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">De quem é o gasto</h2><span class="cartao-nota">responsável</span></div>' +
    barra + '<div class="legenda">' + lista + '</div>' +
    '<div class="separador"></div>' +
    '<div class="rotulo">QUEM PAGOU</div>' + pagadores +
  '</section>';
}

function cartaoCategorias(r) {
  const lista = ordenarMapa(r.porCategoria);
  if (!lista.length) return '<div id="cartao-categorias"></div>';

  const maior = lista[0][1] || 1;
  const visiveis = todasCategorias ? lista : lista.slice(0, 5);

  return '<section class="cartao" id="cartao-categorias">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">Por categoria</h2><span class="cartao-nota">em reais</span></div>' +
    '<div class="cats">' +
    visiveis.map(([nome, valor]) =>
      '<div class="cat-linha">' +
        '<span class="cat-ic">' + iconeCategoria(nome, 18) + '</span>' +
        '<div class="cat-meio"><div class="cat-topo"><span>' + esc(nome) + '</span><strong>' + esc(moeda(valor)) + '</strong></div>' +
        '<div class="cat-barra"><div style="width:' + Math.max(2, valor / maior * 100).toFixed(1) + '%"></div></div></div>' +
      '</div>'
    ).join('') +
    '</div>' +
    (lista.length > 5
      ? '<button type="button" class="botao-texto" data-todas-categorias>' + (todasCategorias ? 'Mostrar menos' : 'Ver todas as ' + lista.length + ' categorias') + '</button>'
      : '') +
  '</section>';
}

function cartaoDias(r, config, viagem) {
  const inicio = config.viagemInicio;
  const fim = config.viagemFim;
  if (!inicio || !fim) return '';

  let antes = 0;
  for (const [d, valor] of r.porDia) if (d && d < inicio) antes += valor;

  if (viagem.fase === 'antes') {
    return '<section class="cartao">' +
      '<div class="cartao-topo"><h2 class="cartao-titulo">Gastos por dia</h2></div>' +
      '<p class="texto-suave">O gráfico diário começa em ' + esc(diaSemana(inicio)) + ', primeiro dia da viagem.</p>' +
      '<div class="linha-simples"><span>Gasto antes da viagem</span><strong>' + esc(moeda(antes)) + '</strong></div>' +
    '</section>';
  }

  const ultimo = hojeDia() < fim ? hojeDia() : fim;
  const n = diasEntre(inicio, ultimo) + 1;
  const dias = [];
  let soma = 0;

  for (let i = 0; i < n; i++) {
    const d = new Date(inicio + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const chave = dia(d);
    const valor = r.porDia.get(chave) || 0;
    soma += valor;
    dias.push([chave, valor]);
  }

  const maior = Math.max(1, ...dias.map(x => x[1]));
  const media = n ? soma / n : 0;

  return '<section class="cartao">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">Gastos por dia</h2><span class="cartao-nota">média ' + esc(moeda(media)) + '/dia</span></div>' +
    '<div class="barras-rolagem"><div class="barras" style="--n:' + n + '">' +
    dias.map(([chave, valor]) => {
      const hoje = chave === hojeDia();
      return '<div class="barra-col' + (hoje ? ' barra-hoje' : '') + '">' +
        '<span class="barra-valor">' + (valor ? compacto.format(valor) : '') + '</span>' +
        '<div class="barra" style="height:' + Math.max(valor ? 4 : 2, valor / maior * 100).toFixed(1) + '%"></div>' +
        '<span class="barra-dia">' + (hoje ? 'hoje' : chave.slice(8, 10) + '/' + chave.slice(5, 7)) + '</span>' +
      '</div>';
    }).join('') +
    '</div></div>' +
    (antes ? '<div class="linha-simples"><span>Gasto antes da viagem</span><strong>' + esc(moeda(antes)) + '</strong></div>' : '') +
  '</section>';
}

function cartaoEspecie(v) {
  const saldos = (v.saldosMoeda || []).filter(s => num(s.quantidade) > 0);
  if (!saldos.length && !(v.fundos || []).length) return '';

  return '<section class="cartao">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">Dinheiro em espécie</h2>' +
    '<a href="#/fundos" class="link-forte">Ver' + icone('direita', 16, 2.2) + '</a></div>' +
    (saldos.length
      ? saldos.map(s =>
          '<div class="linha-simples"><span>' + esc(s.pessoa) + '</span><strong>' + esc(moeda(s.quantidade, s.moeda)) + '</strong></div>'
        ).join('')
      : '<p class="texto-suave">Nenhum saldo em espécie no momento.</p>') +
  '</section>';
}
