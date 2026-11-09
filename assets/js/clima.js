// Dados do tempo, níveis de risco e alertas — compartilhado entre site, painel e gestão.
import { CONFIG } from './config.js';
import { hojeISO, partes } from './util.js';

// ---------------------------------------------------------------- condições do tempo
export const CONDICOES = {
  'limpo': { nome: 'Céu limpo', icone: ['sol', 'lua'], ceu: (d) => (d ? 'sol' : 'noite') },
  'poucas-nuvens': { nome: 'Parcialmente nublado', icone: ['sol-nuvem', 'lua-nuvem'], ceu: (d) => (d ? 'sol' : 'noite') },
  'nublado': { nome: 'Nublado', icone: ['nublado', 'nublado'], ceu: () => 'nublado' },
  'neblina': { nome: 'Neblina', icone: ['neblina', 'neblina'], ceu: () => 'neblina' },
  'garoa': { nome: 'Garoa', icone: ['garoa', 'garoa'], ceu: () => 'chuva' },
  'chuva': { nome: 'Chuva', icone: ['chuva', 'chuva'], ceu: () => 'chuva' },
  'chuva-forte': { nome: 'Chuva forte', icone: ['chuva-forte', 'chuva-forte'], ceu: () => 'chuva-forte' },
  'tempestade': { nome: 'Tempestade', icone: ['tempestade', 'tempestade'], ceu: () => 'tempestade' },
  'granizo': { nome: 'Tempestade com granizo', icone: ['granizo', 'granizo'], ceu: () => 'tempestade' },
};

export function iconeURL(cond, dia = true, base = 'assets/icons/') {
  const c = CONDICOES[cond] || CONDICOES.nublado;
  return `${base}${c.icone[dia ? 0 : 1]}.svg`;
}

/** Parâmetros do céu animado para uma condição. */
export function estadoCeu(cond, dia = true, extra = {}) {
  const tipo = (CONDICOES[cond] || CONDICOES.nublado).ceu(dia);
  const intensidade = { garoa: 0.22, chuva: 0.55, 'chuva-forte': 1, tempestade: 0.9, granizo: 0.85 }[cond] || 0;
  const nuvens = { limpo: 0.08, 'poucas-nuvens': 0.5, nublado: 0.9, neblina: 0.5 }[cond] ?? 1;
  return { tipo, dia, intensidade, nuvens, granizo: cond === 'granizo', vento: extra.vento || 12 };
}

const WMO = {
  0: ['limpo', 'Céu limpo'], 1: ['poucas-nuvens', 'Predomínio de sol'], 2: ['poucas-nuvens', 'Parcialmente nublado'],
  3: ['nublado', 'Nublado'], 45: ['neblina', 'Neblina'], 48: ['neblina', 'Neblina com geada'],
  51: ['garoa', 'Garoa fraca'], 53: ['garoa', 'Garoa'], 55: ['garoa', 'Garoa forte'], 56: ['garoa', 'Garoa congelante'], 57: ['garoa', 'Garoa congelante'],
  61: ['chuva', 'Chuva fraca'], 63: ['chuva', 'Chuva moderada'], 65: ['chuva-forte', 'Chuva forte'],
  66: ['chuva', 'Chuva congelante'], 67: ['chuva-forte', 'Chuva congelante forte'],
  71: ['nublado', 'Neve fraca'], 73: ['nublado', 'Neve'], 75: ['nublado', 'Neve forte'], 77: ['nublado', 'Grãos de neve'],
  80: ['chuva', 'Pancadas de chuva'], 81: ['chuva', 'Pancadas de chuva moderadas'], 82: ['chuva-forte', 'Pancadas de chuva forte'],
  85: ['nublado', 'Pancadas de neve'], 86: ['nublado', 'Pancadas de neve'],
  95: ['tempestade', 'Tempestade'], 96: ['granizo', 'Tempestade com granizo'], 99: ['granizo', 'Tempestade com granizo'],
};
const wmo = (c) => WMO[c] || ['nublado', 'Nublado'];
const DIRS = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'];
const direcao = (g) => (g == null ? null : DIRS[Math.round((g % 360) / 45) % 8]);

// ---------------------------------------------------------------- níveis de risco
// Mesma escala dos boletins da Defesa Civil do Paraná / SIMEPAR.
export const NIVEIS = {
  'sem': { ordem: 0, nome: 'Sem alerta', cor: 'Sem alerta', emoji: '🔵', hex: '#24189A', texto: '#FFFFFF', grad: ['#3B2FD0', '#24189A', '#1B4FD8'] },
  'baixo': { ordem: 1, nome: 'Risco baixo', cor: 'Verde', chamada: 'Risco baixo', emoji: '🟢', hex: '#17834A', texto: '#FFFFFF', grad: ['#2FBF74', '#17834A', '#0C6B3B'] },
  'moderado': { ordem: 2, nome: 'Risco moderado', cor: 'Amarelo', chamada: 'Observação', emoji: '🟡', hex: '#F7C600', texto: '#1A1640', grad: ['#FFE97A', '#FFD21F', '#F2AE00'] },
  'alto': { ordem: 3, nome: 'Risco alto', cor: 'Laranja', chamada: 'Atenção', emoji: '🟠', hex: '#F27405', texto: '#1A1640', grad: ['#FFB25C', '#F68521', '#E2570A'] },
  'muito-alto': { ordem: 4, nome: 'Risco muito alto', cor: 'Vermelho', chamada: 'Alerta', emoji: '🔴', hex: '#D11E2D', texto: '#FFFFFF', grad: ['#FF6B6B', '#E02434', '#A30F1D'] },
};

export const DESCRICAO_NIVEL = {
  'baixo': 'Condições com baixo potencial de danos. Pancadas de chuva, temporais isolados, alagamentos pontuais.',
  'moderado': 'Potencial para provocar danos e interromper algumas atividades. Temporais isolados com rajadas de vento, granizo pontual, chuva intensa, alagamentos e enxurradas pontuais.',
  'alto': 'Alto potencial de danos e transtornos, com possível interrupção de serviços. Tempestades pontualmente severas, intensas rajadas de vento, granizo, chuva forte em pouco tempo, enxurradas e alagamentos.',
  'muito-alto': 'Grande probabilidade de danos severos e riscos à integridade física. Fortes impactos na infraestrutura e nos serviços públicos.',
};

export const FENOMENOS = {
  'chuva-forte': { nome: 'Chuva forte', icone: 'chuva-forte' },
  'rajadas': { nome: 'Rajadas de vento', icone: 'vento' },
  'raios': { nome: 'Raios', icone: 'raio' },
  'granizo': { nome: 'Granizo', icone: 'granizo' },
  'alagamentos': { nome: 'Alagamentos', icone: 'alagamento' },
  'tempestade': { nome: 'Tempestade', icone: 'tempestade' },
  'neblina': { nome: 'Neblina', icone: 'neblina' },
};

export const gradCSS = (n, ang = 135) => {
  const g = (NIVEIS[n] || NIVEIS.sem).grad;
  return `linear-gradient(${ang}deg, ${g[0]} 0%, ${g[1]} 52%, ${g[2]} 100%)`;
};

// ---------------------------------------------------------------- carregamento
async function getJSON(url) {
  const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

export async function buscarOpenMeteo() {
  const p = new URLSearchParams({
    latitude: CONFIG.lat, longitude: CONFIG.lon, timezone: 'America/Sao_Paulo', forecast_days: 8, past_days: 1,
    wind_speed_unit: 'kmh',
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset,uv_index_max',
  });
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
  if (!r.ok) throw new Error(`Open-Meteo: HTTP ${r.status}`);
  return normalizarOpenMeteo(await r.json());
}

// O Open-Meteo devolve horário local sem fuso ("2026-11-09T13:00"); acrescenta -03:00.
const local = (s) => (s && s.length <= 16 ? `${s}-03:00` : s);

export function normalizarOpenMeteo(j) {
  const agora = Date.now();
  const c = j.current || {};
  const [cond, desc] = wmo(c.weather_code);
  const h = j.hourly || {};
  const horas = [];
  let chuva24 = 0;
  (h.time || []).forEach((t, k) => {
    const ts = new Date(local(t)).getTime();
    const p = h.precipitation[k] || 0;
    if (ts > agora - 864e5 && ts <= agora) chuva24 += p;
    const [hc, hd] = wmo(h.weather_code[k]);
    horas.push({
      t: local(t), temp: h.temperature_2m[k], sensacao: h.apparent_temperature[k], umidade: h.relative_humidity_2m[k],
      chuva_mm: p, prob: h.precipitation_probability[k], vento: h.wind_speed_10m[k], rajada: h.wind_gusts_10m[k],
      dia: !!h.is_day[k], condicao: hc, descricao: hd, fonte: 'openmeteo',
    });
  });
  const d = j.daily || {};
  const dias = (d.time || []).map((t, k) => {
    const [dc, dd] = wmo(d.weather_code[k]);
    return {
      data: t, max: d.temperature_2m_max[k], min: d.temperature_2m_min[k], chuva_mm: d.precipitation_sum[k],
      prob: d.precipitation_probability_max[k], vento: d.wind_speed_10m_max[k], rajada: d.wind_gusts_10m_max[k],
      vento_dir: direcao(d.wind_direction_10m_dominant[k]), nascer: d.sunrise && local(d.sunrise[k]),
      por: d.sunset && local(d.sunset[k]), uv: d.uv_index_max?.[k], condicao: dc, descricao: dd, fonte: 'openmeteo',
    };
  });
  const inicioHora = new Date(); inicioHora.setMinutes(0, 0, 0);
  const hoje = hojeISO();
  return {
    versao: 1,
    gerado_em: new Date().toISOString(),
    fontes: { openmeteo: { ok: true, ao_vivo: true } },
    atual: {
      temp: c.temperature_2m, sensacao: c.apparent_temperature, umidade: c.relative_humidity_2m, chuva_mm: c.precipitation,
      vento: c.wind_speed_10m, vento_dir: direcao(c.wind_direction_10m), rajada: c.wind_gusts_10m, dia: !!c.is_day,
      condicao: cond, descricao: desc, hora: c.time ? local(c.time) : new Date().toISOString(), fonte: 'openmeteo',
    },
    chuva_24h_mm: Math.round(chuva24 * 10) / 10,
    horas: horas.filter((x) => new Date(x.t) >= inicioHora).slice(0, 48),
    dias: dias.filter((x) => x.data >= hoje),
    avisos_inmet: [],
  };
}

/**
 * Carrega o clima: primeiro o arquivo gerado pelo robô (SIMEPAR); se estiver velho ou
 * indisponível, busca a previsão ao vivo no Open-Meteo (mantendo os avisos do INMET).
 */
export async function carregarClima(base = '') {
  let arquivo = null;
  try { arquivo = await getJSON(`${base}data/clima.json`); } catch (e) { console.warn(e); }
  const idadeMin = arquivo?.gerado_em ? (Date.now() - new Date(arquivo.gerado_em)) / 60000 : Infinity;
  const valido = arquivo && !arquivo.exemplo && idadeMin < CONFIG.dadosVelhosMin && arquivo.atual;
  if (valido) return { ...arquivo, origem: 'robo', idadeMin };
  try {
    const vivo = await buscarOpenMeteo();
    vivo.avisos_inmet = (arquivo?.avisos_inmet || []).filter((a) => !a.fim || new Date(a.fim) > new Date());
    if (arquivo?.fontes?.inmet) vivo.fontes.inmet = arquivo.fontes.inmet;
    return { ...vivo, origem: 'ao-vivo', idadeMin: 0 };
  } catch (e) {
    console.warn(e);
    if (arquivo && !arquivo.exemplo) return { ...arquivo, origem: 'robo-antigo', idadeMin };
    throw new Error('Não foi possível obter a previsão do tempo agora.');
  }
}

export async function carregarAlerta(base = '') {
  try { return await getJSON(`${base}data/alerta.json`); } catch { return { ativo: false }; }
}

// ---------------------------------------------------------------- alerta em vigor
/**
 * Decide o que a faixa de alerta mostra:
 *  1. alerta publicado pela Defesa Civil de Guarapuava (data/alerta.json), se dentro da vigência;
 *  2. senão, o aviso do INMET mais severo que inclui Guarapuava (se habilitado em config.js);
 *  3. senão, null (sem alerta).
 */
export function alertaVigente(alerta, clima, agora = new Date()) {
  if (alerta?.ativo && NIVEIS[alerta.nivel] && alerta.nivel !== 'sem') {
    const fim = alerta.fim ? new Date(alerta.fim) : null;
    const ini = alerta.inicio ? new Date(alerta.inicio) : null;
    if (!fim || fim > agora) {
      return { ...alerta, origem: 'defesa-civil', futuro: !!(ini && ini > agora) };
    }
  }
  if (CONFIG.usarAvisosINMET) {
    const avisos = (clima?.avisos_inmet || []).filter((a) => !a.fim || new Date(a.fim) > agora);
    if (avisos.length) {
      const a = avisos.sort((x, y) => (NIVEIS[y.nivel]?.ordem || 0) - (NIVEIS[x.nivel]?.ordem || 0))[0];
      const ini = a.inicio ? new Date(a.inicio) : null;
      return {
        origem: 'inmet', nivel: a.nivel || 'moderado', titulo: `${a.evento}`,
        resumo: Array.isArray(a.riscos) ? a.riscos.join(' ') : (a.riscos || ''),
        instrucoes: Array.isArray(a.instrucoes) ? a.instrucoes : (a.instrucoes ? [a.instrucoes] : []),
        inicio: a.inicio, fim: a.fim, severidade: a.severidade, link: a.link,
        fonte: `Aviso do INMET (${a.severidade || 'aviso meteorológico'}) que inclui Guarapuava`,
        futuro: !!(ini && ini > agora), outros: avisos.length - 1,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------- modo demonstração
// Ex.: index.html?simular=tempestade&alerta=muito-alto  (útil para treinar a equipe e testar artes)
export function simulacao() {
  const q = new URLSearchParams(location.search);
  const ceu = q.get('simular');
  const nivel = q.get('alerta');
  if (!ceu && !nivel) return null;
  return { ceu, nivel };
}

export function aplicarSimulacao(clima, alerta, sim) {
  if (!sim) return { clima, alerta };
  const c = structuredClone(clima || {});
  if (sim.ceu) {
    const mapa = {
      sol: ['limpo', true, 'Céu limpo'], 'poucas-nuvens': ['poucas-nuvens', true, 'Parcialmente nublado'],
      noite: ['limpo', false, 'Céu limpo'], nublado: ['nublado', true, 'Nublado'], neblina: ['neblina', true, 'Neblina'],
      garoa: ['garoa', true, 'Garoa'], chuva: ['chuva', true, 'Chuva moderada'], 'chuva-forte': ['chuva-forte', true, 'Chuva forte'],
      tempestade: ['tempestade', true, 'Tempestade'], granizo: ['granizo', true, 'Tempestade com granizo'],
    };
    const [cond, dia, desc] = mapa[sim.ceu] || mapa.chuva;
    c.atual = { ...(c.atual || {}), condicao: cond, dia, descricao: desc };
  }
  let a = alerta;
  if (sim.nivel && NIVEIS[sim.nivel]) {
    const ini = new Date(); ini.setMinutes(0, 0, 0);
    const fim = new Date(ini.getTime() + 36 * 3600e3);
    const p0 = partes(ini), p1 = partes(fim);
    const nomes = { baixo: 'Risco baixo de temporais', moderado: 'Risco moderado de temporais', alto: 'Risco alto de tempestades', 'muito-alto': 'Risco muito alto de tempestades severas' };
    a = {
      ativo: true, nivel: sim.nivel, titulo: nomes[sim.nivel],
      resumo: 'Chuva forte em pouco tempo, rajadas de vento, raios e granizo localizado.',
      inicio: ini.toISOString(), fim: fim.toISOString(), fenomenos: ['chuva-forte', 'rajadas', 'raios', 'granizo'],
      dias: [
        { rotulo: `Hoje (${String(p0.dia).padStart(2, '0')}/${String(p0.mes).padStart(2, '0')})`, nivel: sim.nivel, texto: 'Principalmente a partir do início da tarde, há previsão de chuva forte em pouco tempo, rajadas de vento, raios e granizo localizado.' },
        { rotulo: `Amanhã (${String(p1.dia).padStart(2, '0')}/${String(p1.mes).padStart(2, '0')})`, nivel: sim.nivel, texto: 'Há risco de tempestades severas, com chuva forte, rajadas de vento intensas, raios e granizo.' },
      ],
      impactos: ['queda de árvores', 'alagamentos', 'destelhamentos'],
      fonte: 'SIMULAÇÃO — não é um alerta real',
    };
  }
  return { clima: c, alerta: a };
}
