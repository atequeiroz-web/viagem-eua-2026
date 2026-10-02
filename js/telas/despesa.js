// NOVA DESPESA / EDITAR / CORRIGIR LANÇAMENTO RECUSADO.

import { estado, visao, enfileirar, descartarOperacao, lembrarEscolhas, lerFoto, fotoDaFila } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, abrirFolha, confirmar, avisar, ir } from '../ui.js';
import { icone, iconeCategoria, rotuloCurtoCategoria } from '../icones.js';
import {
  esc, moeda, simboloMoeda, num, arred2, lerNumero, normalizar, dia,
  paraCampoDataHora, gerarId, comprimirFoto, obterLocalizacao, numeroBR
} from '../util.js';
import {
  estimarBRL, cotacaoBRL, previaObrigacoes, momentoEtapa, MOMENTOS, ETAPAS,
  dadosParaEdicao, despesaComAcerto, pessoaPropria, PROTEGIDOS
} from '../calculos.js';

let f = null;          // estado do formulário
let modo = 'nova';     // nova | editar | corrigir
let original = null;   // dados originais (editar/corrigir)
let opOrigem = null;   // operação recusada sendo corrigida
let salvo = false;
let travado = false;   // campos financeiros bloqueados

/* ---------------- Montagem do estado ---------------- */

function novoFormulario(v) {
  const pref = estado.preferencias || {};
  const formas = v.config.formasPagamento || [];
  const cartoes = v.config.cartoes || [];
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
  return f;
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

function htmlCategorias(v) {
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
  const valor = lerNumero(f.valorTexto);
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
  const valor = lerNumero(f.valorTexto);
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

function htmlCartao(v) {
  if (!normalizar(f.formaPagamento).includes('cartao')) return '';
  const cartoes = v.config.cartoes || [];
  const opcoes = cartoes.includes(f.cartao) || !f.cartao ? cartoes : cartoes.concat(f.cartao);
  return '<label class="rotulo rotulo-espaco" for="cartao">CARTÃO</label>' +
    '<div class="selecao">' +
      '<select id="cartao" class="entrada">' +
        '<option value="">Não informado</option>' +
        opcoes.map(c => '<option' + (c === f.cartao ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '</select>' + icone('baixo', 18, 2.2) +
    '</div>';
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
  if (f.gpsSituacao === 'buscando') return '<div class="gps gps-buscando">' + icone('pin', 20, 2) + '<span>Buscando local…</span></div>';
  if (f.gps) return '<button type="button" class="gps gps-ok" data-gps-remover>' + icone('pin', 20, 2) + '<span>Local registrado</span><span class="gps-x">remover</span></button>';
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
    const pessoas = (v.pessoas || []).filter(p => p.ativo).map(p => p.nome);
    const formas = v.config.formasPagamento && v.config.formasPagamento.length ? v.config.formasPagamento.slice() : ['Cartão de Crédito', 'Dinheiro'];
    if (f.formaPagamento && !formas.includes(f.formaPagamento)) formas.push(f.formaPagamento);

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
    '<form id="form-despesa" novalidate>' +
      '<p class="erro-form erro-topo" id="erro-despesa" role="alert"></p>' +

      '<section class="cartao">' +
        '<div class="cartao-topo">' +
          '<label class="rotulo" for="valor">VALOR</label>' +
          segmento('moeda', ['USD', 'BRL', 'PYG'], f.moeda, 'seg-moeda' + (travado ? ' travado' : '')) +
        '</div>' +
        '<div class="valor-grande">' +
          '<span class="valor-simbolo" id="simbolo">' + esc(simboloMoeda(f.moeda)) + '</span>' +
          '<input id="valor" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(f.valorTexto) + '"' + (travado ? ' disabled' : '') + '>' +
        '</div>' +
        '<div class="conversao" id="conversao">' + htmlConversao(v) + '</div>' +
      '</section>' +

      '<section class="cartao">' +
        '<label class="rotulo" for="descricao">DESCRIÇÃO</label>' +
        '<input id="descricao" class="entrada" type="text" maxlength="300" autocomplete="off" placeholder="Ex.: Jantar, Uber para o hotel" value="' + esc(f.descricao) + '">' +
        '<div class="rotulo rotulo-espaco" id="rotulo-categoria">CATEGORIA</div>' +
        '<div class="grade-cats" id="grade-cats">' + htmlCategorias(v) + '</div>' +
      '</section>' +

      '<section class="cartao">' +
        '<div class="rotulo">QUEM PAGOU</div>' +
        segmento('quemPagou', pessoas, f.quemPagou, travado ? 'travado' : '') +
        '<div class="rotulo rotulo-espaco">DE QUEM É A DESPESA</div>' +
        segmento('responsavel', ['João', 'Norma', 'Compartilhada'], f.responsavel, 'seg-quebra' + (travado ? ' travado' : '')) +
        '<div id="aviso-obrig">' + htmlAviso() + '</div>' +
      '</section>' +

      '<section class="cartao">' +
        '<div class="rotulo">FORMA DE PAGAMENTO</div>' +
        segmento('formaPagamento', formas, f.formaPagamento, 'seg-quebra' + (travado ? ' travado' : '')) +
        '<div id="area-cartao">' + htmlCartao(v) + '</div>' +
      '</section>' +

      '<section class="cartao">' +
        '<label class="rotulo" for="local">LOCAL</label>' +
        '<input id="local" class="entrada" type="text" maxlength="120" autocomplete="off" placeholder="Cidade ou estabelecimento" value="' + esc(f.local) + '">' +
        '<div class="linha-dupla">' +
          '<div id="area-foto">' + htmlFoto() + '</div>' +
          '<div id="area-gps">' + htmlGps() + '</div>' +
        '</div>' +
      '</section>' +

      '<div id="area-detalhes">' + htmlDetalhes(v) + '</div>' +

      '<div class="barra-salvar">' +
        '<button type="submit" class="botao botao-primario botao-grande" id="salvar">' + (modo === 'nova' ? 'Salvar despesa' : 'Salvar alterações') + '</button>' +
        '<p class="nota-salvar" id="nota-salvar">' + (navigator.onLine ? 'Vai direto para a planilha.' : 'Sem sinal: fica guardada no iPhone e sobe sozinha depois.') + '</p>' +
      '</div>' +
    '</form>';
  },

  montar(raiz) {
    if (!f) return;
    const v = visao();
    const $ = s => raiz.querySelector(s);

    const atualizarValor = () => {
      $('#conversao').innerHTML = htmlConversao(v);
      $('#aviso-obrig').innerHTML = htmlAviso();
    };

    if (!travado) {
      $('#valor').addEventListener('input', ev => {
        f.valorTexto = ev.target.value;
        atualizarValor();
      });

      ligarSegmento(raiz, 'moeda', valor => {
        f.moeda = valor;
        $('#simbolo').textContent = simboloMoeda(valor);
        atualizarValor();
        $('#area-detalhes').innerHTML = htmlDetalhes(v);
        ligarDetalhes();
      });

      ligarSegmento(raiz, 'quemPagou', valor => {
        f.quemPagou = valor;
        $('#aviso-obrig').innerHTML = htmlAviso();
      });

      ligarSegmento(raiz, 'responsavel', valor => {
        f.responsavel = valor;
        $('#aviso-obrig').innerHTML = htmlAviso();
      });

      ligarSegmento(raiz, 'formaPagamento', valor => {
        f.formaPagamento = valor;
        $('#area-cartao').innerHTML = htmlCartao(v);
        ligarCartao();
        $('#area-detalhes').innerHTML = htmlDetalhes(v);
        ligarDetalhes();
      });
    }

    $('#descricao').addEventListener('input', ev => { f.descricao = ev.target.value; });
    $('#local').addEventListener('input', ev => { f.local = ev.target.value; });

    $('#grade-cats').addEventListener('click', ev => {
      const b = ev.target.closest('[data-categoria]');
      if (b) {
        f.categoria = b.getAttribute('data-categoria');
        $('#grade-cats').innerHTML = htmlCategorias(v);
        return;
      }
      if (ev.target.closest('[data-todas-categorias]')) abrirTodasCategorias(v, raiz);
    });

    const ligarCartao = () => {
      const sel = $('#cartao');
      if (sel) sel.addEventListener('change', () => { f.cartao = sel.value; });
    };
    ligarCartao();

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
      const area = $('#area-gps');
      const buscar = area.querySelector('[data-gps-buscar]');
      const remover = area.querySelector('[data-gps-remover]');
      if (buscar) buscar.addEventListener('click', () => buscarLocal());
      if (remover) remover.addEventListener('click', () => {
        f.gps = '';
        f.gpsSituacao = 'nao';
        area.innerHTML = htmlGps();
        ligarGps();
      });
    };

    const buscarLocal = async () => {
      f.gpsSituacao = 'buscando';
      $('#area-gps').innerHTML = htmlGps();
      const formulario = f;
      const posicao = await obterLocalizacao();
      if (f !== formulario || !$('#area-gps')) return;
      f.gps = posicao;
      f.gpsSituacao = posicao ? 'ok' : 'nao';
      $('#area-gps').innerHTML = htmlGps();
      ligarGps();
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

    $('#form-despesa').addEventListener('submit', ev => {
      ev.preventDefault();
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
    formaPagamento: f.formaPagamento,
    cartao: normalizar(f.formaPagamento).includes('cartao') ? f.cartao || '' : '',
    quemPagou: f.quemPagou,
    responsavel: f.responsavel,
    observacao: f.observacao.trim(),
    gps: f.gps || '',
    moeda: f.moeda,
    valorOriginal: arred2(lerNumero(f.valorTexto))
  };
}

async function salvar(raiz) {
  const erro = raiz.querySelector('#erro-despesa');
  const dados = montarDados();

  const problema =
    !(dados.valorOriginal > 0) ? ['Digite o valor da despesa.', '#valor'] :
    !dados.descricao ? ['Escreva uma descrição curta.', '#descricao'] :
    !dados.categoria ? ['Escolha a categoria.', '#rotulo-categoria'] :
    !dados.dataCompra ? ['Data da compra inválida.', '#area-detalhes'] :
    !dados.formaPagamento ? ['Escolha a forma de pagamento.', '#area-cartao'] :
    null;

  if (problema) {
    erro.textContent = problema[0];
    const alvo = raiz.querySelector(problema[1]);
    if (alvo) {
      alvo.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (alvo.focus && alvo.tagName === 'INPUT') setTimeout(() => alvo.focus(), 300);
    }
    return;
  }

  erro.textContent = '';
  if (f.foto) dados.foto = f.foto;

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

  await lembrarEscolhas({ moeda: dados.moeda, formaPagamento: dados.formaPagamento, cartao: dados.cartao || estado.preferencias.cartao || '' });

  salvo = true;
  avisar(navigator.onLine ? (modo === 'nova' ? 'Despesa salva' : 'Alteração salva') : 'Guardada no iPhone. Sobe quando houver sinal.');
  ir('/historico', true);
}

function abrirTodasCategorias(v, raiz) {
  abrirFolha({
    titulo: 'Categoria',
    html: '<div class="opcoes">' + (v.categorias || []).map(c =>
      '<button type="button" class="opcao' + (f.categoria === c ? ' ativo' : '') + '" data-valor="' + esc(c) + '">' +
      '<span class="opcao-ic">' + iconeCategoria(c, 20) + '</span><span>' + esc(c) + '</span>' +
      (f.categoria === c ? icone('check', 20, 2.6) : '') + '</button>'
    ).join('') + '</div>',
    montar: (corpo, fechar) => {
      corpo.addEventListener('click', ev => {
        const b = ev.target.closest('[data-valor]');
        if (!b) return;
        f.categoria = b.getAttribute('data-valor');
        raiz.querySelector('#grade-cats').innerHTML = htmlCategorias(v);
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

