// Armazenamento no próprio iPhone (IndexedDB).
//   kv    → dados gerais (usuário, chave, última cópia da planilha)
//   fila  → lançamentos aguardando envio
//   fotos → fotos de comprovante já vistas ou tiradas neste aparelho

const NOME = 'viagem-eua-2026';
const VERSAO_BANCO = 1;
let promessa = null;

function abrir() {
  if (!promessa) {
    promessa = new Promise((resolver, rejeitar) => {
      const pedido = indexedDB.open(NOME, VERSAO_BANCO);

      pedido.onupgradeneeded = () => {
        const db = pedido.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('fila')) db.createObjectStore('fila', { keyPath: 'opId' });
        if (!db.objectStoreNames.contains('fotos')) db.createObjectStore('fotos');
      };

      pedido.onsuccess = () => {
        const db = pedido.result;
        // O iPhone às vezes derruba a ligação com o banco quando o app
        // fica em segundo plano. Se cair, a próxima leitura reabre.
        db.onclose = () => { promessa = null; };
        db.onversionchange = () => { db.close(); promessa = null; };
        resolver(db);
      };
      pedido.onerror = () => { promessa = null; rejeitar(pedido.error); };
      pedido.onblocked = () => { promessa = null; rejeitar(new Error('Armazenamento ocupado.')); };
    });
  }
  return promessa;
}

function transacao(db, loja, modo, acao) {
  return new Promise((resolver, rejeitar) => {
    const t = db.transaction(loja, modo);
    const pedido = acao(t.objectStore(loja));
    let resultado;

    if (pedido) pedido.onsuccess = () => { resultado = pedido.result; };

    t.oncomplete = () => resolver(resultado);
    t.onerror = () => rejeitar(t.error);
    t.onabort = () => rejeitar(t.error || new Error('Gravação cancelada.'));
  });
}

/** Executa no banco; se a ligação tiver caído, reabre e tenta mais uma vez. */
async function executar(loja, modo, acao) {
  try {
    return await transacao(await abrir(), loja, modo, acao);
  } catch (erro) {
    registrarDiario('banco: ' + (erro && (erro.name || erro.message) || 'falha') + ' — reabrindo');
    promessa = null;
    await new Promise(r => setTimeout(r, 150));
    return transacao(await abrir(), loja, modo, acao);
  }
}

/* ---------------- Cópia de segurança do acesso e diário ----------------
   Usuário e chave também ficam numa segunda gaveta do aparelho
   (localStorage). Se o iPhone abrir o app sem achar o banco, o acesso
   é restaurado daqui e a planilha é baixada de novo, sem pedir a chave.
   O diário guarda as últimas aberturas e falhas, para diagnóstico. */

const CHAVE_BACKUP = 'viagem-eua-2026:acesso';
const CHAVE_DIARIO = 'viagem-eua-2026:diario';

export function backupGravar(usuario, chave) {
  try { localStorage.setItem(CHAVE_BACKUP, JSON.stringify({ usuario, chave })); } catch (e) { /* sem espaço */ }
}

export function backupLer() {
  try {
    const d = JSON.parse(localStorage.getItem(CHAVE_BACKUP) || 'null');
    return d && d.usuario && d.chave ? d : null;
  } catch (e) {
    return null;
  }
}

export function backupApagar() {
  try { localStorage.removeItem(CHAVE_BACKUP); } catch (e) { /* nada */ }
}

export function registrarDiario(texto) {
  try {
    const lista = JSON.parse(localStorage.getItem(CHAVE_DIARIO) || '[]');
    lista.push({ quando: new Date().toISOString(), texto: String(texto).slice(0, 200) });
    localStorage.setItem(CHAVE_DIARIO, JSON.stringify(lista.slice(-40)));
  } catch (e) { /* nada */ }
}

export function lerDiario() {
  try { return JSON.parse(localStorage.getItem(CHAVE_DIARIO) || '[]'); } catch (e) { return []; }
}

export const kvLer = chave => executar('kv', 'readonly', s => s.get(chave));
export const kvGravar = (chave, valor) => executar('kv', 'readwrite', s => s.put(valor, chave));
export const kvApagar = chave => executar('kv', 'readwrite', s => s.delete(chave));

export async function filaListar() {
  const lista = (await executar('fila', 'readonly', s => s.getAll())) || [];
  return lista.sort((a, b) => a.seq - b.seq);
}

/*
 * 1.7.3: RESERVA no localStorage (a mesma gaveta que guarda a chave).
 * Se o iPhone abrir o app sem o banco (ou sem conseguir lê-lo), a cópia
 * da planilha e os lançamentos ainda não enviados voltam daqui, mesmo
 * sem sinal. As fotos não vão para a reserva (são pesadas): um
 * lançamento restaurado daqui sobe sem a foto.
 */
const CHAVE_COPIA = 'viagem-eua-2026:copia-planilha';
const CHAVE_FILA = 'viagem-eua-2026:fila-reserva';

export function copiaGravar(snapshot) {
  try { localStorage.setItem(CHAVE_COPIA, JSON.stringify(snapshot)); return true; } catch (e) { return false; }
}

export function copiaLer() {
  try { const t = localStorage.getItem(CHAVE_COPIA); return t ? JSON.parse(t) : null; } catch (e) { return null; }
}

function reservaLer() {
  try { return JSON.parse(localStorage.getItem(CHAVE_FILA) || '{}') || {}; } catch (e) { return {}; }
}

function reservaGravar(mapa) {
  try { localStorage.setItem(CHAVE_FILA, JSON.stringify(mapa)); } catch (e) { /* sem espaço: segue só com o banco */ }
}

function semFoto(op) {
  if (!op || !op.dados || !op.dados.foto) return op;
  const { foto, ...resto } = op.dados;
  return { ...op, dados: resto, semFotoNaReserva: true };
}

/** Lançamentos guardados na reserva (sem fotos), em ordem. */
export function filaReservaLer() {
  return Object.values(reservaLer()).sort((a, b) => a.seq - b.seq);
}

export async function filaGravar(op) {
  const mapa = reservaLer();
  mapa[op.opId] = semFoto(op);
  reservaGravar(mapa);
  return executar('fila', 'readwrite', s => s.put(op));
}

export async function filaRemover(opId) {
  const mapa = reservaLer();
  delete mapa[opId];
  reservaGravar(mapa);
  return executar('fila', 'readwrite', s => s.delete(opId));
}

export const fotoLer = chave => executar('fotos', 'readonly', s => s.get(chave));
export const fotoGravar = (chave, dados) => executar('fotos', 'readwrite', s => s.put(dados, chave));

export async function apagarTudo() {
  backupApagar();
  try { localStorage.removeItem(CHAVE_COPIA); localStorage.removeItem(CHAVE_FILA); } catch (e) { /* nada */ }
  const db = await abrir();
  db.close();
  promessa = null;

  await new Promise((resolver, rejeitar) => {
    const pedido = indexedDB.deleteDatabase(NOME);
    pedido.onsuccess = () => resolver();
    pedido.onerror = () => rejeitar(pedido.error);
    pedido.onblocked = () => resolver();
  });
}

/** Pede ao iOS para não apagar os dados do app por falta de espaço. */
export async function pedirArmazenamentoPersistente() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      await navigator.storage.persist();
    }
  } catch (erro) {
    // Sem suporte: o app funciona do mesmo jeito.
  }
}
