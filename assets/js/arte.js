// Gerador de artes para WhatsApp/Instagram (status 1080x1920 e post 1080x1350).
// Usado pelo botão "Compartilhar" do site e pela página de gestão de alertas.
import { CONFIG } from './config.js';
import { NIVEIS, FENOMENOS, iconeURL } from './clima.js';
import { diaSemana, fmtData, fmtHora, fmtQuando, graus, mm, nomeDoDia, num } from './util.js';

export const FORMATOS = { status: [1080, 1920], feed: [1080, 1350] };

const CEUS = {
  sol: ['#1E63D8', '#3D8BF0', '#8CC6FF'],
  noite: ['#060A2E', '#16206A', '#2C3C94'],
  nublado: ['#4E5D82', '#76849F', '#A9B5CB'],
  neblina: ['#5D6880', '#8A94A8', '#B7BECC'],
  chuva: ['#22305A', '#3E5180', '#6C80A8'],
  'chuva-forte': ['#151E40', '#2A3866', '#4D5E8C'],
  tempestade: ['#0E0B2E', '#2A1F62', '#4A3C86'],
};
const CEU_DA_COND = { limpo: 'sol', 'poucas-nuvens': 'sol', nublado: 'nublado', neblina: 'neblina', garoa: 'chuva', chuva: 'chuva', 'chuva-forte': 'chuva-forte', tempestade: 'tempestade', granizo: 'tempestade' };

const cache = new Map();
function imagem(src) {
  if (!cache.has(src)) {
    cache.set(src, new Promise((ok) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => ok(im);
      im.onerror = () => ok(null);
      im.src = src;
    }));
  }
  return cache.get(src);
}

let fontesProntas = null;
export function prepararFontes() {
  if (!fontesProntas) {
    fontesProntas = Promise.all([
      document.fonts.load('900 80px "Saira Cond"'),
      document.fonts.load('700 80px "Saira SemiCond"'),
      document.fonts.load('200 80px "Saira DC"'),
      document.fonts.load('700 40px "Atkinson DC"'),
      document.fonts.load('400 40px "Atkinson DC"'),
    ]).catch(() => null);
  }
  return fontesProntas;
}

// ------------------------------------------------------------------ utilidades de desenho
function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function vidro(c, x, y, w, h, r, alfa = 0.16) {
  c.save();
  rr(c, x, y, w, h, r);
  c.fillStyle = `rgba(255,255,255,${alfa})`;
  c.fill();
  const brilho = c.createLinearGradient(x, y, x + w * 0.6, y + h);
  brilho.addColorStop(0, 'rgba(255,255,255,0.22)');
  brilho.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  brilho.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = brilho;
  c.fill();
  c.lineWidth = 2;
  c.strokeStyle = 'rgba(255,255,255,0.38)';
  c.stroke();
  c.restore();
}

function quebrar(c, texto, larg) {
  const linhas = [];
  for (const par of String(texto || '').split('\n')) {
    let linha = '';
    for (const p of par.split(/\s+/).filter(Boolean)) {
      const t = linha ? `${linha} ${p}` : p;
      if (c.measureText(t).width > larg && linha) { linhas.push(linha); linha = p; } else linha = t;
    }
    linhas.push(linha);
  }
  return linhas;
}

function ajustar(c, texto, fonte, larg, maxLinhas, tam, min) {
  for (let s = tam; s >= min; s -= 2) {
    c.font = fonte(s);
    const l = quebrar(c, texto, larg);
    if (l.length <= maxLinhas && l.every((x) => c.measureText(x).width <= larg)) return { s, l };
  }
  c.font = fonte(min);
  return { s: min, l: quebrar(c, texto, larg) };
}

function gradiente(c, w, h, cores, ang = 'diag') {
  const g = ang === 'v' ? c.createLinearGradient(0, 0, 0, h) : c.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, cores[0]);
  g.addColorStop(0.55, cores[1]);
  g.addColorStop(1, cores[2]);
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

function brilhos(c, w, h, cor = '255,255,255', forca = 0.25) {
  const g1 = c.createRadialGradient(w * 0.1, h * 0.05, 0, w * 0.1, h * 0.05, w * 0.9);
  g1.addColorStop(0, `rgba(${cor},${forca})`);
  g1.addColorStop(1, `rgba(${cor},0)`);
  c.fillStyle = g1;
  c.fillRect(0, 0, w, h);
  const g2 = c.createLinearGradient(0, h * 0.7, 0, h);
  g2.addColorStop(0, 'rgba(8,6,40,0)');
  g2.addColorStop(1, 'rgba(8,6,40,0.35)');
  c.fillStyle = g2;
  c.fillRect(0, 0, w, h);
}

function chuvaTextura(c, w, h, alfa = 0.12, qtd = 220) {
  c.save();
  c.strokeStyle = `rgba(255,255,255,${alfa})`;
  c.lineWidth = 2;
  c.lineCap = 'round';
  let s = 7;
  const r = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = 0; i < qtd; i++) {
    const x = r() * w * 1.2, y = r() * h, l = 30 + r() * 60;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - l * 0.35, y + l); c.stroke();
  }
  c.restore();
}

async function cabecalho(c, w, y, quando, cor = '#fff') {
  const logo = await imagem('assets/img/defesa-civil-guarapuava.png');
  if (logo) {
    c.save(); rr(c, 64, y, 120, 120, 24); c.clip(); c.drawImage(logo, 64, y, 120, 120); c.restore();
  }
  c.fillStyle = cor;
  c.textBaseline = 'alphabetic';
  c.font = '800 52px "Saira SemiCond"';
  c.fillText('Defesa Civil', 208, y + 60);
  c.font = '400 34px "Atkinson DC"';
  c.globalAlpha = 0.9;
  c.fillText('Guarapuava · Paraná', 208, y + 104);
  c.globalAlpha = 1;
  if (quando) {
    c.textAlign = 'right';
    c.font = '700 34px "Atkinson DC"';
    c.fillText(quando[0], w - 64, y + 60);
    c.font = '400 32px "Atkinson DC"';
    c.globalAlpha = 0.9;
    c.fillText(quando[1], w - 64, y + 104);
    c.globalAlpha = 1;
    c.textAlign = 'left';
  }
}

async function rodape(c, w, h, url) {
  const pref = await imagem('assets/img/prefeitura-guarapuava-negativo.png');
  const y = h - 150;
  c.fillStyle = 'rgba(10,6,50,0.35)';
  c.fillRect(0, y - 20, w, 170);
  if (pref) {
    const lw = 430, lh = lw * pref.height / pref.width;
    c.drawImage(pref, 64, y + 65 - lh / 2, lw, lh);
  }
  c.textAlign = 'right';
  c.fillStyle = '#fff';
  c.font = '700 30px "Atkinson DC"';
  c.fillText('Acompanhe o tempo e os alertas:', w - 64, y + 52);
  c.font = '400 28px "Atkinson DC"';
  c.globalAlpha = 0.92;
  c.fillText(url.replace(/^https?:\/\//, '').replace(/\/$/, ''), w - 64, y + 94);
  c.globalAlpha = 1;
  c.textAlign = 'left';
}

function pilulaContatos(c, w, y, alto = 150) {
  const gap = 24, larg = (w - 128 - gap) / 2;
  const itens = [
    ['BOMBEIROS', 'LIGUE 193', ''],
    ['DEFESA CIVIL', CONFIG.contatos.find((x) => x.nome.includes('Guarapuava'))?.numero || '199', 'Plantão 24h'],
  ];
  itens.forEach(([rot, numero, extra], i) => {
    const x = 64 + i * (larg + gap);
    c.save();
    rr(c, x, y, larg, alto, 40);
    const g = c.createLinearGradient(x, y, x + larg, y + alto);
    g.addColorStop(0, 'rgba(36,24,154,0.96)');
    g.addColorStop(1, 'rgba(18,11,84,0.96)');
    c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.stroke();
    c.restore();
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.font = '400 30px "Atkinson DC"';
    c.fillText(rot, x + larg / 2, y + 44);
    const r = ajustar(c, numero, (s) => `800 ${s}px "Saira SemiCond"`, larg - 40, 1, 58, 36);
    c.font = `800 ${r.s}px "Saira SemiCond"`;
    c.fillText(numero, x + larg / 2, y + (extra ? 98 : 112));
    if (extra) { c.font = '700 28px "Atkinson DC"'; c.fillText(extra, x + larg / 2, y + 134); }
    c.textAlign = 'left';
  });
}

function faixaAlertaPequena(c, w, y, alerta) {
  const n = NIVEIS[alerta.nivel] || NIVEIS.alto;
  const h = 112;
  c.save();
  rr(c, 64, y, w - 128, h, 32);
  const g = c.createLinearGradient(64, y, w - 64, y + h);
  g.addColorStop(0, n.grad[0]); g.addColorStop(0.5, n.grad[1]); g.addColorStop(1, n.grad[2]);
  c.fillStyle = g; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 2; c.stroke();
  c.restore();
  c.fillStyle = n.texto;
  c.font = '800 28px "Atkinson DC"';
  c.fillText(`ALERTA ${n.cor.toUpperCase()} EM VIGOR`, 100, y + 44);
  const r = ajustar(c, alerta.titulo || n.nome, (s) => `900 ${s}px "Saira Cond"`, w - 200, 1, 50, 30);
  c.font = `900 ${r.s}px "Saira Cond"`;
  c.fillText((alerta.titulo || n.nome).toUpperCase(), 100, y + 92);
  return y + h;
}

// ------------------------------------------------------------------ modelos
async function arteAlerta(c, w, h, { alerta, url }) {
  const n = NIVEIS[alerta.nivel] || NIVEIS.alto;
  const vertical = h > 1500;
  gradiente(c, w, h, n.grad);
  chuvaTextura(c, w, h, 0.1);
  brilhos(c, w, h, '255,255,255', 0.35);
  const agora = new Date();
  await cabecalho(c, w, 64, [diaSemana(agora).replace(/^./, (x) => x.toUpperCase()), `${fmtData(agora)} · ${fmtHora(agora)}`], n.texto === '#FFFFFF' ? '#FFFFFF' : '#1A1640');

  let y = vertical ? 250 : 220;
  // selo do nível
  c.font = '800 32px "Atkinson DC"';
  const selo = `ALERTA ${n.cor.toUpperCase()} · ${n.nome.toUpperCase()}`;
  const sw = c.measureText(selo).width + 84;
  vidro(c, 64, y, sw, 64, 32, 0.28);
  c.fillStyle = n.texto;
  c.beginPath(); c.arc(64 + 34, y + 32, 15, 0, Math.PI * 2); c.fill();
  c.fillStyle = n.texto === '#FFFFFF' ? n.grad[1] : '#FFFFFF';
  c.font = '900 24px "Saira Cond"'; c.textAlign = 'center'; c.fillText('!', 64 + 34, y + 41); c.textAlign = 'left';
  c.fillStyle = n.texto;
  c.font = '800 32px "Atkinson DC"';
  c.fillText(selo, 64 + 62, y + 43);
  y += 92;

  // título em painel anil (como nas artes da Defesa Civil)
  const titulo = (alerta.titulo || n.nome).toUpperCase();
  const t = ajustar(c, titulo, (s) => `900 ${s}px "Saira Cond"`, w - 200, vertical ? 3 : 2, vertical ? 136 : 104, 56);
  const th = t.l.length * t.s * 0.98 + (vertical ? 70 : 56);
  c.save();
  rr(c, 64, y, w - 128, th, 48);
  const gt = c.createLinearGradient(64, y, w - 64, y + th);
  gt.addColorStop(0, '#2B1DB5'); gt.addColorStop(1, '#120B54');
  c.fillStyle = gt; c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 2; c.stroke();
  c.restore();
  c.fillStyle = '#FFD24A';
  c.font = `900 ${t.s}px "Saira Cond"`;
  t.l.forEach((l, i) => c.fillText(l, 100, y + (vertical ? 30 : 24) + t.s * 0.86 + i * t.s * 0.98));
  y += th + (vertical ? 28 : 22);

  // painel claro com os dias / resumo
  const rodapeY = h - 150 - 20;
  const contatosH = 150;
  const vig = alerta.inicio && alerta.fim ? `Vigência: ${fmtQuando(new Date(alerta.inicio))} até ${fmtQuando(new Date(alerta.fim))}` : '';
  const fenoms = (alerta.fenomenos || []).filter((f) => FENOMENOS[f]).slice(0, 4);
  const fenH = vertical && fenoms.length ? 150 : 0;
  const vigH = vig ? 56 : 0;
  const painelMax = rodapeY - y - contatosH - 40 - fenH - vigH - (vertical ? 30 : 0);
  const larg = w - 200;
  const montar = (comImpactos) => {
    const b = [];
    if (alerta.dias?.length) alerta.dias.forEach((d) => b.push(['dia', d.rotulo], ['txt', d.texto]));
    else if (alerta.resumo) b.push(['txt', alerta.resumo]);
    if (comImpactos && alerta.impactos?.length) b.push(['imp', `Podem ocorrer: ${alerta.impactos.join(', ')}.`]);
    return b;
  };
  const medir = (blocos, s) => {
    let total = 56;
    const res = blocos.map(([tipo, txt]) => {
      c.font = tipo === 'dia' ? `800 ${s * 1.12}px "Saira SemiCond"` : `${tipo === 'imp' ? 700 : 400} ${s}px "Atkinson DC"`;
      const l = quebrar(c, txt, larg);
      const lh = tipo === 'dia' ? s * 1.3 : s * 1.32;
      const hh = l.length * lh + (tipo === 'dia' ? 6 : 22);
      total += hh;
      return { tipo, l, lh, hh };
    });
    return { total, res };
  };
  let tam = 0, medidas = null;
  for (const comImp of [true, false]) {
    const blocos = montar(comImp);
    for (let s2 = vertical ? 44 : 38; s2 >= 24; s2 -= 2) {
      const m = medir(blocos, s2);
      if (m.total <= painelMax) { tam = s2; medidas = m; break; }
    }
    if (medidas) break;
  }
  if (!medidas) { tam = 24; medidas = medir(montar(false), 24); }
  const ph = Math.min(painelMax, medidas.total);
  c.save();
  rr(c, 64, y, w - 128, ph, 48);
  c.fillStyle = 'rgba(255,255,255,0.95)'; c.fill();
  c.restore();
  let yy = y + 36;
  c.textAlign = 'center';
  for (const b of medidas.res) {
    c.fillStyle = b.tipo === 'dia' ? '#1B5FE0' : '#16123D';
    c.font = b.tipo === 'dia' ? `800 ${tam * 1.12}px "Saira SemiCond"` : `${b.tipo === 'imp' ? 700 : 400} ${tam}px "Atkinson DC"`;
    b.l.forEach((l, i) => c.fillText(l, w / 2, yy + tam + i * b.lh));
    yy += b.hh;
  }
  y += ph;
  if (vig) {
    c.fillStyle = n.texto;
    c.font = `700 ${vertical ? 32 : 28}px "Atkinson DC"`;
    const r = ajustar(c, vig, (s) => `700 ${s}px "Atkinson DC"`, w - 128, 1, vertical ? 32 : 28, 20);
    c.font = `700 ${r.s}px "Atkinson DC"`;
    c.fillText(vig, w / 2, y + 42);
  }
  c.textAlign = 'left';
  y += vigH + 20;

  if (fenH) {
    const larg2 = (w - 128) / fenoms.length;
    for (let i = 0; i < fenoms.length; i++) {
      const f = FENOMENOS[fenoms[i]];
      const im = await imagem(`assets/icons/${f.icone}.svg`);
      const cx = 64 + larg2 * i + larg2 / 2;
      c.save(); c.beginPath(); c.arc(cx, y + 50, 56, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,0.88)'; c.fill(); c.restore();
      if (im) c.drawImage(im, cx - 40, y + 10, 80, 80);
      c.fillStyle = n.texto; c.textAlign = 'center'; c.font = '700 28px "Atkinson DC"';
      c.fillText(f.nome, cx, y + 140); c.textAlign = 'left';
    }
    y += fenH + 10;
  }
  pilulaContatos(c, w, rodapeY - contatosH - 26, contatosH);
  await rodape(c, w, h, url);
}

async function arteTempo(c, w, h, { clima, alerta, url }) {
  const a = clima.atual || {};
  const cores = (a.dia === false && ['limpo', 'poucas-nuvens'].includes(a.condicao)) ? CEUS.noite : CEUS[CEU_DA_COND[a.condicao] || 'nublado'];
  const vertical = h > 1500;
  gradiente(c, w, h, cores, 'v');
  if (['chuva', 'chuva-forte', 'tempestade', 'granizo', 'garoa'].includes(a.condicao)) chuvaTextura(c, w, h, 0.14, 300);
  brilhos(c, w, h, a.condicao === 'limpo' && a.dia !== false ? '255,226,150' : '255,255,255', 0.3);
  const ref = a.hora ? new Date(a.hora) : new Date();
  const agora = new Date();
  await cabecalho(c, w, 64, [diaSemana(agora).replace(/^./, (x) => x.toUpperCase()), fmtData(agora)]);

  let y = vertical ? 250 : 220;
  if (alerta) { y = faixaAlertaPequena(c, w, y, alerta) + (vertical ? 50 : 30); }

  c.fillStyle = '#fff';
  c.font = '700 40px "Atkinson DC"';
  c.fillText(`Guarapuava agora · ${fmtHora(agora)}`, 64, y + 40);
  y += 60;
  const icone = await imagem(iconeURL(a.condicao, a.dia !== false));
  const tamIco = vertical ? 330 : 270;
  if (icone) c.drawImage(icone, w - 64 - tamIco, y - 10, tamIco, tamIco);
  c.font = `200 ${vertical ? 300 : 250}px "Saira DC"`;
  c.fillText(graus(a.temp), 44, y + (vertical ? 250 : 210));
  y += vertical ? 300 : 250;
  const cond = ajustar(c, a.descricao || '', (s) => `700 ${s}px "Saira SemiCond"`, w - 128, 2, 72, 46);
  c.font = `700 ${cond.s}px "Saira SemiCond"`;
  cond.l.forEach((l, i) => c.fillText(l, 64, y + cond.s * (i + 0.9)));
  y += cond.s * cond.l.length + 20;
  c.font = '400 36px "Atkinson DC"';
  c.globalAlpha = 0.92;
  c.fillText(`Sensação ${graus(a.sensacao)}  ·  Umidade ${num(a.umidade)}%`, 64, y + 30);
  c.globalAlpha = 1;
  y += 70;

  const hoje = clima.dias?.[0] || {};
  const dados = [
    ['Hoje', `${graus(hoje.min)} a ${graus(hoje.max)}`],
    ['Chuva hoje', `${mm(hoje.chuva_mm)}${hoje.prob != null ? ` · ${num(hoje.prob)}%` : ''}`],
    ['Rajadas', a.rajada != null ? `${num(a.rajada)} km/h` : (hoje.rajada != null ? `${num(hoje.rajada)} km/h` : '–')],
    ['Vento', a.vento != null ? `${num(a.vento)} km/h ${a.vento_dir || ''}`.trim() : '–'],
  ];
  const ph = 230;
  vidro(c, 64, y, w - 128, ph, 40, 0.16);
  const cw = (w - 128) / 2;
  dados.forEach(([rot, val], i) => {
    const x = 64 + (i % 2) * cw + 36, yy = y + 36 + Math.floor(i / 2) * 100;
    c.fillStyle = 'rgba(255,255,255,0.85)'; c.font = '400 30px "Atkinson DC"'; c.fillText(rot, x, yy + 24);
    c.fillStyle = '#fff'; c.font = '700 44px "Saira SemiCond"'; c.fillText(val, x, yy + 72);
  });
  y += ph + 30;

  if (vertical) {
    const horas = (clima.horas || []).filter((x, i) => i > 0 && i % 2 === 0).slice(0, 6);
    if (horas.length) {
      const hh = 300;
      vidro(c, 64, y, w - 128, hh, 40, 0.14);
      c.fillStyle = '#fff'; c.font = '700 32px "Atkinson DC"'; c.fillText('Próximas horas', 100, y + 52);
      const cw2 = (w - 128) / horas.length;
      for (let i = 0; i < horas.length; i++) {
        const x = 64 + cw2 * i + cw2 / 2, H = horas[i];
        c.textAlign = 'center';
        c.font = '700 30px "Atkinson DC"'; c.fillStyle = '#fff';
        c.fillText(fmtHora(new Date(H.t), false), x, y + 108);
        const im = await imagem(iconeURL(H.condicao, H.dia !== false));
        if (im) c.drawImage(im, x - 36, y + 122, 72, 72);
        c.font = '700 40px "Saira SemiCond"'; c.fillText(graus(H.temp), x, y + 236);
        c.font = '700 26px "Atkinson DC"'; c.fillStyle = '#CFE2FF';
        c.fillText(H.chuva_mm > 0 ? mm(H.chuva_mm) : '', x, y + 274);
        c.textAlign = 'left';
      }
      y += hh + 30;
    }
    const dias = (clima.dias || []).slice(1, 4);
    if (dias.length && h - 230 - y > 250) {
      const dh = 230;
      vidro(c, 64, y, w - 128, dh, 40, 0.14);
      const cw3 = (w - 128) / dias.length;
      for (let i = 0; i < dias.length; i++) {
        const d = dias[i], x = 64 + cw3 * i + cw3 / 2;
        c.textAlign = 'center'; c.fillStyle = '#fff';
        c.font = '800 34px "Saira SemiCond"'; c.fillText(nomeDoDia(d.data), x, y + 52);
        const im = await imagem(iconeURL(d.condicao, true));
        if (im) c.drawImage(im, x - 40, y + 64, 80, 80);
        c.font = '700 36px "Saira SemiCond"'; c.fillText(`${graus(d.min)} · ${graus(d.max)}`, x, y + 182);
        c.font = '700 26px "Atkinson DC"'; c.fillStyle = '#CFE2FF';
        c.fillText(d.chuva_mm >= 0.5 ? `chuva ${mm(d.chuva_mm)}` : 'sem chuva', x, y + 214);
        c.textAlign = 'left';
      }
      y += dh + 30;
    }
  }
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.font = '400 28px "Atkinson DC"';
  const fonte = a.fonte === 'simepar' ? 'SIMEPAR' : 'modelo Open-Meteo';
  c.fillText(`Atualizado às ${fmtHora(ref)} · Fonte: ${fonte}`, 64, h - 200);
  await rodape(c, w, h, url);
}

async function artePrevisao(c, w, h, { clima, alerta, url }) {
  const vertical = h > 1500;
  gradiente(c, w, h, ['#3B2FD0', '#24189A', '#0F3FB8'], 'diag');
  brilhos(c, w, h, '120,190,255', 0.35);
  const agora = new Date();
  await cabecalho(c, w, 64, [diaSemana(agora).replace(/^./, (x) => x.toUpperCase()), fmtData(agora)]);
  let y = vertical ? 260 : 220;
  if (alerta) y = faixaAlertaPequena(c, w, y, alerta) + 40;
  c.fillStyle = '#fff';
  c.font = `800 ${vertical ? 92 : 76}px "Saira SemiCond"`;
  c.fillText('Previsão do tempo', 64, y + 70);
  c.font = '400 38px "Atkinson DC"';
  c.globalAlpha = 0.9; c.fillText('Guarapuava · próximos dias', 64, y + 124); c.globalAlpha = 1;
  y += vertical ? 180 : 160;
  const dias = (clima.dias || []).slice(0, 3);
  const espaco = h - 200 - y - 40;
  const ch = Math.min(vertical ? 360 : 250, (espaco - 24 * (dias.length - 1)) / Math.max(1, dias.length));
  for (const d of dias) {
    vidro(c, 64, y, w - 128, ch, 40, 0.15);
    const im = await imagem(iconeURL(d.condicao, true));
    const ti = Math.min(170, ch - 50);
    if (im) c.drawImage(im, 92, y + (ch - ti) / 2, ti, ti);
    const x = 92 + ti + 30;
    c.fillStyle = '#fff';
    c.font = '800 54px "Saira SemiCond"';
    c.fillText(nomeDoDia(d.data), x, y + ch / 2 - 30);
    c.font = '400 30px "Atkinson DC"';
    c.globalAlpha = 0.9; c.fillText(`${fmtData(new Date(d.data + 'T12:00:00-03:00'))} · ${d.descricao || ''}`.slice(0, 40), x, y + ch / 2 + 14); c.globalAlpha = 1;
    c.font = '700 32px "Atkinson DC"'; c.fillStyle = '#CFE2FF';
    c.fillText(`Chuva ${mm(d.chuva_mm)}${d.prob != null ? ` (${num(d.prob)}%)` : ''}`, x, y + ch / 2 + 62);
    c.textAlign = 'right'; c.fillStyle = '#fff';
    c.font = '700 70px "Saira SemiCond"'; c.fillText(graus(d.max), w - 100, y + ch / 2 + 6);
    c.font = '700 44px "Saira SemiCond"'; c.globalAlpha = 0.75; c.fillText(graus(d.min), w - 100, y + ch / 2 + 58); c.globalAlpha = 1;
    c.textAlign = 'left';
    y += ch + 24;
  }
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.font = '400 28px "Atkinson DC"';
  c.fillText(`Fonte: ${dias[0]?.fonte === 'simepar' ? 'SIMEPAR' : 'modelo Open-Meteo'} · gerado às ${fmtHora(agora)}`, 64, h - 200);
  await rodape(c, w, h, url);
}

/**
 * Desenha a arte no canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {{tipo:'alerta'|'tempo'|'previsao', formato:'status'|'feed', clima, alerta, url}} op
 */
export async function desenharArte(canvas, op) {
  await prepararFontes();
  const [w, h] = FORMATOS[op.formato] || FORMATOS.status;
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, w, h);
  c.textBaseline = 'alphabetic';
  if (op.tipo === 'alerta' && op.alerta) return arteAlerta(c, w, h, op);
  if (op.tipo === 'previsao') return artePrevisao(c, w, h, op);
  return arteTempo(c, w, h, op);
}

export function canvasParaArquivo(canvas, nome) {
  return new Promise((ok) => canvas.toBlob((b) => ok(new File([b], nome, { type: 'image/png' })), 'image/png'));
}
