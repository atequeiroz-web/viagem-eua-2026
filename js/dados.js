// Estado do app, fila de envio e sincronização com a planilha.
//
// O app sempre mostra: (cópia da planilha guardada no iPhone)
// + (lançamentos ainda na fila). Assim tudo funciona sem sinal.

import * as db from './db.js';
import { chamar } from './api.js';
import { gerarId, mesmaPessoa, num, arred2, dia } from './util.js';

export const estado = {
  usuario: null,
  chave: null,
  snapshot: null,
  fila: [],
  sincronizando: false,
  ultimaSync: null,
  ultimoErro: null,
  chaveInvalida: false,
  online: navigator.onLine,
  preferencias: {}
};

const ouvintes = new Set();

export function assinar(funcao) {
  ouvintes.add(funcao);
  return () => ouvintes.delete(funcao);
}

function notificar() {
  ouvintes.forEach(f => {
    try { f(); } catch (erro) { console.error(erro); }
  });
}

export async function iniciar(versao = '') {
  let bancoOk = true;
  try {
    estado.usuario = (await db.kvLer('usuario')) || null;
    estado.chave = (await db.kvLer('chave')) || null;
    estado.snapshot = (await db.kvLer('snapshot')) || null;
    estado.ultimaSync = (await db.kvLer('ultimaSync')) || null;
    estado.fila = (await db.filaListar()) || [];
    estado.preferencias = (await db.kvLer('preferencias')) || {};
  } catch (erro) {
    bancoOk = false;
    db.registrarDiario('abriu ' + versao + ': banco indisponível (' + (erro && (erro.name || erro.message)) + ')');
  }

  // Sem usuário/chave no banco? Usa a cópia de segurança, se houver.
  const backup = db.backupLer();
  if ((!estado.usuario || !estado.chave) && backup) {
    estado.usuario = backup.usuario;
    estado.chave = backup.chave;
    db.registrarDiario('abriu ' + versao + ': acesso restaurado da cópia de segurança' + (estado.snapshot ? '' : ' (planilha será baixada de novo)'));
    if (bancoOk) {
      try {
        await db.kvGravar('usuario', estado.usuario);
        await db.kvGravar('chave', estado.chave);
      } catch (e) { /* tenta de novo na próxima abertura */ }
    }
  } else if (estado.usuario && estado.chave) {
    if (!backup) db.backupGravar(estado.usuario, estado.chave);
    db.registrarDiario('abriu ' + versao + ': ok' + (estado.snapshot ? '' : ' (sem cópia da planilha)') + (estado.fila.length ? ', ' + estado.fila.length + ' na fila' : ''));
  } else {
    db.registrarDiario('abriu ' + versao + ': sem acesso guardado (pede a chave)');
  }

  window.addEventListener('online', () => {
    estado.online = true;
    notificar();
    sincronizar();
  });

  window.addEventListener('offline', () => {
    estado.online = false;
    notificar();
  });
}

/** Últimas escolhas (moeda, forma de pagamento, cartão), para agilizar. */
export async function lembrarEscolhas(escolhas) {
  estado.preferencias = { ...(estado.preferencias || {}), ...escolhas };
  await db.kvGravar('preferencias', estado.preferencias);
}

/** Aparelho configurado = sabe quem usa e tem a chave. A cópia da planilha
 *  pode faltar (o iPhone pode ter apagado): nesse caso ela é baixada de novo. */
export function configurado() {
  return Boolean(estado.usuario && estado.chave);
}

/* =========================================================
   PRIMEIRA CONFIGURAÇÃO
   ========================================================= */

export async function configurar(usuario, chave) {
  const r = await chamar({ chave, acao: 'snapshot' });

  if (!r.ok) {
    return {
      ok: false,
      erro: r.codigo === 'CHAVE'
        ? 'Chave de acesso incorreta. Confira e digite de novo.'
        : r.erro || 'Não foi possível conectar.'
    };
  }

  const pessoa = (r.snapshot.pessoas || []).find(p => mesmaPessoa(p.nome, usuario));

  if (!pessoa || !pessoa.ativo) {
    return { ok: false, erro: usuario + ' não está ativo(a) na aba Pessoas da planilha.' };
  }

  await db.kvGravar('usuario', pessoa.nome);
  await db.kvGravar('chave', chave);
  db.backupGravar(pessoa.nome, chave);
  db.registrarDiario('configurado para ' + pessoa.nome);
  await guardarSnapshot(r.snapshot);
  await db.pedirArmazenamentoPersistente();

  estado.usuario = pessoa.nome;
  estado.chave = chave;
  estado.chaveInvalida = false;
  estado.ultimoErro = null;
  notificar();

  return { ok: true };
}

export async function trocarChave(chave) {
  const r = await chamar({ chave, acao: 'snapshot' });

  if (!r.ok) {
    return { ok: false, erro: r.codigo === 'CHAVE' ? 'Chave de acesso incorreta.' : r.erro };
  }

  await db.kvGravar('chave', chave);
  db.backupGravar(estado.usuario, chave);
  estado.chave = chave;
  estado.chaveInvalida = false;
  estado.ultimoErro = null;
  await guardarSnapshot(r.snapshot);
  notificar();
  sincronizar();
  return { ok: true };
}

export async function desconectar() {
  db.registrarDiario('desconectado pelo botão "Desconectar este iPhone"');
  await db.apagarTudo();
  estado.usuario = null;
  estado.chave = null;
  estado.snapshot = null;
  estado.fila = [];
  estado.ultimaSync = null;
  estado.ultimoErro = null;
  notificar();
}

async function guardarSnapshot(snapshot) {
  estado.snapshot = snapshot;
  estado.ultimaSync = new Date().toISOString();
  await db.kvGravar('snapshot', snapshot);
  await db.kvGravar('ultimaSync', estado.ultimaSync);
}

/* =========================================================
   FILA DE ENVIO
   ========================================================= */

export async function enfileirar(tipo, dados) {
  const op = {
    opId: gerarId('op', 16),
    seq: Date.now() + Math.random(),
    tipo,
    dados,
    criadoEm: new Date().toISOString(),
    estado: 'pendente',
    motivo: '',
    tentativas: 0
  };

  await db.filaGravar(op);
  estado.fila.push(op);
  notificar();
  sincronizar();
  return op;
}

export async function descartarOperacao(opId) {
  await db.filaRemover(opId);
  estado.fila = estado.fila.filter(o => o.opId !== opId);
  notificar();
}

export async function tentarDeNovo(opId) {
  const op = estado.fila.find(o => o.opId === opId);
  if (!op) return;
  op.estado = 'pendente';
  op.motivo = '';
  await db.filaGravar(op);
  notificar();
  sincronizar();
}

export function pendentes() {
  return estado.fila.filter(o => o.estado !== 'recusada');
}

export function recusadas() {
  return estado.fila.filter(o => o.estado === 'recusada');
}

/* =========================================================
   SINCRONIZAÇÃO
   ========================================================= */

let emCurso = null;
let pedidoExtra = false;

export function sincronizar() {
  if (emCurso) {
    pedidoExtra = true;
    return emCurso;
  }

  emCurso = executarSincronizacao()
    .catch(erro => {
      estado.ultimoErro = String(erro && erro.message ? erro.message : erro);
    })
    .finally(() => {
      emCurso = null;
      estado.sincronizando = false;
      notificar();

      if (pedidoExtra) {
        pedidoExtra = false;
        sincronizar();
      }
    });

  return emCurso;
}

function tratarFalha(r) {
  if (r.codigo === 'CHAVE') {
    estado.chaveInvalida = true;
    estado.ultimoErro = 'A chave de acesso deste aparelho não é mais aceita.';
  } else {
    estado.ultimoErro = r.erro || 'Falha ao falar com o servidor.';
  }
}

function montarLote(lista) {
  const LIMITE_BYTES = 3500000;
  const lote = [];
  let bytes = 0;

  for (const op of lista) {
    const tamanho = JSON.stringify(op.dados).length;
    if (lote.length && (bytes + tamanho > LIMITE_BYTES || lote.length >= 20)) break;
    lote.push(op);
    bytes += tamanho;
  }

  return lote;
}

async function executarSincronizacao() {
  if (!estado.chave) return;

  if (!navigator.onLine) {
    estado.online = false;
    return;
  }

  estado.online = true;
  estado.sincronizando = true;
  notificar();

  let lista = estado.fila.filter(o => o.estado === 'pendente' || o.estado === 'erro');

  if (!lista.length) {
    const r = await chamar({ chave: estado.chave, acao: 'snapshot' });
    if (!r.ok) return tratarFalha(r);
    estado.ultimoErro = null;
    estado.chaveInvalida = false;
    await guardarSnapshot(r.snapshot);
    return;
  }

  const tentadas = new Set();

  while (lista.length) {
    const lote = montarLote(lista);
    lote.forEach(o => tentadas.add(o.opId));

    const r = await chamar({
      chave: estado.chave,
      acao: 'sincronizar',
      usuario: estado.usuario,
      operacoes: lote.map(o => ({ opId: o.opId, tipo: o.tipo, dados: o.dados }))
    }, 150000);

    if (!r.ok) return tratarFalha(r);

    estado.ultimoErro = null;
    estado.chaveInvalida = false;

    const concluidas = [];

    for (const res of r.resultados || []) {
      const op = estado.fila.find(o => o.opId === res.opId);
      if (!op) continue;

      if (res.resultado === 'aplicada' || res.resultado === 'ja_aplicada') {
        concluidas.push(op);
      } else if (res.resultado === 'recusada') {
        op.estado = 'recusada';
        op.motivo = res.motivo || 'Recusado pela planilha.';
        await db.filaGravar(op);
      } else {
        op.estado = 'erro';
        op.motivo = res.motivo || 'Erro inesperado.';
        op.tentativas = (op.tentativas || 0) + 1;
        await db.filaGravar(op);
      }
    }

    await guardarSnapshot(r.snapshot);

    for (const op of concluidas) {
      await guardarFotoEnviada(op, r.snapshot);
      await db.filaRemover(op.opId);
    }

    estado.fila = estado.fila.filter(o => !concluidas.includes(o));

    if (r.processamento && r.processamento.ok === false) {
      estado.ultimoErro = 'A planilha recebeu os dados, mas o cálculo avisou: ' + r.processamento.erro;
    }

    notificar();

    lista = estado.fila.filter(o => o.estado === 'pendente' && !tentadas.has(o.opId));
  }
}

/** A foto tirada neste aparelho continua visível sem internet. */
async function guardarFotoEnviada(op, snapshot) {
  const foto = op.dados && op.dados.foto;
  if (!foto) return;

  const registro = op.tipo.startsWith('acerto')
    ? (snapshot.acertos || []).find(a => a.id === op.dados.id)
    : (snapshot.despesas || []).find(d => d.id === op.dados.id);

  const chave = registro && (registro.comprovante || '');
  if (chave) await db.fotoGravar(chave, foto);
}

/* =========================================================
   FOTOS
   ========================================================= */

export async function lerFoto(comprovante) {
  if (!comprovante) return null;

  const local = await db.fotoLer(comprovante);
  if (local) return 'data:image/jpeg;base64,' + local;

  if (!estado.chave || !navigator.onLine) return null;

  const r = await chamar({ chave: estado.chave, acao: 'foto', comprovante }, 60000);
  if (!r.ok || !r.base64) return null;

  if ((r.mime || '').includes('jpeg')) await db.fotoGravar(comprovante, r.base64);
  return 'data:' + (r.mime || 'image/jpeg') + ';base64,' + r.base64;
}

/* =========================================================
   VISÃO: PLANILHA + FILA
   ========================================================= */

const VAZIO = {
  config: { orcamentoBRL: 0, viagemInicio: '', viagemFim: '', cartoes: [], formasPagamento: [], moedaPadrao: 'USD' },
  pessoas: [],
  categorias: [],
  cotacoes: {},
  controle: {},
  despesas: [],
  obrigacoes: [],
  acertos: [],
  aplicacoes: [],
  saldosConta: [],
  saldosMoeda: [],
  fundos: []
};

function despesaDeDados(d) {
  const x = {
    id: d.id,
    dataCompra: d.dataCompra,
    dataUtilizacao: d.dataUtilizacao || '',
    momento: d.momento || '',
    etapa: d.etapa || '',
    local: d.local || '',
    categoria: d.categoria,
    descricao: d.descricao,
    formaPagamento: d.formaPagamento,
    cartao: d.cartao || '',
    quemPagou: d.quemPagou,
    responsavel: d.responsavel,
    observacao: d.observacao || '',
    gps: d.gps || '',
    moeda: d.moeda,
    valorOriginal: num(d.valorOriginal)
  };
  if (d.valorEfetivo !== undefined) x.valorEfetivo = d.valorEfetivo === '' ? '' : num(d.valorEfetivo);
  return x;
}

function mudouFinanceiro(antes, d) {
  return arred2(num(antes.valorOriginal)) !== arred2(num(d.valorOriginal)) ||
    antes.moeda !== d.moeda ||
    !mesmaPessoa(antes.quemPagou, d.quemPagou) ||
    !mesmaPessoa(antes.responsavel, d.responsavel) ||
    !mesmaPessoa(antes.formaPagamento, d.formaPagamento) ||
    dia(antes.dataCompra) !== dia(d.dataCompra);
}

export function visao() {
  const s = estado.snapshot || VAZIO;
  const v = {
    ...VAZIO,
    ...s,
    despesas: (s.despesas || []).map(x => ({ ...x })),
    acertos: (s.acertos || []).map(x => ({ ...x })),
    fundos: (s.fundos || []).map(x => ({ ...x })),
    pessoas: (s.pessoas || []).map(x => ({ ...x })),
    categorias: (s.categorias || []).slice(),
    config: { ...VAZIO.config, ...(s.config || {}), cartoes: ((s.config && s.config.cartoes) || []).slice() }
  };

  for (const op of estado.fila) {
    const d = op.dados || {};
    const marca = { _fila: op.estado, _opId: op.opId, _motivo: op.motivo, _tipoOp: op.tipo };

    // Cadastros ainda na fila já aparecem nas telas.
    if (op.tipo === 'pessoa.criar' && op.estado !== 'recusada' && d.nome &&
        !v.pessoas.some(x => mesmaPessoa(x.nome, d.nome))) {
      v.pessoas.push({ nome: d.nome, tipo: 'Terceiro', geraAcerto: true, ativo: true, ...marca });
    }

    if (op.tipo === 'categoria.criar' && op.estado !== 'recusada' && d.nome &&
        !v.categorias.some(c => mesmaPessoa(c, d.nome))) {
      v.categorias.push(d.nome);
    }

    if (op.tipo === 'cartao.salvar' && op.estado !== 'recusada' && d.nome) {
      const semDono = t => String(t).replace(/\s*\([^()]*\)\s*$/, '').trim();
      const i = v.config.cartoes.findIndex(c => mesmaPessoa(semDono(c), d.nome));
      if (i >= 0) v.config.cartoes[i] = semDono(v.config.cartoes[i]) + ' (' + d.dono + ')';
      else v.config.cartoes.push(d.nome + ' (' + d.dono + ')');
    }

    if (op.tipo === 'despesa.criar') {
      if (!v.despesas.some(x => x.id === d.id)) {
        v.despesas.push({
          ...despesaDeDados(d),
          ...marca,
          comprovante: d.foto ? 'fila:' + op.opId : '',
          lancadoPor: estado.usuario,
          status: ''
        });
      }
    }

    if (op.tipo === 'despesa.editar') {
      const i = v.despesas.findIndex(x => x.id === d.id);
      if (i >= 0 && op.estado !== 'recusada') {
        const antes = v.despesas[i];
        const novo = { ...antes, ...despesaDeDados(d), ...marca };
        if (mudouFinanceiro(antes, d) && d.valorEfetivo === undefined) novo.valorEfetivo = '';
        if (d.foto) novo.comprovante = 'fila:' + op.opId;
        v.despesas[i] = novo;
      } else if (i >= 0) {
        v.despesas[i] = { ...v.despesas[i], _avisoEdicaoRecusada: op.motivo };
      }
    }

    if (op.tipo === 'despesa.excluir' && op.estado !== 'recusada') {
      v.despesas = v.despesas.filter(x => x.id !== d.id);
    }

    if (op.tipo === 'acerto.criar' && !v.acertos.some(x => x.id === d.id)) {
      v.acertos.push({
        id: d.id,
        data: d.data,
        credor: d.credor,
        porConta: d.porConta,
        recursosDe: d.recursosDe,
        destinatario: d.destinatario || '',
        moedaObrigacao: d.moedaObrigacao,
        moedaPagamento: d.moedaPagamento,
        valorPago: num(d.valorPago),
        descricao: d.descricao,
        observacao: d.observacao || '',
        comprovante: d.foto ? 'fila:' + op.opId : '',
        status: 'Na fila',
        lancadoPor: estado.usuario,
        ...marca
      });
    }

    if (op.tipo === 'fundo.criar' && !v.fundos.some(x => x.id === d.id)) {
      v.fundos.push({ ...d, quantidade: num(d.quantidade), custoTotal: d.custoTotal === '' ? '' : num(d.custoTotal), lancadoPor: estado.usuario, ...marca });
    }

    if (op.tipo === 'fundo.editar' && op.estado !== 'recusada') {
      const i = v.fundos.findIndex(x => x.id === d.id);
      if (i >= 0) v.fundos[i] = { ...v.fundos[i], ...d, quantidade: num(d.quantidade), custoTotal: d.custoTotal === '' ? '' : num(d.custoTotal), ...marca };
    }

    if (op.tipo === 'fundo.excluir' && op.estado !== 'recusada') {
      v.fundos = v.fundos.filter(x => x.id !== d.id);
    }
  }

  return v;
}

/** Foto de um lançamento ainda na fila. */
export function fotoDaFila(comprovante) {
  if (!String(comprovante).startsWith('fila:')) return null;
  const op = estado.fila.find(o => o.opId === comprovante.slice(5));
  return op && op.dados && op.dados.foto ? 'data:image/jpeg;base64,' + op.dados.foto : null;
}
