// =====================================================================================
//  CONFIGURAÇÕES DO SITE — é aqui que a equipe muda contatos, links e a senha da equipe.
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

  // Contatos exibidos no site e nas artes (ordem = ordem na tela).
  // "whatsapp" (opcional): número com DDI e DDD, só dígitos, para abrir a conversa direto.
  contatos: [
    { numero: '193', tel: '193', nome: 'Corpo de Bombeiros', detalhe: 'Emergências, resgates, incêndios', destaque: true },
    { numero: '(42) 98427-0618', tel: '+5542984270618', whatsapp: '5542984270618', nome: 'Defesa Civil de Guarapuava', detalhe: 'Plantão 24 horas, ligação ou WhatsApp', destaque: true },
    { numero: '199', tel: '199', nome: 'Defesa Civil', detalhe: 'Linha de emergência' },
    { numero: '192', tel: '192', nome: 'SAMU', detalhe: 'Urgência médica' },
    { numero: '190', tel: '190', nome: 'Polícia Militar', detalhe: 'Segurança' },
    { numero: '0800 51 00 116', tel: '08005100116', nome: 'Copel', detalhe: 'Fios caídos e falta de energia' },
    { numero: '0800 200 0115', tel: '08002000115', nome: 'Sanepar', detalhe: 'Água e esgoto, 24 horas' },
  ],

  // WhatsApp do plantão da Defesa Civil (botão verde na barra do celular)
  whatsappPlantao: '5542984270618',

  alertasCelular: { sms: '40199' },

  // Senha da página da equipe (gerenciar.html). Não é a senha em si: é uma "impressão digital"
  // dela. Para trocar, entre na página da equipe e use "Trocar a senha da equipe".
  senhaEquipe: { sal: '9cdd4f9ca5c144ee7990941aebd727ed', hash: '4ba41ecffb216db11e76f98345de7320bf3939a74deabe2890b031c98415c027', iteracoes: 150000 },

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
