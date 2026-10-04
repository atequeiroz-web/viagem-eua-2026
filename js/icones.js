// Ícones em traço (SVG), desenhados para este app.

const P = {
  resumo: '<path d="M12 3a9 9 0 1 0 9 9h-9z"/><path d="M15 3.3A9 9 0 0 1 20.7 9H15z"/>',
  historico: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  conversor: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  contas: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h2"/>',
  menu: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  semSinal: '<path d="M2 2l20 20M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.3-1.7M2 8.8a15 15 0 0 1 4.2-2.6M22 8.8A15 15 0 0 0 10.7 5M12 20h.01"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alerta: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  direita: '<path d="m9 6 6 6-6 6"/>',
  esquerda: '<path d="m15 6-6 6 6 6"/>',
  baixo: '<path d="m6 9 6 6 6-6"/>',
  fechar: '<path d="M6 6l12 12M18 6 6 18"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  lixeira: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  lapis: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  atualizar: '<path d="M20 11a8 8 0 0 0-14.6-4.5L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4.5L20 16"/><path d="M20 20v-4h-4"/>',
  nuvem: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1 0 8z"/>',
  trocar: '<path d="M8 4v16M4 16l4 4 4-4M16 20V4M12 8l4-4 4 4"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  sair: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11"/>',
  dinheiro: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v.01M18 14.5v.01"/>',
  recibo: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  aviao: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  garfo: '<path d="M7 3v8M5 3v4a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1-3 3-3 6v3h3v9"/>',
  carrinho: '<path d="M3 4h2l2.5 11h11L21 8H6.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  carro: '<rect x="4" y="10" width="16" height="7" rx="2"/><path d="M7 10l1.5-4h7L17 10M7 20v-3M17 20v-3"/>',
  ingresso: '<path d="M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z"/><path d="M14 7v10"/>',
  sacola: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  presente: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13"/><path d="M12 8c-1.5-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3.5-2-5 1"/>',
  saude: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z"/><path d="M7 10l7 7"/>',
  telefone: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  escudo: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
  mala: '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V4h6v3M9 11v5M15 11v5"/>',
  cama: '<path d="M3 18V6M3 13h18v5M21 18v-5a3 3 0 0 0-3-3h-7v3"/><circle cx="7" cy="10" r="1.5"/>',
  raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  etiqueta: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  fila: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="17" r="3"/><path d="M18 15.6V17l1 .8"/>',
  compartilhar: '<path d="M12 3v12"/><path d="M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/>',
  maos: '<path d="M7 11V7a2 2 0 0 1 4 0v4M11 9V5a2 2 0 0 1 4 0v6M15 9a2 2 0 0 1 4 0v4a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-2.7L3 13.5a1.8 1.8 0 0 1 2.8-2.2L7 13"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>'
};

export function icone(nome, tamanho = 22, traco = 1.8, extra = '') {
  return '<svg class="ic" width="' + tamanho + '" height="' + tamanho +
    '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + traco +
    '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + extra + '>' +
    (P[nome] || P.etiqueta) + '</svg>';
}

const POR_CATEGORIA = {
  'passagens aereas': 'aviao',
  'alimentacao': 'garfo',
  'mercado': 'carrinho',
  'transporte': 'carro',
  'passeios e ingressos': 'ingresso',
  'compras pessoais': 'sacola',
  'presentes e lembrancas': 'presente',
  'farmacia / saude': 'saude',
  'telefonia / internet': 'telefone',
  'seguro viagem': 'escudo',
  'bagagem / servicos aereos': 'mala',
  'taxas e tarifas': 'recibo',
  'hospedagem': 'cama',
  'imprevistos': 'raio',
  'outros': 'etiqueta'
};

/**
 * Cor de cada categoria, como etiqueta de bagagem: o ícone sai na cor
 * e o quadradinho em volta ganha um fundo claro da mesma cor (app.css).
 */
const COR_CATEGORIA = {
  'passagens aereas': ['ceu', '#1D5FD1'],
  'alimentacao': ['tomate', '#D9480F'],
  'mercado': ['folha', '#2B8A3E'],
  'transporte': ['mar', '#0C8599'],
  'passeios e ingressos': ['violeta', '#7048E8'],
  'compras pessoais': ['framboesa', '#C2255C'],
  'presentes e lembrancas': ['rosa', '#D6336C'],
  'farmacia / saude': ['vermelho', '#E03131'],
  'telefonia / internet': ['anil', '#3B5BDB'],
  'seguro viagem': ['azul', '#1971C2'],
  'bagagem / servicos aereos': ['couro', '#A0522D'],
  'taxas e tarifas': ['ardosia', '#5C677D'],
  'hospedagem': ['ameixa', '#9C36B5'],
  'imprevistos': ['ambar', '#E67700'],
  'outros': ['ardosia', '#5C677D']
};

function chaveCategoria(categoria) {
  return String(categoria ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/** Cor (hex) da categoria; cinza-ardósia para as desconhecidas. */
export function corCategoria(categoria) {
  return (COR_CATEGORIA[chaveCategoria(categoria)] || COR_CATEGORIA.outros)[1];
}

export function iconeCategoria(categoria, tamanho = 22) {
  const chave = chaveCategoria(categoria);
  const [nomeCor, hex] = COR_CATEGORIA[chave] || COR_CATEGORIA.outros;
  return icone(POR_CATEGORIA[chave] || 'etiqueta', tamanho, 1.9, ' data-cor="' + nomeCor + '" style="color:' + hex + '"');
}

/** Nome curto para os botões de categoria. */
export function rotuloCurtoCategoria(categoria) {
  const mapa = {
    'Passagens aéreas': 'Passagens',
    'Passeios e ingressos': 'Passeios',
    'Compras pessoais': 'Compras',
    'Presentes e lembranças': 'Presentes',
    'Farmácia / Saúde': 'Farmácia',
    'Telefonia / Internet': 'Internet',
    'Seguro viagem': 'Seguro',
    'Bagagem / serviços aéreos': 'Bagagem',
    'Taxas e tarifas': 'Taxas'
  };
  return mapa[categoria] || categoria;
}
