// RESUMO: o dinheiro que já saiu, dia após dia.
//
// A tela principal mostra só cards curtos, um por assunto, cada um
// com o número principal. Tocar num card abre aquele assunto em tela
// própria (decisão do usuário: "cards que abrem", 03/10/2026).
//
// Cada moeda é somada à parte (US$ em destaque, R$ e ₲ abaixo).
// Em letra menor, quanto aquilo representou em reais pela cotação
// do dia de cada despesa (referência congelada, só informativa).

import { estado, visao } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, renderizar } from '../ui.js';
import { icone, iconeCategoria, corCategoria } from '../icones.js';
import { esc, moeda, num, dia, hojeDia, diasEntre, diaSemana, tempoRelativo, mesmaPessoa } from '../util.js';
import {
  resumoDe, ordenarMapa, infoViagem, gruposAbertos, dividirPorFase, partePorPessoa,
  somaVazia, juntarSomas, ORDEM_MOEDAS, soReais
} from '../calculos.js';
import { htmlSomaGrande, htmlSomaCompacta, htmlSomaLinha, textoSoma } from '../valores.js';
import { resumoDoMapa } from './mapa.js';

let escopo = 'viagem';        // viagem | geral (tela "Para onde foi o dinheiro")
let todasCategorias = false;

const CORES = {
  joao: 'var(--c-joao)',
  norma: 'var(--c-norma)'
};

function corPessoa(nome, i) {
  const chave = String(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return CORES[chave] || ['var(--c-extra1)', 'var(--c-extra2)', 'var(--c-extra3)'][i % 3];
}

function dados() {
  const v = visao();
  const viagem = infoViagem(v.config);
  const fases = dividirPorFase(v);
  return {
    v,
    viagem,
    fases,
    rViagem: resumoDe(fases.viagem, v.cotacoes),
    rAntes: resumoDe(fases.antes, v.cotacoes)
  };
}

/** Card que abre um assunto: título, resumo curto e a seta. */
function cardLink(rota, titulo, corpo, rotulo, { tom = '', ic = '' } = {}) {
  return '<a href="#' + rota + '" class="cartao card-link' + (tom ? ' tom-' + tom : '') + '" aria-label="' + esc(rotulo || titulo) + '">' +
    '<div class="card-link-topo"><div class="card-link-titulo">' + (ic ? '<span class="tom-bolha">' + icone(ic, 18, 2) + '</span>' : '') +
    '<h2 class="cartao-titulo">' + esc(titulo) + '</h2></div>' + icone('direita', 20, 2.4) + '</div>' +
    '<div class="card-link-corpo">' + corpo + '</div>' +
  '</a>';
}

function rodape() {
  return '<p class="rodape-dados">' + icone('nuvem', 15, 2) + ' Planilha lida ' + esc(tempoRelativo(estado.ultimaSync)) + '</p>';
}

/* =================== Tela principal: só os cards =================== */

export const telaResumo = {
  aba: 'resumo',
  vivo: true,

  render() {
    const { v, viagem, rViagem, rAntes, fases } = dados();
    const listaGeral = fases.viagem.concat(fases.antes);

    return cabecalho({
      sobre: viagem.rotulo,
      titulo: 'Resumo',
      direita: '<button type="button" class="botao-icone" data-ir="/mais" aria-label="Mais opções">' + icone('menu', 24, 2.4) + '</button>'
    }) +
    cartaoViagem(v, rViagem, viagem) +
    cardDias(v, rViagem, viagem) +
    cardMapa(v) +
    cardTotal(v, rAntes, rViagem) +
    cardContas(v) +
    cardDinheiro(v, listaGeral) +
    cardEspecie(v) +
    cardLink('/relatorios', 'Relatórios',
      '<p class="card-link-texto">Extrato completo, por pessoa, por cartão, dívidas e pagamentos, ou montado com filtros.</p>',
      '', { tom: 'mar', ic: 'historico' }) +
    rodape();
  }
};

function cardDias(v, r, viagem) {
  const inicio = v.config.viagemInicio;
  const fim = v.config.viagemFim;
  if (!inicio || !fim) return '';

  if (viagem.fase === 'antes') {
    return cardLink('/resumo/dias', 'Dia a dia',
      '<p class="card-link-texto">Começa em ' + esc(diaSemana(inicio)) + ', dia da saída.</p>', '', { tom: 'ceu', ic: 'calendario' });
  }

  const linhas = linhasDosDias(v, r).slice().reverse().slice(0, 2);
  return cardLink('/resumo/dias', 'Dia a dia',
    linhas.map(l =>
      '<div class="mini-dia">' +
        '<span class="mini-dia-nome">' + esc(diaSemana(l.chave)) + '</span>' +
        (l.valor.quantidade ? htmlSomaCompacta(l.valor, { semRef: true, classe: 'mini-dia-valor' }) : '<span class="mini-dia-valor">—</span>') +
      '</div>'
    ).join('') +
    '<p class="card-link-rodape">Somado até agora: <strong>' + htmlSomaLinha(linhas.length ? linhas[0].acumulado : somaVazia()) + '</strong></p>',
    'Dia a dia, gasto de cada dia e total somado', { tom: 'ceu', ic: 'calendario' });
}

function cardMapa(v) {
  const m = resumoDoMapa(v);
  return cardLink('/mapa', 'Mapa da viagem',
    m.quantidade
      ? '<div class="linha-curta"><span>' + m.quantidade + (m.quantidade === 1 ? ' lugar marcado' : ' lugares marcados') + '</span></div>' +
        '<p class="card-link-rodape">Último: <strong>' + esc(m.ultimo.local || m.ultimo.descricao) + '</strong></p>'
      : '<p class="card-link-texto">Cada despesa com local vira um marco no mapa, ligado na ordem do trajeto.</p>',
    'Mapa da viagem', { tom: 'mar', ic: 'pin' });
}

function cardTotal(v, rAntes, rViagem) {
  const geral = juntarSomas(rAntes.tot, rViagem.tot);
  return cardLink('/resumo/total', 'Antes da viagem e total geral',
    '<div class="linha-curta"><span>Antes da viagem</span>' + (rAntes.quantidade ? htmlSomaCompacta(rAntes.tot, { semRef: true }) : '<strong>—</strong>') + '</div>' +
    '<div class="linha-curta linha-curta-forte"><span>Total geral</span>' + htmlSomaCompacta(geral, { semRef: true }) + '</div>' +
    (!soReais(geral) ? '<p class="card-link-rodape">Tudo isso representa <strong>' + esc(moeda(geral.ref)) + '</strong> em reais</p>' : ''),
    '', { tom: 'anil', ic: 'aviao' });
}

function cardContas(v) {
  const grupos = gruposAbertos(v);
  if (!grupos.length) {
    return cardLink('/contas', 'Contas em aberto', '<p class="card-link-texto">Ninguém deve nada a ninguém.</p>', '', { tom: 'ambar', ic: 'maos' });
  }

  // As do usuário do aparelho primeiro.
  const minhas = g => mesmaPessoa(g.devedor, estado.usuario) || mesmaPessoa(g.credor, estado.usuario);
  const ordem = grupos.slice().sort((a, b) => Number(minhas(b)) - Number(minhas(a)));
  const mostrar = ordem.slice(0, 2);

  return cardLink('/contas', 'Contas em aberto',
    mostrar.map(g =>
      '<div class="linha-curta"><span>' + esc(g.devedor) + ' deve a ' + esc(g.credor) + '</span><strong>' + esc(moeda(g.saldo, g.moeda)) + '</strong></div>'
    ).join('') +
    (grupos.length > 2 ? '<p class="card-link-rodape">e mais ' + (grupos.length - 2) + (grupos.length - 2 === 1 ? ' conta' : ' contas') + '</p>' : ''),
    '', { tom: 'ambar', ic: 'maos' });
}

function cardDinheiro(v, lista) {
  if (!lista.length) return '';
  const r = resumoDe(lista, v.cotacoes);
  const cats = ordenarMapa(r.porCategoria).slice(0, 2);
  return cardLink('/resumo/analise', 'Para onde foi o dinheiro',
    cats.map(([nome, s]) =>
      '<div class="linha-curta"><span class="linha-curta-ic">' + iconeCategoria(nome, 16) + esc(nome) + '</span>' + htmlSomaCompacta(s, { semRef: true }) + '</div>'
    ).join('') +
    '<p class="card-link-rodape">Categorias, parte de cada um, quem pagou e moedas</p>', '', { tom: 'violeta', ic: 'sacola' });
}

function cardEspecie(v) {
  const saldos = (v.saldosMoeda || []).filter(s => num(s.quantidade) > 0);
  if (!saldos.length) return '';
  return cardLink('/fundos', 'Dinheiro em espécie',
    saldos.map(s => '<div class="linha-curta"><span>' + esc(s.pessoa) + '</span><strong>' + esc(moeda(s.quantidade, s.moeda)) + '</strong></div>').join(''),
    '', { tom: 'folha', ic: 'dinheiro' });
}

/* =================== Telas que os cards abrem =================== */

export const telaResumoDias = {
  aba: 'resumo',
  vivo: true,
  render() {
    const { v, viagem, rViagem } = dados();
    return cabecalho({ titulo: 'Dia a dia', sobre: viagem.rotulo, voltarPara: '/resumo' }) +
      cartaoDiaADia(v, rViagem, viagem) + rodape();
  }
};

export const telaResumoTotal = {
  aba: 'resumo',
  vivo: true,
  render() {
    const { v, viagem, rViagem, rAntes, fases } = dados();
    const rGeral = resumoDe(fases.viagem.concat(fases.antes), v.cotacoes);
    return cabecalho({ titulo: 'Total da viagem', sobre: viagem.rotulo, voltarPara: '/resumo' }) +
      cartaoAntes(rAntes, rViagem, v) +
      cartaoMoedas(rGeral, 'Total geral por moeda') + rodape();
  }
};

export const telaResumoAnalise = {
  aba: 'resumo',
  vivo: true,
  render() {
    const { v, viagem, fases } = dados();
    const lista = escopo === 'viagem' ? fases.viagem : fases.viagem.concat(fases.antes);
    const r = resumoDe(lista, v.cotacoes);
    return cabecalho({ titulo: 'Para onde foi o dinheiro', sobre: viagem.rotulo, voltarPara: '/resumo' }) +
      '<div class="escopo">' +
        segmento('escopo', [
          { valor: 'viagem', rotulo: 'Desde ' + rotuloInicio(v) },
          { valor: 'geral', rotulo: 'Total geral' }
        ], escopo) +
      '</div>' +
      cartaoCategorias(r) +
      cartaoPartes(lista, v, r) +
      cartaoMoedas(r, 'Por moeda') + rodape();
  },
  montar(raiz) {
    ligarSegmento(raiz, 'escopo', valor => {
      escopo = valor;
      renderizar(true);
    });
    raiz.addEventListener('click', ev => {
      if (ev.target.closest('[data-todas-categorias]')) {
        todasCategorias = !todasCategorias;
        renderizar(true);
      }
    });
  }
};

function rotuloInicio(v) {
  const i = v.config.viagemInicio;
  return i ? i.slice(8, 10) + '/' + i.slice(5, 7) : 'a viagem';
}

/** Cada dia da viagem até hoje: gasto do dia e total somado. */
function linhasDosDias(v, r) {
  const inicio = v.config.viagemInicio;
  const fim = v.config.viagemFim;
  const ultimo = hojeDia() < fim ? hojeDia() : fim;
  if (ultimo < inicio) return [];
  const n = diasEntre(inicio, ultimo) + 1;
  const linhas = [];
  let acumulado = somaVazia();
  for (let i = 0; i < n; i++) {
    const d = new Date(inicio + 'T12:00:00');
    d.setDate(d.getDate() + i);
    const chave = dia(d);
    const valor = r.porDia.get(chave) || somaVazia();
    acumulado = juntarSomas(acumulado, valor);
    linhas.push({ chave, valor, acumulado });
  }
  return linhas;
}

/* ---------------- Topo: gasto da viagem e de hoje ---------------- */

function cartaoViagem(v, r, viagem) {
  const hoje = r.porDia.get(hojeDia()) || somaVazia();

  if (viagem.fase === 'antes') {
    return '<section class="cartao-total" aria-label="Gasto da viagem">' +
      '<div class="total-rotulo">Gasto da viagem desde ' + esc(rotuloInicio(v)) + '</div>' +
      htmlSomaGrande(r.tot, { principal: 'USD', classe: 'sv-topo' }) +
      '<div class="total-info">' + esc(viagem.rotulo) + '. A contagem diária começa no dia da saída.</div>' +
    '</section>';
  }

  return '<section class="cartao-total" aria-label="Gasto da viagem">' +
    '<div class="total-rotulo">Gasto da viagem desde ' + esc(rotuloInicio(v)) + ' · ' +
      r.quantidade + (r.quantidade === 1 ? ' despesa' : ' despesas') + '</div>' +
    htmlSomaGrande(r.tot, { principal: 'USD', classe: 'sv-topo' }) +
    '<div class="total-hoje">' +
      '<div class="total-hoje-cab"><span>Hoje</span>' +
      '<span class="total-hoje-qtd">' + hoje.quantidade + (hoje.quantidade === 1 ? ' despesa' : ' despesas') + '</span></div>' +
      htmlSomaGrande(hoje, { principal: 'USD', classe: 'sv-hoje' }) +
    '</div>' +
    (r.tot.refEstimada > 0.009
      ? '<div class="total-nota">' + icone('info', 14, 2.2) + ' ' + esc(moeda(r.tot.refEstimada)) + ' da referência em reais ainda é estimativa do aparelho</div>'
      : '') +
  '</section>';
}

/* ---------------- Antes da viagem + total geral ---------------- */

function cartaoAntes(rAntes, rViagem, v) {
  const geral = juntarSomas(rAntes.tot, rViagem.tot);
  const cats = ordenarMapa(rAntes.porCategoria).slice(0, 3);

  return '<section class="cartao cartao-antes" aria-label="Antes da viagem e total geral">' +
    '<div class="antes-linha">' +
      '<div class="antes-esq"><div class="rotulo">ANTES DA VIAGEM</div>' +
      '<div class="antes-sub">' + (rAntes.quantidade
        ? cats.map(([nome, s]) => esc(nome) + ' ' + esc(textoSoma(s))).join('<br>')
        : 'Nenhuma despesa antes de ' + esc(rotuloInicio(v))) + '</div></div>' +
      htmlSomaCompacta(rAntes.tot, { classe: 'antes-valor' }) +
    '</div>' +
    '<div class="antes-geral">' +
      '<div class="rotulo">TOTAL GERAL DA VIAGEM</div>' +
      '<div class="antes-sub">antes + desde ' + esc(rotuloInicio(v)) + ', cada moeda somada à parte</div>' +
      htmlSomaGrande(geral, { principal: 'USD', classe: 'sv-geral', textoRef: 'Tudo isso representa' }) +
    '</div>' +
  '</section>';
}

/* ---------------- Dia a dia ---------------- */

function cartaoDiaADia(v, r, viagem) {
  const inicio = v.config.viagemInicio;
  const fim = v.config.viagemFim;
  if (!inicio || !fim) return '';

  if (viagem.fase === 'antes') {
    return '<section class="cartao">' +
      '<p class="texto-suave">Começa em ' + esc(diaSemana(inicio)) + ', dia da saída. Cada dia vai mostrar o gasto do dia e o total somado até ali, em cada moeda.</p>' +
    '</section>';
  }

  const linhas = linhasDosDias(v, r);
  const maior = Math.max(1, ...linhas.map(l => l.valor.ref));
  const acumulado = linhas.length ? linhas[linhas.length - 1].acumulado : somaVazia();

  // Despesas lançadas com data posterior ao último dia da viagem.
  let depois = somaVazia();
  for (const [chave, valor] of r.porDia) if (chave > fim) depois = juntarSomas(depois, valor);

  const marca = chave =>
    chave === hojeDia() ? 'hoje' : chave === inicio ? 'saída' : chave === fim ? 'volta' : '';

  return '<section class="cartao" aria-label="Gasto dia a dia">' +
    '<div class="dias-cab"><span>Dia</span><span>No dia</span><span>Somado</span></div>' +
    linhas.slice().reverse().map(l => {
      const m = marca(l.chave);
      const vazio = !l.valor.quantidade;
      return '<div class="dia-linha' + (l.chave === hojeDia() ? ' dia-hoje' : '') + '">' +
        '<div class="dia-nome"><span>' + esc(diaSemana(l.chave)) + '</span>' + (m ? '<span class="dia-marca">' + m + '</span>' : '') + '</div>' +
        '<div class="dia-valor">' + (vazio ? '<span class="svc"><span class="svc-zero">—</span></span>' : htmlSomaCompacta(l.valor)) +
          '<div class="dia-barra"><div style="width:' + (l.valor.ref ? Math.max(3, l.valor.ref / maior * 100) : 0).toFixed(1) + '%"></div></div></div>' +
        '<div class="dia-soma">' + htmlSomaCompacta(l.acumulado) + '</div>' +
      '</div>';
    }).join('') +
    (depois.quantidade
      ? '<div class="dia-linha"><div class="dia-nome"><span>depois da volta</span></div><div class="dia-valor">' + htmlSomaCompacta(depois) + '</div><div class="dia-soma">' + htmlSomaCompacta(juntarSomas(acumulado, depois)) + '</div></div>'
      : '') +
    '<p class="nota-pequena">≈ = quanto representou em reais, pela cotação de cada dia.</p>' +
  '</section>';
}

/* ---------------- Por moeda ---------------- */

function cartaoMoedas(r, titulo = 'Por moeda') {
  const nomes = { USD: 'Dólar', BRL: 'Real', PYG: 'Guarani' };
  const t = r.tot;
  if (!t.quantidade) return '';

  return '<section class="cartao" aria-label="Gasto por moeda">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">' + esc(titulo) + '</h2></div>' +
    '<div class="moedas-cab"><span>Moeda</span><span>Gasto</span><span>Em reais</span></div>' +
    ORDEM_MOEDAS.map(m =>
      '<div class="moeda-linha' + (Math.abs(t[m]) > 0.004 ? '' : ' moeda-zero') + '">' +
        '<span>' + nomes[m] + '</span>' +
        '<strong>' + esc(moeda(t[m], m)) + '</strong>' +
        '<span>' + esc(moeda(m === 'BRL' ? t.BRL : refDaMoeda(r, m))) + '</span>' +
      '</div>'
    ).join('') +
    '<div class="moeda-linha moeda-total"><span>Tudo em reais</span><strong>' + esc(moeda(t.ref)) + '</strong></div>' +
    '<p class="nota-pequena">Cada moeda é somada à parte. "Em reais" usa a cotação do dia de cada despesa, congelada: é só referência.</p>' +
  '</section>';
}

/** Parte da referência em reais que veio de uma moeda. */
function refDaMoeda(r, m) {
  return r.refPorMoeda ? r.refPorMoeda[m] : 0;
}

/* ---------------- Parte de cada um / quem pagou ---------------- */

function cartaoPartes(lista, v, r) {
  if (!r.quantidade) return '';

  const partes = ordenarMapa(partePorPessoa(lista, v.cotacoes));
  const pagadores = ordenarMapa(r.porPagador);
  const compartilhado = r.porResponsavel.get('Compartilhada');
  const base = r.tot.ref || 1;

  return '<section class="cartao">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">Parte de cada um</h2></div>' +
    '<div class="pilha" role="img" aria-label="Divisão entre as pessoas">' +
      partes.map(([nome, s], i) => '<div style="width:' + (s.ref / base * 100).toFixed(2) + '%;background:' + corPessoa(nome, i) + '"></div>').join('') +
    '</div>' +
    '<div class="legenda">' +
      partes.map(([nome, s], i) =>
        '<div class="leg-linha"><span class="leg-cor" style="background:' + corPessoa(nome, i) + '"></span>' +
        '<span class="leg-nome">' + esc(nome) + '</span>' + htmlSomaCompacta(s, { classe: 'leg-valor' }) +
        '<span class="leg-pct">' + Math.round(s.ref / base * 100) + '%</span></div>'
      ).join('') +
    '</div>' +
    '<p class="nota-pequena">' + (compartilhado
      ? 'Cada parte já inclui a metade das despesas compartilhadas (' + esc(textoSoma(compartilhado)) + ' no total). A porcentagem usa a referência em reais.'
      : 'Nenhuma despesa compartilhada neste período.') + '</p>' +
    '<div class="separador"></div>' +
    '<div class="rotulo">QUEM PAGOU</div>' +
    pagadores.map(([nome, s]) =>
      '<div class="linha-simples linha-moedas"><span>' + esc(nome) + '</span>' + htmlSomaCompacta(s) + '</div>'
    ).join('') +
  '</section>';
}

/* ---------------- Categorias ---------------- */

function cartaoCategorias(r) {
  const lista = ordenarMapa(r.porCategoria);
  if (!lista.length) return '';

  const maior = lista[0][1].ref || 1;
  const visiveis = todasCategorias ? lista : lista.slice(0, 5);

  return '<section class="cartao">' +
    '<div class="cartao-topo"><h2 class="cartao-titulo">Por categoria</h2><span class="cartao-nota">ordem pelo valor em reais</span></div>' +
    '<div class="cats">' +
    visiveis.map(([nome, s]) =>
      '<div class="cat-linha">' +
        '<span class="cat-ic">' + iconeCategoria(nome, 18) + '</span>' +
        '<div class="cat-meio"><div class="cat-topo"><span>' + esc(nome) + '</span>' + htmlSomaCompacta(s) + '</div>' +
        '<div class="cat-barra"><div style="width:' + Math.max(2, s.ref / maior * 100).toFixed(1) + '%;background:' + corCategoria(nome) + '"></div></div></div>' +
      '</div>'
    ).join('') +
    '</div>' +
    (lista.length > 5
      ? '<button type="button" class="botao-texto" data-todas-categorias>' + (todasCategorias ? 'Mostrar menos' : 'Ver todas as ' + lista.length + ' categorias') + '</button>'
      : '') +
  '</section>';
}
