// Conversa com a ponte (Apps Script). Usa "text/plain" para que o
// navegador não exija autorização prévia (CORS) do Google.

import { API_URL } from './config.js';
import { registrarDiario } from './db.js';

/*
 * 1.7.3: o Google às vezes responde 404/5xx ou falha a ligação e, na
 * tentativa seguinte, funciona. O app tenta até 3 vezes (espera 1,5 s e
 * 4 s) antes de mostrar erro. Repetir é seguro: cada lançamento tem um
 * código único, e a ponte não grava o mesmo duas vezes. Demora excessiva
 * (tempo limite) não é repetida.
 */
const PASSAGEIROS = [404, 408, 429, 500, 502, 503, 504];
const ESPERAS = [1500, 4000];

export async function chamar(corpo, tempoLimite = 60000) {
  let r = null;
  for (let tentativa = 1; tentativa <= ESPERAS.length + 1; tentativa++) {
    r = await chamarUmaVez(corpo, tempoLimite);
    if (r.ok || !r.repetir || !navigator.onLine) {
      if (tentativa > 1) registrarDiario('ponte (' + (corpo.acao || '') + '): ' + (r.ok ? 'deu certo na ' + tentativa + 'ª tentativa' : r.erro));
      return limpar(r);
    }
    if (tentativa <= ESPERAS.length) await new Promise(ok => setTimeout(ok, ESPERAS[tentativa - 1]));
  }
  registrarDiario('ponte (' + (corpo.acao || '') + '): ' + r.erro + ' (3 tentativas)');
  return limpar(r);
}

function limpar(r) {
  if (r && 'repetir' in r && !r.ok) { const { repetir, ...resto } = r; return resto; }
  return r;
}

async function chamarUmaVez(corpo, tempoLimite) {
  if (!navigator.onLine) {
    return { ok: false, rede: true, erro: 'Sem conexão com a internet.' };
  }

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), tempoLimite);

  try {
    const resposta = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(corpo),
      redirect: 'follow',
      cache: 'no-store',
      signal: controle.signal
    });

    if (!resposta.ok) {
      return { ok: false, rede: true, repetir: PASSAGEIROS.includes(resposta.status), erro: 'O servidor respondeu com erro ' + resposta.status + '.' };
    }

    const texto = await resposta.text();

    try {
      return JSON.parse(texto);
    } catch (erro) {
      return { ok: false, rede: true, erro: 'Resposta inesperada do servidor.' };
    }

  } catch (erro) {
    return {
      ok: false,
      rede: true,
      repetir: !(erro && erro.name === 'AbortError'),
      erro: erro && erro.name === 'AbortError'
        ? 'O servidor demorou demais para responder.'
        : 'Não foi possível falar com o servidor.'
    };

  } finally {
    clearTimeout(relogio);
  }
}
