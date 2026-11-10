// Senha única da página da equipe. A senha não fica escrita no site: só a "impressão digital"
// dela (PBKDF2-SHA256) em config.js. Depois de entrar, o computador lembra o acesso.
import { CONFIG } from './config.js';

const CHAVE = 'dc-guarapuava-equipe';
const S = CONFIG.senhaEquipe;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const deHex = (h) => Uint8Array.from(h.match(/../g).map((x) => parseInt(x, 16)));

export async function impressaoDaSenha(senha, sal = S.sal, iteracoes = S.iteracoes) {
  const chave = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: deHex(sal), iterations: iteracoes }, chave, 256);
  return hex(bits);
}

export function novoSal() {
  return hex(crypto.getRandomValues(new Uint8Array(16)));
}

function lembrado() {
  try { return (localStorage.getItem(CHAVE) || sessionStorage.getItem(CHAVE)) === S.hash; } catch { return false; }
}

export function sair() {
  try { localStorage.removeItem(CHAVE); sessionStorage.removeItem(CHAVE); } catch { /* sem armazenamento */ }
  location.reload();
}

/** Mostra a tela de senha (se preciso) e chama aoLiberar() quando a senha estiver certa. */
export function exigirAcesso(aoLiberar) {
  if (lembrado()) { aoLiberar(); return; }
  const portao = document.getElementById('portao');
  const form = document.getElementById('form-senha');
  const campo = document.getElementById('senha');
  const msg = document.getElementById('msg-senha');
  portao.hidden = false;
  campo.focus();
  let tentativas = 0;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const botao = form.querySelector('button');
    botao.disabled = true;
    msg.textContent = 'Conferindo…';
    try {
      const h = await impressaoDaSenha(campo.value);
      if (h !== S.hash) {
        tentativas += 1;
        msg.textContent = 'Senha incorreta. Confira com a coordenação da Defesa Civil.';
        campo.select();
        // espera crescente a cada erro, para dificultar tentativas em sequência
        await new Promise((r) => setTimeout(r, Math.min(8000, 400 * 2 ** tentativas)));
        return;
      }
      try {
        (document.getElementById('lembrar').checked ? localStorage : sessionStorage).setItem(CHAVE, h);
      } catch { /* navegador sem armazenamento: libera só nesta visita */ }
      msg.textContent = '';
      portao.hidden = true;
      aoLiberar();
    } catch {
      msg.textContent = 'Este navegador não conseguiu conferir a senha. Abra o site pelo endereço https.';
    } finally {
      botao.disabled = false;
    }
  });
}
