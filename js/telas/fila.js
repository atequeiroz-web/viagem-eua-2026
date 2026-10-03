// ENVIO PARA A PLANILHA: situação da sincronização e fila.

import { estado, sincronizar, descartarOperacao, tentarDeNovo, trocarChave } from '../dados.js';
import { cabecalho, confirmar, avisar, ir, renderizar } from '../ui.js';
import { icone } from '../icones.js';
import { esc, moeda, dataCurta, hora, tempoRelativo } from '../util.js';

const ROTULOS = {
  'despesa.criar': 'Nova despesa',
  'despesa.editar': 'Alteração de despesa',
  'despesa.excluir': 'Exclusão de despesa',
  'acerto.criar': 'Pagamento de dívida',
  'fundo.criar': 'Compra de moeda',
  'pessoa.criar': 'Novo pagador',
  'categoria.criar': 'Nova categoria',
  'cartao.salvar': 'Cartão',
  'fundo.editar': 'Alteração de compra de moeda',
  'fundo.excluir': 'Exclusão de compra de moeda'
};

function descreverOp(op) {
  const d = op.dados || {};
  if (op.tipo.startsWith('despesa') && op.tipo !== 'despesa.excluir') return (d.descricao || '') + ' · ' + moeda(d.valorOriginal, d.moeda);
  if (op.tipo === 'despesa.excluir') return 'Registro ' + d.id;
  if (op.tipo === 'pessoa.criar' || op.tipo === 'categoria.criar') return d.nome;
  if (op.tipo === 'cartao.salvar') return d.nome + ' (' + d.dono + ')';
  if (op.tipo === 'acerto.criar') return d.recursosDe + ' pagou ' + moeda(d.valorPago, d.moedaPagamento) + ' a ' + d.credor;
  if (op.tipo === 'fundo.excluir') return 'Registro ' + d.id;
  if (op.tipo.startsWith('fundo')) return moeda(d.quantidade, d.moeda) + (d.custoTotal ? ' por ' + moeda(d.custoTotal) : '');
  return '';
}

function cartaoSituacao() {
  const n = estado.fila.filter(o => o.estado !== 'recusada').length;
  let ic = 'check';
  let classe = 'sit-ok';
  let titulo = 'Tudo enviado';
  let texto = 'A planilha está em dia com este iPhone.';

  if (estado.sincronizando) {
    ic = 'atualizar'; classe = 'sit-envio'; titulo = n ? 'Enviando…' : 'Atualizando…'; texto = 'Conversando com a planilha.';
  } else if (!estado.online) {
    ic = 'semSinal'; classe = 'sit-alerta'; titulo = 'Sem sinal';
    texto = n === 1 ? '1 lançamento guardado no iPhone. Sobe sozinho quando houver internet.'
      : n ? n + ' lançamentos guardados no iPhone. Sobem sozinhos quando houver internet.'
      : 'Você pode continuar lançando normalmente.';
  } else if (n) {
    ic = 'relogio'; classe = 'sit-alerta'; titulo = n + (n === 1 ? ' lançamento na fila' : ' lançamentos na fila'); texto = 'Toque em Enviar agora ou aguarde.';
  }

  return '<section class="cartao situacao ' + classe + '">' +
    '<span class="sit-ic">' + icone(ic, 26, 2.2, estado.sincronizando ? ' data-gira="1"' : '') + '</span>' +
    '<div><h2 class="sit-titulo">' + esc(titulo) + '</h2><p class="sit-texto">' + esc(texto) + '</p>' +
    '<p class="suave">Planilha lida ' + esc(tempoRelativo(estado.ultimaSync)) + '</p></div>' +
    '</section>';
}

export const telaFila = {
  semNav: false,
  aba: '',
  vivo: true,

  render() {
    const controle = (estado.snapshot && estado.snapshot.controle) || {};
    const ops = estado.fila.slice().sort((a, b) => a.seq - b.seq);

    return cabecalho({ titulo: 'Envio', sobre: 'PLANILHA ⇄ IPHONE', voltarPara: '/mais' }) +
      cartaoSituacao() +
      (estado.chaveInvalida
        ? '<section class="cartao">' +
            '<h2 class="cartao-titulo">Chave de acesso</h2>' +
            '<p class="texto-suave">A planilha não aceitou a chave guardada neste iPhone (ela pode ter sido trocada). Digite a chave atual.</p>' +
            '<input id="nova-chave" class="entrada entrada-chave" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="19">' +
            '<p class="erro-form" id="erro-chave" role="alert"></p>' +
            '<button type="button" class="botao botao-primario" data-trocar-chave>Salvar chave</button>' +
          '</section>'
        : '') +
      (estado.ultimoErro && !estado.chaveInvalida
        ? '<div class="faixa faixa-alerta">' + icone('alerta', 18, 2.2) + '<span>' + esc(estado.ultimoErro) + '</span></div>'
        : '') +
      '<div class="area-botao"><button type="button" class="botao botao-primario botao-grande" data-enviar' + (estado.sincronizando ? ' disabled' : '') + '>' +
        icone('atualizar', 20, 2.2) + (ops.length ? ' Enviar agora' : ' Atualizar agora') + '</button></div>' +
      (ops.length
        ? '<h2 class="secao-titulo">Na fila</h2><ul class="lista lista-cartao">' + ops.map(op => {
            const selo = op.estado === 'recusada' ? '<span class="selo selo-erro">Recusado</span>'
              : op.estado === 'erro' ? '<span class="selo selo-alerta">Erro · tentará de novo</span>'
              : '<span class="selo selo-neutro">Aguardando</span>';
            const corrigivel = op.estado === 'recusada' && (op.tipo === 'despesa.criar' || op.tipo === 'despesa.editar');
            return '<li class="item item-estatico item-coluna">' +
              '<div class="item-linha"><span class="item-meio"><span class="item-titulo">' + esc(ROTULOS[op.tipo] || op.tipo) + '</span>' +
              '<span class="item-sub">' + esc(descreverOp(op)) + '</span>' +
              '<span class="item-sub">Lançado em ' + esc(dataCurta(op.criadoEm)) + ' às ' + esc(hora(op.criadoEm)) + '</span></span>' + selo + '</div>' +
              (op.motivo ? '<p class="motivo">' + esc(op.motivo) + '</p>' : '') +
              (op.estado === 'recusada'
                ? '<div class="item-acoes">' +
                    (corrigivel ? '<button type="button" class="botao botao-secundario botao-pequeno" data-corrigir="' + esc(op.opId) + '">' + icone('lapis', 16, 2) + ' Corrigir</button>' : '') +
                    '<button type="button" class="botao botao-perigo-suave botao-pequeno" data-descartar="' + esc(op.opId) + '">' + icone('lixeira', 16, 2) + ' Descartar</button>' +
                  '</div>'
                : op.estado === 'erro'
                  ? '<div class="item-acoes"><button type="button" class="botao botao-secundario botao-pequeno" data-tentar="' + esc(op.opId) + '">' + icone('atualizar', 16, 2) + ' Tentar de novo</button></div>'
                  : '') +
            '</li>';
          }).join('') + '</ul>'
        : '') +
      '<h2 class="secao-titulo">Cálculo na planilha</h2>' +
      '<section class="cartao">' +
        '<div class="linha-simples"><span>Situação do motor</span><strong class="' + (controle.status === 'ERRO' ? 'texto-erro' : '') + '">' + esc(controle.status || '—') + '</strong></div>' +
        (controle.observacao ? '<p class="texto-suave">' + esc(controle.observacao) + '</p>' : '') +
        '<div class="linha-simples"><span>Último cálculo</span><strong>' + esc(controle.ultimoProcessamento ? dataCurta(controle.ultimoProcessamento) + ' ' + hora(controle.ultimoProcessamento) : '—') + '</strong></div>' +
      '</section>';
  },

  montar(raiz) {
    raiz.addEventListener('click', async ev => {
      if (ev.target.closest('[data-enviar]')) {
        if (!navigator.onLine) return avisar('Sem internet agora.', 'info');
        await sincronizar();
        if (!estado.ultimoErro) avisar('Planilha atualizada');
        return;
      }

      const corrigir = ev.target.closest('[data-corrigir]');
      if (corrigir) return ir('/corrigir/' + encodeURIComponent(corrigir.getAttribute('data-corrigir')));

      const tentar = ev.target.closest('[data-tentar]');
      if (tentar) return tentarDeNovo(tentar.getAttribute('data-tentar'));

      const descartar = ev.target.closest('[data-descartar]');
      if (descartar) {
        const ok = await confirmar({
          titulo: 'Descartar este lançamento?',
          texto: 'Ele foi recusado pela planilha e será apagado deste iPhone. Nada muda na planilha.',
          sim: 'Descartar',
          perigo: true
        });
        if (ok) {
          await descartarOperacao(descartar.getAttribute('data-descartar'));
          avisar('Lançamento descartado');
        }
        return;
      }

      if (ev.target.closest('[data-trocar-chave]')) {
        const campo = raiz.querySelector('#nova-chave');
        const r = await trocarChave(campo.value.trim());
        if (r.ok) {
          avisar('Chave atualizada');
          renderizar(true);
        } else {
          raiz.querySelector('#erro-chave').textContent = r.erro || 'Não foi possível validar a chave.';
        }
      }
    });

    const campo = raiz.querySelector('#nova-chave');
    if (campo) {
      campo.addEventListener('input', () => {
        const limpo = campo.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
        const formatado = (limpo.match(/.{1,4}/g) || []).join('-');
        if (formatado !== campo.value) campo.value = formatado;
      });
    }
  }
};
