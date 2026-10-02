// REGISTRAR PAGAMENTO (acerto): perguntas simples, uma por vez.
// O app preenche sozinho os campos técnicos que o motor exige.

import { estado, visao, enfileirar } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, confirmar, avisar, ir, voltar, vazio, atualizarPilula } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import {
  esc, moeda, simboloMoeda, num, arred2, lerNumero, mesmaPessoa,
  hojeDia, dataCurta, gerarId, comprimirFoto, numeroBR
} from '../util.js';
import { opcoesDeDivida, converter, cotacaoBRL, obrigacoesDoGrupo, origemDaObrigacao } from '../calculos.js';

const TOTAL_PASSOS = 5;
let a = null;
let salvo = false;

function novo(chave) {
  return {
    passo: chave ? 2 : 1,
    chave: chave || '',
    recursosDe: '',
    valorTexto: '',
    moedaPagamento: 'BRL',
    data: hojeDia(),
    descricao: '',
    destinatario: '',
    observacao: '',
    foto: '',
    erro: ''
  };
}

function opcaoAtual(v) {
  return opcoesDeDivida(v).find(o => o.chave === a.chave) || null;
}

function devedoresDaOpcao(o) {
  return o.porConta === 'Ambos' ? ['João', 'Norma'] : [o.porConta];
}

/** Dívidas da viagem que serão abatidas, na ordem do motor (mais antiga primeiro). */
function previaFifo(v, o, valorNaMoedaDaDivida) {
  const lista = [];
  devedoresDaOpcao(o).forEach(dev => {
    obrigacoesDoGrupo(v, { devedor: dev, credor: o.credor, moeda: o.moeda })
      .filter(x => num(x.saldo) > 0 && x.status !== 'Liquidada')
      .forEach(x => lista.push(x));
  });
  lista.sort((x, y) => String(x.dataOrigem).localeCompare(String(y.dataOrigem)));

  let resta = valorNaMoedaDaDivida;
  const afetadas = [];
  for (const ob of lista) {
    if (resta <= 0.004) break;
    const aplicado = Math.min(resta, num(ob.saldo));
    resta = arred2(resta - aplicado);
    afetadas.push({ ob, aplicado: arred2(aplicado), quita: aplicado >= num(ob.saldo) - 0.004 });
  }
  return { afetadas, sobra: Math.max(0, resta) };
}

/* ---------------- Passos ---------------- */

function passo1(v) {
  const opcoes = opcoesDeDivida(v);
  if (!opcoes.length) return vazio('check', 'Não há dívidas em aberto', 'Quando houver, elas aparecem aqui para serem pagas.');

  return '<h2 class="pergunta">Qual dívida está sendo paga?</h2>' +
    '<div class="opcoes-cartao">' +
    opcoes.map(o =>
      '<button type="button" class="opcao-cartao' + (a.chave === o.chave ? ' ativo' : '') + '" data-divida="' + esc(o.chave) + '" aria-pressed="' + (a.chave === o.chave) + '">' +
        '<span class="opcao-cartao-texto"><strong>' + esc(o.devedor) + (o.porConta === 'Ambos' ? ' devem' : ' deve') + ' a ' + esc(o.credor) + '</strong>' +
        '<span class="suave">' + (o.porConta === 'Ambos' ? 'Paga as dívidas dos dois de uma vez' : 'Dívidas desta viagem') + '</span></span>' +
        '<span class="opcao-cartao-valor">' + esc(moeda(o.saldo, o.moeda)) + '</span>' +
      '</button>'
    ).join('') +
    '</div>';
}

function passo2(v, o) {
  const pessoas = (v.pessoas || []).filter(p => p.ativo && !mesmaPessoa(p.nome, o.credor)).map(p => p.nome);
  if (!a.recursosDe) a.recursosDe = o.porConta === 'Ambos' ? estado.usuario : o.porConta;

  return '<h2 class="pergunta">Quem pagou?</h2>' +
    '<p class="texto-suave">Normalmente é quem deve. Se outra pessoa pagou no lugar, escolha essa pessoa.</p>' +
    segmento('recursosDe', pessoas, a.recursosDe, 'seg-quebra') +
    '<div id="nota-pagador">' + notaPagador(o) + '</div>';
}

function notaPagador(o) {
  const devedores = devedoresDaOpcao(o);
  const outros = devedores.filter(d => !mesmaPessoa(d, a.recursosDe));
  if (!outros.length) return '';
  return '<div class="aviso-obrig">' + icone('info', 18, 2.2) + '<span>Como <strong>' + esc(a.recursosDe) + '</strong> pagou no lugar de <strong>' +
    esc(outros.join(' e ')) + '</strong>, ' + esc(outros.join(' e ')) + (outros.length > 1 ? ' passam' : ' passa') + ' a dever esse valor a ' + esc(a.recursosDe) + '. O app registra isso sozinho.</span></div>';
}

function passo3(v, o) {
  return '<h2 class="pergunta">Quanto foi pago?</h2>' +
    '<div class="cartao">' +
      '<div class="cartao-topo"><label class="rotulo" for="valor-acerto">VALOR PAGO</label>' +
      segmento('moedaPagamento', ['BRL', 'USD', 'PYG'], a.moedaPagamento, 'seg-moeda') + '</div>' +
      '<div class="valor-grande"><span class="valor-simbolo" id="simbolo-acerto">' + esc(simboloMoeda(a.moedaPagamento)) + '</span>' +
      '<input id="valor-acerto" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(a.valorTexto) + '"></div>' +
      '<label class="rotulo rotulo-espaco" for="data-acerto">DATA DO PAGAMENTO</label>' +
      '<input id="data-acerto" class="entrada" type="date" value="' + esc(a.data) + '" max="' + esc(hojeDia()) + '">' +
    '</div>' +
    '<div id="estimativa">' + estimativa(v, o) + '</div>';
}

function estimativa(v, o) {
  const valor = lerNumero(a.valorTexto);
  if (!(valor > 0)) {
    return '<div class="cartao cartao-suave"><div class="linha-simples"><span>Dívida atual</span><strong>' + esc(moeda(o.saldo, o.moeda)) + '</strong></div></div>';
  }

  const naMoedaDivida = arred2(converter(valor, a.moedaPagamento, o.moeda, v.cotacoes));
  if (!Number.isFinite(naMoedaDivida)) {
    return '<div class="cartao cartao-suave"><p class="texto-suave">Sem cotação no aparelho para estimar. A planilha calcula ao receber.</p></div>';
  }

  const depois = arred2(o.saldo - naMoedaDivida);
  const mesma = a.moedaPagamento === o.moeda;
  const cot = !mesma ? (cotacaoBRL(o.moeda, v.cotacoes) / cotacaoBRL(a.moedaPagamento, v.cotacoes)) : 1;

  let html = '<div class="cartao cartao-suave">' +
    (!mesma ? '<div class="linha-simples"><span>Equivale a cerca de</span><strong>' + esc(moeda(naMoedaDivida, o.moeda)) + '</strong></div>' : '') +
    '<div class="linha-simples"><span>Dívida atual</span><strong>' + esc(moeda(o.saldo, o.moeda)) + '</strong></div>' +
    (depois > 0.004
      ? '<div class="linha-simples linha-destaque"><span>Faltará cerca de</span><strong>' + esc(moeda(depois, o.moeda)) + '</strong></div>'
      : '<div class="linha-simples linha-ok"><span>Quita a dívida</span><strong>' + icone('check', 16, 2.6) + '</strong></div>' +
        (depois < -0.004
          ? '<div class="linha-simples"><span>Pago a mais (vira crédito de ' + esc(a.recursosDe) + ')</span><strong>' + esc(moeda(converter(-depois, o.moeda, a.moedaPagamento, v.cotacoes), a.moedaPagamento)) + '</strong></div>'
          : '')) +
    (!mesma
      ? '<p class="nota-pequena">Estimativa com a cotação guardada no aparelho (' + esc(simboloMoeda(o.moeda)) + ' 1 = ' +
        esc(simboloMoeda(a.moedaPagamento)) + ' ' + esc(numeroBR(cot, 4)) + '). A planilha usa a PTAX oficial do dia do pagamento.</p>'
      : '') +
  '</div>';

  return html;
}

function passo4() {
  return '<h2 class="pergunta">O que foi pago?</h2>' +
    '<div class="cartao">' +
      '<label class="rotulo" for="desc-acerto">DESCRIÇÃO</label>' +
      '<input id="desc-acerto" class="entrada" type="text" maxlength="300" autocomplete="off" placeholder="Ex.: Cimento para a obra, Pix direto" value="' + esc(a.descricao) + '">' +
      '<label class="rotulo rotulo-espaco" for="dest-acerto">PARA QUEM FOI O DINHEIRO? <span class="suave">(opcional)</span></label>' +
      '<input id="dest-acerto" class="entrada" type="text" maxlength="120" autocomplete="off" placeholder="Ex.: Loja de materiais, pedreiro, a própria pessoa" value="' + esc(a.destinatario) + '">' +
      '<div class="rotulo rotulo-espaco">COMPROVANTE</div>' +
      '<div id="foto-acerto">' + htmlFoto() + '</div>' +
      '<label class="rotulo rotulo-espaco" for="obs-acerto">OBSERVAÇÃO <span class="suave">(opcional)</span></label>' +
      '<textarea id="obs-acerto" class="entrada" rows="2" maxlength="500">' + esc(a.observacao) + '</textarea>' +
    '</div>';
}

function htmlFoto() {
  if (a.foto) {
    return '<div class="foto-previa"><img src="data:image/jpeg;base64,' + a.foto + '" alt="Comprovante">' +
      '<button type="button" class="foto-remover" data-remover-foto aria-label="Remover foto">' + icone('fechar', 18, 2.4) + '</button></div>';
  }
  return '<label class="foto-botao foto-botao-largo">' + icone('camera', 24, 1.8) + '<span>Foto do comprovante</span><input type="file" accept="image/*" data-foto hidden></label>';
}

function passo5(v, o) {
  const valor = arred2(lerNumero(a.valorTexto));
  const naMoedaDivida = arred2(converter(valor, a.moedaPagamento, o.moeda, v.cotacoes));
  const { afetadas } = Number.isFinite(naMoedaDivida) ? previaFifo(v, o, naMoedaDivida) : { afetadas: [] };
  const devedores = devedoresDaOpcao(o);
  const outros = devedores.filter(d => !mesmaPessoa(d, a.recursosDe));

  const frase = '<strong>' + esc(a.recursosDe) + '</strong> pagou <strong>' + esc(moeda(valor, a.moedaPagamento)) + '</strong>' +
    (a.destinatario ? ' a ' + esc(a.destinatario) : '') + ' (' + esc(a.descricao) + ')' +
    ', por conta da dívida de <strong>' + esc(o.porConta === 'Ambos' ? 'João e Norma' : o.porConta) + '</strong> com <strong>' + esc(o.credor) + '</strong>.';

  return '<h2 class="pergunta">Confira antes de confirmar</h2>' +
    '<div class="cartao cartao-confirma">' +
      '<p class="frase">' + frase + '</p>' +
      (Number.isFinite(naMoedaDivida)
        ? '<p class="frase-sub">Isso abate cerca de <strong>' + esc(moeda(Math.min(naMoedaDivida, o.saldo), o.moeda)) + '</strong>' +
          (o.saldo - naMoedaDivida > 0.004 ? ' e ficam faltando cerca de <strong>' + esc(moeda(o.saldo - naMoedaDivida, o.moeda)) + '</strong>.' : ' e quita a dívida.') + '</p>'
        : '') +
      (outros.length ? '<p class="frase-sub">' + esc(outros.join(' e ')) + (outros.length > 1 ? ' passam' : ' passa') + ' a dever a parte paga a ' + esc(a.recursosDe) + '.</p>' : '') +
    '</div>' +
    (afetadas.length
      ? '<div class="cartao"><div class="rotulo">DÍVIDAS DESTA VIAGEM QUE SERÃO ABATIDAS</div>' +
        '<ul class="lista lista-simples">' + afetadas.map(({ ob, aplicado, quita }) => {
          const origem = origemDaObrigacao(v, ob);
          return '<li class="item item-compacto item-estatico"><span class="item-ic">' + (origem.icone ? icone(origem.icone, 18) : iconeCategoria(origem.categoria, 18)) + '</span>' +
            '<span class="item-meio"><span class="item-titulo">' + esc(origem.titulo) + '</span><span class="item-sub">' + esc(dataCurta(origem.data)) +
            (devedores.length > 1 ? ' · de ' + esc(ob.devedor) : '') + '</span></span>' +
            '<span class="item-dir"><span class="item-valor">' + esc(moeda(aplicado, ob.moeda)) + '</span>' +
            (quita ? '<span class="selo selo-ok">quita</span>' : '<span class="selo selo-alerta">parcial</span>') + '</span></li>';
        }).join('') + '</ul>' +
        '<p class="nota-pequena">A mais antiga é paga primeiro. Valores estimados; a planilha confirma com a PTAX do dia ' + esc(dataCurta(a.data)) + '.</p></div>'
      : '') +
    '<div class="cartao cartao-suave"><p class="nota-pequena">Se este pagamento for de outra dívida, que não seja desta viagem, <strong>não confirme</strong>: o app só controla o que nasceu nesta viagem.</p></div>';
}

/* ---------------- Tela ---------------- */

export const telaAcerto = {
  semNav: true,

  render(params) {
    if (!a || params._novo !== false) {
      a = novo(params.chave || '');
      salvo = false;
    }

    const v = visao();
    const o = opcaoAtual(v);
    if (a.passo > 1 && !o) a.passo = 1;

    let corpo;
    if (a.passo === 1) corpo = passo1(v);
    else if (a.passo === 2) corpo = passo2(v, o);
    else if (a.passo === 3) corpo = passo3(v, o);
    else if (a.passo === 4) corpo = passo4();
    else corpo = passo5(v, o);

    const ultimo = a.passo === TOTAL_PASSOS;
    const temOpcoes = opcoesDeDivida(v).length > 0;

    return cabecalho({ titulo: 'Registrar pagamento', voltarPara: '/contas' }) +
      '<div class="passos" aria-label="Passo ' + a.passo + ' de ' + TOTAL_PASSOS + '">' +
        Array.from({ length: TOTAL_PASSOS }, (_, i) => '<span class="passo' + (i + 1 <= a.passo ? ' feito' : '') + '"></span>').join('') +
      '</div>' +
      (o && a.passo > 1
        ? '<div class="contexto-divida">' + esc(o.devedor) + (o.porConta === 'Ambos' ? ' devem' : ' deve') + ' a ' + esc(o.credor) + ' · <strong>' + esc(moeda(o.saldo, o.moeda)) + '</strong></div>'
        : '') +
      '<div class="passo-corpo">' + corpo + '</div>' +
      '<p class="erro-form" id="erro-acerto" role="alert">' + esc(a.erro) + '</p>' +
      (temOpcoes
        ? '<div class="barra-salvar barra-dupla">' +
            (a.passo > 1 ? '<button type="button" class="botao botao-secundario" data-anterior>Voltar</button>' : '') +
            '<button type="button" class="botao botao-primario botao-grande" data-proximo>' + (ultimo ? 'Confirmar pagamento' : 'Continuar') + '</button>' +
          '</div>'
        : '');
  },

  montar(raiz) {
    const v = visao();
    const o = opcaoAtual(v);
    const $ = s => raiz.querySelector(s);

    raiz.querySelectorAll('[data-divida]').forEach(b => b.addEventListener('click', () => {
      if (a.chave !== b.getAttribute('data-divida')) a.recursosDe = '';
      a.chave = b.getAttribute('data-divida');
      a.erro = '';
      raiz.querySelectorAll('[data-divida]').forEach(x => {
        x.classList.toggle('ativo', x === b);
        x.setAttribute('aria-pressed', String(x === b));
      });
    }));

    ligarSegmento(raiz, 'recursosDe', valor => {
      a.recursosDe = valor;
      $('#nota-pagador').innerHTML = notaPagador(o);
    });

    ligarSegmento(raiz, 'moedaPagamento', valor => {
      a.moedaPagamento = valor;
      $('#simbolo-acerto').textContent = simboloMoeda(valor);
      $('#estimativa').innerHTML = estimativa(v, o);
    });

    const valor = $('#valor-acerto');
    if (valor) valor.addEventListener('input', () => {
      a.valorTexto = valor.value;
      $('#estimativa').innerHTML = estimativa(v, o);
    });

    const data = $('#data-acerto');
    if (data) data.addEventListener('change', () => { a.data = data.value; });

    const campos = [['#desc-acerto', 'descricao'], ['#dest-acerto', 'destinatario'], ['#obs-acerto', 'observacao']];
    campos.forEach(([sel, chave]) => {
      const el = $(sel);
      if (el) el.addEventListener('input', () => { a[chave] = el.value; });
    });

    const ligarFoto = () => {
      const area = $('#foto-acerto');
      if (!area) return;
      const input = area.querySelector('[data-foto]');
      if (input) input.addEventListener('change', async () => {
        const arquivo = input.files && input.files[0];
        if (!arquivo) return;
        area.innerHTML = '<div class="foto-botao foto-botao-largo">' + icone('atualizar', 22, 2, ' data-gira="1"') + '<span>Preparando foto…</span></div>';
        try { a.foto = await comprimirFoto(arquivo); } catch (e) { avisar('Não foi possível usar esta foto.', 'erro'); }
        area.innerHTML = htmlFoto();
        ligarFoto();
      });
      const remover = area.querySelector('[data-remover-foto]');
      if (remover) remover.addEventListener('click', () => { a.foto = ''; area.innerHTML = htmlFoto(); ligarFoto(); });
    };
    ligarFoto();

    const anterior = $('[data-anterior]');
    if (anterior) anterior.addEventListener('click', () => {
      a.erro = '';
      a.passo = Math.max(1, a.passo - 1);
      redesenhar();
    });

    const proximo = $('[data-proximo]');
    if (proximo) proximo.addEventListener('click', async () => {
      const atual = opcaoAtual(visao());
      const erro = validarPasso(v, atual);
      if (erro) {
        a.erro = erro;
        $('#erro-acerto').textContent = erro;
        return;
      }
      a.erro = '';

      if (a.passo < TOTAL_PASSOS) {
        a.passo += 1;
        redesenhar();
        return;
      }

      proximo.disabled = true;
      await gravar(atual);
    });

    if (a.passo === 3 && valor && !a.valorTexto) setTimeout(() => valor.focus(), 200);
  },

  async podeSair() {
    if (salvo || !a) return true;
    const algo = a.passo > 1 || a.valorTexto || a.descricao;
    if (!algo) return true;
    return confirmar({ titulo: 'Abandonar este pagamento?', texto: 'O que foi preenchido será perdido.', sim: 'Abandonar', nao: 'Continuar', perigo: true });
  },

  sair() {
    a = null;
  }
};

function redesenhar() {
  const tela = document.getElementById('tela');
  tela.innerHTML = telaAcerto.render({ _novo: false });
  telaAcerto.montar(tela);
  tela.querySelectorAll('[data-voltar]').forEach(el => el.addEventListener('click', ev => {
    ev.preventDefault();
    voltar('/contas');
  }));
  atualizarPilula();
  window.scrollTo(0, 0);
}

function validarPasso(v, o) {
  if (a.passo === 1 && !o) return 'Escolha a dívida que está sendo paga.';
  if (a.passo === 2 && !a.recursosDe) return 'Escolha quem pagou.';
  if (a.passo === 3) {
    if (!(lerNumero(a.valorTexto) > 0)) return 'Digite o valor pago.';
    if (!a.data) return 'Informe a data do pagamento.';
    if (a.data > hojeDia()) return 'A data do pagamento não pode ser no futuro.';
  }
  if (a.passo === 4 && !a.descricao.trim()) return 'Descreva o que foi pago.';
  return '';
}

async function gravar(o) {
  const dados = {
    id: gerarId('a', 9),
    data: new Date(a.data + 'T12:00:00').toISOString(),
    credor: o.credor,
    porConta: o.porConta,
    recursosDe: a.recursosDe,
    destinatario: a.destinatario.trim(),
    moedaObrigacao: o.moeda,
    moedaPagamento: a.moedaPagamento,
    valorPago: arred2(lerNumero(a.valorTexto)),
    descricao: a.descricao.trim(),
    observacao: a.observacao.trim()
  };
  if (a.foto) dados.foto = a.foto;

  await enfileirar('acerto.criar', dados);
  salvo = true;
  avisar(navigator.onLine ? 'Pagamento registrado' : 'Guardado no iPhone. Sobe quando houver sinal.');
  ir('/contas', true);
}

