// MAPA DA VIAGEM: cada despesa com local vira um marco, na cor da
// categoria. Os marcos são ligados na ordem em que as despesas
// aconteceram, para reconstruir o trajeto. Tocar no marco abre a
// despesa completa (pedido do usuário, 03/10/2026, como no AppSheet).
//
// Mapa: Leaflet (guardado no próprio app) com o desenho das ruas do
// OpenStreetMap/CARTO. As ruas precisam de internet; o que já foi visto
// fica guardado no iPhone. Os marcos vêm da planilha e funcionam sem sinal.

import { visao } from '../dados.js';
import { cabecalho, renderizar } from '../ui.js';
import { icone, iconeCategoria, corCategoria } from '../icones.js';
import { esc, moeda, dia, diaSemana, hora, dataCurta } from '../util.js';
import { despesasValidas } from '../calculos.js';
import { abrirDetalheDespesa } from './detalhe.js';

let diaSel = '';          // '' = toda a viagem
let mapa = null;          // instância atual do Leaflet
let carregando = null;    // promessa de carregar o Leaflet

/** Carrega o Leaflet só quando o mapa é aberto (não pesa nas outras telas). */
function carregarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (carregando) return carregando;
  carregando = new Promise((resolver, rejeitar) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'vendor/leaflet/leaflet.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'vendor/leaflet/leaflet.js';
    js.onload = () => resolver(window.L);
    js.onerror = () => { carregando = null; rejeitar(new Error('Não foi possível carregar o mapa.')); };
    document.head.appendChild(js);
  });
  return carregando;
}

/** "40.758, -73.985" → [40.758, -73.985] (ou null). */
export function coordenadas(gps) {
  const m = String(gps || '').match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180) || (lat === 0 && lng === 0)) return null;
  return [lat, lng];
}

function pontosDaViagem(v) {
  return despesasValidas(v)
    .map(d => ({ d, c: coordenadas(d.gps) }))
    .filter(p => p.c)
    .sort((a, b) => String(a.d.dataCompra).localeCompare(String(b.d.dataCompra)));
}

export const telaMapa = {
  aba: 'resumo',
  vivo: false,

  render(params) {
    const v = visao();
    const todos = pontosDaViagem(v);
    const total = despesasValidas(v).length;
    const dias = Array.from(new Set(todos.map(p => dia(p.d.dataCompra))));
    if (params.id) {
      const alvo = todos.find(p => p.d.id === params.id);
      if (alvo) diaSel = dia(alvo.d.dataCompra);
    }
    if (diaSel && !dias.includes(diaSel)) diaSel = '';
    const pontos = diaSel ? todos.filter(p => dia(p.d.dataCompra) === diaSel) : todos;

    return cabecalho({ titulo: 'Mapa da viagem', voltarPara: '/resumo' }) +
      (dias.length > 1
        ? '<div class="chips mapa-dias" role="group" aria-label="Escolher o dia">' +
            '<button type="button" class="chip' + (diaSel ? '' : ' ativo') + '" data-dia="">Toda a viagem</button>' +
            dias.map(d => '<button type="button" class="chip' + (diaSel === d ? ' ativo' : '') + '" data-dia="' + d + '">' + esc(diaSemana(d)) + '</button>').join('') +
          '</div>'
        : '') +
      '<section class="cartao mapa-cartao">' +
        (pontos.length
          ? '<div id="mapa" class="mapa" aria-label="Mapa com as despesas"></div>'
          : '<div class="mapa mapa-vazio">' + icone('pin', 28, 1.8) +
            '<p>Nenhuma despesa com local ainda.</p><p class="suave">Ao lançar uma despesa, toque em <strong>Registrar local</strong>.</p></div>') +
      '</section>' +
      '<p class="nota-pequena mapa-nota">' + todos.length + ' de ' + total + (total === 1 ? ' despesa tem' : ' despesas têm') + ' local registrado. Toque num marco para ver a despesa.</p>' +
      (pontos.length
        ? '<h2 class="secao-titulo">' + (diaSel ? esc(diaSemana(diaSel)) : 'Trajeto') + ' · ' + pontos.length + (pontos.length === 1 ? ' parada' : ' paradas') + '</h2>' +
          '<ul class="lista">' + pontos.map((p, i) =>
            '<li><button type="button" class="item item-compacto" data-ponto="' + esc(p.d.id) + '">' +
              '<span class="mapa-num" style="--cor:' + corCategoria(p.d.categoria) + '">' + (i + 1) + '</span>' +
              '<span class="item-meio"><span class="item-titulo">' + esc(p.d.descricao) + '</span>' +
              '<span class="item-sub">' + esc(diaSel ? hora(p.d.dataCompra) : dataCurta(p.d.dataCompra) + ' ' + hora(p.d.dataCompra)) + (p.d.local ? ' · ' + esc(p.d.local) : '') + '</span></span>' +
              '<span class="item-dir"><span class="item-valor">' + esc(moeda(p.d.valorOriginal, p.d.moeda)) + '</span></span>' +
            '</button></li>'
          ).join('') + '</ul>'
        : '');
  },

  montar(raiz, params) {
    raiz.addEventListener('click', ev => {
      const c = ev.target.closest('[data-dia]');
      if (c) { diaSel = c.getAttribute('data-dia'); renderizar(true); return; }
      const p = ev.target.closest('[data-ponto]');
      if (p) focar(p.getAttribute('data-ponto'), true);
    });

    const alvo = raiz.querySelector('#mapa');
    if (!alvo) return;

    const v = visao();
    const todos = pontosDaViagem(v);
    const pontos = diaSel ? todos.filter(p => dia(p.d.dataCompra) === diaSel) : todos;

    carregarLeaflet().then(L => {
      if (!alvo.isConnected) return;
      if (mapa) { mapa.remove(); mapa = null; }

      mapa = L.map(alvo, { zoomControl: true, attributionControl: true, tap: true });
      mapa.attributionControl.setPrefix(false);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        crossOrigin: true,
        attribution: '© OpenStreetMap · © CARTO'
      }).addTo(mapa);

      // Trajeto: linha ligando os marcos na ordem das despesas.
      if (pontos.length > 1) {
        L.polyline(pontos.map(p => p.c), { color: '#1F4FD8', weight: 3, opacity: 0.55, dashArray: '6 8' }).addTo(mapa);
      }

      marcadores = new Map();
      pontos.forEach((p, i) => {
        const cor = corCategoria(p.d.categoria);
        const html = '<span class="pino" style="--cor:' + cor + '">' + iconeCategoria(p.d.categoria, 16) +
          '<span class="pino-num">' + (i + 1) + '</span></span>';
        const m = L.marker(p.c, {
          icon: L.divIcon({ html, className: 'pino-caixa', iconSize: [34, 34], iconAnchor: [17, 32] }),
          title: p.d.descricao,
          riseOnHover: true
        }).addTo(mapa);
        m.on('click', () => abrirDetalheDespesa(p.d.id));
        marcadores.set(p.d.id, m);
      });

      const limites = L.latLngBounds(pontos.map(p => p.c));
      if (pontos.length === 1) mapa.setView(pontos[0].c, 16);
      else mapa.fitBounds(limites, { padding: [36, 36], maxZoom: 16 });

      if (params.id) focar(params.id, false);
    }).catch(erro => {
      alvo.classList.add('mapa-vazio');
      alvo.innerHTML = icone('alerta', 28, 1.8) + '<p>' + esc(erro.message) + '</p>';
    });
  },

  sair() {
    if (mapa) { mapa.remove(); mapa = null; }
  }
};

let marcadores = new Map();

function focar(id, abrir) {
  const m = marcadores.get(id);
  if (mapa && m) {
    mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 16), { animate: true });
    const el = document.getElementById('mapa');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (abrir) setTimeout(() => abrirDetalheDespesa(id), m ? 450 : 0);
}

/** Resumo: quantas despesas têm local e qual foi o último lugar. */
export function resumoDoMapa(v) {
  const pontos = pontosDaViagem(v);
  const ultimo = pontos[pontos.length - 1];
  return { quantidade: pontos.length, ultimo: ultimo ? ultimo.d : null };
}
