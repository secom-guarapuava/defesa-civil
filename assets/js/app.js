// Página principal: monta alerta, tempo agora, horas, dias, gráfico, avisos e contatos.
import { CONFIG } from './config.js';
import {
  NIVEIS, FENOMENOS, DESCRICAO_NIVEL, gradCSS, iconeURL, estadoCeu,
  carregarClima, carregarAlerta, alertaVigente, simulacao, aplicarSimulacao,
} from './clima.js';
import { Ceu } from './ceu.js';
import { iniciarCompartilhar } from './compartilhar.js';
import { prepararFontes } from './arte.js';
import {
  $, $$, esc, fmtData, fmtHora, fmtQuando, fmtVigencia, diasInteiros, graus, mm, num, nomeDoDia, diaSemana, relativo, duracao, partes, ler, guardar,
} from './util.js';

const estado = { clima: null, alerta: null, alertaBruto: null };
const sim = simulacao();
const ceu = new Ceu($('#ceu'));

// ------------------------------------------------------------------ links da config
const LINKS = {
  canal: CONFIG.canalWhatsApp,
  simepar: CONFIG.links.simepar,
  defesaCivilPR: CONFIG.links.defesaCivilPR,
  whatsNacional: CONFIG.alertasCelular.whatsappNacionalLink,
};
$$('[data-link]').forEach((a) => { a.href = LINKS[a.dataset.link] || a.href; });

// ------------------------------------------------------------------ alerta
function renderAlerta() {
  const area = $('#alerta-area');
  const al = estado.alerta;
  document.body.dataset.nivel = al ? al.nivel : 'sem';
  if (!al) {
    const c = estado.clima;
    area.innerHTML = `
      <h1 class="sr">Tempo e alertas em Guarapuava</h1>
      <div class="status-ok vidro">
        <span class="bolinha" aria-hidden="true"></span>
        <strong>Sem alerta vigente para Guarapuava</strong>
        <span>${c ? `Dados atualizados ${relativo(c.gerado_em)}` : ''}</span>
        <a class="link-seta" href="#orientacoes" style="color:#fff">Como se preparar</a>
      </div>`;
    return;
  }
  const n = NIVEIS[al.nivel];
  const ini = al.inicio ? new Date(al.inicio) : null;
  const fim = al.fim ? new Date(al.fim) : null;
  const agora = new Date();
  const escuro = n.texto !== '#FFFFFF';
  const fenomenos = (al.fenomenos || []).filter((f) => FENOMENOS[f]);
  const temDetalhes = (al.dias?.length || 0) + (al.instrucoes?.length || 0) > 0;
  let falta = '';
  if (ini && ini > agora) falta = `Começa em ${duracao(ini - agora)}`;
  else if (fim) falta = `Termina em ${duracao(fim - agora)}`;
  const origem = al.origem === 'inmet'
    ? `Aviso automático do INMET que inclui Guarapuava${al.outros ? ` (+${al.outros} outro${al.outros > 1 ? 's' : ''})` : ''}. <a href="${esc(al.link || CONFIG.links.inmetAvisos)}" target="_blank" rel="noopener">Ver no INMET</a>`
    : `Publicado pela Defesa Civil de Guarapuava${al.publicado_em ? ` ${relativo(al.publicado_em)}` : ''}${al.fonte && !/^Defesa Civil de Guarapuava$/.test(al.fonte) ? ` · ${esc(al.fonte)}` : ''}`;

  area.innerHTML = `
    <article class="alerta" data-nivel="${al.nivel}" ${escuro ? 'data-texto-escuro' : ''}
      style="--alerta-grad:${gradCSS(al.nivel)};--alerta-texto:${n.texto};--alerta-ponto:${escuro ? n.grad[1] : n.grad[2]};--alerta-sombra:${n.hex}AA">
      <div class="alerta-corpo">
        <div>
          <span class="alerta-selo"><span class="ponto" aria-hidden="true"></span>Alerta ${n.cor.toLowerCase()} · ${n.nome}</span>
          <h1>${esc(al.titulo || n.nome)}</h1>
          ${al.resumo ? `<p class="resumo">${esc(al.resumo)}</p>` : ''}
          ${fenomenos.length ? `<ul class="fenomenos" aria-label="Fenômenos esperados">${fenomenos.map((f) => `<li><img src="assets/icons/${FENOMENOS[f].icone}.svg" alt="">${FENOMENOS[f].nome}</li>`).join('')}</ul>` : ''}
          <div class="alerta-acoes">
            <button class="btn btn-alerta" type="button" data-compartilhar="alerta"><svg aria-hidden="true"><use href="#i-compartilhar"/></svg>Compartilhar alerta</button>
            ${temDetalhes ? '<button class="btn btn-alerta-2" type="button" id="btn-detalhes" aria-expanded="false" aria-controls="alerta-dias">Ver detalhes por dia</button>' : ''}
          </div>
          <p class="origem">${origem}</p>
        </div>
        <div class="vigencia">
          <h2>Vigência do alerta</h2>
          ${ini && fim && diasInteiros(ini, fim) ? `<p class="periodo">${fmtVigencia(ini, fim).replace(/^de /, '').replace(' a ', '<br>a ')}</p>` : ini && fim ? `<p class="periodo">${fmtQuando(ini)}<br>até ${fmtQuando(fim)}</p>` : fim ? `<p class="periodo">até ${fmtQuando(fim)}</p>` : ''}
          ${falta ? `<p class="falta">${falta}</p>` : ''}
          ${ini && fim ? regua(ini, fim, agora) : ''}
          <p style="margin:14px 0 0;font-size:.92rem">${esc(DESCRICAO_NIVEL[al.nivel] || '')}</p>
        </div>
      </div>
      ${temDetalhes ? `<div class="alerta-dias" id="alerta-dias" hidden>
        ${(al.dias || []).map((d) => {
          const nd = NIVEIS[d.nivel] || n;
          return `<div class="alerta-dia" style="--chip-grad:${gradCSS(d.nivel || al.nivel)};--chip-texto:${nd.texto}"><h3>${esc(d.rotulo)}<small>${nd.nome}</small></h3><p>${esc(d.texto)}</p></div>`;
        }).join('')}
        ${al.impactos?.length ? `<div class="alerta-dia"><h3>Podem ocorrer</h3><ul>${al.impactos.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}
        ${al.instrucoes?.length ? `<div class="alerta-dia"><h3>Orientações do INMET</h3><ul>${al.instrucoes.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : ''}
      </div>` : ''}
    </article>`;
  const btn = $('#btn-detalhes');
  btn?.addEventListener('click', () => {
    const painel = $('#alerta-dias');
    const abrir = painel.hidden;
    painel.hidden = !abrir;
    btn.setAttribute('aria-expanded', String(abrir));
    btn.textContent = abrir ? 'Esconder detalhes' : 'Ver detalhes por dia';
  });
}

function regua(ini, fim, agora) {
  const total = fim - ini;
  const pos = Math.max(0, Math.min(1, (agora - ini) / total));
  const marcas = [];
  // meia-noite (horário de Brasília) dentro da janela
  for (let t = Math.ceil((ini.getTime() - 3 * 3600e3) / 864e5) * 864e5 + 3 * 3600e3; t < fim.getTime(); t += 864e5) {
    const p = (t - ini) / total;
    if (p > 0.14 && p < 0.86) marcas.push(`<span class="marca-dia" style="left:${(p * 100).toFixed(2)}%">${diaSemana(new Date(t + 3600e3), true)}</span>`);
  }
  const dentro = agora >= ini && agora <= fim;
  return `<div class="regua" role="img" aria-label="Linha do tempo do alerta: ${dentro ? `${Math.round(pos * 100)}% do período já passou` : 'ainda não começou'}">
    <div class="trilho"><div class="passado" style="width:${(pos * 100).toFixed(2)}%"></div></div>
    ${dentro ? `<div class="agulha" style="left:${(pos * 100).toFixed(2)}%"><span>agora</span></div>` : ''}
    <span class="ponta ini">${fmtHora(ini)}</span>${marcas.join('')}<span class="ponta fim">${fmtHora(fim)}</span>
  </div>`;
}

// ------------------------------------------------------------------ tempo agora
function renderAgora() {
  const c = estado.clima;
  const a = c.atual || {};
  const hoje = c.dias?.[0] || {};
  $('#agora-hora').textContent = fmtHora(new Date());
  $('#agora-hora').dateTime = new Date().toISOString();
  $('#agora-fonte').textContent = a.fonte === 'simepar' ? '· dados do SIMEPAR' : '· modelo Open-Meteo';
  $('#agora-icone').src = iconeURL(a.condicao, a.dia !== false);
  $('#agora-temp').textContent = graus(a.temp);
  $('#agora-cond').textContent = a.descricao || '';
  $('#hoje-resumo').innerHTML = `Hoje: <b>${graus(hoje.min)}</b> a <b>${graus(hoje.max)}</b> · chuva de <b>${mm(hoje.chuva_mm)}</b>${hoje.prob != null ? ` (${num(hoje.prob)}% de chance)` : ''}`;
  const itens = [
    ['Sensação', graus(a.sensacao)],
    ['Umidade', a.umidade != null ? `${num(a.umidade)}%` : '–'],
    ['Vento', a.vento != null ? `${num(a.vento)} <small>km/h ${a.vento_dir || ''}</small>` : '–'],
    ['Rajadas', (a.rajada ?? hoje.rajada) != null ? `${num(a.rajada ?? hoje.rajada)} <small>km/h</small>` : '–'],
    ['Chuva hoje', mm(hoje.chuva_mm)],
    ['Últimas 24 h', c.chuva_24h_mm != null ? mm(c.chuva_24h_mm) : '–'],
  ];
  $('#agora-dados').innerHTML = itens.map(([t, v]) => `<div><dt>${t}</dt><dd>${v}</dd></div>`).join('');
  ceu.definir(estadoCeu(a.condicao, a.dia !== false, { vento: a.vento }));
}

function renderHoras() {
  const horas = (estado.clima.horas || []).slice(0, 24);
  let diaAnterior = horas[0] ? partes(horas[0].t).iso : null;
  $('#lista-horas').innerHTML = horas.map((h, i) => {
    const d = new Date(h.t);
    const p = partes(d);
    const virou = p.iso !== diaAnterior;
    diaAnterior = p.iso;
    const chuva = h.chuva_mm > 0 ? `<span class="c${h.chuva_mm >= 5 ? ' forte' : ''}">${mm(h.chuva_mm)}</span>` : `<span class="c">${h.prob ? `${num(h.prob)}%` : ''}</span>`;
    return `<li class="${i === 0 ? 'agora-h' : ''}${virou ? ' virada' : ''}" ${virou ? `data-dia="${diaSemana(d, true)}"` : ''}>
      <span class="h">${i === 0 ? 'Agora' : fmtHora(d, false)}</span>
      <img src="${iconeURL(h.condicao, h.dia !== false)}" alt="${esc(h.descricao || '')}" width="40" height="40" loading="lazy">
      <span class="t">${graus(h.temp)}</span>${chuva}</li>`;
  }).join('');
}

function renderDias() {
  const dias = (estado.clima.dias || []).slice(0, 7);
  const mins = dias.map((d) => d.min).filter((v) => v != null);
  const maxs = dias.map((d) => d.max).filter((v) => v != null);
  const lo = Math.min(...mins), hi = Math.max(...maxs), amp = Math.max(1, hi - lo);
  $('#lista-dias').innerHTML = dias.map((d, i) => {
    const data = new Date(d.data + 'T12:00:00-03:00');
    const esq = ((d.min - lo) / amp) * 100, larg = ((d.max - d.min) / amp) * 100;
    const seca = !d.chuva_mm || d.chuva_mm < 0.5;
    return `<li class="dia vidro${i === 0 ? ' hoje' : ''}">
      <span class="nome">${nomeDoDia(d.data)}</span>
      <span class="data">${fmtData(data)}</span>
      <img src="${iconeURL(d.condicao, true)}" alt="" width="58" height="58" loading="lazy">
      <span class="desc">${esc(d.descricao || '')}</span>
      <span class="faixa-t"><span class="min">${graus(d.min)}</span><span class="barra-t" aria-hidden="true"><i style="left:${esq}%;width:${Math.max(6, larg)}%"></i></span><span>${graus(d.max)}</span></span>
      <span class="chuva${seca ? ' seca' : ''}" title="Chuva prevista">${seca ? 'sem chuva' : `${mm(d.chuva_mm)}${d.prob != null ? ` · ${num(d.prob)}%` : ''}`}</span>
      ${d.rajada != null ? `<span class="vento">rajadas ${num(d.rajada)} km/h</span>` : ''}
    </li>`;
  }).join('');
  const f = estado.clima;
  const fonte = dias[0]?.fonte === 'simepar' ? 'SIMEPAR' : 'modelo Open-Meteo';
  $('#previsao-fonte').textContent = `Fonte: ${fonte} · atualizado ${relativo(f.gerado_em)}`;
}

// ------------------------------------------------------------------ gráfico de chuva (48 h)
function renderGrafico() {
  const horas = (estado.clima.horas || []).slice(0, 48);
  const svg = $('#grafico-svg');
  const W = Math.max(320, svg.clientWidth || 900), H = 190;
  const m = { t: 10, r: 8, b: 26, l: 34 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b;
  const total = horas.reduce((s, h) => s + (h.chuva_mm || 0), 0);
  const maximo = Math.max(...horas.map((h) => h.chuva_mm || 0), 0);
  $('#grafico-total').textContent = total >= 0.5
    ? `Total previsto: ${mm(total)} · pico de ${mm(maximo)} em 1 hora`
    : 'Sem chuva significativa prevista';
  const topo = Math.max(4, Math.ceil(maximo / 2) * 2);
  const passo = topo <= 8 ? 2 : topo <= 20 ? 5 : 10;
  const bw = iw / Math.max(1, horas.length);
  const y = (v) => m.t + ih - (v / topo) * ih;
  let s = `<defs><linearGradient id="g-barra" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9CCBFF"/><stop offset="1" stop-color="#3B82F6"/></linearGradient></defs>`;
  // faixas da noite
  horas.forEach((h, i) => { if (h.dia === false) s += `<rect class="noite-faixa" x="${m.l + i * bw}" y="${m.t}" width="${bw + 0.5}" height="${ih}"/>`; });
  s += '<g class="grade">';
  for (let v = 0; v <= topo; v += passo) s += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/>`;
  s += '</g><g class="eixo">';
  for (let v = 0; v <= topo; v += passo) s += `<text x="${m.l - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  horas.forEach((h, i) => {
    const p = partes(h.t);
    if (p.hora % 6 === 0) s += `<text x="${m.l + i * bw + bw / 2}" y="${H - 6}" text-anchor="middle">${p.hora === 0 ? diaSemana(new Date(h.t), true) : `${p.hora}h`}</text>`;
  });
  s += '</g>';
  horas.forEach((h, i) => {
    const v = h.chuva_mm || 0;
    const x = m.l + i * bw + 1, wb = Math.max(1, bw - 2);
    const alt = (v / topo) * ih;
    const raio = Math.min(4, wb / 2, alt);
    const d = new Date(h.t);
    const rotulo = `${diaSemana(d, true)} ${fmtHora(d, false)}: ${mm(v)}${h.prob != null ? `, ${num(h.prob)}% de chance` : ''}`;
    s += `<g class="barra" tabindex="0" data-dica="${esc(rotulo)}" aria-label="${esc(rotulo)}">
      <rect class="alvo" x="${m.l + i * bw}" y="${m.t}" width="${bw}" height="${ih}"/>
      ${v > 0 ? `<path class="b" fill="url(#g-barra)" d="M${x} ${m.t + ih} V${m.t + ih - alt + raio} Q${x} ${m.t + ih - alt} ${x + raio} ${m.t + ih - alt} H${x + wb - raio} Q${x + wb} ${m.t + ih - alt} ${x + wb} ${m.t + ih - alt + raio} V${m.t + ih} Z"/>` : ''}
    </g>`;
  });
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = s;
  const dica = $('#dica');
  const mostrar = (el) => {
    const r = el.getBoundingClientRect();
    dica.textContent = el.dataset.dica;
    dica.style.left = `${r.left + r.width / 2}px`;
    dica.style.top = `${Math.max(60, svg.getBoundingClientRect().top + 20)}px`;
    dica.hidden = false;
  };
  $$('.barra', svg).forEach((g) => {
    g.addEventListener('pointerenter', () => mostrar(g));
    g.addEventListener('focus', () => mostrar(g));
    g.addEventListener('pointerleave', () => { dica.hidden = true; });
    g.addEventListener('blur', () => { dica.hidden = true; });
  });
}

// ------------------------------------------------------------------ avisos INMET e fontes
function renderAvisos() {
  const avisos = (estado.clima.avisos_inmet || []).filter((a) => !a.fim || new Date(a.fim) > new Date());
  $('#avisos-inmet').innerHTML = avisos.map((a) => {
    const n = NIVEIS[a.nivel] || NIVEIS.moderado;
    return `<article class="aviso" style="--chip-grad:${gradCSS(a.nivel)};--chip-texto:${n.texto}">
      <span class="cor" aria-hidden="true"></span>
      <div><h3>Aviso do INMET: ${esc(a.evento)}</h3>
      <p>${a.inicio && a.fim ? `De ${fmtQuando(new Date(a.inicio))} até ${fmtQuando(new Date(a.fim))}. ` : ''}<a href="${esc(a.link || CONFIG.links.inmetAvisos)}" target="_blank" rel="noopener">Ver aviso completo</a></p></div>
      <span class="sev">${esc(a.severidade || n.nome)}</span>
    </article>`;
  }).join('');
}

function renderFontes() {
  const c = estado.clima;
  const f = c.fontes || {};
  const linhas = [];
  if (f.simepar) linhas.push([f.simepar.ok, f.simepar.ok ? 'SIMEPAR — previsão oficial' : 'SIMEPAR — sem resposta na última tentativa']);
  else if (c.origem === 'ao-vivo') linhas.push([false, 'SIMEPAR — aguardando o robô de atualização']);
  linhas.push([!!f.openmeteo?.ok || c.origem === 'ao-vivo', c.origem === 'ao-vivo' ? 'Open-Meteo — previsão ao vivo (reserva)' : 'Open-Meteo — dados complementares']);
  if (f.inmet) linhas.push([f.inmet.ok, f.inmet.ok ? 'INMET — avisos meteorológicos' : 'INMET — sem resposta na última tentativa']);
  $('#estado-fontes').innerHTML = linhas.map(([ok, t]) => `<li><span class="${ok ? 'ok' : 'falha'}" aria-hidden="true"></span>${t}</li>`).join('');
  $('#ultima-atualizacao').textContent = `Última atualização: ${fmtData(new Date(c.gerado_em))} às ${fmtHora(new Date(c.gerado_em))} (${relativo(c.gerado_em)}).`;
  const b = $('#boletim-data');
  if (b) b.textContent = c.origem === 'robo' ? `Baixar PDF · gerado ${relativo(c.gerado_em)}` : 'Baixar PDF';
}

function renderContatos() {
  $('#lista-contatos').innerHTML = CONFIG.contatos.map((c) => `
    <li class="${c.destaque ? 'destaque' : ''}">
      <a class="contato vidro" href="tel:${c.tel}">
        <span class="nome">${esc(c.nome)}</span>
        <span class="numero">${esc(c.numero)}</span>
        <span class="det">${esc(c.detalhe || '')}</span>
        <span class="ligar"><svg width="16" height="16" aria-hidden="true"><use href="#i-telefone"/></svg>Ligar</span>
      </a></li>`).join('');
}

// ------------------------------------------------------------------ orientações: abas e kit
function iniciarAbas() {
  const abas = $$('.abas [role="tab"]');
  const ativar = (aba, foco = false) => {
    abas.forEach((a) => {
      const sel = a === aba;
      a.setAttribute('aria-selected', String(sel));
      a.tabIndex = sel ? 0 : -1;
      $(`#${a.getAttribute('aria-controls')}`).hidden = !sel;
    });
    if (foco) aba.focus();
  };
  abas.forEach((a, i) => {
    a.addEventListener('click', () => ativar(a));
    a.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') ativar(abas[(i + 1) % abas.length], true);
      if (e.key === 'ArrowLeft') ativar(abas[(i - 1 + abas.length) % abas.length], true);
    });
  });
  // durante um alerta, a aba "Durante" já vem aberta; sem alerta, "Antes"
  ativar(estado.alerta ? abas[1] : abas[0]);
}

const KIT = [
  'Água potável para 3 dias', 'Lanterna e pilhas extras', 'Rádio a pilha', 'Carregador portátil (power bank) carregado',
  'Remédios de uso contínuo e receitas', 'Kit de primeiros socorros', 'Documentos em saco plástico', 'Alimentos que não estragam',
  'Lista de telefones em papel', 'Roupas e calçados extras', 'Apito para pedir ajuda', 'Ração e água para os animais',
];
function iniciarKit() {
  const marcados = new Set(ler('kit-emergencia', []));
  const lista = $('#kit-lista');
  lista.innerHTML = KIT.map((item, i) => `<li><label><input type="checkbox" data-i="${i}" ${marcados.has(i) ? 'checked' : ''}><span>${item}</span></label></li>`).join('');
  const atualizar = () => {
    const pct = Math.round((marcados.size / KIT.length) * 100);
    $('#kit-barra').style.width = `${pct}%`;
    $('#kit-texto').textContent = marcados.size === KIT.length ? 'Kit completo. Confira a validade a cada 6 meses.' : `${marcados.size} de ${KIT.length} itens prontos.`;
  };
  lista.addEventListener('change', (e) => {
    const i = +e.target.dataset.i;
    if (e.target.checked) marcados.add(i); else marcados.delete(i);
    guardar('kit-emergencia', [...marcados]);
    atualizar();
  });
  atualizar();
}

// ------------------------------------------------------------------ topo: muda de cor fora do céu
function iniciarTopo() {
  const topo = $('#topo');
  new IntersectionObserver(([e]) => topo.classList.toggle('sobre-claro', !e.isIntersecting), { rootMargin: '-70px 0px 0px 0px', threshold: 0 })
    .observe($('#ceu-area .ceu-conteudo') || $('#ceu-area'));
}

// ------------------------------------------------------------------ ciclo
async function atualizar() {
  try {
    const [clima, alertaBruto] = await Promise.all([carregarClima(), carregarAlerta()]);
    let c = clima, a = alertaBruto;
    if (sim) ({ clima: c, alerta: a } = aplicarSimulacao(clima, alertaBruto, sim));
    estado.clima = c;
    estado.alertaBruto = a;
    estado.alerta = alertaVigente(a, c);
    renderAlerta();
    renderAgora();
    renderHoras();
    renderDias();
    renderGrafico();
    renderAvisos();
    renderFontes();
  } catch (e) {
    console.error(e);
    $('#agora-cond').textContent = 'Não foi possível carregar o tempo agora. Tente de novo em alguns minutos.';
  }
}

if (sim) $('#aviso-simulacao').hidden = false;
renderContatos();
iniciarKit();
iniciarTopo();
await atualizar();
iniciarAbas();
prepararFontes();

const abrirCompartilhar = iniciarCompartilhar(() => estado);
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-compartilhar]');
  if (b) abrirCompartilhar(b.dataset.compartilhar);
});

setInterval(atualizar, CONFIG.atualizarACadaMin * 60e3);
let largura = innerWidth;
addEventListener('resize', () => { if (Math.abs(innerWidth - largura) > 40) { largura = innerWidth; renderGrafico(); } });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
