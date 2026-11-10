// Área da equipe (carregada só depois da senha): monta o alerta e gera a arte e a legenda.
import { CONFIG, urlDoSite } from './config.js';
import { NIVEIS, FENOMENOS, gradCSS, carregarClima, carregarAlerta, alertaVigente } from './clima.js';
import { desenharArte, canvasParaArquivo } from './arte.js';
import { textoAlerta, textoTempo, textoPrevisao, abrirWhatsAppTexto } from './compartilhar.js';
import { sair, impressaoDaSenha, novoSal } from './acesso.js';
import { $, $$, esc, diaSemana, partes, doisDig, diasInteiros } from './util.js';

const IMPACTOS = ['queda de árvores', 'alagamentos', 'destelhamentos', 'enxurradas', 'transbordamento de córregos', 'queda de energia', 'deslizamentos', 'danos em plantações'];
const form = $('#form-alerta');
let clima = null;
let alertaEmVigor = null; // alerta que já aparece no site (Defesa Civil ou INMET), para as artes de tempo/previsão

$('#sair').addEventListener('click', sair);

// ------------------------------------------------------------------ controles
$('#niveis').innerHTML = ['baixo', 'moderado', 'alto', 'muito-alto'].map((k) => {
  const n = NIVEIS[k];
  return `<label><input type="radio" name="nivel" value="${k}" ${k === 'alto' ? 'checked' : ''}><span style="background:${gradCSS(k)};color:${n.texto}">${n.cor}<br><small>${n.nome}</small></span></label>`;
}).join('');
$('#fenomenos').innerHTML = Object.entries(FENOMENOS).map(([k, f]) => `<label><input type="checkbox" name="fen" value="${k}"><span><img src="assets/icons/${f.icone}.svg" alt="" width="22" height="22">${f.nome}</span></label>`).join('');
$('#impactos').innerHTML = IMPACTOS.map((i) => `<label><input type="checkbox" name="imp" value="${i}"><span>${i}</span></label>`).join('');

const nivelAtual = () => form.querySelector('input[name="nivel"]:checked')?.value || 'alto';
const tipoArte = () => form.querySelector('input[name="tipo"]:checked').value;

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

// ------------------------------------------------------------------ vigência (dias inteiros ou horário exato, sempre -03:00)
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

// ------------------------------------------------------------------ formulário
function lerFormulario() {
  return {
    ativo: true,
    origem: 'defesa-civil',
    nivel: nivelAtual(),
    titulo: $('#f-titulo').value.trim(),
    resumo: $('#f-resumo').value.trim(),
    inicio: lerVigencia('#f-inicio', false),
    fim: lerVigencia('#f-fim', true),
    fenomenos: $$('input[name="fen"]:checked').map((i) => i.value),
    dias: $$('.dia-item').map((el) => ({ rotulo: el.querySelector('.d-rotulo').value.trim(), nivel: el.querySelector('.d-nivel').value, texto: el.querySelector('.d-texto').value.trim() })).filter((d) => d.rotulo || d.texto),
    impactos: $$('input[name="imp"]:checked').map((i) => i.value),
  };
}

function preencher(a) {
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
  atualizar();
}

function padrao() {
  const hoje = partes(new Date());
  const d = `${hoje.ano}-${doisDig(hoje.mes)}-${doisDig(hoje.dia)}`;
  preencher({
    nivel: 'alto', titulo: 'Risco alto de tempestades',
    resumo: 'Chuva forte em pouco tempo, rajadas de vento, raios e granizo localizado.',
    inicio: `${d}T00:00:00-03:00`, fim: `${d}T23:59:00-03:00`,
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
$('#usar-inmet').addEventListener('click', () => {
  const a = alertaEmVigor?.origem === 'inmet' ? alertaEmVigor : null;
  if (!a) { $('#msg-form').textContent = 'Não há aviso do INMET em vigor para Guarapuava agora.'; return; }
  preencher({ ...a, dias: [], impactos: [] });
  $('#msg-form').textContent = 'Formulário preenchido com o aviso do INMET. Revise o texto antes de baixar a arte.';
});

// ------------------------------------------------------------------ prévia da arte e legenda
let pendente = null;
async function atualizar() {
  const tipo = tipoArte();
  $('#campos-alerta').classList.toggle('desativado', tipo !== 'alerta');
  clearTimeout(pendente);
  pendente = setTimeout(async () => {
    const formato = $('#formato').querySelector('input:checked').value;
    const cv = $('#arte');
    const url = urlDoSite();
    if (tipo === 'alerta') {
      const alerta = lerFormulario();
      await desenharArte(cv, { tipo: 'alerta', formato, clima, alerta, url });
      $('#legenda').value = textoAlerta(alerta, url);
    } else if (clima) {
      await desenharArte(cv, { tipo, formato, clima, alerta: alertaEmVigor, url });
      $('#legenda').value = tipo === 'tempo' ? textoTempo(clima, alertaEmVigor, url) : textoPrevisao(clima, alertaEmVigor, url);
    } else {
      $('#legenda').value = 'Não foi possível carregar a previsão agora. Tente de novo em alguns minutos.';
    }
  }, 250);
}
form.addEventListener('input', atualizar);
form.addEventListener('change', atualizar);
$('#formato').addEventListener('change', atualizar);

$('#baixar-arte').addEventListener('click', async () => {
  const f = $('#formato').querySelector('input:checked').value;
  const d = partes(new Date());
  const arq = await canvasParaArquivo($('#arte'), `defesa-civil-guarapuava-${tipoArte()}-${f}-${doisDig(d.dia)}-${doisDig(d.mes)}-${doisDig(d.hora)}h${doisDig(d.min)}.png`);
  const link = document.createElement('a');
  link.href = URL.createObjectURL(arq); link.download = arq.name; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  $('#msg-arte').textContent = 'Arte baixada.';
});
$('#copiar-legenda').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#legenda').value); $('#msg-arte').textContent = 'Legenda copiada.'; } catch { $('#legenda').select(); }
});
$('#whats-legenda').addEventListener('click', () => abrirWhatsAppTexto($('#legenda').value));

// ------------------------------------------------------------------ trocar a senha
(function linkConfig() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  const repo = location.pathname.split('/').filter(Boolean)[0];
  if (m && repo) {
    const a = $('#link-config');
    a.href = `https://github.com/${m[1]}/${repo}/edit/main/assets/js/config.js`;
    a.hidden = false;
  }
}());
$('#gerar-senha').addEventListener('click', async () => {
  const s = $('#nova-senha').value;
  const msg = $('#msg-senha-nova');
  msg.className = 'msg';
  if (s.length < 10) { msg.textContent = 'Use pelo menos 10 caracteres (por exemplo, uma frase curta).'; msg.classList.add('erro'); return; }
  const sal = novoSal();
  const it = CONFIG.senhaEquipe.iteracoes || 150000;
  const hash = await impressaoDaSenha(s, sal, it);
  $('#linha-senha').value = `  senhaEquipe: { sal: '${sal}', hash: '${hash}', iteracoes: ${it} },`;
  $('#linha-senha').select();
  msg.textContent = 'Linha gerada. Cole no config.js no lugar da linha senhaEquipe.';
  msg.classList.add('ok');
});

// ------------------------------------------------------------------ início
padrao();
try {
  const [c, publicado] = await Promise.all([carregarClima(), carregarAlerta()]);
  clima = c;
  alertaEmVigor = alertaVigente(publicado, c);
} catch { clima = null; }
$('#usar-inmet').disabled = alertaEmVigor?.origem !== 'inmet';
atualizar();
