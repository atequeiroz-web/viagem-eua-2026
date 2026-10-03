// MAIS: aparelho, envio, dinheiro em espécie e informações.

import { estado, visao, sincronizar, desconectar, pendentes } from '../dados.js';
import { cabecalho, confirmar, avisar, ir, abrirFolha } from '../ui.js';
import { lerDiario } from '../db.js';
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
        '<li>' + link('/relatorios', 'recibo', 'Relatórios', 'Extrato, por pessoa, por cartão, dívidas e montado') + '</li>' +
        '<li>' + link('/fundos', 'dinheiro', 'Dinheiro em espécie', 'Compras de dólar e guarani e saldos') + '</li>' +
        '<li>' + link('/cadastros', 'usuario', 'Cadastros', 'Pagadores, cartões e categorias') + '</li>' +
      '</ul>' +
      '<div class="area-botao"><button type="button" class="botao botao-secundario botao-grande" data-atualizar>' + icone('atualizar', 20, 2.2) + ' Atualizar dados agora</button></div>' +
      '<section class="cartao">' +
        '<div class="linha-simples"><span>Versão do app</span><strong>' + esc(VERSAO) + '</strong></div>' +
        '<div class="linha-simples"><span>Versão da ponte</span><strong>' + esc(v.versaoApi || '—') + '</strong></div>' +
        '<p class="texto-suave">Os cálculos oficiais (câmbio, dívidas, acertos) são feitos pelo motor na planilha. O app mostra e envia os lançamentos.</p>' +
        '<button type="button" class="botao-texto" data-diario>Ver o diário deste iPhone</button>' +
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

    raiz.querySelector('[data-diario]').addEventListener('click', () => {
      const lista = lerDiario().slice().reverse();
      const quando = iso => {
        const d = new Date(iso);
        return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      };
      abrirFolha({
        titulo: 'Diário deste iPhone',
        html: '<p class="texto-suave">Aberturas do app e falhas do armazenamento, da mais recente para a mais antiga. Serve para descobrir o que aconteceu se o app fechar ou pedir a chave de novo.</p>' +
          (lista.length
            ? '<ul class="lista lista-simples">' + lista.map(x =>
                '<li class="item item-compacto item-estatico"><span class="item-meio"><span class="item-sub">' + esc(quando(x.quando)) + '</span>' +
                '<span class="item-titulo diario-texto">' + esc(x.texto) + '</span></span></li>').join('') + '</ul>'
            : '<p class="texto-suave">Nada registrado ainda.</p>')
      });
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
