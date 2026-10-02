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

      pedido.onsuccess = () => resolver(pedido.result);
      pedido.onerror = () => rejeitar(pedido.error);
    });
  }
  return promessa;
}

async function executar(loja, modo, acao) {
  const db = await abrir();

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

export const kvLer = chave => executar('kv', 'readonly', s => s.get(chave));
export const kvGravar = (chave, valor) => executar('kv', 'readwrite', s => s.put(valor, chave));
export const kvApagar = chave => executar('kv', 'readwrite', s => s.delete(chave));

export async function filaListar() {
  const lista = (await executar('fila', 'readonly', s => s.getAll())) || [];
  return lista.sort((a, b) => a.seq - b.seq);
}

export const filaGravar = op => executar('fila', 'readwrite', s => s.put(op));
export const filaRemover = opId => executar('fila', 'readwrite', s => s.delete(opId));

export const fotoLer = chave => executar('fotos', 'readonly', s => s.get(chave));
export const fotoGravar = (chave, dados) => executar('fotos', 'readwrite', s => s.put(dados, chave));

export async function apagarTudo() {
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
