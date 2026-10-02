// DINHEIRO EM ESPÉCIE: compras de moeda (aba Fundos) e saldos.

import { estado, visao, enfileirar } from '../dados.js';
import { cabecalho, segmento, ligarSegmento, confirmar, avisar, ir, vazio } from '../ui.js';
import { icone } from '../icones.js';
import {
  esc, moeda, simboloMoeda, num, arred2, lerNumero, numeroBR, dataCurta,
  paraCampoDataHora, gerarId
} from '../util.js';
import { pessoaPropria } from '../calculos.js';

/* ---------------- Lista ---------------- */

export const telaFundos = {
  aba: '',
  vivo: true,

  render() {
    const v = visao();
    const saldos = (v.saldosMoeda || []).filter(s => num(s.quantidade) > 0);
    const fundos = (v.fundos || []).slice().sort((a, b) => String(b.data).localeCompare(String(a.data)));

    return cabecalho({ titulo: 'Dinheiro em espécie', voltarPara: '/mais' }) +
      '<section class="cartao">' +
        '<div class="cartao-topo"><h2 class="cartao-titulo">Saldo atual</h2></div>' +
        (saldos.length
          ? saldos.map(s =>
              '<div class="linha-simples"><span>' + esc(s.pessoa) + '<span class="suave"> · custo médio R$ ' + esc(numeroBR(s.precoMedio, 4)) + '</span></span>' +
              '<strong>' + esc(moeda(s.quantidade, s.moeda)) + '</strong></div>').join('')
          : '<p class="texto-suave">Nenhum dinheiro em espécie registrado.</p>') +
        '<p class="nota-pequena">Cada despesa paga em dinheiro usa o custo médio das compras de moeda de quem pagou.</p>' +
      '</section>' +
      '<div class="area-botao"><a href="#/fundo/novo" class="botao botao-primario botao-grande">' + icone('mais', 20, 2.4) + ' Registrar compra de moeda</a></div>' +
      (fundos.length
        ? '<h2 class="secao-titulo">Compras registradas</h2><ul class="lista lista-cartao">' + fundos.map(f =>
            '<li><a href="#/fundo/' + encodeURIComponent(f.id) + '" class="item item-link">' +
              '<span class="item-ic">' + icone('dinheiro', 20) + '</span>' +
              '<span class="item-meio"><span class="item-titulo">' + esc(f.recursosDe) + ' comprou ' + esc(moeda(f.quantidade, f.moeda)) + '</span>' +
              '<span class="item-sub">' + esc(dataCurta(f.data)) + (num(f.custoTotal) > 0 ? ' · custou ' + esc(moeda(f.custoTotal)) + ' (R$ ' + esc(numeroBR(num(f.custoTotal) / num(f.quantidade), 4)) + ')' : '') + '</span>' +
              (f._fila ? '<span class="selo ' + (f._fila === 'recusada' ? 'selo-erro">Recusado' : 'selo-alerta">Na fila') + '</span>' : '') +
              '</span>' + icone('direita', 18, 2.2) + '</a></li>'
          ).join('') + '</ul>'
        : vazio('dinheiro', 'Nenhuma compra de moeda', 'Registre aqui cada vez que comprar dólares ou guaranis em espécie.'));
  }
};

/* ---------------- Formulário ---------------- */

let f = null;
let salvo = false;

export const telaFundo = {
  semNav: true,

  render(params) {
    const v = visao();
    salvo = false;
    const editando = params.id && params.id !== 'novo';

    if (editando) {
      const x = v.fundos.find(y => y.id === params.id);
      if (!x) return cabecalho({ titulo: 'Compra de moeda', voltarPara: '/fundos' }) + '<div class="cartao"><p>Registro não encontrado.</p></div>';
      f = {
        id: x.id, editando: true, moeda: x.moeda || 'USD',
        quantidadeTexto: numeroBR(x.quantidade, x.moeda === 'PYG' ? 0 : 2),
        recursosDe: x.recursosDe, responsavel: x.responsavel || '',
        custoTexto: num(x.custoTotal) > 0 ? numeroBR(x.custoTotal, 2) : '',
        data: paraCampoDataHora(x.data), observacao: x.observacao || ''
      };
    } else {
      f = {
        id: gerarId('f', 9), editando: false, moeda: 'USD', quantidadeTexto: '',
        recursosDe: estado.usuario, responsavel: estado.usuario,
        custoTexto: '', data: paraCampoDataHora(new Date()), observacao: ''
      };
    }

    const pessoas = (v.pessoas || []).filter(p => p.ativo).map(p => p.nome);

    return cabecalho({ titulo: f.editando ? 'Compra de moeda' : 'Nova compra de moeda', voltarPara: '/fundos' }) +
      '<form id="form-fundo" novalidate>' +
        '<p class="erro-form erro-topo" id="erro-fundo" role="alert"></p>' +
        '<section class="cartao">' +
          '<div class="cartao-topo"><label class="rotulo" for="qtd">QUANTIDADE COMPRADA</label>' + segmento('moeda-fundo', ['USD', 'PYG'], f.moeda, 'seg-moeda') + '</div>' +
          '<div class="valor-grande"><span class="valor-simbolo" id="simbolo-fundo">' + esc(simboloMoeda(f.moeda)) + '</span>' +
          '<input id="qtd" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(f.quantidadeTexto) + '"></div>' +
        '</section>' +
        '<section class="cartao">' +
          '<div class="rotulo">DE QUEM É O DINHEIRO</div>' +
          segmento('recursos-fundo', pessoas, f.recursosDe, 'seg-quebra') +
          '<div class="rotulo rotulo-espaco">PARA USO DE</div>' +
          segmento('resp-fundo', ['João', 'Norma', 'Compartilhada'], f.responsavel) +
          '<div id="area-custo">' + htmlCusto(v) + '</div>' +
        '</section>' +
        '<section class="cartao">' +
          '<label class="rotulo" for="data-fundo">DATA E HORA DA COMPRA</label>' +
          '<input id="data-fundo" class="entrada" type="datetime-local" value="' + esc(f.data) + '">' +
          '<p class="nota-pequena">A hora importa: despesas em dinheiro feitas antes desta compra não usam este lote.</p>' +
          '<label class="rotulo rotulo-espaco" for="obs-fundo">OBSERVAÇÃO</label>' +
          '<textarea id="obs-fundo" class="entrada" rows="2" maxlength="500" placeholder="Ex.: Casa de câmbio no aeroporto">' + esc(f.observacao) + '</textarea>' +
        '</section>' +
        '<div class="barra-salvar' + (f.editando ? ' barra-dupla' : '') + '">' +
          (f.editando ? '<button type="button" class="botao botao-perigo-suave" data-excluir>' + icone('lixeira', 18, 2) + '</button>' : '') +
          '<button type="submit" class="botao botao-primario botao-grande">' + (f.editando ? 'Salvar alterações' : 'Salvar compra') + '</button>' +
        '</div>' +
      '</form>';
  },

  montar(raiz) {
    if (!f) return;
    const v = visao();
    const $ = s => raiz.querySelector(s);

    const atualizarCusto = () => {
      $('#area-custo').innerHTML = htmlCusto(v);
      const c = $('#custo');
      if (c) c.addEventListener('input', () => { f.custoTexto = c.value; $('#unitario').innerHTML = htmlUnitario(); });
    };

    ligarSegmento(raiz, 'moeda-fundo', valor => {
      f.moeda = valor;
      $('#simbolo-fundo').textContent = simboloMoeda(valor);
      atualizarCusto();
    });
    ligarSegmento(raiz, 'recursos-fundo', valor => { f.recursosDe = valor; atualizarCusto(); });
    ligarSegmento(raiz, 'resp-fundo', valor => { f.responsavel = valor; });

    $('#qtd').addEventListener('input', ev => {
      f.quantidadeTexto = ev.target.value;
      const u = $('#unitario');
      if (u) u.innerHTML = htmlUnitario();
    });
    $('#data-fundo').addEventListener('change', ev => { f.data = ev.target.value; });
    $('#obs-fundo').addEventListener('input', ev => { f.observacao = ev.target.value; });
    atualizarCusto();

    const excluir = $('[data-excluir]');
    if (excluir) excluir.addEventListener('click', async () => {
      const ok = await confirmar({
        titulo: 'Excluir esta compra de moeda?',
        texto: 'O custo médio do dinheiro em espécie será recalculado. Despesas em dinheiro podem ficar sem saldo.',
        sim: 'Excluir',
        perigo: true
      });
      if (!ok) return;
      await enfileirar('fundo.excluir', { id: f.id });
      salvo = true;
      avisar('Exclusão registrada');
      ir('/fundos', true);
    });

    $('#form-fundo').addEventListener('submit', async ev => {
      ev.preventDefault();
      const erro = $('#erro-fundo');
      const quantidade = arred2(lerNumero(f.quantidadeTexto));
      const custo = arred2(lerNumero(f.custoTexto));
      const propria = pessoaPropria(v, f.recursosDe);

      if (!(quantidade > 0)) { erro.textContent = 'Digite a quantidade comprada.'; return; }
      if (propria && !(custo > 0)) { erro.textContent = 'Informe quanto custou em reais.'; return; }
      if (!f.data) { erro.textContent = 'Informe a data e a hora da compra.'; return; }

      const dados = {
        id: f.id,
        data: new Date(f.data).toISOString(),
        moeda: f.moeda,
        quantidade,
        recursosDe: f.recursosDe,
        responsavel: f.responsavel,
        custoTotal: custo > 0 ? custo : '',
        observacao: f.observacao.trim()
      };

      await enfileirar(f.editando ? 'fundo.editar' : 'fundo.criar', dados);
      salvo = true;
      avisar(f.editando ? 'Compra de moeda alterada' : 'Compra de moeda registrada');
      ir('/fundos', true);
    });
  },

  async podeSair() {
    if (salvo || !f || f.editando || !(f.quantidadeTexto || f.custoTexto)) return true;
    return confirmar({ titulo: 'Descartar esta compra?', texto: 'O que foi preenchido será perdido.', sim: 'Descartar', nao: 'Continuar', perigo: true });
  },

  sair() {
    f = null;
  }
};

function htmlCusto(v) {
  const propria = pessoaPropria(v, f.recursosDe);
  if (!propria) {
    return '<div class="aviso-obrig aviso-obrig-neutro">' + icone('info', 18, 2.2) +
      '<span>Dinheiro de ' + esc(f.recursosDe) + ': não entra no saldo em espécie de João e Norma. ' +
      'Ao gastar esse dinheiro, lance a despesa com <strong>Quem pagou: ' + esc(f.recursosDe) + '</strong>.</span></div>';
  }
  return '<label class="rotulo rotulo-espaco" for="custo">QUANTO CUSTOU EM REAIS</label>' +
    '<div class="entrada-valor-pequena"><span>R$</span><input id="custo" class="entrada" type="text" inputmode="decimal" autocomplete="off" placeholder="0,00" value="' + esc(f.custoTexto) + '"></div>' +
    '<p class="nota-pequena" id="unitario">' + htmlUnitario() + '</p>';
}

function htmlUnitario() {
  const q = lerNumero(f.quantidadeTexto);
  const c = lerNumero(f.custoTexto);
  if (!(q > 0) || !(c > 0)) return 'Informe o total pago, com taxas.';
  return f.moeda === 'PYG'
    ? 'Custo: R$ ' + esc(numeroBR(c / q * 1000, 2)) + ' por ₲ 1.000'
    : 'Custo: R$ ' + esc(numeroBR(c / q, 4)) + ' por dólar';
}

