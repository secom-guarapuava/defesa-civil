// Página da equipe: monta o alerta, gera a arte/legenda e publica data/alerta.json no GitHub.
import { CONFIG } from './config.js';
import { NIVEIS, FENOMENOS, gradCSS, carregarClima, carregarAlerta } from './clima.js';
import { desenharArte, canvasParaArquivo } from './arte.js';
import { textoAlerta, abrirWhatsAppTexto } from './compartilhar.js';
import { $, $$, esc, diaSemana, partes, doisDig, ler, guardar, diasInteiros } from './util.js';

const IMPACTOS = ['queda de árvores', 'alagamentos', 'destelhamentos', 'enxurradas', 'transbordamento de córregos', 'queda de energia', 'deslizamentos', 'danos em plantações'];
const form = $('#form-alerta');
let clima = null;

// ------------------------------------------------------------------ montar controles
$('#niveis').innerHTML = ['baixo', 'moderado', 'alto', 'muito-alto'].map((k) => {
  const n = NIVEIS[k];
  return `<label><input type="radio" name="nivel" value="${k}" ${k === 'alto' ? 'checked' : ''}><span style="background:${gradCSS(k)};color:${n.texto}">${n.cor}<br><small>${n.nome}</small></span></label>`;
}).join('');
$('#fenomenos').innerHTML = Object.entries(FENOMENOS).map(([k, f]) => `<label><input type="checkbox" name="fen" value="${k}"><span><img src="assets/icons/${f.icone}.svg" alt="" width="22" height="22">${f.nome}</span></label>`).join('');
$('#impactos').innerHTML = IMPACTOS.map((i) => `<label><input type="checkbox" name="imp" value="${i}"><span>${i}</span></label>`).join('');

function addDia(d = {}) {
  const el = document.createElement('div');
  el.className = 'dia-item';
  el.innerHTML = `<div class="linha">
      <input type="text" class="d-rotulo" placeholder="Ex.: Sexta-feira (06/11)" value="${esc(d.rotulo || '')}" aria-label="Dia">
      <select class="d-nivel" aria-label="Nível do dia">${['baixo', 'moderado', 'alto', 'muito-alto'].map((k) => `<option value="${k}" ${k === (d.nivel || nivelAtual()) ? 'selected' : ''}>${NIVEIS[k].nome}</option>`).join('')}</select>
      <button class="btn btn-claro" type="button" aria-label="Remover este dia">Remover</button></div>
    <textarea class="d-texto" placeholder="O que esperar neste dia" aria-label="Texto do dia">${esc(d.texto || '')}</textarea>`;
  el.querySelector('button').addEventListener('click', () => { el.remove(); atualizar(); });
  $('#dias').append(el);
}
const nivelAtual = () => form.querySelector('input[name="nivel"]:checked')?.value || 'alto';

// Campos de vigência: dias inteiros (date) ou horário exato (datetime-local), sempre no fuso -03:00
const modoDias = () => $('#f-dias-inteiros').checked;
const paraLocal = (iso, soData) => {
  if (!iso) return '';
  const p = partes(new Date(iso));
  const d = `${p.ano}-${doisDig(p.mes)}-${doisDig(p.dia)}`;
  return soData ? d : `${d}T${doisDig(p.hora)}:${doisDig(p.min)}`;
};
const lerVigencia = (campo, fim) => {
  const v = $(campo).value;
  if (!v) return null;
  if (modoDias()) return `${v.slice(0, 10)}T${fim ? '23:59' : '00:00'}:00-03:00`;
  return `${v}:00-03:00`;
};
function aplicarModoDias() {
  const dias = modoDias();
  for (const [campo, fim] of [['#f-inicio', false], ['#f-fim', true]]) {
    const el = $(campo);
    const atual = el.value;
    el.type = dias ? 'date' : 'datetime-local';
    if (atual) el.value = dias ? atual.slice(0, 10) : (atual.length === 10 ? `${atual}T${fim ? '23:59' : '00:00'}` : atual);
  }
  $('#rot-inicio').textContent = dias ? 'Primeiro dia' : 'Início da vigência';
  $('#rot-fim').textContent = dias ? 'Último dia' : 'Fim da vigência';
}
$('#f-dias-inteiros').addEventListener('change', () => { aplicarModoDias(); atualizar(); });

function lerFormulario() {
  const ativo = form.ativo.value === 'sim';
  return {
    ativo,
    nivel: nivelAtual(),
    titulo: $('#f-titulo').value.trim(),
    resumo: $('#f-resumo').value.trim(),
    inicio: lerVigencia('#f-inicio', false),
    fim: lerVigencia('#f-fim', true),
    fenomenos: $$('input[name="fen"]:checked').map((i) => i.value),
    dias: $$('.dia-item').map((el) => ({ rotulo: el.querySelector('.d-rotulo').value.trim(), nivel: el.querySelector('.d-nivel').value, texto: el.querySelector('.d-texto').value.trim() })).filter((d) => d.rotulo || d.texto),
    impactos: $$('input[name="imp"]:checked').map((i) => i.value),
    fonte: $('#f-fonte').value.trim() || 'Defesa Civil de Guarapuava',
    publicado_em: new Date().toISOString(),
    publicado_por: 'Defesa Civil de Guarapuava',
  };
}

function preencher(a) {
  form.ativo.value = a.ativo ? 'sim' : 'nao';
  const r = form.querySelector(`input[name="nivel"][value="${a.nivel}"]`);
  if (r) r.checked = true;
  $('#f-titulo').value = a.titulo || '';
  $('#f-resumo').value = a.resumo || '';
  $('#f-dias-inteiros').checked = !a.inicio || diasInteiros(a.inicio, a.fim);
  aplicarModoDias();
  $('#f-inicio').value = paraLocal(a.inicio, modoDias());
  $('#f-fim').value = paraLocal(a.fim, modoDias());
  $$('input[name="fen"]').forEach((i) => { i.checked = (a.fenomenos || []).includes(i.value); });
  $$('input[name="imp"]').forEach((i) => { i.checked = (a.impactos || []).includes(i.value); });
  $('#dias').innerHTML = '';
  (a.dias || []).forEach(addDia);
  if (a.fonte) $('#f-fonte').value = a.fonte;
  atualizar();
}

function padrao() {
  const hoje = partes(new Date());
  const d = `${hoje.ano}-${doisDig(hoje.mes)}-${doisDig(hoje.dia)}`;
  const ini = new Date(`${d}T00:00:00-03:00`);
  const fim = new Date(`${d}T23:59:00-03:00`);
  preencher({
    ativo: true, nivel: 'alto', titulo: 'Risco alto de tempestades',
    resumo: 'Chuva forte em pouco tempo, rajadas de vento, raios e granizo localizado.',
    inicio: ini.toISOString(), fim: fim.toISOString(),
    fenomenos: ['chuva-forte', 'rajadas', 'raios', 'granizo'], impactos: ['queda de árvores', 'alagamentos', 'destelhamentos'], dias: [],
  });
}

$('#add-dia').addEventListener('click', () => { addDia(); atualizar(); });
$('#auto-dias').addEventListener('click', () => {
  const a = lerFormulario();
  if (!a.inicio || !a.fim) return;
  $('#dias').innerHTML = '';
  const fim = new Date(a.fim);
  for (let t = new Date(a.inicio); t <= fim; t = new Date(t.getTime() + 864e5)) {
    const p = partes(t);
    const nome = diaSemana(t);
    addDia({ rotulo: `${nome.charAt(0).toUpperCase() + nome.slice(1)} (${doisDig(p.dia)}/${doisDig(p.mes)})`, nivel: a.nivel, texto: '' });
    if (partes(new Date(t.getTime() + 864e5)).iso > partes(fim).iso) break;
  }
  atualizar();
});
$('#limpar').addEventListener('click', padrao);
$('#carregar').addEventListener('click', async () => {
  const a = await carregarAlerta();
  if (a && (a.titulo || a.ativo)) preencher(a); else $('#msg-publicar').textContent = 'Não há alerta publicado no momento.';
});

// ------------------------------------------------------------------ prévia da arte
let pendente = null;
async function atualizar() {
  const a = lerFormulario();
  $('#campos-alerta').classList.toggle('desativado', !a.ativo);
  clearTimeout(pendente);
  pendente = setTimeout(async () => {
    const alerta = a.ativo ? { ...a, origem: 'defesa-civil' } : null;
    const formato = $('#formato').querySelector('input:checked').value;
    const cv = $('#arte');
    if (alerta) {
      await desenharArte(cv, { tipo: 'alerta', formato, clima, alerta, url: urlSite() });
      $('#legenda').value = textoAlerta(alerta, urlSite());
    } else {
      await desenharArte(cv, { tipo: 'tempo', formato, clima: clima || {}, alerta: null, url: urlSite() });
      $('#legenda').value = 'Sem alerta vigente. (A arte mostra o tempo agora.)';
    }
  }, 250);
}
const urlSite = () => {
  if (CONFIG.urlSite) return CONFIG.urlSite;
  const u = new URL('./', location.href);
  return u.toString();
};
form.addEventListener('input', atualizar);
form.addEventListener('change', atualizar);
$('#formato').addEventListener('change', atualizar);

$('#baixar-arte').addEventListener('click', async () => {
  const f = $('#formato').querySelector('input:checked').value;
  const arq = await canvasParaArquivo($('#arte'), `alerta-defesa-civil-guarapuava-${f}.png`);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arq); link.download = arq.name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  $('#msg-arte').textContent = 'Arte baixada.';
});
$('#copiar-legenda').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#legenda').value); $('#msg-arte').textContent = 'Legenda copiada.'; } catch { $('#legenda').select(); }
});
$('#whats-legenda').addEventListener('click', () => abrirWhatsAppTexto($('#legenda').value));

// ------------------------------------------------------------------ publicação no GitHub
const salvo = ler('gh-publicar', {});
$('#g-usuario').value = salvo.usuario || CONFIG.github.usuario || '';
$('#g-repo').value = salvo.repositorio || CONFIG.github.repositorio || '';
$('#g-token').value = salvo.token || '';
$('#g-lembrar').checked = !!salvo.token;

function json() {
  const a = lerFormulario();
  if (!a.ativo) return JSON.stringify({ ativo: false, encerrado_em: new Date().toISOString(), ultimo_titulo: a.titulo || null }, null, 2);
  return JSON.stringify(a, null, 2);
}
function validar() {
  const a = lerFormulario();
  if (!a.ativo) return null;
  if (!a.titulo) return 'Escreva o título do alerta.';
  if (!a.inicio || !a.fim) return 'Preencha o início e o fim da vigência.';
  if (new Date(a.fim) <= new Date(a.inicio)) return 'O fim da vigência precisa ser depois do início.';
  if (new Date(a.fim) < new Date()) return 'O fim da vigência já passou: o alerta não apareceria no site.';
  return null;
}
const b64 = (txt) => { const bytes = new TextEncoder().encode(txt); let s = ''; bytes.forEach((b) => { s += String.fromCharCode(b); }); return btoa(s); };

$('#publicar').addEventListener('click', async () => {
  const msg = $('#msg-publicar');
  msg.className = 'msg';
  const erro = validar();
  if (erro) { msg.textContent = erro; msg.classList.add('erro'); return; }
  const usuario = $('#g-usuario').value.trim(), repositorio = $('#g-repo').value.trim(), token = $('#g-token').value.trim();
  if (!usuario || !repositorio || !token) { msg.textContent = 'Preencha usuário, repositório e token, ou use “Baixar alerta.json”.'; msg.classList.add('erro'); return; }
  guardar('gh-publicar', $('#g-lembrar').checked ? { usuario, repositorio, token } : {});
  const ramo = CONFIG.github.ramo || 'main';
  const url = `https://api.github.com/repos/${usuario}/${repositorio}/contents/data/alerta.json`;
  const cab = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  msg.textContent = 'Publicando…';
  try {
    let sha;
    const atual = await fetch(`${url}?ref=${ramo}`, { headers: cab });
    if (atual.ok) sha = (await atual.json()).sha;
    else if (atual.status !== 404) throw new Error(`GitHub respondeu ${atual.status} ao ler o arquivo`);
    const a = lerFormulario();
    const mensagem = a.ativo ? `Alerta ${NIVEIS[a.nivel].cor.toLowerCase()}: ${a.titulo}` : 'Encerra alerta';
    const r = await fetch(url, { method: 'PUT', headers: cab, body: JSON.stringify({ message: mensagem, content: b64(json()), sha, branch: ramo }) });
    if (!r.ok) {
      const det = await r.json().catch(() => ({}));
      throw new Error(r.status === 401 ? 'token inválido ou expirado' : r.status === 403 || r.status === 404 ? 'o token não tem permissão de escrita neste repositório' : det.message || `erro ${r.status}`);
    }
    msg.textContent = 'Publicado. O site e o boletim mostram o novo alerta em 1 a 2 minutos.';
    msg.classList.add('ok');
  } catch (e) {
    msg.textContent = `Não foi possível publicar: ${e.message}. Use “Baixar alerta.json” e envie pelo GitHub.`;
    msg.classList.add('erro');
  }
});

$('#baixar-json').addEventListener('click', () => {
  const erro = validar();
  if (erro) { $('#msg-publicar').textContent = erro; $('#msg-publicar').className = 'msg erro'; return; }
  const blob = new Blob([json()], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = 'alerta.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  const u = $('#g-usuario').value.trim(), r = $('#g-repo').value.trim();
  $('#msg-publicar').className = 'msg ok';
  $('#msg-publicar').innerHTML = u && r
    ? `Arquivo baixado. Agora envie em <a href="https://github.com/${esc(u)}/${esc(r)}/upload/${esc(CONFIG.github.ramo || 'main')}/data" target="_blank" rel="noopener">github.com/${esc(u)}/${esc(r)} → pasta data</a>, substituindo o alerta.json.`
    : 'Arquivo baixado. Envie no GitHub dentro da pasta data, substituindo o alerta.json.';
});

// ------------------------------------------------------------------ início
padrao();
try { clima = await carregarClima(); } catch { clima = null; }
const publicado = await carregarAlerta();
if (publicado?.ativo && publicado.fim && new Date(publicado.fim) > new Date()) preencher(publicado);
atualizar();
