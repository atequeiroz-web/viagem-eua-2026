// Primeira abertura: quem usa o aparelho e a chave de acesso.

import { configurar } from '../dados.js';
import { ir } from '../ui.js';
import { icone } from '../icones.js';
import { esc } from '../util.js';

const f = { usuario: '', chave: '', enviando: false, erro: '' };

function instalado() {
  return window.navigator.standalone === true ||
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
}

function ehIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function formatarChave(texto) {
  const limpo = String(texto).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  return limpo.match(/.{1,4}/g)?.join('-') || '';
}

export const telaInicio = {
  semNav: true,

  render() {
    const dicaInstalar = ehIOS() && !instalado()
      ? '<div class="cartao cartao-dica">' + icone('info', 20, 2) +
        '<div><strong>Instale o app antes de configurar.</strong> No Safari, toque em <strong>•••</strong> (canto inferior direito), ' +
        'depois em <strong>Compartilhar</strong> e em <strong>Adicionar à Tela de Início</strong>. ' +
        'Em iPhones mais antigos, o botão Compartilhar fica direto na barra de baixo. ' +
        'Abra o app pelo ícone novo e faça a configuração lá.</div></div>'
      : '';

    return '<div class="inicio">' +
      '<div class="inicio-marca">' +
        '<img src="icones/icone-192.png" alt="" width="72" height="72" class="inicio-icone">' +
        '<h1 class="inicio-titulo">Viagem EUA 2026</h1>' +
        '<p class="inicio-sub">Despesas da viagem e acertos de contas</p>' +
      '</div>' +
      dicaInstalar +
      '<form class="cartao inicio-form" id="form-inicio" novalidate>' +
        '<fieldset class="campo-grupo">' +
          '<legend class="rotulo">QUEM VAI USAR ESTE IPHONE?</legend>' +
          '<div class="escolha-dupla">' +
            ['João', 'Norma'].map(n =>
              '<button type="button" class="escolha' + (f.usuario === n ? ' ativo' : '') + '" data-usuario="' + n + '" aria-pressed="' + (f.usuario === n) + '">' +
              '<span class="escolha-avatar">' + n[0] + '</span>' + n + '</button>'
            ).join('') +
          '</div>' +
        '</fieldset>' +
        '<label class="rotulo" for="chave">CHAVE DE ACESSO</label>' +
        '<input id="chave" class="entrada entrada-chave" type="text" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" ' +
          'placeholder="XXXX-XXXX-XXXX-XXXX" value="' + esc(f.chave) + '" maxlength="19">' +
        '<button type="button" class="botao botao-secundario botao-colar" data-colar>' + icone('recibo', 18, 2) + ' Colar a chave copiada</button>' +
        '<p class="ajuda">Copie a chave das suas Notas e toque em Colar. Ela fica guardada neste iPhone; não é preciso digitar de novo.</p>' +
        '<p class="erro-form" id="erro-inicio" role="alert">' + esc(f.erro) + '</p>' +
        '<button type="submit" class="botao botao-primario botao-grande" id="entrar"' + (f.enviando ? ' disabled' : '') + '>' +
          (f.enviando ? icone('atualizar', 20, 2.2, ' data-gira="1"') + ' Conectando…' : 'Entrar') +
        '</button>' +
      '</form>' +
      '<p class="inicio-rodape">Na primeira vez é preciso internet. Depois o app funciona também sem sinal.</p>' +
    '</div>';
  },

  montar(raiz) {
    raiz.querySelectorAll('[data-usuario]').forEach(b => {
      b.addEventListener('click', () => {
        f.usuario = b.getAttribute('data-usuario');
        raiz.querySelectorAll('[data-usuario]').forEach(x => {
          const ativo = x === b;
          x.classList.toggle('ativo', ativo);
          x.setAttribute('aria-pressed', String(ativo));
        });
      });
    });

    const campo = raiz.querySelector('#chave');
    campo.addEventListener('input', () => {
      const formatada = formatarChave(campo.value);
      if (formatada !== campo.value) campo.value = formatada;
      f.chave = formatada;
    });

    const colar = raiz.querySelector('[data-colar]');
    if (colar) colar.addEventListener('click', async () => {
      try {
        const texto = await navigator.clipboard.readText();
        const formatada = formatarChave(texto);
        if (formatada.replace(/-/g, '').length !== 16) {
          raiz.querySelector('#erro-inicio').textContent = 'O que está copiado não parece a chave (16 letras e números).';
          return;
        }
        campo.value = formatada;
        f.chave = formatada;
        raiz.querySelector('#erro-inicio').textContent = '';
      } catch (e) {
        // Sem permissão para ler a área de transferência: cola pelo próprio campo.
        campo.focus();
        raiz.querySelector('#erro-inicio').textContent = 'Toque e segure no campo da chave e escolha Colar.';
      }
    });

    raiz.querySelector('#form-inicio').addEventListener('submit', async ev => {
      ev.preventDefault();
      const erro = raiz.querySelector('#erro-inicio');

      if (!f.usuario) { erro.textContent = 'Escolha quem vai usar este iPhone.'; return; }
      if (f.chave.replace(/-/g, '').length !== 16) { erro.textContent = 'A chave tem 16 letras e números.'; return; }
      if (!navigator.onLine) { erro.textContent = 'Sem internet. Conecte-se para a primeira configuração.'; return; }

      f.enviando = true;
      f.erro = '';
      const botao = raiz.querySelector('#entrar');
      botao.disabled = true;
      botao.innerHTML = icone('atualizar', 20, 2.2, ' data-gira="1"') + ' Conectando…';

      const r = await configurar(f.usuario, f.chave);
      f.enviando = false;

      if (r.ok) {
        f.chave = '';
        ir('/resumo', true);
      } else {
        f.erro = r.erro;
        botao.disabled = false;
        botao.textContent = 'Entrar';
        erro.textContent = r.erro;
      }
    });
  }
};
