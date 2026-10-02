// Ponto de partida do app.

import { iniciar, configurado, sincronizar, estado } from './dados.js';
import { registrarRota, iniciarNavegacao, ir, mostrarNovaVersao } from './ui.js';
import { telaInicio } from './telas/inicio.js';
import { telaResumo } from './telas/resumo.js';
import { telaHistorico } from './telas/historico.js';
import { telaDespesa } from './telas/despesa.js';
import { telaContas } from './telas/contas.js';
import { telaAcerto } from './telas/acerto.js';
import { telaConversor } from './telas/conversor.js';
import { telaMais } from './telas/mais.js';
import { telaFila } from './telas/fila.js';
import { telaFundos, telaFundo } from './telas/fundos.js';

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
registrarRota('/historico', protegida(telaHistorico));
registrarRota('/nova', protegida(telaDespesa));
registrarRota('/editar/:id', protegida(telaDespesa));
registrarRota('/corrigir/:opId', protegida(telaDespesa));
registrarRota('/contas', protegida(telaContas));
registrarRota('/acerto', protegida(telaAcerto));
registrarRota('/acerto/:chave', protegida(telaAcerto));
registrarRota('/conversor', protegida(telaConversor));
registrarRota('/mais', protegida(telaMais));
registrarRota('/fila', protegida(telaFila));
registrarRota('/fundos', protegida(telaFundos));
registrarRota('/fundo/:id', protegida(telaFundo));

function registrarServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('sw.js').then(registro => {
    const avisarSePronto = trabalhador => {
      if (trabalhador && navigator.serviceWorker.controller) {
        mostrarNovaVersao(() => trabalhador.postMessage('ativar'));
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

  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recarregando) return;
    recarregando = true;
    location.reload();
  });
}

function sincronizarDeTempoEmTempo() {
  const talvez = () => {
    if (!configurado() || document.visibilityState !== 'visible') return;
    const ultima = estado.ultimaSync ? new Date(estado.ultimaSync).getTime() : 0;
    if (Date.now() - ultima > 60000 || estado.fila.some(o => o.estado !== 'recusada')) sincronizar();
  };

  document.addEventListener('visibilitychange', talvez);
  setInterval(talvez, 3 * 60 * 1000);
}

async function comecar() {
  try {
    await iniciar();
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
