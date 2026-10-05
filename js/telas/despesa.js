// NOVA DESPESA / EDITAR / CORRIGIR LANÇAMENTO RECUSADO.

import { estado, visao, enfileirar, descartarOperacao, lembrarEscolhas, lerFoto, fotoDaFila } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, abrirFolha, confirmar, avisar, ir } from '../ui.js';
import { icone, iconeCategoria, rotuloCurtoCategoria } from '../icones.js';
import {
  esc, moeda, simboloMoeda, num, arred2, lerNumero, normalizar, dia,
  paraCampoDataHora, gerarId, comprimirFoto, obterLocalizacao, numeroBR, ultimoErroLocalizacao, ultimaPrecisao
} from '../util.js';
import {
  estimarBRL, cotacaoBRL, previaObrigacoes, momentoEtapa, MOMENTOS, ETAPAS,
  dadosParaEdicao, despesaComAcerto, pessoaPropria, PROTEGIDOS, cartoesDe, ehTerceiro
} from '../calculos.js';
import { abrirNovoPagador, abrirNovaCategoria, abrirNovoCartao } from './cadastros.js';

let f = null;          // estado do formulário
let modo = 'nova';     // nova | editar | corrigir
let original = null;   // dados originais (editar/corrigir)
let opOrigem = null;   // operação recusada sendo corrigida
let salvo = false;
let travado = false;   // campos financeiros bloqueados
let etapa = 1;         // 1.8.0: etapa atual do formulário (1 a 4)

/*
 * 1.8.0 (decisão do usuário, 04/10/2026): a Nova despesa em 4 etapas, com
 * "Continuar", como o Registrar pagamento. Os campos e as regras são os
 * mesmos de antes; muda só a forma de apresentar (um grupo por vez).
 * Editar e corrigir abrem direto na etapa 4 (conferir).
 */
const NOMES_PASSOS = ['Quanto e o quê', 'Quem pagou e de quem é', 'Comprovante e local', 'Conferir e salvar'];
const TOTAL_PASSOS = NOMES_PASSOS.length;

/* ---------------- Montagem do estado ---------------- */

function novoFormulario(v) {
  const pref = estado.preferencias || {};
  const formas = v.config.formasPagamento || [];
  const cartoes = cartoesDe(v, estado.usuario);
  const agora = paraCampoDataHora(new Date());
  const me = momentoEtapa(agora.slice(0, 10), v.config);

  return {
    id: gerarId('d', 9),
    valorTexto: '',
    moeda: pref.moeda || v.config.moedaPadrao || 'USD',
    descricao: '',
    categoria: '',
    quemPagou: estado.usuario,
    responsavel: 'Compartilhada',
    formaPagamento: formas.includes(pref.formaPagamento) ? pref.formaPagamento : (formas[0] || 'Cartão de Crédito'),
    cartao: cartoes.includes(pref.cartao) ? pref.cartao : (cartoes[0] || ''),
    local: '',
    gps: '',
    gpsSituacao: 'buscando',
    foto: '',
    comprovante: '',
    dataCompra: agora,
    dataUtilizacao: '',
    momento: me.momento,
    etapa: me.etapa,
    momentoManual: false,
    observacao: '',
    valorEfetivoTexto: '',
    detalhes: false
  };
}

function formularioDeDados(d, efetivo) {
  return {
    id: d.id,
    valorTexto: num(d.valorOriginal) ? numeroBR(d.valorOriginal, d.moeda === 'PYG' ? 0 : 2) : '',
    moeda: d.moeda,
    descricao: d.descricao || '',
    categoria: d.categoria || '',
    quemPagou: d.quemPagou,
    responsavel: d.responsavel,
    formaPagamento: d.formaPagamento || '',
    cartao: d.cartao || '',
    local: d.local || '',
    gps: d.gps || '',
    gpsSituacao: d.gps ? 'ok' : 'nao',
    foto: d.foto || '',
    comprovante: d.comprovante || '',
    dataCompra: paraCampoDataHora(d.dataCompra),
    dataUtilizacao: d.dataUtilizacao ? dia(d.dataUtilizacao) : '',
    momento: d.momento || '',
    etapa: d.etapa || '',
    momentoManual: true,
    observacao: d.observacao || '',
    valorEfetivoTexto: num(efetivo) > 0 ? numeroBR(efetivo, 2) : '',
    detalhes: false
  };
}

function prepararFormulario(params) {
  const v = visao();
  salvo = false;
  travado = false;
  opOrigem = null;
  original = null;

  if (params.opId) {
    modo = 'corrigir';
    opOrigem = estado.fila.find(o => o.opId === params.opId) || null;
    if (!opOrigem) return null;
    original = { ...opOrigem.dados };
    f = formularioDeDados(opOrigem.dados, opOrigem.dados.valorEfetivo);
    return f;
  }

  if (params.id) {
    modo = 'editar';
    const d = v.despesas.find(x => x.id === params.id);
    if (!d) return null;
    original = { ...dadosParaEdicao(d), valorEfetivo: d.valorEfetivo };
    travado = PROTEGIDOS.includes(d.id) || despesaComAcerto(v, d.id);
    f = formularioDeDados({ ...d, foto: '' }, d.valorEfetivo);
    return f;
  }

  modo = 'nova';
  f = novoFormulario(v);
  aplicarRegrasPagador(v);
  return f;
}

/* ---------------- Regras de quem pagou ---------------- */

function formaDinheiro(v) {
  return (v.config.formasPagamento || []).find(x => normalizar(x).includes('dinheiro')) || 'Dinheiro';
}

/**
 * Terceiro (Nice, Ana, outro) pagando: sempre dinheiro, em dólar, sem
 * cartão (decisão do usuário). Voltando para João ou Norma, volta a forma
 * de pagamento de costume e os cartões dessa pessoa.
 */
function aplicarRegrasPagador(v) {
  if (ehTerceiro(v, f.quemPagou)) {
    if (!f.formaAntesTerceiro) f.formaAntesTerceiro = f.formaPagamento;
    f.formaPagamento = formaDinheiro(v);
    f.moeda = 'USD';
    f.cartao = '';
    return;
  }

  if (f.formaAntesTerceiro) {
    f.formaPagamento = f.formaAntesTerceiro;
    f.formaAntesTerceiro = '';
  }
  const meus = cartoesDe(v, f.quemPagou);
  if (!meus.includes(f.cartao)) {
    const pref = (estado.preferencias || {}).cartao;
    f.cartao = meus.includes(pref) ? pref : (meus[0] || '');
  }
}

/* ---------------- Gorjeta (1.8.2) ----------------
   Decisão de 04/10/2026: só gorjeta, sem botão de imposto (o imposto varia
   por estado e por tipo de compra, e já vem somado no recibo). Você digita o
   total do recibo e escolhe 15%, 18%, 20% ou um valor; o valor lançado passa
   a ser recibo + gorjeta, e a conta fica anotada na observação. Só em US$ e
   só na Nova despesa (numa edição, o valor já é o total). */

const PERCENTUAIS_GORJETA = [15, 18, 20];

function gorjetaPermitida() {
  return modo === 'nova' && !travado && f.moeda === 'USD';
}

function valorGorjeta() {
  if (!f.gorjeta || !gorjetaPermitida()) return 0;
  const base = lerNumero(f.valorTexto);
  if (f.gorjeta.tipo === 'pct') return base > 0 ? arred2(base * f.gorjeta.pct / 100) : 0;
  return arred2(lerNumero(f.gorjeta.texto || ''));
}

/** Valor que será lançado: recibo + gorjeta (quando houver). */
function valorFinal() {
  return arred2(lerNumero(f.valorTexto) + valorGorjeta());
}

function textoGorjeta() {
  const g = valorGorjeta();
  if (!(g > 0)) return '';
  const rotulo = f.gorjeta.tipo === 'pct' ? 'gorjeta ' + f.gorjeta.pct + '%' : 'gorjeta';
  return 'Recibo ' + moeda(lerNumero(f.valorTexto), 'USD') + ' + ' + rotulo + ' ' + moeda(g, 'USD') + ' = ' + moeda(valorFinal(), 'USD');
}

function htmlGorjeta() {
  if (!gorjetaPermitida()) return '';
  if (!f.gorjeta && !f.gorjetaAberta) {
    return '<button type="button" class="link-forte gorjeta-link" data-gorjeta-abrir>' + icone('mais', 16, 2.4) + ' Gorjeta</button>';
  }
  const atual = !f.gorjeta ? 'sem' : f.gorjeta.tipo === 'pct' ? String(f.gorjeta.pct) : 'outro';
  const opcoes = [{ valor: 'sem', rotulo: 'Sem' }].concat(PERCENTUAIS_GORJETA.map(p => ({ valor: String(p), rotulo: p + '%' })), [{ valor: 'outro', rotulo: 'Valor' }]);
  return '<div class="gorjeta">' +
    '<div class="rotulo">GORJETA <span class="suave">(sobre o total do recibo)</span></div>' +
    segmento('gorjeta', opcoes, atual, 'seg-pequeno') +
    (atual === 'outro'
      ? '<div class="entrada-valor-pequena gorjeta-valor"><span>US$</span><input id="gorjeta-valor" class="entrada" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(f.gorjeta.texto || '') + '"></div>'
      : '') +
    '<p class="gorjeta-conta" id="gorjeta-conta">' + esc(textoGorjeta()) + '</p>' +
  '</div>';
}

/* ---------------- Sugestões por toque (1.8.0) ---------------- */

function maisRecentes(v) {
  return v.despesas.slice().sort((a, b) => String(b.dataCompra || '').localeCompare(String(a.dataCompra || '')));
}

/** Descrições já usadas (mais recentes primeiro; as da categoria escolhida antes). */
function sugestoesDescricao(v) {
  const digitado = normalizar(f.descricao);
  const vistos = new Map();
  maisRecentes(v).forEach(d => {
    const texto = String(d.descricao || '').trim();
    const k = normalizar(texto);
    if (texto && !vistos.has(k)) vistos.set(k, { texto, categoria: d.categoria || '' });
  });
  const lista = Array.from(vistos.values())
    .filter(s => normalizar(s.texto) !== digitado && (!digitado || normalizar(s.texto).includes(digitado)));
  if (f.categoria) lista.sort((a, b) => (b.categoria === f.categoria) - (a.categoria === f.categoria));
  return lista.slice(0, 5);
}

/** Locais já usados (mais recentes primeiro). */
function sugestoesLocal(v) {
  const digitado = normalizar(f.local);
  const vistos = new Map();
  maisRecentes(v).forEach(d => {
    const texto = String(d.local || '').trim();
    const k = normalizar(texto);
    if (texto && !vistos.has(k)) vistos.set(k, texto);
  });
  return Array.from(vistos.values())
    .filter(t => normalizar(t) !== digitado && (!digitado || normalizar(t).includes(digitado)))
    .slice(0, 5);
}

function htmlSugestoes(lista, atributo) {
  if (!lista.length) return '';
  return lista.map(s => {
    const texto = typeof s === 'string' ? s : s.texto;
    return '<button type="button" class="sug-chip" ' + atributo + '="' + esc(texto) + '">' + esc(texto) + '</button>';
  }).join('');
}

/* ---------------- Etapas (1.8.0) ---------------- */

function htmlProgresso() {
  let pontos = '';
  for (let i = 1; i <= TOTAL_PASSOS; i++) pontos += '<span class="' + (i < etapa ? 'feito' : i === etapa ? 'ativo' : '') + '"></span>';
  return '<div class="etapas-pontos">' + pontos + '</div>' +
    '<div class="etapas-nome">Etapa ' + etapa + ' de ' + TOTAL_PASSOS + ' · ' + esc(NOMES_PASSOS[etapa - 1]) + '</div>';
}

function htmlBarra() {
  const ultimo = etapa === TOTAL_PASSOS;
  return '<div class="barra-etapas">' +
      (etapa > 1 ? '<button type="button" class="botao botao-contorno botao-grande barra-anterior" data-anterior>' + icone('esquerda', 20, 2.4) + ' Voltar</button>' : '') +
      (ultimo
        ? '<button type="submit" class="botao botao-primario botao-grande" id="salvar">' + (modo === 'nova' ? 'Salvar despesa' : 'Salvar alterações') + '</button>'
        : '<button type="button" class="botao botao-primario botao-grande" data-continuar>Continuar</button>') +
    '</div>' +
    (ultimo ? '<p class="nota-salvar" id="nota-salvar">' + (navigator.onLine ? 'Vai direto para a planilha.' : 'Sem sinal: fica guardada no iPhone e sobe sozinha depois.') + '</p>' : '');
}

function formaTexto(v) {
  if (ehTerceiro(v, f.quemPagou)) return 'dinheiro, em dólar';
  const cartao = normalizar(f.formaPagamento).includes('cartao') && f.cartao ? ' · ' + f.cartao : '';
  return f.formaPagamento + cartao;
}

function htmlResumo(v) {
  const valor = valorFinal();
  const est = f.moeda !== 'BRL' && valor > 0 ? estimarBRL(valor, f.moeda, v.cotacoes) : 0;
  const local = (f.local.trim() || '—') + (f.gps ? ' · no mapa' : f.gpsSituacao === 'buscando' ? ' · buscando local…' : '');
  const foto = f.foto ? 'com foto' : f.comprovante ? 'já registrado' : 'sem foto';
  const linhas = [
    [1, 'Valor', moeda(valor, f.moeda) + (valorGorjeta() > 0 ? ' · com gorjeta de ' + moeda(valorGorjeta(), 'USD') : '') + (est ? ' (≈ ' + moeda(est) + ')' : '')],
    [1, 'O quê', (f.descricao.trim() || '—') + (f.categoria ? ' · ' + f.categoria : '')],
    [2, 'Quem pagou', f.quemPagou + ' · ' + formaTexto(v)],
    [2, 'De quem é', f.responsavel],
    [3, 'Comprovante', foto],
    [3, 'Local', local],
    [3, 'Quando', resumoDetalhes()]
  ];
  return '<p class="resumo-dica">Toque numa linha para corrigir.</p>' +
    linhas.map(([passo, rotulo, valorTexto]) =>
      '<button type="button" class="resumo-linha" data-passo="' + passo + '"><span class="suave">' + esc(rotulo) + '</span>' +
      '<span class="resumo-valor">' + esc(valorTexto) + '</span>' + icone('direita', 16, 2.2) + '</button>'
    ).join('') +
    htmlAviso();
}

/** Mostra uma etapa: só o grupo dela fica visível. */
function irParaEtapa(n) {
  const form = document.getElementById('form-despesa');
  if (!form || !f) return;
  etapa = Math.max(1, Math.min(TOTAL_PASSOS, n));
  form.setAttribute('data-etapa', String(etapa));
  form.querySelectorAll('[data-grupo]').forEach(g => { g.hidden = Number(g.getAttribute('data-grupo')) !== etapa; });
  form.querySelector('#etapas-topo').innerHTML = htmlProgresso();
  form.querySelector('#barra').innerHTML = htmlBarra();
  form.querySelector('#erro-despesa').textContent = '';
  if (etapa === TOTAL_PASSOS) atualizarResumo();
  window.scrollTo(0, 0);
}

function atualizarResumo() {
  const alvo = document.getElementById('resumo-despesa');
  if (alvo && f && etapa === TOTAL_PASSOS) alvo.innerHTML = htmlResumo(visao());
}

/** O que falta em cada etapa: [mensagem, seletor do campo, etapa]. */
function problemaDaEtapa(n) {
  const dados = montarDados();
  if (n === 1) {
    if (!(dados.valorOriginal > 0)) return ['Digite o valor da despesa.', '#valor', 1];
    if (!dados.descricao) return ['Escreva uma descrição curta (ou toque numa sugestão).', '#descricao', 1];
    if (!dados.categoria) return ['Escolha a categoria.', '#rotulo-categoria', 1];
  }
  if (n === 2 && !dados.formaPagamento) return ['Escolha a forma de pagamento.', '#area-forma', 2];
  if (n === 3 && !dados.dataCompra) return ['Data da compra inválida.', '#area-detalhes', 3];
  return null;
}

function mostrarProblema(raiz, problema) {
  if (problema[2] !== etapa) irParaEtapa(problema[2]);
  raiz.querySelector('#erro-despesa').textContent = problema[0];
  const alvo = raiz.querySelector(problema[1]);
  if (alvo) {
    alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (alvo.focus && alvo.tagName === 'INPUT') setTimeout(() => alvo.focus(), 300);
  }
}

/* ---------------- Pedaços da tela ---------------- */

function categoriasVisiveis(v) {
  const uso = new Map();
  v.despesas.forEach(d => uso.set(d.categoria, (uso.get(d.categoria) || 0) + 1));

  const preferidas = ['Alimentação', 'Mercado', 'Transporte', 'Passeios e ingressos', 'Compras pessoais', 'Hospedagem', 'Farmácia / Saúde'];
  const todas = v.categorias || [];
  const ordem = todas.slice().sort((a, b) => {
    const ua = (uso.get(a) || 0) - (a === 'Passagens aéreas' ? 1000 : 0);
    const ub = (uso.get(b) || 0) - (b === 'Passagens aéreas' ? 1000 : 0);
    if (ub !== ua) return ub - ua;
    const pa = preferidas.indexOf(a);
    const pb = preferidas.indexOf(b);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });

  let visiveis = ordem.slice(0, 8);
  if (f.categoria && !visiveis.includes(f.categoria)) visiveis = visiveis.slice(0, 7).concat(f.categoria);
  return { visiveis, total: todas.length };
}

function htmlCategorias(v = visao()) {
  const { visiveis, total } = categoriasVisiveis(v);
  return visiveis.map(c =>
    '<button type="button" class="cat-botao' + (f.categoria === c ? ' ativo' : '') + '" data-categoria="' + esc(c) + '" aria-pressed="' + (f.categoria === c) + '">' +
    iconeCategoria(c, 22) + '<span>' + esc(rotuloCurtoCategoria(c)) + '</span></button>'
  ).join('') +
  (total > visiveis.length
    ? '<button type="button" class="cat-botao" data-todas-categorias>' + icone('menu', 22, 2.4) + '<span>Todas</span></button>'
    : '');
}

function htmlConversao(v) {
  const valor = valorFinal();
  if (f.moeda === 'BRL') return '';
  const efetivo = lerNumero(f.valorEfetivoTexto);
  if (modo !== 'nova' && efetivo > 0) {
    return icone('recibo', 16, 2) + '<span>Valor na fatura: <strong>' + esc(moeda(efetivo)) + '</strong></span>';
  }
  const cot = cotacaoBRL(f.moeda, v.cotacoes);
  if (!cot) return '<span class="suave">Cotação ainda não disponível no aparelho.</span>';
  const fonte = v.cotacoes[f.moeda];
  const rotuloCot = f.moeda === 'PYG' ? 'R$ ' + numeroBR(cot * 1000, 2) + ' por ₲ 1.000' : 'R$ ' + numeroBR(cot, 4);
  return icone('conversor', 16, 2) + '<span>≈ <strong>' + esc(moeda(valor > 0 ? estimarBRL(valor, f.moeda, v.cotacoes) : 0)) + '</strong> · ' +
    esc(rotuloCot) + (fonte && fonte.data ? ' de ' + esc(String(fonte.data).slice(8, 10) + '/' + String(fonte.data).slice(5, 7)) : '') + '</span>';
}

function htmlAviso() {
  const valor = valorFinal();
  const lista = previaObrigacoes({ valor, moeda: f.moeda, quemPagou: f.quemPagou, responsavel: f.responsavel });

  if (!(valor > 0)) return '';

  if (!lista.length) {
    return '<div class="aviso-obrig aviso-obrig-neutro">' + icone('check', 18, 2.4) +
      '<span>Ninguém fica devendo: quem pagou é o dono da despesa.</span></div>';
  }

  return '<div class="aviso-obrig">' + icone('info', 18, 2.2) + '<span>' +
    lista.map(o => '<strong>' + esc(o.devedor) + ' passa a dever ' + esc(moeda(o.valor, o.moeda)) + ' a ' + esc(o.credor) + '.</strong>').join(' ') +
    '</span></div>';
}

function htmlCartao(v = visao()) {
  if (!normalizar(f.formaPagamento).includes('cartao')) return '';
  const cartoes = cartoesDe(v, f.quemPagou);
  const opcoes = cartoes.includes(f.cartao) || !f.cartao ? cartoes : cartoes.concat(f.cartao);
  return '<label class="rotulo rotulo-espaco" for="cartao">CARTÃO DE ' + esc(String(f.quemPagou).toUpperCase()) + '</label>' +
    '<div class="selecao">' +
      '<select id="cartao" class="entrada">' +
        '<option value="">Não informado</option>' +
        opcoes.map(c => '<option' + (c === f.cartao ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
        (!travado ? '<option value="__novo">+ Cadastrar cartão…</option>' : '') +
      '</select>' + icone('baixo', 18, 2.2) +
    '</div>';
}

function htmlMoeda(v = visao()) {
  const bloqueada = travado || ehTerceiro(v, f.quemPagou);
  return segmento('moeda', ['USD', 'BRL', 'PYG'], f.moeda, 'seg-moeda' + (bloqueada ? ' travado' : ''));
}

function htmlPagador(v = visao()) {
  const pessoas = (v.pessoas || []).filter(p => p.ativo).map(p => p.nome);
  if (f.quemPagou && !pessoas.includes(f.quemPagou)) pessoas.push(f.quemPagou);
  return segmento('quemPagou', pessoas, f.quemPagou, 'seg-quebra' + (travado ? ' travado' : '')) +
    (!travado ? '<button type="button" class="link-forte cad-link" data-novo-pagador>' + icone('mais', 16, 2.4) + ' Outro pagador</button>' : '');
}

function htmlForma(v = visao()) {
  if (ehTerceiro(v, f.quemPagou)) {
    return '<div class="aviso-obrig aviso-obrig-neutro">' + icone('dinheiro', 18, 2.2) +
      '<span>Pago por <strong>' + esc(f.quemPagou) + '</strong>: conta como <strong>dinheiro, em dólar</strong>.</span></div>';
  }
  const formas = v.config.formasPagamento && v.config.formasPagamento.length ? v.config.formasPagamento.slice() : ['Cartão de Crédito', 'Dinheiro'];
  if (f.formaPagamento && !formas.includes(f.formaPagamento)) formas.push(f.formaPagamento);
  // 1.8.0: rótulos curtos ("Crédito", "Débito") para caber numa linha só.
  const curto = x => String(x).replace(/^Cart[aã]o de /i, '');
  return segmento('formaPagamento', formas.map(x => ({ valor: x, rotulo: curto(x) })), f.formaPagamento, 'seg-quebra' + (travado ? ' travado' : '')) +
    '<div id="area-cartao">' + htmlCartao(v) + '</div>';
}

function htmlFoto() {
  if (f.foto) {
    return '<div class="foto-previa"><img src="data:image/jpeg;base64,' + f.foto + '" alt="Comprovante">' +
      '<button type="button" class="foto-remover" data-remover-foto aria-label="Remover foto">' + icone('fechar', 18, 2.4) + '</button></div>';
  }
  if (f.comprovante) {
    return '<div class="foto-previa" id="foto-existente"><span class="suave">Comprovante já registrado</span>' +
      '<label class="foto-trocar">' + icone('camera', 18, 2) + ' Trocar<input type="file" accept="image/*" data-foto hidden></label></div>';
  }
  return '<label class="foto-botao">' + icone('camera', 24, 1.8) + '<span>Foto do comprovante</span><input type="file" accept="image/*" data-foto hidden></label>';
}

function htmlGps() {
  if (f.gpsSituacao === 'buscando') return '<button type="button" class="gps gps-buscando" data-gps-cancelar>' + icone('pin', 20, 2) + '<span>Buscando local…</span><span class="gps-x">cancelar</span></button>';
  if (f.gps) return '<button type="button" class="gps gps-ok" data-gps-remover>' + icone('pin', 20, 2) + '<span>Local registrado</span>' +
    '<span class="gps-coord">' + esc(f.gps) + (f.gpsPrecisao ? ' · ±' + f.gpsPrecisao + ' m' : '') + '</span><span class="gps-x">remover</span></button>';
  return '<button type="button" class="gps" data-gps-buscar>' + icone('pin', 20, 2) + '<span>Registrar local</span></button>';
}

function htmlDetalhes(v) {
  const d = original || {};
  const mostraFatura = modo !== 'nova' && f.moeda !== 'BRL' &&
    !normalizar(f.formaPagamento).includes('dinheiro') && pessoaPropria(v, f.quemPagou);

  return '<div class="detalhes' + (f.detalhes ? ' abertos' : '') + '">' +
    '<button type="button" class="detalhes-botao" data-detalhes aria-expanded="' + f.detalhes + '">' +
      '<span>Mais detalhes</span><span class="suave">' + esc(resumoDetalhes()) + '</span>' + icone('baixo', 18, 2.2) +
    '</button>' +
    '<div class="detalhes-corpo">' +
      '<label class="rotulo" for="dataCompra">DATA E HORA DA COMPRA</label>' +
      '<input id="dataCompra" class="entrada" type="datetime-local" value="' + esc(f.dataCompra) + '"' + (travado ? ' disabled' : '') + '>' +
      '<label class="rotulo rotulo-espaco" for="dataUtilizacao">DATA DE UTILIZAÇÃO <span class="suave">(se for outra)</span></label>' +
      '<input id="dataUtilizacao" class="entrada" type="date" value="' + esc(f.dataUtilizacao) + '">' +
      '<div class="rotulo rotulo-espaco">MOMENTO</div>' +
      segmento('momento', MOMENTOS.map(m => ({ valor: m, rotulo: m.replace(' de viajar', '').replace(' a viagem', '').replace(' de voltar', '') })), f.momento, 'seg-pequeno') +
      '<div class="rotulo rotulo-espaco">ETAPA</div>' +
      segmento('etapa', [{ valor: '', rotulo: '—' }].concat(ETAPAS), f.etapa, 'seg-pequeno') +
      '<label class="rotulo rotulo-espaco" for="observacao">OBSERVAÇÃO</label>' +
      '<textarea id="observacao" class="entrada" rows="2" maxlength="500" placeholder="Opcional">' + esc(f.observacao) + '</textarea>' +
      (mostraFatura
        ? '<label class="rotulo rotulo-espaco" for="valorEfetivo">VALOR NA FATURA (R$) <span class="suave">(quando chegar)</span></label>' +
          '<div class="entrada-valor-pequena"><span>R$</span><input id="valorEfetivo" class="entrada" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(f.valorEfetivoTexto) + '"></div>'
        : '') +
      (d.id ? '<p class="det-id">Registro ' + esc(d.id) + '</p>' : '') +
    '</div>' +
  '</div>';
}

function resumoDetalhes() {
  const partes = [];
  const dc = f.dataCompra ? f.dataCompra.slice(8, 10) + '/' + f.dataCompra.slice(5, 7) + ' ' + f.dataCompra.slice(11, 16) : '';
  if (dc) partes.push(dc);
  if (f.momento) partes.push(f.momento.replace('Durante a viagem', 'Viagem'));
  if (f.etapa) partes.push(f.etapa);
  return partes.join(' · ');
}

/* ---------------- Tela ---------------- */

export const telaDespesa = {
  semNav: true,

  render(params) {
    const v = visao();
    if (!prepararFormulario(params)) {
      return cabecalho({ titulo: 'Despesa', voltarPara: '/historico' }) +
        '<div class="cartao"><p>Este lançamento não foi encontrado. Ele pode ter sido excluído ou já enviado.</p></div>';
    }

    const titulo = modo === 'nova' ? 'Nova despesa' : modo === 'editar' ? 'Editar despesa' : 'Corrigir lançamento';
    etapa = modo === 'nova' ? 1 : TOTAL_PASSOS;
    const grupo = n => '<div class="etapa-grupo" data-grupo="' + n + '"' + (n === etapa ? '' : ' hidden') + '>';

    return cabecalho({
      titulo,
      sobre: modo === 'nova' ? 'LANÇADA POR ' + String(estado.usuario).toUpperCase() : '',
      voltarPara: '/historico'
    }) +
    (modo === 'corrigir' && opOrigem
      ? '<div class="faixa faixa-erro">' + icone('alerta', 18, 2.2) + '<span><strong>Motivo da recusa:</strong> ' + esc(opOrigem.motivo) + '</span></div>'
      : '') +
    (travado
      ? '<div class="faixa faixa-info">' + icone('escudo', 18, 2) + '<span>' +
        (PROTEGIDOS.includes(f.id) ? 'Registro protegido.' : 'Já houve acerto sobre esta despesa.') +
        ' Valor, moeda, data, pessoas e forma de pagamento estão bloqueados.</span></div>'
      : '') +
    '<form id="form-despesa" novalidate data-etapa="' + etapa + '">' +
      '<div class="etapas-topo" id="etapas-topo">' + htmlProgresso() + '</div>' +
      '<p class="erro-form erro-topo" id="erro-despesa" role="alert"></p>' +

      grupo(1) +
      '<section class="cartao">' +
        '<div class="cartao-topo">' +
          '<label class="rotulo" for="valor">VALOR</label>' +
          '<span id="area-moeda">' + htmlMoeda(v) + '</span>' +
        '</div>' +
        '<div class="valor-grande">' +
          '<span class="valor-simbolo" id="simbolo">' + esc(simboloMoeda(f.moeda)) + '</span>' +
          '<input id="valor" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(f.valorTexto) + '"' + (travado ? ' disabled' : '') + '>' +
        '</div>' +
        '<div class="conversao" id="conversao">' + htmlConversao(v) + '</div>' +
        '<div id="area-gorjeta">' + htmlGorjeta() + '</div>' +
      '</section>' +

      '<section class="cartao">' +
        '<label class="rotulo" for="descricao">DESCRIÇÃO</label>' +
        '<input id="descricao" class="entrada" type="text" maxlength="300" autocomplete="off" placeholder="Ex.: Jantar, Uber para o hotel" value="' + esc(f.descricao) + '">' +
        '<div class="sugestoes" id="sug-descricao">' + htmlSugestoes(sugestoesDescricao(v), 'data-sug-desc') + '</div>' +
        '<div class="rotulo rotulo-espaco" id="rotulo-categoria">CATEGORIA</div>' +
        '<div class="grade-cats" id="grade-cats">' + htmlCategorias(v) + '</div>' +
      '</section>' +
      '</div>' +

      grupo(2) +
      '<section class="cartao cartao-quem">' +
        '<div class="rotulo">QUEM PAGOU</div>' +
        '<div id="area-pagador">' + htmlPagador(v) + '</div>' +
        '<div class="rotulo rotulo-espaco">DE QUEM É A DESPESA</div>' +
        segmento('responsavel', ['João', 'Norma', 'Compartilhada'], f.responsavel, 'seg-quebra' + (travado ? ' travado' : '')) +
        '<div id="aviso-obrig">' + htmlAviso() + '</div>' +
        '<div class="rotulo rotulo-espaco">FORMA DE PAGAMENTO</div>' +
        '<div id="area-forma">' + htmlForma(v) + '</div>' +
      '</section>' +
      '</div>' +

      grupo(3) +
      '<section class="cartao">' +
        '<div class="linha-dupla">' +
          '<div id="area-foto">' + htmlFoto() + '</div>' +
          '<div id="area-gps">' + htmlGps() + '</div>' +
        '</div>' +
        '<label class="rotulo rotulo-espaco" for="local">LOCAL <span class="suave">(opcional)</span></label>' +
        '<input id="local" class="entrada" type="text" maxlength="120" autocomplete="off" placeholder="Cidade ou estabelecimento" value="' + esc(f.local) + '">' +
        '<div class="sugestoes" id="sug-local">' + htmlSugestoes(sugestoesLocal(v), 'data-sug-local') + '</div>' +
      '</section>' +

      '<div id="area-detalhes">' + htmlDetalhes(v) + '</div>' +
      '</div>' +

      grupo(4) +
      '<section class="cartao resumo-despesa" id="resumo-despesa">' + (etapa === TOTAL_PASSOS ? htmlResumo(v) : '') + '</section>' +
      '</div>' +

      '<div class="barra-salvar" id="barra">' + htmlBarra() + '</div>' +
    '</form>';
  },

  montar(raiz) {
    if (!f) return;
    const v = visao();
    const $ = s => raiz.querySelector(s);

    const atualizarValor = () => {
      $('#conversao').innerHTML = htmlConversao(v);
      $('#aviso-obrig').innerHTML = htmlAviso();
      const conta = $('#gorjeta-conta');
      if (conta) conta.textContent = textoGorjeta();
    };

    // 1.8.2: gorjeta
    const ligarGorjeta = () => {
      const area = $('#area-gorjeta');
      const abrir = area.querySelector('[data-gorjeta-abrir]');
      if (abrir) abrir.addEventListener('click', () => { f.gorjetaAberta = true; redesenharGorjeta(); });
      ligarSegmento(area, 'gorjeta', valor => {
        if (valor === 'sem') f.gorjeta = null;
        else if (valor === 'outro') f.gorjeta = { tipo: 'valor', texto: (f.gorjeta && f.gorjeta.texto) || '' };
        else f.gorjeta = { tipo: 'pct', pct: Number(valor) };
        redesenharGorjeta();
        if (valor === 'outro') setTimeout(() => { const c = $('#gorjeta-valor'); if (c) c.focus(); }, 50);
      });
      const campo = area.querySelector('#gorjeta-valor');
      if (campo) campo.addEventListener('input', () => { f.gorjeta.texto = campo.value; atualizarValor(); });
    };
    const redesenharGorjeta = () => {
      if (!gorjetaPermitida()) { f.gorjeta = null; f.gorjetaAberta = false; }
      $('#area-gorjeta').innerHTML = htmlGorjeta();
      ligarGorjeta();
      atualizarValor();
    };
    ligarGorjeta();

    const ligarMoeda = () => {
      if (travado || ehTerceiro(visao(), f.quemPagou)) return;
      ligarSegmento($('#area-moeda'), 'moeda', valor => {
        f.moeda = valor;
        $('#simbolo').textContent = simboloMoeda(valor);
        redesenharGorjeta();
        $('#area-detalhes').innerHTML = htmlDetalhes(v);
        ligarDetalhes();
      });
    };

    const ligarForma = () => {
      if (travado) return;
      ligarSegmento($('#area-forma'), 'formaPagamento', valor => {
        f.formaPagamento = valor;
        $('#area-cartao').innerHTML = htmlCartao();
        ligarCartao();
        $('#area-detalhes').innerHTML = htmlDetalhes(v);
        ligarDetalhes();
      });
      ligarCartao();
    };

    // Trocar quem pagou pode travar/destravar moeda, forma e cartão.
    const redesenharPagador = () => {
      const atual = visao();
      $('#area-pagador').innerHTML = htmlPagador(atual);
      $('#area-moeda').innerHTML = htmlMoeda(atual);
      $('#simbolo').textContent = simboloMoeda(f.moeda);
      $('#area-forma').innerHTML = htmlForma(atual);
      redesenharGorjeta();
      $('#area-detalhes').innerHTML = htmlDetalhes(atual);
      ligarDetalhes();
      ligarPagador();
      ligarMoeda();
      ligarForma();
    };

    const ligarPagador = () => {
      if (travado) return;
      ligarSegmento($('#area-pagador'), 'quemPagou', valor => {
        f.quemPagou = valor;
        aplicarRegrasPagador(visao());
        redesenharPagador();
      });
      const novo = $('#area-pagador [data-novo-pagador]');
      if (novo) novo.addEventListener('click', () => abrirNovoPagador(nome => {
        f.quemPagou = nome;
        aplicarRegrasPagador(visao());
        redesenharPagador();
      }));
    };

    if (!travado) {
      $('#valor').addEventListener('input', ev => {
        f.valorTexto = ev.target.value;
        atualizarValor();
      });

      ligarSegmento(raiz, 'responsavel', valor => {
        f.responsavel = valor;
        $('#aviso-obrig').innerHTML = htmlAviso();
      });
    }

    const atualizarSugDescricao = () => { $('#sug-descricao').innerHTML = htmlSugestoes(sugestoesDescricao(visao()), 'data-sug-desc'); };
    const atualizarSugLocal = () => { $('#sug-local').innerHTML = htmlSugestoes(sugestoesLocal(visao()), 'data-sug-local'); };

    $('#descricao').addEventListener('input', ev => { f.descricao = ev.target.value; atualizarSugDescricao(); });
    $('#local').addEventListener('input', ev => { f.local = ev.target.value; atualizarSugLocal(); });

    // 1.8.0: tocar numa sugestão preenche (e, se faltar, traz a categoria usada antes).
    $('#sug-descricao').addEventListener('click', ev => {
      const b = ev.target.closest('[data-sug-desc]');
      if (!b) return;
      const texto = b.getAttribute('data-sug-desc');
      const usada = sugestoesDescricao(visao()).find(s => s.texto === texto);
      f.descricao = texto;
      $('#descricao').value = texto;
      if (!f.categoria && usada && usada.categoria) {
        f.categoria = usada.categoria;
        $('#grade-cats').innerHTML = htmlCategorias();
      }
      atualizarSugDescricao();
    });
    $('#sug-local').addEventListener('click', ev => {
      const b = ev.target.closest('[data-sug-local]');
      if (!b) return;
      f.local = b.getAttribute('data-sug-local');
      $('#local').value = f.local;
      atualizarSugLocal();
    });

    $('#grade-cats').addEventListener('click', ev => {
      const b = ev.target.closest('[data-categoria]');
      if (b) {
        f.categoria = b.getAttribute('data-categoria');
        $('#grade-cats').innerHTML = htmlCategorias();
        atualizarSugDescricao();
        return;
      }
      if (ev.target.closest('[data-todas-categorias]')) abrirTodasCategorias(visao(), raiz);
    });

    const ligarCartao = () => {
      const sel = $('#cartao');
      if (!sel) return;
      sel.addEventListener('change', () => {
        if (sel.value !== '__novo') { f.cartao = sel.value; return; }
        sel.value = f.cartao;
        abrirNovoCartao(f.quemPagou, (nome, extras) => {
          if (mesmaDona(extras.dono)) f.cartao = nome;
          $('#area-cartao').innerHTML = htmlCartao();
          ligarCartao();
        });
      });
    };
    const mesmaDona = dono => normalizar(dono) === normalizar(f.quemPagou);

    ligarPagador();
    ligarMoeda();
    ligarForma();

    const ligarFoto = () => {
      const area = $('#area-foto');
      const input = area.querySelector('[data-foto]');
      if (input) {
        input.addEventListener('change', async () => {
          const arquivo = input.files && input.files[0];
          if (!arquivo) return;
          area.innerHTML = '<div class="foto-botao">' + icone('atualizar', 22, 2, ' data-gira="1"') + '<span>Preparando foto…</span></div>';
          try {
            f.foto = await comprimirFoto(arquivo);
          } catch (erro) {
            avisar('Não foi possível usar esta foto.', 'erro');
          }
          area.innerHTML = htmlFoto();
          ligarFoto();
        });
      }
      const remover = area.querySelector('[data-remover-foto]');
      if (remover) {
        remover.addEventListener('click', () => {
          f.foto = '';
          area.innerHTML = htmlFoto();
          ligarFoto();
        });
      }
      const existente = area.querySelector('#foto-existente');
      if (existente && f.comprovante) mostrarFotoExistente(existente);
    };
    ligarFoto();

    const ligarGps = () => {
      const area = document.getElementById('area-gps');
      const buscar = area.querySelector('[data-gps-buscar]');
      const remover = area.querySelector('[data-gps-remover]');
      const cancelar = area.querySelector('[data-gps-cancelar]');
      if (cancelar) cancelar.addEventListener('click', () => {
        f.gpsSituacao = 'nao';
        f.gpsBusca = (f.gpsBusca || 0) + 1;   // ignora a resposta da busca cancelada
        area.innerHTML = htmlGps();
        ligarGps();
      });
      if (buscar) buscar.addEventListener('click', () => buscarLocal(true));
      if (remover) remover.addEventListener('click', () => {
        f.gps = '';
        f.gpsSituacao = 'nao';
        area.innerHTML = htmlGps();
        ligarGps();
      });
    };

    const buscarLocal = async (pedidoPeloToque = false) => {
      f.gpsSituacao = 'buscando';
      const busca = f.gpsBusca = (f.gpsBusca || 0) + 1;
      document.getElementById('area-gps').innerHTML = htmlGps();
      ligarGps();
      const formulario = f;
      // Pedido pelo toque: GPS de alta precisão, com mais tempo.
      const posicao = await obterLocalizacao(pedidoPeloToque ? 15000 : 8000, pedidoPeloToque);
      if (f !== formulario || !document.getElementById('area-gps') || f.gpsBusca !== busca) return;
      f.gps = posicao;
      f.gpsPrecisao = posicao ? ultimaPrecisao : 0;
      f.gpsSituacao = posicao ? 'ok' : 'nao';
      document.getElementById('area-gps').innerHTML = htmlGps();
      ligarGps();
      atualizarResumo();
      if (posicao && pedidoPeloToque) avisar('Local registrado' + (f.gpsPrecisao ? ' (precisão de ' + f.gpsPrecisao + ' m)' : '') + '. Ele entra no mapa quando a despesa for salva.');
      if (!posicao && pedidoPeloToque && ultimoErroLocalizacao) avisar(ultimoErroLocalizacao, 'erro');
    };

    if (modo === 'nova' && f.gpsSituacao === 'buscando') buscarLocal();
    else ligarGps();

    const ligarDetalhes = () => {
      const area = $('#area-detalhes');
      area.querySelector('[data-detalhes]').addEventListener('click', () => {
        f.detalhes = !f.detalhes;
        area.querySelector('.detalhes').classList.toggle('abertos', f.detalhes);
        area.querySelector('[data-detalhes]').setAttribute('aria-expanded', String(f.detalhes));
      });

      const dc = area.querySelector('#dataCompra');
      dc.addEventListener('change', () => {
        f.dataCompra = dc.value;
        if (!f.momentoManual) {
          const me = momentoEtapa(dc.value.slice(0, 10), v.config);
          f.momento = me.momento;
          f.etapa = me.etapa;
          const aberto = f.detalhes;
          area.innerHTML = htmlDetalhes(v);
          f.detalhes = aberto;
          ligarDetalhes();
        }
        atualizarResumoDetalhes();
      });

      area.querySelector('#dataUtilizacao').addEventListener('change', ev => { f.dataUtilizacao = ev.target.value; });
      area.querySelector('#observacao').addEventListener('input', ev => { f.observacao = ev.target.value; });

      ligarSegmento(area, 'momento', valor => { f.momento = valor; f.momentoManual = true; atualizarResumoDetalhes(); });
      ligarSegmento(area, 'etapa', valor => { f.etapa = valor; f.momentoManual = true; atualizarResumoDetalhes(); });

      const ef = area.querySelector('#valorEfetivo');
      if (ef) ef.addEventListener('input', () => { f.valorEfetivoTexto = ef.value; $('#conversao').innerHTML = htmlConversao(v); });
    };

    const atualizarResumoDetalhes = () => {
      const alvo = $('#area-detalhes .detalhes-botao .suave');
      if (alvo) alvo.textContent = resumoDetalhes();
    };

    ligarDetalhes();

    // 1.8.0: navegação entre as etapas.
    $('#barra').addEventListener('click', ev => {
      if (ev.target.closest('[data-anterior]')) return irParaEtapa(etapa - 1);
      if (ev.target.closest('[data-continuar]')) {
        const problema = problemaDaEtapa(etapa);
        if (problema) return mostrarProblema(raiz, problema);
        irParaEtapa(etapa + 1);
      }
    });
    $('#resumo-despesa').addEventListener('click', ev => {
      const b = ev.target.closest('[data-passo]');
      if (b) irParaEtapa(Number(b.getAttribute('data-passo')));
    });

    // "Ir"/Enter do teclado num campo de texto vale como Continuar (sem salvar antes da hora).
    $('#form-despesa').addEventListener('keydown', ev => {
      if (ev.key !== 'Enter' || ev.target.tagName !== 'INPUT' || etapa >= TOTAL_PASSOS) return;
      ev.preventDefault();
      if (ev.target.id === 'valor' && lerNumero(f.valorTexto) > 0) return $('#descricao').focus();
      const problema = problemaDaEtapa(etapa);
      if (problema) return mostrarProblema(raiz, problema);
      irParaEtapa(etapa + 1);
    });

    $('#form-despesa').addEventListener('submit', ev => {
      ev.preventDefault();
      // "Ir" do teclado antes da última etapa vale como Continuar.
      if (etapa < TOTAL_PASSOS) {
        const problema = problemaDaEtapa(etapa);
        if (problema) return mostrarProblema(raiz, problema);
        return irParaEtapa(etapa + 1);
      }
      salvar(raiz);
    });
  },

  async podeSair() {
    if (salvo || !f || !alterado()) return true;
    return confirmar({
      titulo: modo === 'nova' ? 'Descartar esta despesa?' : 'Descartar as alterações?',
      texto: 'O que foi preenchido será perdido.',
      sim: 'Descartar',
      nao: 'Continuar editando',
      perigo: true
    });
  },

  sair() {
    f = null;
  }
};

/* ---------------- Ações ---------------- */

function alterado() {
  if (modo === 'nova') return Boolean(f.valorTexto || f.descricao || f.categoria || f.foto || f.local || f.observacao);
  const atual = montarDados();
  return JSON.stringify({ ...atual, valorEfetivo: undefined }) !== JSON.stringify({ ...dadosComparaveis(original), valorEfetivo: undefined }) ||
    Boolean(f.foto) || f.valorEfetivoTexto !== (num(original.valorEfetivo) > 0 ? numeroBR(original.valorEfetivo, 2) : '');
}

function dadosComparaveis(d) {
  return {
    id: d.id,
    dataCompra: new Date(paraCampoDataHora(d.dataCompra)).toISOString(),
    dataUtilizacao: d.dataUtilizacao || '',
    momento: d.momento || '',
    etapa: d.etapa || '',
    local: d.local || '',
    categoria: d.categoria,
    descricao: d.descricao,
    formaPagamento: d.formaPagamento,
    cartao: normalizar(d.formaPagamento).includes('cartao') ? d.cartao || '' : '',
    quemPagou: d.quemPagou,
    responsavel: d.responsavel,
    observacao: d.observacao || '',
    gps: d.gps || '',
    moeda: d.moeda,
    valorOriginal: arred2(num(d.valorOriginal))
  };
}

function montarDados() {
  const dataCompra = f.dataCompra ? new Date(f.dataCompra) : new Date();
  return {
    id: f.id,
    dataCompra: isNaN(dataCompra) ? '' : dataCompra.toISOString(),
    dataUtilizacao: f.dataUtilizacao || '',
    momento: f.momento || '',
    etapa: f.etapa || '',
    local: f.local.trim(),
    categoria: f.categoria,
    descricao: f.descricao.trim(),
    formaPagamento: ehTerceiro(visao(), f.quemPagou) ? formaDinheiro(visao()) : f.formaPagamento,
    cartao: !ehTerceiro(visao(), f.quemPagou) && normalizar(f.formaPagamento).includes('cartao') ? f.cartao || '' : '',
    quemPagou: f.quemPagou,
    responsavel: f.responsavel,
    observacao: f.observacao.trim(),
    gps: f.gps || '',
    moeda: f.moeda,
    valorOriginal: valorFinal()
  };
}

async function salvar(raiz) {
  const erro = raiz.querySelector('#erro-despesa');
  const dados = montarDados();

  const problema = problemaDaEtapa(1) || problemaDaEtapa(2) || problemaDaEtapa(3);

  if (problema) {
    mostrarProblema(raiz, problema);
    return;
  }

  erro.textContent = '';
  if (f.foto) dados.foto = f.foto;
  const contaGorjeta = textoGorjeta();
  if (contaGorjeta) dados.observacao = (contaGorjeta + '.' + (dados.observacao ? ' ' + dados.observacao : '')).slice(0, 500);

  if (modo !== 'nova') {
    const efetivoAntes = num(original.valorEfetivo) > 0 ? numeroBR(original.valorEfetivo, 2) : '';
    if (f.valorEfetivoTexto !== efetivoAntes) {
      const ef = arred2(lerNumero(f.valorEfetivoTexto));
      dados.valorEfetivo = ef > 0 ? ef : '';
    }
  }

  const botao = raiz.querySelector('#salvar');
  botao.disabled = true;

  if (modo === 'nova') {
    dados.criadoEm = new Date().toISOString();
    await enfileirar('despesa.criar', dados);
  } else if (modo === 'editar') {
    await enfileirar('despesa.editar', dados);
  } else {
    const tipo = opOrigem.tipo;
    if (tipo === 'despesa.criar') dados.criadoEm = opOrigem.dados.criadoEm || new Date().toISOString();
    await descartarOperacao(opOrigem.opId);
    await enfileirar(tipo, dados);
  }

  if (!ehTerceiro(visao(), dados.quemPagou)) {
    await lembrarEscolhas({ moeda: dados.moeda, formaPagamento: dados.formaPagamento, cartao: dados.cartao || estado.preferencias.cartao || '' });
  }

  salvo = true;
  avisar(navigator.onLine ? (modo === 'nova' ? 'Despesa salva' : 'Alteração salva') : 'Guardada no iPhone. Sobe quando houver sinal.');
  ir('/historico', true);
}

function abrirTodasCategorias(v, raiz) {
  abrirFolha({
    titulo: 'Categoria',
    html: '<button type="button" class="botao botao-contorno cad-botao cad-botao-topo" data-nova-categoria>' + icone('mais', 18, 2.4) + ' Cadastrar categoria</button>' +
      '<div class="opcoes">' + (v.categorias || []).map(c =>
      '<button type="button" class="opcao' + (f.categoria === c ? ' ativo' : '') + '" data-valor="' + esc(c) + '">' +
      '<span class="opcao-ic">' + iconeCategoria(c, 20) + '</span><span>' + esc(c) + '</span>' +
      (f.categoria === c ? icone('check', 20, 2.6) : '') + '</button>'
    ).join('') + '</div>',
    montar: (corpo, fechar) => {
      corpo.addEventListener('click', ev => {
        if (ev.target.closest('[data-nova-categoria]')) {
          fechar();
          abrirNovaCategoria(nome => {
            if (!f) return;
            f.categoria = nome;
            raiz.querySelector('#grade-cats').innerHTML = htmlCategorias();
          });
          return;
        }
        const b = ev.target.closest('[data-valor]');
        if (!b) return;
        f.categoria = b.getAttribute('data-valor');
        raiz.querySelector('#grade-cats').innerHTML = htmlCategorias();
        fechar();
      });
    }
  });
}

async function mostrarFotoExistente(alvo) {
  const comprovante = f.comprovante;
  const src = fotoDaFila(comprovante) || await lerFoto(comprovante);
  if (!src || !f || f.comprovante !== comprovante || !alvo.isConnected) return;
  const rotulo = alvo.querySelector('.suave');
  if (rotulo) rotulo.outerHTML = '<img src="' + src + '" alt="Comprovante registrado">';
}

