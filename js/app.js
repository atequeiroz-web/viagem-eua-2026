// Ponto de partida do app.

import { iniciar, configurado, sincronizar, estado } from './dados.js';
import { VERSAO } from './config.js';
import { registrarRota, iniciarNavegacao, ir, mostrarNovaVersao } from './ui.js';
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
import {
  telaRelatorios, telaRelExtrato, telaRelPessoa, telaRelCartao, telaRelDividas, telaRelMontar
} from './telas/relatorio.js';

/** Telas que exigem o aparelho já configurado. */
function protegida(tela) {
  return new Proxy(tela, {
    get(alvo, prop) {
      if (prop === 'render') {
        return params => {
          if (!configurado()) {
            setTimeout(() => ir('/inicio', true), 0);
            return '';
          }
          return alvo.render(params);
        };
      }
      if (prop === 'montar') {
        return (raiz, params) => {
          if (configurado() && alvo.montar) alvo.montar(raiz, params);
        };
      }
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

function sincronizarDeTempoEmTempo() {
  const talvez = () => {
    if (!configurado() || document.visibilityState !== 'visible') return;
    const ultima = estado.ultimaSync ? new Date(estado.ultimaSync).getTime() : 0;
    if (Date.now() - ultima > 50000 || estado.fila.some(o => o.estado !== 'recusada')) sincronizar();
  };

  document.addEventListener('visibilitychange', talvez);
  setInterval(talvez, 60 * 1000);
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
  registrarServiceWorker();
  sincronizarDeTempoEmTempo();

  if (configurado()) sincronizar();
}

comecar();
