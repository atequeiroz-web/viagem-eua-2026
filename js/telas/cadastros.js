// CADASTROS feitos pelo próprio app (na viagem não haverá computador):
// novos pagadores, cartões (com dono) e categorias.
//
// Regras (decisões do usuário, 03/10/2026):
//  - pagador novo é sempre terceiro, como Nice e Ana: o que ele paga
//    conta como dinheiro, em dólar, e vira dívida de João e/ou Norma;
//  - cada cartão tem dono (João ou Norma), e cada um vê só os seus;
//  - tudo funciona sem sinal: o cadastro entra na fila e sobe depois.

import { estado, visao, enfileirar } from '../dados.js';
import { cabecalho, abrirFolha, avisar, segmento, ligarSegmento } from '../ui.js';
import { icone, iconeCategoria } from '../icones.js';
import { esc, mesmaPessoa } from '../util.js';
import { listaCartoes, ponteCadastra } from '../calculos.js';

const DONOS = ['João', 'Norma'];

/** Mesmas regras da ponte: 2 a 40 letras, sem ";" nem parênteses, sem repetir. */
function validarNome(nome, existentes, rotulo, limite = 40) {
  const t = String(nome || '').replace(/\s+/g, ' ').trim();
  if (t.length < 2) return 'Escreva pelo menos 2 letras.';
  if (t.length > limite) return rotulo + ': no máximo ' + limite + ' letras.';
  if (/[;()]/.test(t) || /^[=+@]/.test(t)) return 'Não use ponto e vírgula nem parênteses.';
  if (existentes.some(x => mesmaPessoa(x, t))) return '"' + t + '" já está cadastrado.';
  return '';
}

function ponteDesatualizada() {
  if (ponteCadastra(visao())) return false;
  avisar('Para cadastrar pelo app, a ponte na planilha precisa ser atualizada (versão 1.1.0).', 'erro');
  return true;
}

/** Folha com um campo de nome. aoSalvar(nome) é chamado depois de enfileirar. */
function folhaNome({ titulo, rotulo, explicacao, placeholder, existentes, tipo, extra = '', dadosExtra = () => ({}), aoSalvar, limite = 40 }) {
  if (ponteDesatualizada()) return;
  abrirFolha({
    titulo,
    html:
      (explicacao ? '<p class="texto-suave">' + explicacao + '</p>' : '') +
      '<label class="rotulo" for="cad-nome">' + esc(rotulo) + '</label>' +
      '<input id="cad-nome" class="entrada" type="text" maxlength="' + limite + '" autocomplete="off" autocapitalize="words" placeholder="' + esc(placeholder) + '">' +
      extra +
      '<p class="erro-form" id="cad-erro" role="alert"></p>' +
      '<div class="det-acoes"><button type="button" class="botao botao-primario botao-grande" data-cad-salvar>Cadastrar</button></div>',
    montar: (corpo, fechar) => {
      const campo = corpo.querySelector('#cad-nome');
      setTimeout(() => campo.focus(), 250);
      ligarSegmento(corpo, 'cad-dono', () => {});
      const salvar = async () => {
        const erro = validarNome(campo.value, existentes, rotulo, limite);
        if (erro) { corpo.querySelector('#cad-erro').textContent = erro; return; }
        const nome = campo.value.replace(/\s+/g, ' ').trim();
        const extras = dadosExtra(corpo);
        if (extras === null) return;
        await enfileirar(tipo, { nome, ...extras });
        fechar();
        avisar(navigator.onLine ? '"' + nome + '" cadastrado' : '"' + nome + '" cadastrado no iPhone. Sobe quando houver sinal.');
        if (aoSalvar) aoSalvar(nome, extras);
      };
      corpo.querySelector('[data-cad-salvar]').addEventListener('click', salvar);
      campo.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); salvar(); } });
    }
  });
}

export function abrirNovoPagador(aoSalvar) {
  const v = visao();
  folhaNome({
    titulo: 'Novo pagador',
    rotulo: 'NOME DE QUEM PAGOU',
    placeholder: 'Ex.: Tia Lúcia',
    explicacao: 'Alguém de fora (como Nice e Ana) que pagou algo para vocês. O que essa pessoa pagar conta como <strong>dinheiro, em dólar</strong>, e vira dívida de João, da Norma ou dos dois com ela.',
    existentes: (v.pessoas || []).map(p => p.nome),
    tipo: 'pessoa.criar',
    aoSalvar
  });
}

export function abrirNovaCategoria(aoSalvar) {
  const v = visao();
  folhaNome({
    titulo: 'Nova categoria',
    rotulo: 'NOME DA CATEGORIA',
    placeholder: 'Ex.: Lavanderia',
    existentes: v.categorias || [],
    tipo: 'categoria.criar',
    aoSalvar
  });
}

/** Cartão novo. dono: já escolhido (ex.: quem está pagando na Nova despesa). */
export function abrirNovoCartao(donoInicial, aoSalvar) {
  const v = visao();
  const dono = DONOS.find(d => mesmaPessoa(d, donoInicial)) || estado.usuario;
  folhaNome({
    titulo: 'Novo cartão',
    rotulo: 'NOME DO CARTÃO',
    placeholder: 'Ex.: Nubank Mastercard',
    limite: 60,
    existentes: listaCartoes(v).map(c => c.nome),
    tipo: 'cartao.salvar',
    extra: '<div class="rotulo rotulo-espaco">DE QUEM É O CARTÃO</div>' + segmento('cad-dono', DONOS, dono),
    dadosExtra: corpo => {
      const ativo = corpo.querySelector('[data-seg="cad-dono"] .ativo');
      return { dono: ativo ? ativo.getAttribute('data-valor') : dono };
    },
    aoSalvar
  });
}

/** Trocar o dono de um cartão que já existe. */
function abrirDonoCartao(cartao) {
  if (ponteDesatualizada()) return;
  abrirFolha({
    titulo: cartao.nome,
    html: '<div class="rotulo">DE QUEM É ESTE CARTÃO</div>' +
      '<div class="opcoes">' + DONOS.map(d =>
        '<button type="button" class="opcao' + (mesmaPessoa(cartao.dono, d) ? ' ativo' : '') + '" data-dono="' + esc(d) + '"><span>' + esc(d) + '</span>' +
        (mesmaPessoa(cartao.dono, d) ? icone('check', 20, 2.6) : '') + '</button>').join('') + '</div>',
    montar: (corpo, fechar) => corpo.addEventListener('click', async ev => {
      const b = ev.target.closest('[data-dono]');
      if (!b) return;
      const dono = b.getAttribute('data-dono');
      fechar();
      if (mesmaPessoa(dono, cartao.dono)) return;
      await enfileirar('cartao.salvar', { nome: cartao.nome, dono });
      avisar('Cartão ' + cartao.nome + ' agora é de ' + dono);
    })
  });
}

/* =================== Tela Cadastros =================== */

export const telaCadastros = {
  aba: '',
  vivo: true,

  render() {
    const v = visao();
    const pessoas = (v.pessoas || []).filter(p => p.ativo);
    const cartoes = listaCartoes(v);
    const categorias = (v.categorias || []).slice().sort((a, b) => a.localeCompare(b));

    return cabecalho({ titulo: 'Cadastros', sobre: 'PAGADORES, CARTÕES E CATEGORIAS', voltarPara: '/mais' }) +
      (!ponteCadastra(v)
        ? '<div class="faixa faixa-alerta">' + icone('alerta', 18, 2.2) + '<span>A ponte na planilha ainda é a ' + esc(v.versaoApi || 'antiga') + '. Para cadastrar pelo app, ela precisa ser atualizada para a 1.1.0.</span></div>'
        : '') +

      '<section class="cartao">' +
        '<div class="cartao-topo"><h2 class="cartao-titulo">Quem pode pagar</h2></div>' +
        pessoas.map(p =>
          '<div class="linha-curta"><span>' + esc(p.nome) + (p._fila ? ' <span class="selo selo-alerta">na fila</span>' : '') + '</span>' +
          '<span class="suave">' + (p.geraAcerto ? 'dinheiro, em US$ · gera dívida' : 'conta própria') + '</span></div>'
        ).join('') +
        '<button type="button" class="botao botao-contorno cad-botao" data-novo-pagador>' + icone('mais', 18, 2.4) + ' Cadastrar pagador</button>' +
      '</section>' +

      '<section class="cartao">' +
        '<div class="cartao-topo"><h2 class="cartao-titulo">Cartões</h2></div>' +
        (cartoes.length
          ? cartoes.map(c =>
              '<button type="button" class="cad-cartao" data-cartao="' + esc(c.nome) + '">' +
                '<span class="item-ic">' + icone('contas', 18) + '</span>' +
                '<span class="cad-cartao-meio"><span class="item-titulo">' + esc(c.nome) + '</span>' +
                '<span class="item-sub">' + (c.dono ? 'de ' + esc(c.dono) : 'sem dono: toque para escolher') + '</span></span>' +
                icone('direita', 18, 2.2) +
              '</button>'
            ).join('')
          : '<p class="texto-suave">Nenhum cartão cadastrado.</p>') +
        '<p class="nota-pequena">Cada um vê na Nova despesa só os seus cartões. Cartão sem dono aparece para os dois.</p>' +
        '<button type="button" class="botao botao-contorno cad-botao" data-novo-cartao>' + icone('mais', 18, 2.4) + ' Cadastrar cartão</button>' +
      '</section>' +

      '<section class="cartao">' +
        '<div class="cartao-topo"><h2 class="cartao-titulo">Categorias</h2></div>' +
        '<div class="cad-cats">' + categorias.map(c =>
          '<span class="cad-cat"><span class="opcao-ic">' + iconeCategoria(c, 16) + '</span>' + esc(c) + '</span>'
        ).join('') + '</div>' +
        '<button type="button" class="botao botao-contorno cad-botao" data-nova-categoria>' + icone('mais', 18, 2.4) + ' Cadastrar categoria</button>' +
      '</section>';
  },

  montar(raiz) {
    raiz.addEventListener('click', ev => {
      if (ev.target.closest('[data-novo-pagador]')) return abrirNovoPagador();
      if (ev.target.closest('[data-novo-cartao]')) return abrirNovoCartao(estado.usuario);
      if (ev.target.closest('[data-nova-categoria]')) return abrirNovaCategoria();
      const c = ev.target.closest('[data-cartao]');
      if (c) {
        const cartao = listaCartoes(visao()).find(x => x.nome === c.getAttribute('data-cartao'));
        if (cartao) abrirDonoCartao(cartao);
      }
    });
  }
};
