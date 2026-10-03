// MAPA DA VIAGEM: cada despesa com local vira um marco, na cor da
// categoria. Os marcos são ligados na ordem em que as despesas
// aconteceram, para reconstruir o trajeto. Tocar no marco abre a
// despesa completa (pedido do usuário, 03/10/2026, como no AppSheet).
//
// Mapa: Leaflet (guardado no próprio app). Ruas do OpenStreetMap e imagem
// de satélite da Esri, ambos sem chave de acesso. (A 1.5.0 usava a CARTO,
// que passou a exigir chave: o mapa aparecia em branco.) As ruas precisam
// de internet; o que já foi visto fica guardado no iPhone. Os marcos vêm
// da planilha e funcionam sem sinal. Como no app da viagem SC, o mapa
// aparece mesmo sem despesas, como referência, com o botão "onde estou".

import { visao } from '../dados.js';
import { cabecalho, renderizar } from '../ui.js';
import { icone, iconeCategoria, corCategoria } from '../icones.js';
import { esc, moeda, dia, diaSemana, hora, dataCurta, obterLocalizacao, ultimoErroLocalizacao } from '../util.js';
import { avisar } from '../ui.js';
import { refBRL } from '../calculos.js';
import { despesasValidas } from '../calculos.js';
import { abrirDetalheDespesa } from './detalhe.js';

let diaSel = '';          // '' = toda a viagem
let camada = 'mapa';      // mapa | satelite

const CAMADAS = {
  mapa: {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    opcoes: { maxZoom: 19, attribution: '© colaboradores do OpenStreetMap' }
  },
  satelite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    opcoes: { maxZoom: 19, attribution: 'Imagens © Esri' }
  }
};

// Sem despesas com local: Nova York (destino da viagem) como referência.
const CENTRO_PADRAO = [40.7128, -74.006];
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
        '<div class="mapa-caixa">' +
          '<div id="mapa" class="mapa" aria-label="Mapa com as despesas"></div>' +
          '<div class="mapa-camadas" role="group" aria-label="Tipo de mapa">' +
            '<button type="button" class="' + (camada === 'mapa' ? 'ativo' : '') + '" data-camada="mapa">Mapa</button>' +
            '<button type="button" class="' + (camada === 'satelite' ? 'ativo' : '') + '" data-camada="satelite">Satélite</button>' +
          '</div>' +
          '<button type="button" class="mapa-onde" data-onde aria-label="Mostrar onde estou">' + icone('pin', 20, 2.2) + '</button>' +
        '</div>' +
        (pontos.length ? '<div id="mapa-previa" class="mapa-previa" hidden></div>' : '') +
      '</section>' +
      (!todos.length ? '<p class="nota-pequena mapa-nota">Nenhuma despesa com local ainda. Ao lançar uma despesa, o local é registrado e ela aparece aqui.</p>' : '') +
      (todos.length ? '<p class="nota-pequena mapa-nota">' + todos.length + ' de ' + total + (total === 1 ? ' despesa tem' : ' despesas têm') + ' local registrado. Toque num marco para ver o gasto; toque no resumo para abrir tudo.</p>' : '') +
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
      if (p) { focar(p.getAttribute('data-ponto')); return; }
      const prev = ev.target.closest('[data-abrir]');
      if (prev) { abrirDetalheDespesa(prev.getAttribute('data-abrir')); return; }
      const cam = ev.target.closest('[data-camada]');
      if (cam) { trocarCamada(cam.getAttribute('data-camada')); return; }
      if (ev.target.closest('[data-onde]')) mostrarOndeEstou();
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
      aplicarCamada(L);

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
        m.on('click', () => selecionar(p.d.id));
        marcadores.set(p.d.id, m);
      });

      if (!pontos.length) {
        // Só referência: abre em Nova York e, se o iPhone permitir, vai para onde você está.
        mapa.setView(CENTRO_PADRAO, 12);
        mostrarOndeEstou(true);
      } else if (pontos.length === 1) {
        mapa.setView(pontos[0].c, 16);
      } else {
        mapa.fitBounds(L.latLngBounds(pontos.map(p => p.c)), { padding: [36, 36], maxZoom: 16 });
      }

      if (params.id) focar(params.id);
    }).catch(erro => {
      alvo.classList.add('mapa-vazio');
      alvo.innerHTML = icone('alerta', 28, 1.8) + '<p>' + esc(erro.message) + '</p>';
    });
  },

  sair() {
    if (mapa) { mapa.remove(); mapa = null; }
    camadaAtual = null;
    marcoOndeEstou = null;
  }
};

let marcadores = new Map();
let camadaAtual = null;
let marcoOndeEstou = null;

/**
 * Põe a camada escolhida. Primeiro tenta com permissão de cópia (permite
 * guardar no iPhone); se o servidor recusar, tenta do jeito simples.
 */
function aplicarCamada(L, simples = false) {
  if (!mapa) return;
  if (camadaAtual) mapa.removeLayer(camadaAtual);
  const c = CAMADAS[camada];
  const nova = L.tileLayer(c.url, { ...c.opcoes, crossOrigin: simples ? undefined : 'anonymous' });
  let carregou = false;
  let erros = 0;
  nova.on('tileload', () => { carregou = true; });
  nova.on('tileerror', () => {
    erros++;
    if (!simples && !carregou && erros >= 3 && camadaAtual === nova) aplicarCamada(L, true);
  });
  nova.addTo(mapa);
  camadaAtual = nova;
}

function trocarCamada(nome) {
  if (!CAMADAS[nome] || nome === camada) return;
  camada = nome;
  document.querySelectorAll('[data-camada]').forEach(b => b.classList.toggle('ativo', b.getAttribute('data-camada') === nome));
  if (window.L) aplicarCamada(window.L);
}

/** Ponto azul "você está aqui", como no mapa do iPhone. */
async function mostrarOndeEstou(silencioso = false) {
  const botao = document.querySelector('[data-onde]');
  if (botao) botao.classList.add('buscando');
  const pos = await obterLocalizacao(silencioso ? 8000 : 15000, !silencioso);
  if (botao) botao.classList.remove('buscando');
  const c = coordenadas(pos);
  if (!c || !mapa || !window.L) {
    if (!silencioso && ultimoErroLocalizacao) avisar(ultimoErroLocalizacao, 'erro');
    return;
  }
  if (marcoOndeEstou) mapa.removeLayer(marcoOndeEstou);
  marcoOndeEstou = window.L.circleMarker(c, { radius: 8, color: '#FFFFFF', weight: 3, fillColor: '#1A73E8', fillOpacity: 1 }).addTo(mapa);
  if (silencioso && marcadores.size) return;
  mapa.setView(c, Math.max(mapa.getZoom(), 15), { animate: true });
}

/** Centraliza no marco e mostra o resumo do gasto embaixo do mapa. */
function focar(id) {
  const m = marcadores.get(id);
  if (mapa && m) {
    mapa.setView(m.getLatLng(), Math.max(mapa.getZoom(), 16), { animate: true });
    const el = document.getElementById('mapa');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  selecionar(id);
}

/**
 * Como no app da viagem a Santa Catarina: tocar no marco mostra, embaixo
 * do mapa, as coordenadas e o gasto; tocar nesse resumo abre a despesa.
 */
function selecionar(id) {
  const v = visao();
  const d = v.despesas.find(x => x.id === id);
  const caixa = document.getElementById('mapa-previa');
  if (!d || !caixa) return;

  marcadores.forEach((m, chave) => {
    const el = m.getElement && m.getElement();
    if (el) el.classList.toggle('pino-ativo', chave === id);
  });

  const ref = refBRL(d, v.cotacoes);
  caixa.hidden = false;
  caixa.innerHTML =
    '<div class="previa-coord">' + icone('pin', 14, 2.2) + esc(d.gps) + '</div>' +
    '<button type="button" class="previa-gasto" data-abrir="' + esc(d.id) + '">' +
      '<span class="item-ic">' + iconeCategoria(d.categoria, 20) + '</span>' +
      '<span class="item-meio"><span class="item-titulo">' + esc(d.descricao) + '</span>' +
        '<span class="item-sub">' + esc(d.categoria) + ' · ' + esc(dataCurta(d.dataCompra)) + ' ' + esc(hora(d.dataCompra)) +
        (d.local ? ' · ' + esc(d.local) : '') + ' · pagou ' + esc(d.quemPagou) + '</span></span>' +
      '<span class="item-dir"><span class="item-valor">' + esc(moeda(d.valorOriginal, d.moeda)) + '</span>' +
        (d.moeda !== 'BRL' ? '<span class="item-sub">≈ ' + esc(moeda(ref.valor)) + '</span>' : '') +
        '<span class="previa-abrir">detalhes ' + icone('direita', 14, 2.4) + '</span></span>' +
    '</button>';
}

/** Resumo: quantas despesas têm local e qual foi o último lugar. */
export function resumoDoMapa(v) {
  const pontos = pontosDaViagem(v);
  const ultimo = pontos[pontos.length - 1];
  return { quantidade: pontos.length, ultimo: ultimo ? ultimo.d : null };
}
