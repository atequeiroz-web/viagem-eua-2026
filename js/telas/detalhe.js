// Detalhe de uma despesa (folha que sobe sobre o Histórico).

import { visao, enfileirar, lerFoto, fotoDaFila } from '../dados.js';
import { abrirFolha, confirmar, avisar, ir } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, moeda, num, dataCurta, hora, cotacaoBR, lerNumero, arred2, normalizar } from '../util.js';
import { refBRL, pagamentosDaObrigacao, dadosParaEdicao, obrigacoesDaDespesa, despesaComAcerto, pessoaPropria, PROTEGIDOS } from '../calculos.js';
import { abrirPagamento } from './pagamento.js';

function linha(rotulo, valor) {
  if (valor === '' || valor === null || valor === undefined) return '';
  return '<div class="det-linha"><span class="det-rotulo">' + esc(rotulo) + '</span><span class="det-valor">' + valor + '</span></div>';
}

export function abrirDetalheDespesa(id) {
  const v = visao();
  const d = v.despesas.find(x => x.id === id);
  if (!d) return;

  const ref = refBRL(d, v.cotacoes);
  const efetivo = num(d.valorEfetivo) > 0;
  const protegido = PROTEGIDOS.includes(d.id);
  const comAcerto = despesaComAcerto(v, d.id);
  const naFila = Boolean(d._fila);
  const recusadaCriacao = d._tipoOp === 'despesa.criar' && d._fila === 'recusada';

  const obrigs = obrigacoesDaDespesa(v, d.id);
  const podeFatura =
    d.moeda !== 'BRL' &&
    !normalizar(d.formaPagamento).includes('dinheiro') &&
    pessoaPropria(v, d.quemPagou) &&
    !recusadaCriacao;

  let avisoTopo = '';
  if (recusadaCriacao || d._fila === 'recusada') {
    avisoTopo = '<div class="faixa faixa-erro">' + icone('alerta', 18, 2.2) + '<span><strong>A planilha recusou este lançamento:</strong> ' + esc(d._motivo) + ' Corrija em Mais → Envio.</span></div>';
  } else if (d._avisoEdicaoRecusada) {
    avisoTopo = '<div class="faixa faixa-erro">' + icone('alerta', 18, 2.2) + '<span><strong>Uma alteração foi recusada:</strong> ' + esc(d._avisoEdicaoRecusada) + '</span></div>';
  } else if (naFila) {
    avisoTopo = '<div class="faixa faixa-alerta">' + icone('relogio', 18, 2.2) + '<span>Guardada no iPhone. Será enviada à planilha quando houver sinal.</span></div>';
  }

  const cambio = d.moeda === 'BRL'
    ? ''
    : num(d.cotacao) > 0
      ? 'R$ ' + cotacaoBR(d.cotacao) + (d.dataCotacao ? ' <span class="suave">de ' + esc(dataCurta(d.dataCotacao)) + '</span>' : '')
      : naFila ? '<span class="suave">calculado ao enviar</span>' : '';

  const obrigHtml = obrigs.length
    ? '<div class="det-bloco"><div class="rotulo">DÍVIDAS GERADAS</div>' +
      obrigs.map(o =>
        '<div class="det-obrig"><span>' + esc(o.devedor) + ' deve a ' + esc(o.credor) + '</span>' +
        '<span class="det-obrig-dir"><strong>' + esc(moeda(o.valorOriginal, o.moeda)) + '</strong>' +
        '<span class="selo ' + (o.status === 'Liquidada' ? 'selo-ok' : o.status === 'Parcial' ? 'selo-alerta' : 'selo-neutro') + '">' +
        esc(o.status === 'Parcial' ? 'Falta ' + moeda(o.saldo, o.moeda) : o.status) + '</span></span></div>' +
        pagamentosDaObrigacao(v, o.id).map(({ ap, acerto }) => acerto
          ? '<button type="button" class="det-pag" data-pagamento="' + esc(acerto.id) + '">' + icone('maos', 16, 2) +
            '<span>' + esc(dataCurta(acerto.data)) + ': ' + esc(acerto.recursosDe) + ' pagou <span class="nw">' + esc(moeda(acerto.valorPago, acerto.moedaPagamento)) + '</span>' +
            ' → abateu <span class="nw">' + esc(moeda(ap.valorAplicado, ap.moeda)) + '</span></span>' + icone('direita', 16, 2.2) + '</button>'
          : '').join('')
      ).join('') + '</div>'
    : '';

  const html =
    avisoTopo +
    '<div class="det-topo">' +
      '<span class="det-ic">' + iconeCategoria(d.categoria, 24) + '</span>' +
      '<div><div class="det-desc">' + esc(d.descricao) + '</div><div class="suave">' + esc(d.categoria) + '</div></div>' +
    '</div>' +
    '<div class="det-valores">' +
      '<div><div class="rotulo">VALOR</div><div class="det-grande">' + esc(moeda(d.valorOriginal, d.moeda)) + '</div></div>' +
      (d.moeda !== 'BRL'
        ? '<div><div class="rotulo">REFERÊNCIA EM REAIS</div><div class="det-grande det-grande-suave">' + esc(moeda(ref.valor)) + '</div>' +
          '<div class="det-nota">' + (ref.estimada ? 'estimada no aparelho' : 'cotação do dia, congelada') + '</div></div>'
        : '') +
    '</div>' +
    '<div class="det-lista">' +
      linha('Data da compra', esc(dataCurta(d.dataCompra)) + (hora(d.dataCompra) !== '00:00' ? ' <span class="suave">às ' + esc(hora(d.dataCompra)) + '</span>' : '')) +
      linha('Data de utilização', d.dataUtilizacao ? esc(dataCurta(d.dataUtilizacao)) : '') +
      linha('Momento', esc([d.momento, d.etapa].filter(Boolean).join(' · '))) +
      linha('Local', esc(d.local)) +
      linha('Quem pagou', esc(d.quemPagou)) +
      linha('De quem é', esc(d.responsavel)) +
      linha('Pagamento', esc([d.formaPagamento, d.cartao].filter(Boolean).join(' · '))) +
      linha('Câmbio', cambio) +
      (efetivo && d.moeda !== 'BRL' ? linha('Valor na fatura', esc(moeda(d.valorEfetivo))) : '') +
      linha('Situação', esc(d.status || '')) +
      linha('Observação', esc(d.observacao)) +
      linha('Lançada por', esc(d.lancadoPor || '')) +
      (d.gps ? linha('Local no mapa', '<button type="button" class="link-forte" data-acao="mapa">Ver no mapa da viagem</button>') : '') +
    '</div>' +
    obrigHtml +
    (d.comprovante
      ? '<div class="det-bloco"><div class="rotulo">COMPROVANTE</div><div class="det-foto" id="det-foto"><span class="suave">' +
        icone('atualizar', 16, 2.2, ' data-gira="1"') + ' Carregando…</span></div></div>'
      : '') +
    (protegido ? '<p class="nota-protegida">' + icone('escudo', 16, 2) + ' Registro protegido: o app só permite corrigir textos (descrição, local, observação).</p>' : '') +
    (comAcerto && !protegido ? '<p class="nota-protegida">' + icone('escudo', 16, 2) + ' Já houve pagamento sobre esta despesa: valor, moeda, data e pessoas não podem mudar, e ela não pode ser excluída. Para excluir, exclua antes os pagamentos acima (toque em cada um e em "Excluir pagamento").</p>' : '') +
    (recusadaCriacao ? '' :
      '<div class="det-acoes">' +
        '<button type="button" class="botao botao-secundario" data-acao="editar">' + icone('lapis', 18, 2) + ' Editar</button>' +
        (podeFatura ? '<button type="button" class="botao botao-secundario" data-acao="fatura">' + icone('recibo', 18, 2) + (efetivo ? ' Alterar valor da fatura' : ' Informar valor da fatura') + '</button>' : '') +
        (!protegido && !comAcerto ? '<button type="button" class="botao botao-perigo-suave" data-acao="excluir">' + icone('lixeira', 18, 2) + ' Excluir</button>' : '') +
      '</div>') +
    '<p class="det-id">Registro ' + esc(d.id) + '</p>';

  abrirFolha({
    titulo: 'Despesa',
    html,
    montar: (corpo, fechar) => {
      if (d.comprovante) carregarFoto(corpo, d.comprovante);

      corpo.addEventListener('click', async ev => {
        const pag = ev.target.closest('[data-pagamento]');
        if (pag) {
          fechar();
          abrirPagamento(pag.getAttribute('data-pagamento'));
          return;
        }
        const b = ev.target.closest('[data-acao]');
        if (!b) return;
        const acao = b.getAttribute('data-acao');

        if (acao === 'mapa') {
          fechar();
          ir('/mapa/' + encodeURIComponent(d.id));
        }

        if (acao === 'editar') {
          fechar();
          ir('/editar/' + encodeURIComponent(d.id));
        }

        if (acao === 'fatura') {
          fechar();
          abrirFatura(d);
        }

        if (acao === 'excluir') {
          const ok = await confirmar({
            titulo: 'Excluir esta despesa?',
            texto: '<strong>' + esc(d.descricao) + '</strong> (' + esc(moeda(d.valorOriginal, d.moeda)) + ') será apagada da planilha.' +
              (obrigs.length ? ' As dívidas que ela gerou também serão apagadas.' : '') + ' Fica registrado na auditoria.',
            sim: 'Excluir',
            perigo: true
          });
          if (!ok) return;
          fechar();
          await enfileirar('despesa.excluir', { id: d.id });
          avisar('Exclusão registrada');
        }
      });
    }
  });
}

export async function carregarFoto(corpo, comprovante) {
  const alvo = corpo.querySelector('#det-foto');
  if (!alvo) return;

  const src = fotoDaFila(comprovante) || await lerFoto(comprovante);

  if (!src) {
    alvo.innerHTML = '<span class="suave">' + (navigator.onLine ? 'Não foi possível carregar a foto.' : 'Sem sinal: a foto aparece quando houver internet.') + '</span>';
    return;
  }

  alvo.innerHTML = '<button type="button" class="det-foto-botao" aria-label="Ampliar comprovante"><img src="' + src + '" alt="Foto do comprovante"></button>';
  alvo.querySelector('button').addEventListener('click', () => {
    abrirFolha({ titulo: 'Comprovante', classe: 'folha-foto', html: '<img class="foto-cheia" src="' + src + '" alt="Foto do comprovante">' });
  });
}

function abrirFatura(d) {
  const atual = num(d.valorEfetivo) > 0 ? String(d.valorEfetivo).replace('.', ',') : '';

  abrirFolha({
    titulo: 'Valor da fatura',
    html:
      '<p class="texto-suave">Quando a fatura do cartão chegar, informe quanto esta compra de <strong>' + esc(moeda(d.valorOriginal, d.moeda)) +
      '</strong> custou de fato em reais (com IOF). Esse valor substitui a estimativa pela cotação.</p>' +
      '<label class="rotulo" for="fatura">VALOR NA FATURA (R$)</label>' +
      '<div class="entrada-valor-pequena"><span>R$</span><input id="fatura" class="entrada" type="text" inputmode="decimal" autocomplete="off" value="' + esc(atual) + '" placeholder="0,00"></div>' +
      '<p class="erro-form" id="erro-fatura" role="alert"></p>' +
      '<div class="det-acoes">' +
        '<button type="button" class="botao botao-primario botao-grande" data-salvar>Salvar valor</button>' +
        (atual ? '<button type="button" class="botao botao-secundario" data-limpar>Voltar a usar a estimativa</button>' : '') +
      '</div>',
    montar: (corpo, fechar) => {
      const campo = corpo.querySelector('#fatura');
      setTimeout(() => campo.focus(), 250);

      corpo.querySelector('[data-salvar]').addEventListener('click', async () => {
        const valor = arred2(lerNumero(campo.value));
        if (!(valor > 0)) {
          corpo.querySelector('#erro-fatura').textContent = 'Digite o valor em reais.';
          return;
        }
        await enfileirar('despesa.editar', { ...dadosParaEdicao(d), valorEfetivo: valor });
        fechar();
        avisar('Valor da fatura registrado');
      });

      const limpar = corpo.querySelector('[data-limpar]');
      if (limpar) {
        limpar.addEventListener('click', async () => {
          await enfileirar('despesa.editar', { ...dadosParaEdicao(d), valorEfetivo: '' });
          fechar();
          avisar('Voltou a usar a estimativa');
        });
      }
    }
  });
}

