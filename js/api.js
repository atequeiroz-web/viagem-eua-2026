// Conversa com a ponte (Apps Script). Usa "text/plain" para que o
// navegador não exija autorização prévia (CORS) do Google.

import { API_URL } from './config.js';

export async function chamar(corpo, tempoLimite = 60000) {
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
      return { ok: false, rede: true, erro: 'O servidor respondeu com erro ' + resposta.status + '.' };
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
      erro: erro && erro.name === 'AbortError'
        ? 'O servidor demorou demais para responder.'
        : 'Não foi possível falar com o servidor.'
    };

  } finally {
    clearTimeout(relogio);
  }
}
