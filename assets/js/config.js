// =====================================================================================
//  CONFIGURAÇÕES DO SITE — é aqui que a equipe muda contatos, links e o repositório.
// =====================================================================================
export const CONFIG = {
  municipio: 'Guarapuava',
  uf: 'PR',
  ibge: 4109401,
  lat: -25.3902,
  lon: -51.4623,

  // Endereço público do site. Se ficar vazio, o site usa o endereço em que está aberto.
  // Ex.: 'https://defesacivil.guarapuava.pr.gov.br/'
  urlSite: '',

  canalWhatsApp: 'https://whatsapp.com/channel/0029Vb8W13N0G0XZkOXPLw2s',

  links: {
    simepar: 'https://www.simepar.br/simepar/forecast_by_counties/4109401',
    defesaCivilPR: 'https://www.defesacivil.pr.gov.br/',
    inmetAvisos: 'https://alertas2.inmet.gov.br/',
    prefeitura: 'https://www.guarapuava.pr.gov.br/',
  },

  // Contatos exibidos no site, no boletim e nas artes (ordem = ordem na tela)
  contatos: [
    { numero: '193', tel: '193', nome: 'Corpo de Bombeiros', detalhe: 'Emergências, resgates, incêndios', destaque: true },
    { numero: '(42) 98427-0618', tel: '+5542984270618', nome: 'Defesa Civil de Guarapuava', detalhe: 'Plantão 24 horas', destaque: true },
    { numero: '199', tel: '199', nome: 'Defesa Civil', detalhe: 'Linha de emergência' },
    { numero: '192', tel: '192', nome: 'SAMU', detalhe: 'Urgência médica' },
    { numero: '190', tel: '190', nome: 'Polícia Militar', detalhe: 'Segurança' },
    { numero: '0800 51 00 116', tel: '08005100116', nome: 'Copel', detalhe: 'Fios caídos e falta de energia' },
    { numero: '0800 200 0115', tel: '08002000115', nome: 'Sanepar', detalhe: 'Água e esgoto, 24 horas' },
  ],

  alertasCelular: {
    sms: '40199',
    whatsappNacional: '(61) 2034-4611',
    whatsappNacionalLink: 'https://wa.me/556120344611?text=oi',
  },

  // Repositório no GitHub — usado pela página "gerenciar.html" para publicar alertas.
  // Preencha com o seu usuário/organização e o nome do repositório.
  github: { usuario: '', repositorio: '', ramo: 'main' },

  // Se não houver alerta da Defesa Civil, mostrar avisos do INMET que incluem Guarapuava?
  usarAvisosINMET: true,

  // A cada quantos minutos a página busca dados novos (sem precisar recarregar)
  atualizarACadaMin: 5,

  // Se os dados do robô tiverem mais de X minutos, a página busca a previsão direto no Open-Meteo
  dadosVelhosMin: 100,
};

export function urlDoSite() {
  if (CONFIG.urlSite) return CONFIG.urlSite;
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/(index|painel|gerenciar)\.html$/, '');
  return u.toString();
}
