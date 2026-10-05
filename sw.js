// Service worker: guarda o app no iPhone para abrir sem sinal.
// Ao publicar uma versão nova, aumente VERSAO (igual a js/config.js).

const VERSAO = '1.8.2';
const CACHE = 'viagem-eua-' + VERSAO;
// Pedaços do mapa já vistos: guardados à parte, valem entre versões.
const CACHE_MAPA = 'viagem-eua-mapa';
const LIMITE_MAPA = 1500;

const ARQUIVOS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/config.js',
  'js/util.js',
  'js/icones.js',
  'js/db.js',
  'js/api.js',
  'js/dados.js',
  'js/calculos.js',
  'js/valores.js',
  'js/ui.js',
  'js/telas/inicio.js',
  'js/telas/resumo.js',
  'js/telas/historico.js',
  'js/telas/detalhe.js',
  'js/telas/despesa.js',
  'js/telas/contas.js',
  'js/telas/acerto.js',
  'js/telas/conversor.js',
  'js/telas/mais.js',
  'js/telas/fila.js',
  'js/telas/fundos.js',
  'js/telas/pagamento.js',
  'js/telas/relatorio.js',
  'js/telas/cadastros.js',
  'js/telas/sobre.js',
  'js/telas/mapa.js',
  'vendor/leaflet/leaflet.js',
  'vendor/leaflet/leaflet.css',
  'fontes/plus-jakarta-sans-latin.woff2',
  'fontes/plus-jakarta-sans-latin-ext.woff2',
  'icones/icone-192.png',
  'icones/icone-512.png',
  'icones/icone-maskable-512.png',
  'icones/apple-touch-icon.png',
  'icones/splash.jpg'
];

self.addEventListener('install', evento => {
  evento.waitUntil(
    caches.open(CACHE).then(cache =>
      cache.addAll(ARQUIVOS.map(url => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(
        chaves
          .filter(chave => chave.startsWith('viagem-eua-') && chave !== CACHE && chave !== CACHE_MAPA)
          .map(chave => caches.delete(chave))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', evento => {
  if (evento.data === 'ativar') self.skipWaiting();
});

self.addEventListener('fetch', evento => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);

  // Ruas do mapa: usa o que já está guardado; senão busca e guarda.
  if (url.hostname === 'tile.openstreetmap.org' || url.hostname === 'server.arcgisonline.com') {
    evento.respondWith(
      caches.open(CACHE_MAPA).then(cache =>
        cache.match(pedido).then(guardada => guardada || fetch(pedido).then(resposta => {
          if (resposta.ok || resposta.type === 'opaque') {
            cache.put(pedido, resposta.clone());
            cache.keys().then(chaves => {
              if (chaves.length > LIMITE_MAPA) chaves.slice(0, chaves.length - LIMITE_MAPA).forEach(k => cache.delete(k));
            });
          }
          return resposta;
        }))
      )
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (pedido.mode === 'navigate') {
    evento.respondWith(
      caches.match('index.html').then(resposta => resposta || fetch(pedido))
    );
    return;
  }

  evento.respondWith(
    caches.match(pedido, { ignoreSearch: true }).then(resposta => resposta || fetch(pedido))
  );
});
