// Casca do app: navegação, cabeçalho, barra inferior, folhas,
// diálogos e avisos.

import { estado, assinar, recusadas, pendentes } from './dados.js';
import { esc } from './util.js';
import { icone } from './icones.js';

const rotas = [];
let telaAtual = null;
let paramsAtuais = {};
let caminhoAtual = '';
let ignorarProximaMudanca = false;

export function registrarRota(padrao, tela) {
  const nomes = [];
  const regex = new RegExp('^' + padrao.replace(/:([a-zA-Z]+)/g, (_, n) => {
    nomes.push(n);
    return '([^/]+)';
  }) + '$');
  rotas.push({ regex, nomes, tela });
}

export function ir(caminho, substituir = false) {
  const destino = '#' + caminho;
  if (location.hash === destino) {
    renderizar();
    return;
  }
  if (substituir) {
    history.replaceState(null, '', destino);
    renderizar();
  } else {
    location.hash = destino;
  }
}

export function voltar(alternativa = '/resumo') {
  if (history.length > 1 && sessionStorage.getItem('navegou') === '1') history.back();
  else ir(alternativa, true);
}

function localizar(caminho) {
  for (const r of rotas) {
    const m = caminho.match(r.regex);
    if (m) {
      const params = {};
      r.nomes.forEach((n, i) => { params[n] = decodeURIComponent(m[i + 1]); });
      return { tela: r.tela, params };
    }
  }
  return null;
}

export function iniciarNavegacao(rotaInicial) {
  window.addEventListener('hashchange', async () => {
    if (ignorarProximaMudanca) {
      ignorarProximaMudanca = false;
      return;
    }

    if (telaAtual && telaAtual.podeSair) {
      const pode = await telaAtual.podeSair();
      if (!pode) {
        ignorarProximaMudanca = true;
        history.replaceState(null, '', '#' + caminhoAtual);
        return;
      }
    }

    try { sessionStorage.setItem('navegou', '1'); } catch (e) { /* sem armazenamento */ }
    renderizar();
  });

  assinar(() => {
    atualizarPilula();
    if (!telaAtual) return;
    if (telaAtual.aoMudarDados) telaAtual.aoMudarDados(document.getElementById('tela'), paramsAtuais);
    else if (telaAtual.vivo) renderizar(true);
  });

  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    history.replaceState(null, '', '#' + rotaInicial);
  }

  renderizar();
}

export function renderizar(manterRolagem = false) {
  const caminho = (location.hash || '#/resumo').slice(1);
  const achado = localizar(caminho) || localizar('/resumo');
  const mudouTela = achado.tela !== telaAtual || caminho !== caminhoAtual;

  if (mudouTela && telaAtual && telaAtual.sair) telaAtual.sair();

  telaAtual = achado.tela;
  paramsAtuais = achado.params;
  caminhoAtual = caminho;

  const app = document.getElementById('app');
  const rolagem = window.scrollY;

  app.innerHTML =
    '<main id="tela" class="tela' + (telaAtual.semNav ? ' tela-sem-nav' : '') + '">' +
    telaAtual.render(paramsAtuais) +
    '</main>' +
    (telaAtual.semNav ? '' : barraInferior(telaAtual.aba));

  if (telaAtual.montar) telaAtual.montar(document.getElementById('tela'), paramsAtuais);

  app.querySelectorAll('[data-ir]').forEach(el => {
    el.addEventListener('click', ev => {
      ev.preventDefault();
      ir(el.getAttribute('data-ir'));
    });
  });

  app.querySelectorAll('[data-voltar]').forEach(el => {
    el.addEventListener('click', ev => {
      ev.preventDefault();
      voltar(el.getAttribute('data-voltar') || '/resumo');
    });
  });

  atualizarPilula();

  if (manterRolagem && !mudouTela) window.scrollTo(0, rolagem);
  else if (mudouTela) window.scrollTo(0, 0);
}

/* ---------------- Cabeçalho ---------------- */

export function cabecalho({ titulo, sobre = '', subtitulo = '', voltarPara = '', direita = '' }) {
  return '<header class="cab">' +
    (voltarPara
      ? '<button type="button" class="cab-voltar" data-voltar="' + esc(voltarPara) + '">' + icone('esquerda', 22, 2.2) + '<span>Voltar</span></button>'
      : '') +
    '<div class="cab-linha">' +
      '<div class="cab-textos">' +
        (sobre ? '<div class="cab-sobre">' + esc(sobre) + '</div>' : '') +
        '<h1 class="cab-titulo">' + esc(titulo) + '</h1>' +
        (subtitulo ? '<p class="cab-sub">' + subtitulo + '</p>' : '') +
      '</div>' +
      '<div class="cab-direita">' + direita + '<span id="pilula"></span></div>' +
    '</div>' +
  '</header>';
}

export function atualizarPilula() {
  const alvo = document.getElementById('pilula');
  if (!alvo) return;

  const nRecusadas = recusadas().length;
  const nPendentes = pendentes().length;
  let classe = 'pil-ok';
  let ic = 'check';
  let texto = 'Em dia';

  if (estado.chaveInvalida) {
    classe = 'pil-erro'; ic = 'alerta'; texto = 'Chave';
  } else if (nRecusadas) {
    classe = 'pil-erro'; ic = 'alerta'; texto = nRecusadas === 1 ? '1 recusado' : nRecusadas + ' recusados';
  } else if (estado.sincronizando) {
    classe = 'pil-envio'; ic = 'atualizar'; texto = nPendentes ? 'Enviando' : 'Atualizando';
  } else if (!estado.online) {
    classe = 'pil-alerta'; ic = 'semSinal'; texto = nPendentes ? nPendentes + ' na fila' : 'Sem sinal';
  } else if (nPendentes) {
    classe = 'pil-alerta'; ic = 'relogio'; texto = nPendentes + ' na fila';
  } else if (estado.ultimoErro) {
    classe = 'pil-alerta'; ic = 'alerta'; texto = 'Verificar';
  }

  alvo.innerHTML = '<button type="button" class="pilula ' + classe + '" aria-label="Situação do envio: ' + esc(texto) + '">' +
    icone(ic, 14, 2.4, estado.sincronizando ? ' data-gira="1"' : '') + '<span>' + esc(texto) + '</span></button>';

  alvo.querySelector('button').addEventListener('click', () => ir('/fila'));
}

/* ---------------- Barra inferior ---------------- */

function barraInferior(aba) {
  const item = (rota, nome, ic, rotulo) =>
    '<a href="#' + rota + '" class="nav-item' + (aba === nome ? ' ativo' : '') + '"' +
    (aba === nome ? ' aria-current="page"' : '') + '>' + icone(ic, 23) + '<span>' + rotulo + '</span></a>';

  return '<nav class="nav" aria-label="Navegação principal">' +
    item('/resumo', 'resumo', 'resumo', 'Resumo') +
    item('/historico', 'historico', 'historico', 'Histórico') +
    '<a href="#/nova" class="nav-item nav-nova" aria-label="Nova despesa"><span class="nav-fab">' + icone('mais', 28, 2.4) + '</span><span>Nova</span></a>' +
    item('/contas', 'contas', 'contas', 'Contas') +
    item('/conversor', 'conversor', 'conversor', 'Conversor') +
  '</nav>';
}

/* ---------------- Folhas (painéis que sobem) ---------------- */

export function abrirFolha({ titulo = '', html = '', montar = null, classe = '' }) {
  const camada = document.getElementById('camada');
  const folha = document.createElement('div');
  folha.className = 'folha-fundo';
  folha.innerHTML =
    '<div class="folha ' + classe + '" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
      '<div class="folha-alca"></div>' +
      '<div class="folha-topo">' +
        '<h2 class="folha-titulo">' + esc(titulo) + '</h2>' +
        '<button type="button" class="botao-icone" data-fechar aria-label="Fechar">' + icone('fechar', 22, 2.2) + '</button>' +
      '</div>' +
      '<div class="folha-corpo">' + html + '</div>' +
    '</div>';

  camada.appendChild(folha);
  document.body.classList.add('com-folha');
  requestAnimationFrame(() => folha.classList.add('aberta'));

  const fechar = () => {
    folha.classList.remove('aberta');
    setTimeout(() => {
      folha.remove();
      if (!document.querySelector('.folha-fundo')) document.body.classList.remove('com-folha');
    }, 220);
  };

  folha.addEventListener('click', ev => {
    if (ev.target === folha || ev.target.closest('[data-fechar]')) fechar();
  });

  if (montar) montar(folha.querySelector('.folha-corpo'), fechar);
  return fechar;
}

/* ---------------- Diálogo de confirmação ---------------- */

export function confirmar({ titulo, texto = '', sim = 'Confirmar', nao = 'Cancelar', perigo = false }) {
  return new Promise(resolver => {
    const camada = document.getElementById('camada');
    const caixa = document.createElement('div');
    caixa.className = 'dialogo-fundo';
    caixa.innerHTML =
      '<div class="dialogo" role="alertdialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
        '<h2 class="dialogo-titulo">' + esc(titulo) + '</h2>' +
        (texto ? '<p class="dialogo-texto">' + texto + '</p>' : '') +
        '<div class="dialogo-botoes">' +
          '<button type="button" class="botao botao-secundario" data-r="nao">' + esc(nao) + '</button>' +
          '<button type="button" class="botao ' + (perigo ? 'botao-perigo' : 'botao-primario') + '" data-r="sim">' + esc(sim) + '</button>' +
        '</div>' +
      '</div>';

    camada.appendChild(caixa);
    requestAnimationFrame(() => caixa.classList.add('aberta'));

    caixa.addEventListener('click', ev => {
      const b = ev.target.closest('[data-r]');
      if (!b && ev.target !== caixa) return;
      const r = b ? b.getAttribute('data-r') === 'sim' : false;
      caixa.classList.remove('aberta');
      setTimeout(() => caixa.remove(), 180);
      resolver(r);
    });
  });
}

/* ---------------- Avisos rápidos ---------------- */

export function avisar(texto, tipo = 'ok') {
  const area = document.getElementById('avisos');
  const el = document.createElement('div');
  el.className = 'aviso aviso-' + tipo;
  el.innerHTML = icone(tipo === 'erro' ? 'alerta' : tipo === 'info' ? 'info' : 'check', 18, 2.4) + '<span>' + esc(texto) + '</span>';
  area.appendChild(el);
  requestAnimationFrame(() => el.classList.add('visivel'));
  setTimeout(() => {
    el.classList.remove('visivel');
    setTimeout(() => el.remove(), 250);
  }, tipo === 'erro' ? 5000 : 2600);
}

/* ---------------- Faixa de nova versão ---------------- */

export function mostrarNovaVersao(atualizar) {
  if (document.querySelector('.faixa-versao')) return;
  const faixa = document.createElement('div');
  faixa.className = 'faixa-versao';
  faixa.innerHTML = '<span>Nova versão do app disponível.</span><button type="button" class="botao-faixa">Atualizar</button>';
  document.body.appendChild(faixa);
  faixa.querySelector('button').addEventListener('click', atualizar);
}

/* ---------------- Pedaços reutilizáveis ---------------- */

export function segmento(nome, opcoes, valor, extraClasse = '') {
  return '<div class="seg ' + extraClasse + '" role="group" data-seg="' + esc(nome) + '" style="--n:' + opcoes.length + '">' +
    opcoes.map(o => {
      const v = typeof o === 'string' ? o : o.valor;
      const r = typeof o === 'string' ? o : o.rotulo;
      const ativo = String(v) === String(valor);
      return '<button type="button" class="seg-op' + (ativo ? ' ativo' : '') + '" aria-pressed="' + ativo + '" data-valor="' + esc(v) + '">' + esc(r) + '</button>';
    }).join('') +
  '</div>';
}

/** Liga os botões de um segmento a uma função. */
export function ligarSegmento(raiz, nome, aoEscolher) {
  const grupo = raiz.querySelector('[data-seg="' + nome + '"]');
  if (!grupo) return;
  grupo.addEventListener('click', ev => {
    const b = ev.target.closest('.seg-op');
    if (!b) return;
    grupo.querySelectorAll('.seg-op').forEach(x => {
      const ativo = x === b;
      x.classList.toggle('ativo', ativo);
      x.setAttribute('aria-pressed', String(ativo));
    });
    aoEscolher(b.getAttribute('data-valor'));
  });
}

export function vazio(ic, titulo, texto = '') {
  return '<div class="vazio">' + icone(ic, 34, 1.6) + '<p class="vazio-titulo">' + esc(titulo) + '</p>' +
    (texto ? '<p class="vazio-texto">' + texto + '</p>' : '') + '</div>';
}
