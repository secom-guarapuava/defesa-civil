// Textos prontos para WhatsApp e controle da janela "Compartilhar".
import { CONFIG, urlDoSite } from './config.js';
import { NIVEIS } from './clima.js';
import { desenharArte, canvasParaArquivo } from './arte.js';
import { $, fmtData, fmtHora, fmtQuando, fmtVigencia, graus, mm, nomeDoDia, num } from './util.js';

const contatoDC = () => CONFIG.contatos.find((c) => c.nome.includes('Guarapuava'));

function rodapeTexto(url) {
  const dc = contatoDC();
  return [
    '',
    `📞 Bombeiros: 193${dc ? ` | Defesa Civil: ${dc.numero} (plantão 24h)` : ''}`,
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

// ------------------------------------------------------------------ janela de compartilhar
export function iniciarCompartilhar(obterDados) {
  const dlg = $('#dlg-compartilhar');
  const form = $('#comp-form');
  const canvas = $('#comp-canvas');
  const texto = $('#comp-texto');
  const msg = $('#comp-msg');
  let editado = false;
  let ultimoTipo = null;

  const valores = () => ({ tipo: form.tipo.value, formato: form.formato.value });

  async function atualizar() {
    const { clima, alerta } = obterDados();
    const { tipo, formato } = valores();
    if (tipo !== ultimoTipo) editado = false;
    ultimoTipo = tipo;
    if (!editado) {
      texto.value = tipo === 'alerta' ? textoAlerta(alerta) : tipo === 'previsao' ? textoPrevisao(clima, alerta) : textoTempo(clima, alerta);
    }
    msg.textContent = '';
    canvas.style.opacity = '.5';
    await desenharArte(canvas, { tipo, formato, clima, alerta, url: urlDoSite() });
    canvas.style.opacity = '1';
  }

  texto.addEventListener('input', () => { editado = true; });
  form.addEventListener('change', atualizar);

  function nomeArquivo() {
    const { tipo, formato } = valores();
    const d = new Date();
    return `defesa-civil-guarapuava-${tipo}-${formato}-${fmtData(d).replace('/', '-')}-${fmtHora(d).replace('h', 'h')}.png`;
  }

  $('#comp-enviar').addEventListener('click', async () => {
    const arquivo = await canvasParaArquivo(canvas, nomeArquivo());
    const dados = { files: [arquivo], text: texto.value };
    if (navigator.canShare?.(dados)) {
      try { await navigator.share(dados); msg.textContent = 'Pronto!'; return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    // Computador: baixa a imagem, copia a legenda e abre o WhatsApp
    baixar(arquivo);
    try { await navigator.clipboard.writeText(texto.value); } catch { /* sem permissão */ }
    msg.textContent = 'Imagem baixada e legenda copiada. No WhatsApp, anexe a imagem e cole a legenda.';
    window.open('https://web.whatsapp.com/', '_blank', 'noopener');
  });

  function baixar(arquivo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(arquivo);
    a.download = arquivo.name;
    document.body.append(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  $('#comp-baixar').addEventListener('click', async () => {
    baixar(await canvasParaArquivo(canvas, nomeArquivo()));
    msg.textContent = 'Imagem baixada.';
  });
  $('#comp-texto-whats').addEventListener('click', () => abrirWhatsAppTexto(texto.value));
  $('#comp-copiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(texto.value); msg.textContent = 'Legenda copiada.'; } catch { texto.select(); msg.textContent = 'Selecione e copie a legenda.'; }
  });
  $('#comp-fechar').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });

  return function abrir(tipo = 'auto') {
    const { alerta } = obterDados();
    const radioAlerta = form.querySelector('input[value="alerta"]');
    radioAlerta.disabled = !alerta;
    const escolhido = tipo === 'auto' ? (alerta ? 'alerta' : 'tempo') : (tipo === 'alerta' && !alerta ? 'tempo' : tipo);
    form.querySelector(`input[name="tipo"][value="${escolhido}"]`).checked = true;
    editado = false;
    dlg.showModal();
    atualizar();
  };
}
