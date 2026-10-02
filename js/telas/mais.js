// MAIS: aparelho, envio, dinheiro em espécie e informações.

import { estado, visao, sincronizar, desconectar, pendentes } from '../dados.js';
import { cabecalho, confirmar, avisar, ir } from '../ui.js';
import { icone } from '../icones.js';
import { esc, tempoRelativo } from '../util.js';
import { VERSAO } from '../config.js';

export const telaMais = {
  aba: '',
  vivo: true,

  render() {
    const v = visao();
    const n = pendentes().length;
    const recusados = estado.fila.length - n;

    const link = (rota, ic, titulo, sub, extra = '') =>
      '<a href="#' + rota + '" class="item item-link"><span class="item-ic">' + icone(ic, 20) + '</span>' +
      '<span class="item-meio"><span class="item-titulo">' + esc(titulo) + '</span><span class="item-sub">' + sub + '</span></span>' +
      extra + icone('direita', 18, 2.2) + '</a>';

    return cabecalho({ titulo: 'Mais', voltarPara: '/resumo' }) +
      '<section class="cartao aparelho">' +
        '<span class="avatar avatar-grande ' + (estado.usuario === 'Norma' ? 'av-norma' : 'av-joao') + '">' + esc(String(estado.usuario || '?')[0]) + '</span>' +
        '<div><div class="rotulo">ESTE IPHONE É DE</div><div class="aparelho-nome">' + esc(estado.usuario) + '</div>' +
        '<div class="suave">' + esc(v.planilha || '') + '</div></div>' +
      '</section>' +
      '<ul class="lista lista-cartao">' +
        '<li>' + link('/fila', 'nuvem', 'Envio para a planilha',
          n ? esc(n + (n === 1 ? ' lançamento na fila' : ' lançamentos na fila')) : 'Planilha lida ' + esc(tempoRelativo(estado.ultimaSync)),
          recusados ? '<span class="selo selo-erro">' + recusados + '</span>' : '') + '</li>' +
        '<li>' + link('/fundos', 'dinheiro', 'Dinheiro em espécie', 'Compras de dólar e guarani e saldos') + '</li>' +
      '</ul>' +
      '<div class="area-botao"><button type="button" class="botao botao-secundario botao-grande" data-atualizar>' + icone('atualizar', 20, 2.2) + ' Atualizar dados agora</button></div>' +
      '<section class="cartao">' +
        '<div class="linha-simples"><span>Versão do app</span><strong>' + esc(VERSAO) + '</strong></div>' +
        '<div class="linha-simples"><span>Versão da ponte</span><strong>' + esc(v.versaoApi || '—') + '</strong></div>' +
        '<p class="texto-suave">Os cálculos oficiais (câmbio, dívidas, acertos) são feitos pelo motor na planilha. O app mostra e envia os lançamentos.</p>' +
      '</section>' +
      '<div class="area-botao"><button type="button" class="botao botao-perigo-suave" data-desconectar>' + icone('sair', 18, 2) + ' Desconectar este iPhone</button></div>';
  },

  montar(raiz) {
    raiz.querySelector('[data-atualizar]').addEventListener('click', async () => {
      if (!navigator.onLine) return avisar('Sem internet agora.', 'info');
      await sincronizar();
      if (!estado.ultimoErro) avisar('Dados atualizados');
      else avisar(estado.ultimoErro, 'erro');
    });

    raiz.querySelector('[data-desconectar]').addEventListener('click', async () => {
      const n = estado.fila.length;
      const ok = await confirmar({
        titulo: 'Desconectar este iPhone?',
        texto: (n
          ? '<strong>Atenção: há ' + n + (n === 1 ? ' lançamento que ainda não foi enviado' : ' lançamentos que ainda não foram enviados') + ' e ' + (n === 1 ? 'será perdido' : 'serão perdidos') + '.</strong> '
          : '') + 'Os dados guardados no aparelho serão apagados. A planilha não é alterada. Para voltar a usar, será preciso digitar a chave de novo.',
        sim: 'Desconectar',
        perigo: true
      });
      if (!ok) return;
      await desconectar();
      ir('/inicio', true);
    });
  }
};
