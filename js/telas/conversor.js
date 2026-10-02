// CONVERSOR: usa as cotações guardadas no aparelho (funciona sem sinal).

import { visao } from '../dados.js';
import { cabecalho, abrirFolha, renderizar } from '../ui.js';
import { icone } from '../icones.js';
import { esc, moeda, numeroBR, lerNumero, dataCurta, tempoRelativo, simboloMoeda } from '../util.js';
import { converter, cotacaoBRL } from '../calculos.js';

const NOMES = { USD: 'Dólar americano', BRL: 'Real', PYG: 'Guarani paraguaio' };
const c = { valorTexto: '100', de: 'USD', para: 'BRL' };

function resultado(v) {
  const valor = lerNumero(c.valorTexto);
  if (!(valor > 0)) return '—';
  const r = converter(valor, c.de, c.para, v.cotacoes);
  if (!Number.isFinite(r)) return 'sem cotação';
  return moeda(r, c.para);
}

function taxa(v) {
  const r = converter(1, c.de, c.para, v.cotacoes);
  if (!Number.isFinite(r)) return '';
  if (c.de === 'PYG') return '₲ 1.000 = ' + moeda(r * 1000, c.para);
  const destino = c.para === 'PYG' ? moeda(r, 'PYG') : simboloMoeda(c.para) + ' ' + numeroBR(r, 4);
  return moeda(1, c.de) + ' = ' + destino;
}

function botaoMoeda(lado) {
  const cod = c[lado];
  return '<button type="button" class="moeda-botao" data-escolher="' + lado + '">' + esc(cod) + icone('baixo', 14, 2.4) + '</button>';
}

export const telaConversor = {
  aba: 'conversor',

  aoMudarDados() {
    if (document.activeElement && document.activeElement.id === 'conv-valor') return;
    renderizar(true);
  },

  render() {
    const v = visao();
    const usd = v.cotacoes.USD;
    const pyg = v.cotacoes.PYG;

    return cabecalho({ titulo: 'Conversor', sobre: 'BANCO CENTRAL DO BRASIL' }) +
      '<section class="cartao conv">' +
        '<label class="rotulo" for="conv-valor">DE · ' + esc(NOMES[c.de]) + '</label>' +
        '<div class="conv-linha">' + botaoMoeda('de') +
          '<input id="conv-valor" type="text" inputmode="decimal" autocomplete="off" value="' + esc(c.valorTexto) + '" aria-label="Valor a converter"></div>' +
        '<div class="conv-meio"><button type="button" class="conv-trocar" data-trocar aria-label="Inverter moedas">' + icone('trocar', 22, 2.2) + '</button></div>' +
        '<div class="rotulo">PARA · ' + esc(NOMES[c.para]) + '</div>' +
        '<div class="conv-linha">' + botaoMoeda('para') + '<output id="conv-resultado" class="conv-resultado">' + esc(resultado(v)) + '</output></div>' +
        '<div class="conv-taxa" id="conv-taxa">' + esc(taxa(v)) + '</div>' +
      '</section>' +
      '<div class="atalhos">' + [10, 20, 50, 100, 500].map(n =>
        '<button type="button" class="atalho' + (lerNumero(c.valorTexto) === n ? ' ativo' : '') + '" data-atalho="' + n + '">' + n + '</button>'
      ).join('') + '</div>' +
      '<section class="cartao">' +
        '<div class="cot-linha"><span class="cot-sigla">USD</span><div class="cot-meio"><strong>Dólar americano</strong><span class="suave">PTAX venda' + (usd ? ' · ' + esc(dataCurta(usd.data)) : '') + '</span></div>' +
        '<div class="cot-valor">' + (usd ? 'R$ ' + esc(numeroBR(usd.cotacao, 4)) : '—') + '</div></div>' +
        '<div class="cot-linha"><span class="cot-sigla">PYG</span><div class="cot-meio"><strong>Guarani paraguaio</strong><span class="suave">SML Real/Guarani' + (pyg ? ' · ' + esc(dataCurta(pyg.data)) : '') + '</span></div>' +
        '<div class="cot-valor">' + (pyg ? 'R$ ' + esc(numeroBR(cotacaoBRL('PYG', v.cotacoes) * 1000, 2)) + '<span class="suave">por ₲ 1.000</span>' : '—') + '</div></div>' +
      '</section>' +
      '<p class="rodape-dados">' + icone('relogio', 15, 2) + ' Cotações atualizadas ' + esc(tempoRelativo(usd && usd.atualizadoEm)) + '. Sem sinal, o conversor usa as últimas guardadas.</p>';
  },

  montar(raiz) {
    const v = visao();
    const campo = raiz.querySelector('#conv-valor');

    const atualizar = () => {
      raiz.querySelector('#conv-resultado').textContent = resultado(v);
      raiz.querySelectorAll('[data-atalho]').forEach(b => b.classList.toggle('ativo', Number(b.getAttribute('data-atalho')) === lerNumero(c.valorTexto)));
    };

    campo.addEventListener('input', () => { c.valorTexto = campo.value; atualizar(); });

    raiz.addEventListener('click', ev => {
      const at = ev.target.closest('[data-atalho]');
      if (at) {
        c.valorTexto = at.getAttribute('data-atalho');
        campo.value = c.valorTexto;
        atualizar();
        return;
      }

      if (ev.target.closest('[data-trocar]')) {
        [c.de, c.para] = [c.para, c.de];
        renderizar(true);
        return;
      }

      const esc_ = ev.target.closest('[data-escolher]');
      if (esc_) {
        const lado = esc_.getAttribute('data-escolher');
        abrirFolha({
          titulo: lado === 'de' ? 'Converter de' : 'Converter para',
          html: '<div class="opcoes">' + ['USD', 'BRL', 'PYG'].map(m =>
            '<button type="button" class="opcao' + (c[lado] === m ? ' ativo' : '') + '" data-valor="' + m + '"><span><strong>' + m + '</strong> · ' + NOMES[m] + '</span>' +
            (c[lado] === m ? icone('check', 20, 2.6) : '') + '</button>').join('') + '</div>',
          montar: (corpo, fechar) => corpo.addEventListener('click', e => {
            const b = e.target.closest('[data-valor]');
            if (!b) return;
            const outro = lado === 'de' ? 'para' : 'de';
            const novo = b.getAttribute('data-valor');
            if (c[outro] === novo) c[outro] = c[lado];
            c[lado] = novo;
            fechar();
            renderizar(true);
          })
        });
      }
    });
  }
};
