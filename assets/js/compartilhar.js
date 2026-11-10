// Legendas prontas para WhatsApp e Instagram (usadas na área da equipe).
import { CONFIG, urlDoSite } from './config.js';
import { NIVEIS } from './clima.js';
import { fmtData, fmtHora, fmtQuando, fmtVigencia, graus, mm, nomeDoDia, num } from './util.js';

const contatoDC = () => CONFIG.contatos.find((c) => c.nome.includes('Guarapuava'));

function rodapeTexto(url) {
  const dc = contatoDC();
  return [
    '',
    `📞 Bombeiros: 193${dc ? ` | Defesa Civil: ${dc.numero} (plantão 24h, ligação ou WhatsApp)` : ''}`,
    `🔗 Acompanhe: ${url}`,
    `📲 Canal da Defesa Civil de Guarapuava: ${CONFIG.canalWhatsApp}`,
  ].join('\n');
}

export function textoAlerta(alerta, url = urlDoSite()) {
  if (!alerta) return '';
  const n = NIVEIS[alerta.nivel] || NIVEIS.alto;
  const linhas = [
    `${n.emoji} *ALERTA ${n.cor.toUpperCase()}: ${(alerta.titulo || n.nome).toUpperCase()}*`,
    `📍 Guarapuava (PR)`,
  ];
  if (alerta.inicio && alerta.fim) linhas.push(`🗓️ Vigência: ${fmtVigencia(alerta.inicio, alerta.fim)}`);
  linhas.push('');
  if (alerta.dias?.length) alerta.dias.forEach((d) => linhas.push(`*${d.rotulo}:* ${d.texto}`, ''));
  else if (alerta.resumo) linhas.push(alerta.resumo, '');
  if (alerta.impactos?.length) linhas.push(`⚠️ Podem ocorrer: ${alerta.impactos.join(', ')}.`);
  if (alerta.origem === 'inmet') linhas.push('Fonte: aviso meteorológico do INMET.');
  return linhas.join('\n').replace(/\n{3,}/g, '\n\n') + '\n' + rodapeTexto(url);
}

export function textoTempo(clima, alerta, url = urlDoSite()) {
  const a = clima?.atual || {};
  const hoje = clima?.dias?.[0] || {};
  const agora = new Date();
  const linhas = [
    `🌦️ *Tempo agora em Guarapuava* (${fmtData(agora)}, ${fmtHora(agora)})`,
    `🌡️ ${graus(a.temp)} · ${a.descricao || ''}`,
    `Sensação ${graus(a.sensacao)} · Umidade ${num(a.umidade)}%`,
    `Hoje: mínima ${graus(hoje.min)} e máxima ${graus(hoje.max)}`,
    `🌧️ Chuva prevista hoje: ${mm(hoje.chuva_mm)}${hoje.prob != null ? ` (${num(hoje.prob)}% de chance)` : ''}`,
  ];
  if (hoje.rajada != null) linhas.push(`💨 Rajadas de até ${num(hoje.rajada)} km/h`);
  if (alerta) {
    const n = NIVEIS[alerta.nivel] || NIVEIS.alto;
    linhas.push('', `${n.emoji} *Alerta ${n.cor.toLowerCase()} em vigor:* ${alerta.titulo}${alerta.fim ? ` (até ${fmtQuando(new Date(alerta.fim))})` : ''}`);
  }
  linhas.push(`Fonte: ${a.fonte === 'simepar' ? 'SIMEPAR' : 'Open-Meteo'}`);
  return linhas.join('\n') + '\n' + rodapeTexto(url);
}

export function textoPrevisao(clima, alerta, url = urlDoSite()) {
  const dias = (clima?.dias || []).slice(0, 3);
  const linhas = ['📅 *Previsão do tempo para Guarapuava*', ''];
  for (const d of dias) {
    linhas.push(`*${nomeDoDia(d.data)} (${fmtData(new Date(d.data + 'T12:00:00-03:00'))}):* ${d.descricao || ''}. ${graus(d.min)} a ${graus(d.max)}. Chuva: ${mm(d.chuva_mm)}${d.prob != null ? ` (${num(d.prob)}%)` : ''}.`);
  }
  if (alerta) {
    const n = NIVEIS[alerta.nivel] || NIVEIS.alto;
    linhas.push('', `${n.emoji} *Alerta ${n.cor.toLowerCase()} em vigor:* ${alerta.titulo}`);
  }
  linhas.push(`Fonte: ${dias[0]?.fonte === 'simepar' ? 'SIMEPAR' : 'Open-Meteo'}`);
  return linhas.join('\n') + '\n' + rodapeTexto(url);
}

export function abrirWhatsAppTexto(texto) {
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
}
