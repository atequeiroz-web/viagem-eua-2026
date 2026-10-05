// SOBRE O APP: identificação, versões das peças, onde ficam os dados,
// novidades de cada versão, o que fazer se algo der errado e créditos.
// Conteúdo combinado com o usuário em 03/10/2026 (sem dados da viagem e
// sem menção a ferramentas de IA).

import { estado, visao } from '../dados.js';
import { cabecalho, abrirFolha, renderizar } from '../ui.js';
import { icone } from '../icones.js';
import { esc, tempoRelativo } from '../util.js';
import { lerDiario } from '../db.js';
import { VERSAO, DATA_VERSAO, VERSAO_MOTOR } from '../config.js';

// Da mais nova para a mais antiga. Ao publicar, acrescente no topo.
const NOVIDADES = [
  ['1.8.2', '04/10/2026', [
    'Gorjeta na Nova despesa (em US$): digite o total do recibo e toque em 15%, 18%, 20% ou informe o valor; o app lança o total e anota a conta na observação.',
    'Categoria "Gorjetas" (para gorjeta paga à parte: camareira, valet, guia) com ícone e cor próprios, quando for cadastrada.',
    'Desconectar encerra a sessão na hora: uma resposta da planilha que chegue depois é descartada.'
  ]],
  ['1.8.1', '04/10/2026', [
    'Desconectar este iPhone apaga o acesso e os dados de forma garantida, mesmo que o iPhone demore a liberar o armazenamento.',
    'Se o armazenamento do iPhone travar ao abrir, o app não fica parado: segue pela reserva ou pede a chave.'
  ]],
  ['1.8.0', '04/10/2026', [
    'Nova despesa em 4 etapas, com "Continuar": quanto e o quê; quem pagou e de quem é; comprovante e local; conferir e salvar.',
    'Sugestões por toque: as descrições e os locais já usados aparecem para tocar, sem digitar.',
    'Editar uma despesa abre direto no "Conferir": toque na linha que quer mudar.',
    'Enviar extrato: na tela de uma dívida, o texto pronto para mandar por WhatsApp, Mensagens ou e-mail.'
  ]],
  ['1.7.3', '04/10/2026', [
    'Se o Google falhar por um instante (erro 404 ou sem resposta), o app tenta de novo sozinho antes de avisar.',
    'Segunda cópia dos dados e dos lançamentos ainda não enviados: se o iPhone perder a primeira, o app abre pela reserva, mesmo sem sinal.',
    'Splash de 2 segundos.'
  ]],
  ['1.7.2', '04/10/2026', [
    'Com o app aberto, a planilha é lida de 5 em 5 minutos (antes, a cada minuto), para poupar bateria. Para ler na hora: tocar em "Em dia" e em "Atualizar agora".',
    'A faixa do relógio e da bateria ficou sólida: o título não aparece mais por baixo dela.'
  ]],
  ['1.7.1', '04/10/2026', [
    'Dívida em dólar mostra quanto vale hoje em reais (na conta e no pagamento), pela cotação oficial mais recente.',
    'Aviso de ponte desatualizada indica a versão certa (1.2.1 ou mais nova).'
  ]],
  ['1.7.0', '03/10/2026', [
    'Excluir pagamento: devolve as dívidas que ele tinha abatido. Com isso, lançamentos de teste podem ser apagados pelo próprio app (primeiro os pagamentos, depois a despesa).',
    'Pagamento ainda na fila (sem sinal) pode ser desistido antes de subir.'
  ]],
  ['1.6.0', '03/10/2026', [
    'Splash: a imagem da viagem aparece ao abrir o app; um toque pula.'
  ]],
  ['1.5.4', '03/10/2026', [
    'Mapa com ruas do OpenStreetMap e opção Satélite, sem chave de acesso (antes aparecia "API KEY REQUIRED").',
    'O mapa aparece mesmo sem despesas, como referência, com o botão que mostra onde você está.'
  ]],
  ['1.5.3', '03/10/2026', [
    'Mapa: tocar no marco mostra embaixo do mapa as coordenadas e o resumo do gasto; tocar no resumo abre a despesa completa.'
  ]],
  ['1.5.2', '03/10/2026', [
    'Local registrado mostra as coordenadas e a precisão; ao tocar, aparece a confirmação.',
    'O texto não passa mais por baixo do relógio e da bateria ao rolar a tela.'
  ]],
  ['1.5.1', '03/10/2026', [
    'Registrar local nunca fica parado em "Buscando local…": há um prazo, a opção de cancelar e, se falhar, o motivo na tela.',
    'O diário registra a permissão de localização e cada tentativa de achar o local.'
  ]],
  ['1.5.0', '03/10/2026', [
    'Mapa da viagem: cada despesa com local vira um marco na cor da categoria, ligado na ordem do trajeto; tocar no marco abre a despesa.',
    'Filtro do mapa por dia e lista das paradas.',
    'Registrar local pelo toque usa o GPS de alta precisão e, se falhar, diz o motivo.'
  ]],
  ['1.4.2', '03/10/2026', [
    'Tela "Sobre o app".'
  ]],
  ['1.4.1', '03/10/2026', [
    'Sem a cópia da planilha no iPhone, aparece "Baixando os dados…" em vez de telas vazias.',
    'Voltar segue o caminho percorrido; sem caminho, sobe até o Resumo.',
    'Diário registra cada gravação da cópia da planilha.',
    'Regra de segurança: o app só executa o próprio código e só fala com a ponte do Google.'
  ]],
  ['1.4.0', '03/10/2026', [
    'Cadastros pelo app: pagador, cartão com dono e categoria.',
    'Nice, Ana ou outro pagador de fora: sempre dinheiro, em dólar.',
    'Cada um vê só os seus cartões.',
    'Cópia de segurança do acesso: o app não pede a chave de novo se o iPhone perder dados.',
    'Diário do iPhone e botão "Colar a chave copiada".'
  ]],
  ['1.3.0', '03/10/2026', [
    'Telas em cards que abrem; Relatórios (extrato, por pessoa, por cartão, dívidas e montado).',
    'Conversor abre vazio, com o cursor no valor.',
    'Ícones coloridos por categoria e cartões translúcidos.'
  ]],
  ['1.2.0', '02/10/2026', [
    'Totais por moeda (US$ em destaque) com a referência em reais.',
    'Card do pagamento: quanto foi pago, quanto abateu em dólar e quais dívidas quitou.'
  ]],
  ['1.1.0', '02/10/2026', [
    'Resumo dia a dia, gasto antes da viagem e total geral.'
  ]],
  ['1.0.0', '02/10/2026', [
    'Primeira versão: lançamento de despesas, contas, pagamentos e conversor, com funcionamento sem sinal.'
  ]]
];

let todasNovidades = false;

function linha(rotulo, valor, classe = '') {
  return '<div class="linha-simples' + (classe ? ' ' + classe : '') + '"><span>' + esc(rotulo) + '</span><strong>' + valor + '</strong></div>';
}

export function abrirDiario() {
  const lista = lerDiario().slice().reverse();
  const quando = iso => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };
  abrirFolha({
    titulo: 'Diário deste iPhone',
    html: '<p class="texto-suave">Aberturas do app e gravações da cópia da planilha, da mais recente para a mais antiga. Serve para descobrir o que aconteceu se o app fechar ou pedir a chave de novo.</p>' +
      (lista.length
        ? '<ul class="lista lista-simples">' + lista.map(x =>
            '<li class="item item-compacto item-estatico"><span class="item-meio"><span class="item-sub">' + esc(quando(x.quando)) + '</span>' +
            '<span class="item-titulo diario-texto">' + esc(x.texto) + '</span></span></li>').join('') + '</ul>'
        : '<p class="texto-suave">Nada registrado ainda.</p>')
  });
}

export const telaSobre = {
  aba: '',
  vivo: true,

  render() {
    const v = visao();
    const novidades = todasNovidades ? NOVIDADES : NOVIDADES.slice(0, 2);

    return cabecalho({ titulo: 'Sobre o app', voltarPara: '/mais' }) +

      '<section class="cartao sobre-id">' +
        '<img src="icones/icone-192.png" alt="" width="64" height="64" class="sobre-icone">' +
        '<div><h2 class="sobre-nome">Viagem EUA 2026</h2>' +
        '<p class="sobre-desc">Controle de despesas e acertos</p></div>' +
      '</section>' +

      '<section class="cartao">' +
        linha('Versão', esc(VERSAO)) +
        linha('Data da versão', esc(DATA_VERSAO)) +
        linha('Desenvolvedor', 'João Batista Queiroz Neto', 'linha-quebra') +
        '<p class="nota-pequena">© 2026 João Batista Queiroz Neto. Uso pessoal.</p>' +
      '</section>' +

      '<h2 class="secao-titulo">Componentes</h2>' +
      '<section class="cartao">' +
        linha('App', esc(VERSAO)) +
        linha('Ponte (Apps Script)', esc(v.versaoApi || '—')) +
        linha('Motor financeiro', esc(VERSAO_MOTOR)) +
        linha('Planilha', esc(v.planilha || '—'), 'linha-quebra') +
        linha('Lida pela última vez', esc(tempoRelativo(estado.ultimaSync))) +
      '</section>' +

      '<h2 class="secao-titulo">Onde ficam os dados</h2>' +
      '<section class="cartao sobre-texto">' +
        '<p>' + icone('nuvem', 18, 2) + '<span>Os lançamentos ficam na sua planilha Google; as fotos dos comprovantes, no seu Google Drive.</span></p>' +
        '<p>' + icone('telefone', 18, 2) + '<span>Uma cópia fica neste iPhone, para o app funcionar sem sinal.</span></p>' +
        '<p>' + icone('escudo', 18, 2) + '<span>O app não envia nada para terceiros. Sem a chave de acesso, ninguém lê nem grava.</span></p>' +
      '</section>' +

      '<h2 class="secao-titulo">Novidades</h2>' +
      novidades.map(([versao, data, itens]) =>
        '<section class="cartao sobre-versao">' +
          '<div class="cartao-topo"><h3 class="cartao-titulo">Versão ' + esc(versao) + '</h3><span class="cartao-nota">' + esc(data) + '</span></div>' +
          '<ul class="sobre-lista">' + itens.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
        '</section>'
      ).join('') +
      (NOVIDADES.length > 2
        ? '<button type="button" class="botao-texto" data-novidades>' + (todasNovidades ? 'Mostrar só as últimas' : 'Ver todas as versões') + '</button>'
        : '') +

      '<h2 class="secao-titulo">Se algo der errado</h2>' +
      '<section class="cartao">' +
        '<ol class="sobre-passos">' +
          '<li>Feche o app por completo e abra de novo pelo ícone.</li>' +
          '<li>Veja o diário deste iPhone (botão abaixo): ele mostra como o app abriu.</li>' +
          '<li>Se o app não abrir, lance a despesa direto na planilha pelo app Google Planilhas. O motor processa do mesmo jeito.</li>' +
        '</ol>' +
        '<button type="button" class="botao botao-secundario sobre-diario" data-diario>' + icone('fila', 18, 2) + ' Ver o diário deste iPhone</button>' +
      '</section>' +

      '<h2 class="secao-titulo">Créditos</h2>' +
      '<section class="cartao sobre-texto">' +
        '<p><span>Fonte Plus Jakarta Sans © 2020 The Plus Jakarta Sans Project Authors, sob a licença SIL Open Font License 1.1.</span></p>' +
        '<p><span>Cotações: Banco Central do Brasil (PTAX e SGS).</span></p>' +
        '<p><span>Mapa: Leaflet (licença BSD-2); ruas © colaboradores do OpenStreetMap; imagens de satélite © Esri.</span></p>' +
      '</section>';
  },

  montar(raiz) {
    raiz.addEventListener('click', ev => {
      if (ev.target.closest('[data-diario]')) return abrirDiario();
      if (ev.target.closest('[data-novidades]')) {
        todasNovidades = !todasNovidades;
        renderizar(true);
      }
    });
  }
};
