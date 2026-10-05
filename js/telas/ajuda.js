// GUIA RÁPIDO (1.9.0): ajuda dentro do próprio app, pedida pelo usuário
// em 05/10/2026. Cada assunto abre e fecha, para a tela não ficar poluída.

import { cabecalho } from '../ui.js';
import { icone } from '../icones.js';

const TOPICOS = [
  ['mais', 'Lançar uma despesa', [
    'Toque no botão azul <strong>+</strong> no rodapé. São 4 etapas, com <strong>Continuar</strong>: quanto e o quê; quem pagou e de quem é; comprovante e local; conferir e salvar.',
    'Descrições e locais já usados aparecem como botões: toque para não digitar.',
    'O <strong>local é registrado sozinho</strong>. O quadro verde "Local registrado" já é o local; tocar nele <strong>remove</strong>.',
    'No restaurante, digite o <strong>total do recibo</strong> (já com o imposto) e toque em <strong>+ Gorjeta</strong> (15%, 18%, 20% ou um valor). O app lança o total.',
    'Antes de salvar, a etapa 4 mostra tudo. Toque numa linha para corrigir.'
  ]],
  ['contas', 'Quem paga e quem fica devendo', [
    '<strong>Compartilhada</strong>: metade de cada um. Se o João pagou, a Norma passa a dever a metade a ele, e vice-versa.',
    'Se <strong>Nice ou Ana</strong> pagarem, conta sempre como <strong>dinheiro, em dólar</strong>, e vira dívida de quem consumiu.',
    'Cada dívida fica na moeda do gasto: dólar com dólar, real com real.',
    'Cada um vê, na Nova despesa, só os seus cartões.'
  ]],
  ['maos', 'Pagar uma dívida', [
    'Em <strong>Contas</strong>, toque em <strong>Registrar pagamento</strong>: escolha a dívida, quem pagou, o valor (pode ser em reais) e o que foi pago. A foto do Pix ou do recibo é opcional.',
    'A planilha converte pela cotação oficial do dia e abate a dívida mais antiga primeiro. Pagou a mais? Vira crédito.',
    'Na tela de uma dívida aparecem o valor em reais de hoje e o botão <strong>Enviar extrato</strong> (WhatsApp, Mensagens, e-mail).'
  ]],
  ['dinheiro', 'Dinheiro em espécie (dólar e guarani)', [
    'Ao comprar moeda, lance em <strong>Mais → Dinheiro em espécie</strong>, no nome de quem vai carregar o dinheiro, com o custo em reais.',
    'Assim, cada gasto em dinheiro sai pelo preço que você pagou. Sem essa compra lançada, aparece "saldo insuficiente".',
    'Real em dinheiro não precisa de nada antes.'
  ]],
  ['semSinal', 'Sem sinal', [
    'Pode lançar normalmente, com foto e local: fica guardado no iPhone e sobe sozinho quando houver sinal.',
    'Quando tiver Wi-Fi, abra o app e confira que a etiqueta do alto diz <strong>Em dia</strong>.',
    'Para ler a planilha na hora: toque em <strong>Em dia</strong> e em <strong>Atualizar agora</strong>.'
  ]],
  ['lixeira', 'Corrigir ou apagar', [
    'Abra a despesa no <strong>Histórico</strong> e toque em <strong>Editar</strong> ou <strong>Excluir</strong>.',
    'Despesa que já teve pagamento: exclua antes os pagamentos (do mais novo para o mais antigo), depois a despesa.',
    'Se salvar duas vezes a mesma despesa em poucos minutos, o app pergunta antes.'
  ]],
  ['alerta', 'Se algo der errado', [
    'Feche o app por completo e abra de novo.',
    'Veja o diário em <strong>Mais → Sobre o app</strong>.',
    'Se o app não abrir de jeito nenhum, lance direto na planilha pelo app Google Planilhas: o cálculo acontece do mesmo jeito.',
    '<strong>Desconectar este iPhone</strong> só em último caso: para voltar, é preciso internet e a chave de acesso.'
  ]]
];

export const telaAjuda = {
  aba: '',

  render() {
    return cabecalho({ titulo: 'Guia rápido', sobre: 'COMO USAR', voltarPara: '/mais' }) +
      '<div class="ajuda">' +
      TOPICOS.map(([ic, titulo, itens]) =>
        '<details class="cartao ajuda-topico">' +
          '<summary><span class="item-ic">' + icone(ic, 20) + '</span><span class="ajuda-titulo">' + titulo + '</span>' + icone('baixo', 18, 2.2) + '</summary>' +
          '<ul class="ajuda-lista">' + itens.map(t => '<li>' + t + '</li>').join('') + '</ul>' +
        '</details>'
      ).join('') +
      '</div>';
  }
};
