// Ponto de partida do app.

import { iniciar, configurado, sincronizar, estado, assinar } from './dados.js';
import { VERSAO } from './config.js';
import { registrarRota, iniciarNavegacao, ir, mostrarNovaVersao, renderizar } from './ui.js';
import { icone } from './icones.js';
import { esc, permissaoLocalizacao } from './util.js';
import { registrarDiario } from './db.js';
import { telaInicio } from './telas/inicio.js';
import { telaResumo, telaResumoDias, telaResumoTotal, telaResumoAnalise } from './telas/resumo.js';
import { telaHistorico } from './telas/historico.js';
import { telaDespesa } from './telas/despesa.js';
import { telaContas, telaConta, telaPagamentos } from './telas/contas.js';
import { telaAcerto } from './telas/acerto.js';
import { telaConversor } from './telas/conversor.js';
import { telaMais } from './telas/mais.js';
import { telaFila } from './telas/fila.js';
import { telaFundos, telaFundo } from './telas/fundos.js';
import { telaCadastros } from './telas/cadastros.js';
import { telaSobre } from './telas/sobre.js';
import { telaMapa } from './telas/mapa.js';
import {
  telaRelatorios, telaRelExtrato, telaRelPessoa, telaRelCartao, telaRelDividas, telaRelMontar
} from './telas/relatorio.js';

/*
 * Sem a cópia da planilha no iPhone (primeira abertura depois de o iOS
 * apagar os dados, por exemplo), nenhuma tela abre "vazia": aparece o
 * aviso de que os dados estão sendo baixados, e a tela pedida abre
 * sozinha quando eles chegam. Abrir vazia fazia sumir categorias e
 * pagadores e dava a falsa mensagem de ponte desatualizada (1.4.0).
 */
let esperandoPlanilha = false;

function telaBaixando() {
  const semSinal = !navigator.onLine;
  const erro = estado.ultimoErro;
  return '<div class="inicio baixando">' +
    '<img src="icones/icone-192.png" alt="" width="64" height="64" class="inicio-icone' + (semSinal || erro ? '' : ' pulsando') + '">' +
    '<h1 class="inicio-titulo">' + (semSinal ? 'Sem internet' : erro ? 'Não deu para baixar os dados' : 'Baixando os dados da planilha…') + '</h1>' +
    '<p class="inicio-sub">' + (semSinal
      ? 'Este iPhone ainda não tem a cópia da planilha. Conecte-se à internet e ela será baixada sozinha.'
      : erro
        ? esc(erro)
        : 'Isso só acontece quando o iPhone está sem a cópia dos dados. Leva alguns segundos.') + '</p>' +
    (semSinal || erro ? '<button type="button" class="botao botao-primario botao-grande" data-tentar>' + icone('atualizar', 20, 2.2) + ' Tentar de novo</button>' : '') +
  '</div>';
}

assinar(() => {
  if (esperandoPlanilha && estado.snapshot) {
    esperandoPlanilha = false;
    renderizar();
  } else if (esperandoPlanilha && !estado.sincronizando) {
    renderizar(true);
  }
});

/** Telas que exigem o aparelho já configurado (e com a cópia da planilha). */
function protegida(tela) {
  return new Proxy(tela, {
    get(alvo, prop) {
      if (prop === 'render') {
        return params => {
          if (!configurado()) {
            setTimeout(() => ir('/inicio', true), 0);
            return '';
          }
          if (!estado.snapshot) {
            esperandoPlanilha = true;
            return telaBaixando();
          }
          esperandoPlanilha = false;
          return alvo.render(params);
        };
      }
      if (prop === 'montar') {
        return (raiz, params) => {
          if (!configurado()) return;
          if (!estado.snapshot) {
            const b = raiz.querySelector('[data-tentar]');
            if (b) b.addEventListener('click', () => { estado.ultimoErro = null; renderizar(true); sincronizar(); });
            return;
          }
          if (alvo.montar) alvo.montar(raiz, params);
        };
      }
      if (prop === 'semNav' && !estado.snapshot) return true;
      return alvo[prop];
    }
  });
}

const telaInicioGuardada = new Proxy(telaInicio, {
  get(alvo, prop) {
    if (prop === 'render') {
      return params => {
        if (configurado()) {
          setTimeout(() => ir('/resumo', true), 0);
          return '';
        }
        return alvo.render(params);
      };
    }
    return alvo[prop];
  }
});

registrarRota('/inicio', telaInicioGuardada);
registrarRota('/resumo', protegida(telaResumo));
registrarRota('/resumo/dias', protegida(telaResumoDias));
registrarRota('/resumo/total', protegida(telaResumoTotal));
registrarRota('/resumo/analise', protegida(telaResumoAnalise));
registrarRota('/historico', protegida(telaHistorico));
registrarRota('/nova', protegida(telaDespesa));
registrarRota('/editar/:id', protegida(telaDespesa));
registrarRota('/corrigir/:opId', protegida(telaDespesa));
registrarRota('/contas', protegida(telaContas));
registrarRota('/conta/:chave', protegida(telaConta));
registrarRota('/pagamentos', protegida(telaPagamentos));
registrarRota('/acerto', protegida(telaAcerto));
registrarRota('/acerto/:chave', protegida(telaAcerto));
registrarRota('/conversor', protegida(telaConversor));
registrarRota('/mais', protegida(telaMais));
registrarRota('/fila', protegida(telaFila));
registrarRota('/fundos', protegida(telaFundos));
registrarRota('/fundo/:id', protegida(telaFundo));
registrarRota('/cadastros', protegida(telaCadastros));
registrarRota('/sobre', protegida(telaSobre));
registrarRota('/mapa', protegida(telaMapa));
registrarRota('/mapa/:id', protegida(telaMapa));
registrarRota('/relatorios', protegida(telaRelatorios));
registrarRota('/relatorio/extrato', protegida(telaRelExtrato));
registrarRota('/relatorio/pessoa', protegida(telaRelPessoa));
registrarRota('/relatorio/cartao', protegida(telaRelCartao));
registrarRota('/relatorio/dividas', protegida(telaRelDividas));
registrarRota('/relatorio/montar', protegida(telaRelMontar));

let atualizacaoPedida = false;

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('sw.js').then(registro => {
    const avisarSePronto = trabalhador => {
      if (trabalhador && navigator.serviceWorker.controller) {
        mostrarNovaVersao(() => {
          atualizacaoPedida = true;
          trabalhador.postMessage('ativar');
        });
      }
    };

    if (registro.waiting) avisarSePronto(registro.waiting);

    registro.addEventListener('updatefound', () => {
      const novo = registro.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        if (novo.state === 'installed') avisarSePronto(novo);
      });
    });

    setInterval(() => registro.update().catch(() => {}), 30 * 60 * 1000);
  }).catch(() => {});

  // Só recarrega quando a pessoa pediu a atualização. Na primeira
  // abertura o service worker também assume o controle da página, e
  // recarregar nesse momento apagaria o que estivesse sendo digitado.
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!atualizacaoPedida || recarregando) return;
    recarregando = true;
    location.reload();
  });
}

/*
 * 1.7.2 (decisão do usuário, 04/10/2026, por causa da bateria):
 *  - com o app aberto, lê a planilha de 5 em 5 minutos (antes: a cada minuto);
 *  - ao voltar para o app (abrir de novo), lê se passou mais de 50 s;
 *  - lançamento na fila é enviado no minuto seguinte, sem esperar os 5 minutos;
 *  - para ler na hora: tocar em "Em dia" e em "Atualizar agora".
 */
const INTERVALO_LEITURA = 5 * 60 * 1000;

function sincronizarDeTempoEmTempo() {
  const talvez = limite => {
    if (!configurado() || document.visibilityState !== 'visible') return;
    const ultima = estado.ultimaSync ? new Date(estado.ultimaSync).getTime() : 0;
    if (Date.now() - ultima > limite || estado.fila.some(o => o.estado !== 'recusada')) sincronizar();
  };

  document.addEventListener('visibilitychange', () => talvez(50000));
  setInterval(() => talvez(INTERVALO_LEITURA - 10000), 60 * 1000);
}

async function comecar() {
  try {
    await iniciar(VERSAO);
  } catch (erro) {
    document.getElementById('app').innerHTML =
      '<div class="inicio"><p class="erro-form">Não foi possível abrir o armazenamento do aparelho. Feche o app e abra de novo.</p></div>';
    return;
  }

  iniciarNavegacao(configurado() ? '/resumo' : '/inicio');
  permissaoLocalizacao().then(estadoPermissao => registrarDiario('permissão de localização: ' + estadoPermissao));
  registrarServiceWorker();
  sincronizarDeTempoEmTempo();

  if (configurado()) sincronizar();
}

/*
 * Splash: a imagem da viagem aparece ao abrir o app do zero e some
 * sozinha depois de ~1,6 s (ou antes, com um toque).
 */
const inicioSplash = Date.now();
function esconderSplash() {
  const el = document.getElementById('splash');
  if (!el || el.classList.contains('sumindo')) return;
  el.classList.add('sumindo');
  setTimeout(() => el.remove(), 450);
}
(function prepararSplash() {
  const el = document.getElementById('splash');
  if (!el) return;
  el.addEventListener('click', esconderSplash);
  setTimeout(esconderSplash, 4000); // nunca fica presa
})();

comecar().finally(() => {
  setTimeout(esconderSplash, Math.max(0, 1600 - (Date.now() - inicioSplash)));
});
