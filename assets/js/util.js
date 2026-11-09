// Utilidades de data, número e texto — sempre no horário de Brasília (America/Sao_Paulo).
const TZ = 'America/Sao_Paulo';
const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const fmtPartes = new Intl.DateTimeFormat('pt-BR', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short',
});
const MAPA_SEMANA = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sáb: 6, sab: 6 };

export function partes(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const p = {};
  for (const { type, value } of fmtPartes.formatToParts(dt)) p[type] = value;
  const sem = MAPA_SEMANA[(p.weekday || '').replace('.', '').toLowerCase()] ?? dt.getDay();
  return {
    ano: +p.year, mes: +p.month, dia: +p.day, hora: +p.hour, min: +p.minute, semana: sem,
    iso: `${p.year}-${p.month}-${p.day}`,
  };
}

export const hojeISO = (d = new Date()) => partes(d).iso;
export const diaSemana = (d, curto = false) => (curto ? DIAS_CURTOS : DIAS)[partes(d).semana];
export const doisDig = (n) => String(n).padStart(2, '0');

export function fmtHora(d, comMin = true) {
  const p = partes(d);
  if (!comMin || p.min === 0) return `${p.hora}h`;
  return `${p.hora}h${doisDig(p.min)}`;
}
export function fmtData(d, comAno = false) {
  const p = partes(d);
  return `${doisDig(p.dia)}/${doisDig(p.mes)}${comAno ? '/' + p.ano : ''}`;
}
export function fmtQuando(d) {
  // "seg 09/11 às 14h"
  return `${diaSemana(d, true)} ${fmtData(d)} às ${fmtHora(d)}`;
}
/** Vigência no padrão dos boletins: dias inteiros viram "de sex 06/11 a sáb 07/11". */
export function diasInteiros(ini, fim) {
  if (!ini || !fim) return false;
  const a = partes(ini), b = partes(fim);
  return a.hora === 0 && a.min === 0 && b.hora === 23 && b.min === 59;
}
export function fmtVigencia(ini, fim) {
  ini = ini && new Date(ini); fim = fim && new Date(fim);
  if (!ini || !fim) return fim ? `até ${fmtQuando(fim)}` : '';
  if (diasInteiros(ini, fim)) {
    const a = `${diaSemana(ini, true)} ${fmtData(ini)}`, b = `${diaSemana(fim, true)} ${fmtData(fim)}`;
    return partes(ini).iso === partes(fim).iso ? `${a} (o dia todo)` : `de ${a} a ${b}`;
  }
  return `${fmtQuando(ini)} até ${fmtQuando(fim)}`;
}

export function nomeDoDia(dataISO, hoje = hojeISO()) {
  const d = new Date(dataISO + 'T12:00:00-03:00');
  const amanha = hojeISO(new Date(Date.now() + 864e5));
  if (dataISO === hoje) return 'Hoje';
  if (dataISO === amanha) return 'Amanhã';
  const n = diaSemana(d);
  return n.charAt(0).toUpperCase() + n.slice(1).replace('-feira', '');
}

export function relativo(d, agora = new Date()) {
  const min = Math.round((agora - new Date(d)) / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h} h${min % 60 ? ' ' + (min % 60) + ' min' : ''}`;
  const dd = Math.floor(h / 24);
  return `há ${dd} dia${dd > 1 ? 's' : ''}`;
}

export function duracao(ms) {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} h${min % 60 && h < 6 ? ' ' + (min % 60) + ' min' : ''}`;
  return `${Math.round(h / 24)} dias`;
}

export function num(v, casas = 0) {
  if (v === null || v === undefined || Number.isNaN(+v)) return '–';
  return (+v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
export const graus = (v) => (v === null || v === undefined ? '–' : `${Math.round(v)}°`);
export function mm(v) {
  if (v === null || v === undefined) return '–';
  if (v > 0 && v < 1) return `${num(v, 1)} mm`;
  return `${num(v, 0)} mm`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function $(sel, raiz = document) { return raiz.querySelector(sel); }
export function $$(sel, raiz = document) { return [...raiz.querySelectorAll(sel)]; }

export const reduzMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function guardar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* navegador sem armazenamento */ }
}
export function ler(chave, padrao = null) {
  try { const v = localStorage.getItem(chave); return v === null ? padrao : JSON.parse(v); } catch { return padrao; }
}
