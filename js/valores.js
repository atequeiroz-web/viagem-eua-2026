// Como mostrar uma soma feita em várias moedas.
//
// Regra (decisão do usuário, opção A): cada moeda aparece com o seu
// próprio total, nunca convertida. O dólar vem primeiro. Em letra
// menor, a soma das referências em reais (cotação de cada dia,
// congelada), dizendo quanto aquilo representou em R$.

import { esc, moeda } from './util.js';
import { moedasUsadas, soReais } from './calculos.js';

/** Moedas a mostrar: as usadas, na ordem US$, R$, ₲ (US$ 0,00 se vazio). */
function moedasParaMostrar(s, principal) {
  const usadas = moedasUsadas(s);
  if (principal && !usadas.includes(principal)) return [principal].concat(usadas);
  return usadas.length ? usadas : ['USD'];
}

/**
 * Bloco grande (topo do Resumo, Total geral).
 * principal: moeda que aparece sempre em destaque, mesmo zerada.
 */
export function htmlSomaGrande(s, { principal = '', classe = '', textoRef = 'Representa' } = {}) {
  const lista = moedasParaMostrar(s, principal);
  const [primeira, ...outras] = lista;

  return '<div class="sv ' + classe + '">' +
    '<div class="sv-principal">' + esc(moeda(s[primeira], primeira)) + '</div>' +
    (outras.length
      ? '<div class="sv-outras">' + outras.map(m => '<span>' + esc(moeda(s[m], m)) + '</span>').join('') + '</div>'
      : '') +
    (!soReais(s)
      ? '<div class="sv-ref">' + esc(textoRef) + ' <strong>' + esc(moeda(s.ref)) + '</strong> em reais</div>'
      : '') +
  '</div>';
}

/** Bloco compacto (dia a dia, categorias, pessoas): uma moeda por linha + "≈ R$". */
export function htmlSomaCompacta(s, { classe = '', semRef = false } = {}) {
  const lista = moedasParaMostrar(s);
  return '<span class="svc ' + classe + '">' +
    lista.map((m, i) => '<span class="' + (i === 0 ? 'svc-1' : 'svc-n') + '">' + esc(moeda(s[m], m)) + '</span>').join('') +
    (!semRef && !soReais(s) ? '<span class="svc-ref">≈ ' + esc(moeda(s.ref)) + '</span>' : '') +
  '</span>';
}

/** Texto corrido: "US$ 120,00 · R$ 35,00". */
export function textoSoma(s) {
  return moedasParaMostrar(s).map(m => moeda(s[m], m)).join(' · ');
}

/** Na mesma linha, sem quebrar dentro de um valor: "US$ 757,00 · R$ 205,00". */
export function htmlSomaLinha(s) {
  return moedasParaMostrar(s).map(m => '<span class="nw">' + esc(moeda(s[m], m)) + '</span>').join(' · ');
}
