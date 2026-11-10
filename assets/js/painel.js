// Painel de monitoramento para deixar aberto nos computadores da equipe.
import { CONFIG } from './config.js';
import { NIVEIS, gradCSS, iconeURL, estadoCeu, carregarClima, carregarAlerta, alertaVigente } from './clima.js';
import { Ceu } from './ceu.js';
import { $, esc, fmtData, fmtHora, fmtQuando, fmtVigencia, graus, mm, num, nomeDoDia, diaSemana, relativo, partes, duracao, ler, guardar } from './util.js';

const ceu = new Ceu($('#ceu'), { economia: true });
let proxima = Date.now();
let somAtivo = ler('painel-som', false);
let audio = null;

// ------------------------------------------------------------------ relógio
function relogio() {
  const p = partes(new Date());
  $('#relogio').textContent = `${String(p.hora).padStart(2, '0')}:${String(p.min).padStart(2, '0')}:${String(new Date().getSeconds()).padStart(2, '0')}`;
  const d = diaSemana(new Date());
  $('#data-hoje').textContent = `${d.charAt(0).toUpperCase() + d.slice(1)}, ${fmtData(new Date(), true)}`;
  const falta = Math.max(0, proxima - Date.now());
  const el = $('#p-proxima');
  if (el) el.textContent = `próxima verificação em ${Math.floor(falta / 60000)}:${String(Math.floor((falta % 60000) / 1000)).padStart(2, '0')}`;
}
setInterval(relogio, 1000);
relogio();

// ------------------------------------------------------------------ som e notificação quando o alerta sobe
function bip() {
  try {
    audio = audio || new AudioContext();
    const t = audio.currentTime;
    [0, 0.35, 0.7].forEach((d) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.frequency.value = 880; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.28);
      o.connect(g).connect(audio.destination); o.start(t + d); o.stop(t + d + 0.3);
    });
  } catch { /* sem áudio */ }
}
function avisarMudanca(al) {
  const chave = al ? `${al.origem}|${al.nivel}|${al.titulo}|${al.fim}` : 'sem';
  const anterior = ler('painel-ultimo-alerta', null);
  guardar('painel-ultimo-alerta', chave);
  if (anterior === null || anterior === chave || !al) return;
  if (somAtivo) bip();
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = NIVEIS[al.nivel];
    new Notification(`Alerta ${n.cor.toLowerCase()} — Guarapuava`, { body: al.titulo, icon: 'assets/img/icone-192.png', tag: 'alerta-dc' });
  }
}
const btnSom = $('#btn-som');
const atualizarBtnSom = () => { btnSom.setAttribute('aria-pressed', String(somAtivo)); btnSom.textContent = somAtivo ? 'Aviso sonoro ligado' : 'Ativar aviso sonoro'; };
atualizarBtnSom();
btnSom.addEventListener('click', async () => {
  somAtivo = !somAtivo;
  guardar('painel-som', somAtivo);
  atualizarBtnSom();
  if (somAtivo) {
    bip();
    if ('Notification' in window && Notification.permission === 'default') { try { await Notification.requestPermission(); } catch { /* ignorado */ } }
  }
});
$('#btn-tela').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.();
});

// ------------------------------------------------------------------ desenho
function desenharAlerta(al) {
  const box = $('#p-alerta');
  if (!al) {
    box.className = 'p-alerta ok';
    box.removeAttribute('style');
    box.innerHTML = `<span class="nivel">Normal</span><div><h2>Sem alerta vigente para Guarapuava</h2><p>Monitorando SIMEPAR e INMET. A faixa muda de cor sozinha quando houver alerta.</p></div><div class="vig"></div>`;
    return;
  }
  const n = NIVEIS[al.nivel];
  const ini = al.inicio ? new Date(al.inicio) : null, fim = al.fim ? new Date(al.fim) : null;
  box.className = 'p-alerta';
  box.style.cssText = `--alerta-grad:${gradCSS(al.nivel)};--alerta-texto:${n.texto}`;
  box.innerHTML = `<span class="nivel">Alerta ${n.cor.toLowerCase()} · ${n.nome}</span>
    <div><h2>${esc(al.titulo)}</h2><p>${esc(al.resumo || '')}${al.origem === 'inmet' ? ' (aviso automático do INMET)' : ''}</p></div>
    <div class="vig">${ini && fim ? `${fmtVigencia(ini, fim).replace(' até ', '<br>até ').replace(' a ', '<br>a ')}<br>` : ''}${fim ? `<small>${ini && ini > new Date() ? `começa em ${duracao(ini - new Date())}` : `termina em ${duracao(fim - new Date())}`}</small>` : ''}</div>`;
}

function desenharAgora(c) {
  const a = c.atual || {}, hoje = c.dias?.[0] || {};
  $('#p-agora').innerHTML = `
    <img src="${iconeURL(a.condicao, a.dia !== false)}" alt="">
    <span class="temp">${graus(a.temp)}</span>
    <p class="cond">${esc(a.descricao || '')}</p>
    <dl>
      <div><dt>Hoje</dt><dd>${graus(hoje.min)} a ${graus(hoje.max)}</dd></div>
      <div><dt>Chuva hoje</dt><dd>${mm(hoje.chuva_mm)}${hoje.prob != null ? ` · ${num(hoje.prob)}%` : ''}</dd></div>
      <div><dt>Últimas 24 h</dt><dd>${c.chuva_24h_mm != null ? mm(c.chuva_24h_mm) : '–'}</dd></div>
      <div><dt>Umidade</dt><dd>${a.umidade != null ? `${num(a.umidade)}%` : '–'}</dd></div>
      <div><dt>Vento</dt><dd>${a.vento != null ? `${num(a.vento)} km/h ${a.vento_dir || ''}` : '–'}</dd></div>
      <div><dt>Rajadas</dt><dd>${(a.rajada ?? hoje.rajada) != null ? `${num(a.rajada ?? hoje.rajada)} km/h` : '–'}</dd></div>
    </dl>`;
  ceu.definir(estadoCeu(a.condicao, a.dia !== false, { vento: a.vento }));
}

function desenharGrafico(c) {
  const horas = (c.horas || []).slice(0, 24);
  const svg = $('#p-svg');
  const r = svg.getBoundingClientRect();
  const W = Math.max(300, r.width), H = Math.max(140, r.height);
  const m = { t: 34, r: 6, b: 24, l: 30 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const maxC = Math.max(4, ...horas.map((h) => h.chuva_mm || 0));
  const topo = Math.ceil(maxC / 2) * 2, passo = topo <= 8 ? 2 : topo <= 20 ? 5 : 10;
  const bw = iw / Math.max(1, horas.length);
  const y = (v) => m.t + ih - (v / topo) * ih;
  let s = '<defs><linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CCBFF"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs><g class="grade">';
  for (let v = 0; v <= topo; v += passo) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
  s += '</g><g class="eixo">';
  for (let v = 0; v <= topo; v += passo) s += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  horas.forEach((h, i) => { const p = partes(h.t); if (i % 3 === 0) s += `<text x="${m.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${p.hora}h</text>`; });
  s += '</g>';
  horas.forEach((h, i) => {
    const v = h.chuva_mm || 0, alt = (v / topo) * ih, x = m.l + i * bw + 1.5, wb = Math.max(1, bw - 3);
    if (v > 0) s += `<rect x="${x}" y="${m.t + ih - alt}" width="${wb}" height="${alt}" rx="${Math.min(4, wb / 2, alt)}" fill="url(#pg)"/>`;
    if (i % 3 === 0) s += `<text class="temp-h" x="${m.l + i * bw + bw / 2}" y="${m.t - 12}" text-anchor="middle">${graus(h.temp)}</text>`;
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
}

function desenharDias(c) {
  $('#p-dias').innerHTML = (c.dias || []).slice(0, 5).map((d) => `
    <li><b>${nomeDoDia(d.data)}</b><img src="${iconeURL(d.condicao, true)}" alt="${esc(d.descricao || '')}">
    <span class="t">${graus(d.min)} · ${graus(d.max)}</span><span class="c">${d.chuva_mm >= 0.5 ? `${mm(d.chuva_mm)}${d.prob != null ? ` · ${num(d.prob)}%` : ''}` : 'sem chuva'}</span></li>`).join('');
}

function desenharAvisos(c) {
  const av = (c.avisos_inmet || []).filter((a) => !a.fim || new Date(a.fim) > new Date());
  $('#p-avisos').innerHTML = av.length
    ? av.map((a) => `<li><b style="color:${NIVEIS[a.nivel]?.grad[0] || '#fff'}">${esc(a.severidade || '')}</b> · ${esc(a.evento)}${a.fim ? ` até ${fmtQuando(new Date(a.fim))}` : ''}</li>`).join('')
    : '<li>Nenhum aviso ativo do INMET para Guarapuava.</li>';
}

function desenharRodape(c) {
  const f = c.fontes || {};
  const itens = [];
  if (f.simepar) itens.push([f.simepar.ok, 'SIMEPAR']);
  itens.push([f.openmeteo?.ok || c.origem === 'ao-vivo', c.origem === 'ao-vivo' ? 'Open-Meteo (ao vivo)' : 'Open-Meteo']);
  if (f.inmet) itens.push([f.inmet.ok, 'INMET']);
  $('#p-fontes').innerHTML = itens.map(([ok, t]) => `<li><span class="${ok ? 'ok' : 'falha'}"></span>${t}</li>`).join('');
  $('#p-atualizacao').innerHTML = `Dados de ${fmtHora(new Date(c.gerado_em))} (${relativo(c.gerado_em)}) · <span id="p-proxima"></span>`;
}

let ultimo = null;
async function atualizar() {
  proxima = Date.now() + CONFIG.atualizarACadaMin * 60e3;
  try {
    const [clima, alerta] = await Promise.all([carregarClima(), carregarAlerta()]);
    const al = alertaVigente(alerta, clima);
    ultimo = clima;
    desenharAlerta(al);
    desenharAgora(clima);
    desenharGrafico(clima);
    desenharDias(clima);
    desenharAvisos(clima);
    desenharRodape(clima);
    avisarMudanca(al);
  } catch (e) {
    console.error(e);
    $('#p-atualizacao').textContent = 'Sem conexão com os dados. Tentando de novo em instantes.';
    proxima = Date.now() + 60e3;
    setTimeout(atualizar, 60e3);
  }
}
await atualizar();
setInterval(atualizar, CONFIG.atualizarACadaMin * 60e3);
addEventListener('resize', () => ultimo && desenharGrafico(ultimo));
// recarrega a página a cada 6 h para pegar melhorias publicadas no site
setTimeout(() => location.reload(), 6 * 3600e3);
