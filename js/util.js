import { registrarDiario } from './db.js';
// Funções utilitárias: texto, números, moedas e datas.

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

export function normalizar(valor) {
  return String(valor ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function mesmaPessoa(a, b) {
  return normalizar(a) === normalizar(b);
}

export function num(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  const n = lerNumero(valor);
  return Number.isFinite(n) ? n : 0;
}

export function arred2(valor) {
  return Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
}

/**
 * Lê números digitados em português: "1.234,56", "55,5", "55.5",
 * "200.000" (milhar). Devolve NaN se não houver número.
 */
export function lerNumero(texto) {
  let t = String(texto ?? '').trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!t) return NaN;

  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else {
    const pontos = (t.match(/\./g) || []).length;
    if (pontos > 1 || /^\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
  }

  return Number(t);
}

const formatadores = {};

export function moeda(valor, codigo = 'BRL') {
  const cod = codigo || 'BRL';
  if (!formatadores[cod]) {
    const casas = cod === 'PYG' ? 0 : 2;
    formatadores[cod] = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: cod,
      currencyDisplay: cod === 'PYG' ? 'narrowSymbol' : 'symbol',
      minimumFractionDigits: casas,
      maximumFractionDigits: casas
    });
  }
  return formatadores[cod].format(num(valor)).replace(/ /g, ' ');
}

export function simboloMoeda(codigo) {
  return { BRL: 'R$', USD: 'US$', PYG: '₲' }[codigo] || codigo;
}

export function numeroBR(valor, casas = 2) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas
  }).format(num(valor));
}

export function cotacaoBR(valor) {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
  }).format(num(valor));
}

/* ---------------- Datas ---------------- */

const doisDigitos = n => String(n).padStart(2, '0');

export function paraData(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return isNaN(valor) ? null : valor;
  const texto = String(valor);
  const d = /^\d{4}-\d{2}-\d{2}$/.test(texto)
    ? new Date(texto + 'T12:00:00')
    : new Date(texto);
  return isNaN(d) ? null : d;
}

/** "YYYY-MM-DD" no horário do aparelho. */
export function dia(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return d.getFullYear() + '-' + doisDigitos(d.getMonth() + 1) + '-' + doisDigitos(d.getDate());
}

export function hojeDia() {
  return dia(new Date());
}

/** Valor para <input type="datetime-local">. */
export function paraCampoDataHora(valor) {
  const d = paraData(valor) || new Date();
  return dia(d) + 'T' + doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
}

/**
 * Dia de uma cotação do Banco Central (dd/mm), lido no horário de Brasília.
 * A planilha guarda a data à meia-noite do Brasil; lida no fuso do iPhone
 * (Manaus, Nova York), cairia no dia anterior.
 */
export function dataCotacao(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' });
}

export function dataCurta(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1) + '/' + d.getFullYear();
}

export function hora(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return doisDigitos(d.getHours()) + ':' + doisDigitos(d.getMinutes());
}

const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/** "qui 15/10" */
export function diaSemana(diaISO) {
  const d = paraData(diaISO);
  if (!d) return '';
  return SEMANA[d.getDay()] + ' ' + doisDigitos(d.getDate()) + '/' + doisDigitos(d.getMonth() + 1);
}

export function diasEntre(diaA, diaB) {
  const a = paraData(diaA);
  const b = paraData(diaB);
  if (!a || !b) return 0;
  return Math.round((b - a) / 86400000);
}

export function tempoRelativo(valor) {
  const d = paraData(valor);
  if (!d) return 'nunca';
  const seg = Math.round((Date.now() - d.getTime()) / 1000);
  if (seg < 60) return 'agora há pouco';
  const min = Math.round(seg / 60);
  if (min < 60) return 'há ' + min + ' min';
  const h = Math.round(min / 60);
  if (h < 24) return 'há ' + h + ' h';
  return 'em ' + dataCurta(d) + ' às ' + hora(d);
}

/* ---------------- Identificadores ---------------- */

/** Sempre começa por letra: a planilha nunca o confunde com número. */
export function gerarId(prefixo = 'p', tamanho = 9) {
  const bytes = new Uint8Array(tamanho);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return prefixo + hex.substring(0, tamanho);
}

/* ---------------- Fotos ---------------- */

/**
 * Reduz a foto (lado maior até 1600 px, JPEG) e devolve o
 * conteúdo em base64, sem o prefixo "data:".
 */
export function comprimirFoto(arquivo, ladoMaximo = 1600, qualidade = 0.72) {
  return new Promise((resolver, rejeitar) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();

    img.onload = () => {
      try {
        const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
        const largura = Math.max(1, Math.round(img.naturalWidth * escala));
        const altura = Math.max(1, Math.round(img.naturalHeight * escala));
        const canvas = document.createElement('canvas');
        canvas.width = largura;
        canvas.height = altura;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, largura, altura);
        ctx.drawImage(img, 0, 0, largura, altura);
        const dataUrl = canvas.toDataURL('image/jpeg', qualidade);
        URL.revokeObjectURL(url);
        resolver(dataUrl.replace(/^data:image\/jpeg;base64,/, ''));
      } catch (erro) {
        URL.revokeObjectURL(url);
        rejeitar(erro);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      rejeitar(new Error('Não foi possível ler a imagem.'));
    };

    img.src = url;
  });
}

/**
 * Pede a posição ao iPhone. Nunca fica esperando para sempre: pelas
 * regras dos navegadores, o prazo do GPS só começa a contar depois que a
 * permissão é dada; se o iPhone não mostrar o pedido de permissão, a busca
 * ficaria parada. Por isso há um prazo próprio, e o motivo da falha fica
 * em ultimoErroLocalizacao (e no diário do iPhone).
 */
export function obterLocalizacao(tempo = 8000, alta = false) {
  return new Promise(resolver => {
    let terminou = false;
    const fim = (posicao, erro, registro) => {
      if (terminou) return;
      terminou = true;
      clearTimeout(vigia);
      ultimoErroLocalizacao = erro || '';
      registrarDiario('local: ' + registro);
      resolver(posicao);
    };

    if (!('geolocation' in navigator)) {
      return fim('', 'Este aparelho não oferece localização ao app.', 'sem suporte');
    }

    const vigia = setTimeout(() => fim('',
      'O iPhone não respondeu ao pedido de localização. Confira em Ajustes > Privacidade e Segurança > Serviços de Localização: ' +
      'a chave geral deve estar ligada e, em "Sites do Safari", escolha "Durante o Uso". Depois feche e abra o app.',
      'sem resposta do iPhone em ' + Math.round((tempo + 7000) / 1000) + ' s'), tempo + 7000);

    try {
      navigator.geolocation.getCurrentPosition(
        p => {
          ultimaPrecisao = Math.round(p.coords.accuracy || 0);
          fim(p.coords.latitude.toFixed(6) + ', ' + p.coords.longitude.toFixed(6), '',
            'ok (precisão ' + ultimaPrecisao + ' m)');
        },
        e => fim('',
          e && e.code === 1
            ? 'Localização bloqueada para o app. No iPhone: Ajustes > Privacidade e Segurança > Serviços de Localização > Sites do Safari > Durante o Uso. Depois feche e abra o app.'
            : e && e.code === 3
              ? 'O iPhone demorou para achar o local. Tente de novo em lugar aberto.'
              : 'Não foi possível achar o local agora.',
          'erro ' + (e && e.code) + ' ' + (e && e.message || '')),
        { enableHighAccuracy: alta, timeout: tempo, maximumAge: alta ? 60000 : 300000 }
      );
    } catch (erro) {
      fim('', 'Não foi possível pedir a localização ao iPhone.', 'exceção ' + (erro && erro.message));
    }
  });
}

/** Motivo da última falha ao buscar o local (vazio se deu certo). */
export let ultimoErroLocalizacao = '';

/** Precisão, em metros, do último local encontrado. */
export let ultimaPrecisao = 0;

/** Situação da permissão de localização (granted, prompt, denied ou desconhecida). */
export async function permissaoLocalizacao() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const r = await navigator.permissions.query({ name: 'geolocation' });
      return r.state;
    }
  } catch (e) { /* sem suporte */ }
  return 'desconhecida';
}
