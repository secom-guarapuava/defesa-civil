// Céu animado: desenha em um <canvas> o tempo atual de Guarapuava
// (sol, nuvens, chuva, tempestade com relâmpagos, granizo, neblina, noite estrelada).
// Leve: pausa quando a aba está escondida ou o céu sai da tela, e respeita "reduzir movimento".

const PALETAS = {
  sol: [[38, 110, 232], [92, 160, 245], [168, 214, 255]],
  noite: [[6, 9, 40], [17, 24, 82], [40, 52, 128]],
  nublado: [[84, 98, 128], [122, 136, 164], [170, 182, 204]],
  neblina: [[96, 106, 124], [132, 142, 158], [172, 180, 194]],
  chuva: [[38, 50, 82], [64, 80, 114], [102, 118, 150]],
  'chuva-forte': [[26, 34, 62], [46, 58, 92], [78, 92, 126]],
  tempestade: [[14, 12, 40], [36, 28, 78], [70, 56, 110]],
};

const lerp = (a, b, t) => a + (b - a) * t;
const lerpCor = (a, b, t) => a.map((v, i) => Math.round(lerp(v, b[i], t)));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const rnd = (a, b) => a + Math.random() * (b - a);

export class Ceu {
  constructor(canvas, opcoes = {}) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.economia = !!opcoes.economia;
    this.reduzido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.estado = { tipo: 'nublado', intensidade: 0, nuvens: 0.8, vento: 12, granizo: false };
    this.paleta = PALETAS.nublado.map((c) => [...c]);
    this.paletaAlvo = PALETAS.nublado;
    this.nuvens = [];
    this.gotas = [];
    this.estrelas = [];
    this.flash = 0;
    this.raio = null;
    this.proxRaio = performance.now() + 4000;
    this.t0 = performance.now();
    this.rodando = false;
    this.visivel = true;
    this._loop = this._loop.bind(this);
    this._redimensionar = this._redimensionar.bind(this);
    new ResizeObserver(this._redimensionar).observe(canvas);
    document.addEventListener('visibilitychange', () => this._atualizarRodando());
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { this.visivel = e.isIntersecting; this._atualizarRodando(); }).observe(canvas);
    }
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', (e) => {
      this.reduzido = e.matches; this._atualizarRodando(); this._quadroUnico();
    });
    this._redimensionar();
  }

  definir(estado) {
    const antes = this.estado.tipo;
    this.estado = { ...this.estado, ...estado };
    this.paletaAlvo = PALETAS[this.estado.tipo] || PALETAS.nublado;
    if (antes !== this.estado.tipo || !this.nuvens.length) this._criarNuvens();
    this._criarGotas();
    this._criarEstrelas();
    if (this.reduzido) { this.paleta = this.paletaAlvo.map((c) => [...c]); this._quadroUnico(); }
    this._atualizarRodando();
  }

  _redimensionar() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.economia ? 1 : 1.5);
    const r = this.cv.getBoundingClientRect();
    this.W = Math.max(1, r.width);
    this.H = Math.max(1, r.height);
    this.cv.width = Math.round(this.W * dpr);
    this.cv.height = Math.round(this.H * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._criarNuvens();
    this._criarGotas();
    this._criarEstrelas();
    if (!this.rodando) this._quadroUnico();
  }

  _atualizarRodando() {
    const deve = !this.reduzido && !document.hidden && this.visivel;
    if (deve && !this.rodando) { this.rodando = true; this.ultimo = performance.now(); requestAnimationFrame(this._loop); }
    if (!deve) this.rodando = false;
  }

  // ------------------------------------------------------------ elementos
  _spriteNuvem(largura, cor) {
    // nuvem feita de muitos "flocos" macios, mais larga do que alta
    const c = document.createElement('canvas');
    const h = Math.round(largura * 0.5);
    c.width = largura; c.height = h;
    const x = c.getContext('2d');
    const flocos = 18 + Math.floor(Math.random() * 10);
    for (let i = 0; i < flocos; i++) {
      const u = Math.random();
      const bx = largura * (0.12 + 0.76 * u);
      const arco = Math.sin(u * Math.PI);
      const by = h * (0.62 - 0.22 * arco) + rnd(-h * 0.06, h * 0.06);
      const br = largura * rnd(0.07, 0.13) * (0.7 + arco * 0.6);
      const g = x.createRadialGradient(bx, by - br * 0.35, 0, bx, by, br);
      g.addColorStop(0, rgb(cor.topo, 0.5));
      g.addColorStop(0.55, rgb(cor.base, 0.32));
      g.addColorStop(1, rgb(cor.base, 0));
      x.fillStyle = g;
      x.beginPath(); x.arc(bx, by, br, 0, Math.PI * 2); x.fill();
    }
    // base achatada, levemente mais escura
    const gb = x.createLinearGradient(0, h * 0.45, 0, h * 0.85);
    gb.addColorStop(0, rgb(cor.base, 0));
    gb.addColorStop(1, rgb(cor.base, 0.18));
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = gb; x.fillRect(0, 0, largura, h);
    return c;
  }

  _corNuvem() {
    const t = this.estado.tipo;
    if (t === 'sol') return { topo: [255, 255, 255], base: [226, 234, 250] };
    if (t === 'noite') return { topo: [70, 80, 140], base: [40, 48, 100] };
    if (t === 'nublado' || t === 'neblina') return { topo: [214, 220, 234], base: [150, 162, 186] };
    if (t === 'chuva') return { topo: [140, 152, 178], base: [70, 84, 112] };
    if (t === 'chuva-forte') return { topo: [110, 120, 150], base: [44, 54, 82] };
    return { topo: [92, 84, 130], base: [30, 24, 58] }; // tempestade
  }

  _criarNuvens() {
    if (!this.W) return;
    const qtd = Math.round((this.economia ? 5 : 9) * (0.3 + (this.estado.nuvens ?? 0.8)) * Math.min(1.6, this.W / 1000));
    const cor = this._corNuvem();
    this.nuvens = Array.from({ length: Math.max(1, qtd) }, (_, i) => {
      const larg = rnd(380, 820) * (this.W < 700 ? 0.65 : 1);
      const camada = i % 3;
      return {
        img: this._spriteNuvem(Math.round(larg), cor),
        x: rnd(-larg, this.W),
        y: rnd(-larg * 0.15, this.H * (this.estado.tipo === 'sol' ? 0.45 : 0.55)),
        v: (0.4 + camada * 0.35) * rnd(0.6, 1.2),
        a: this.estado.tipo === 'sol' ? rnd(0.7, 1) : rnd(0.8, 1),
        larg,
      };
    });
  }

  _criarGotas() {
    if (!this.W) return;
    const i = this.estado.intensidade || 0;
    const base = (this.W * this.H) / (this.economia ? 9000 : 4500);
    const qtd = Math.round(Math.min(this.economia ? 160 : 420, base * i));
    this.gotas = Array.from({ length: qtd }, () => this._novaGota(true));
  }

  _novaGota(espalhar) {
    const gr = this.estado.granizo && Math.random() < 0.35;
    return {
      x: rnd(-60, this.W + 60),
      y: espalhar ? rnd(-this.H, this.H) : rnd(-80, -10),
      v: gr ? rnd(13, 18) : rnd(9, 15) * (0.7 + (this.estado.intensidade || 0) * 0.5),
      c: rnd(12, 26) * (0.6 + (this.estado.intensidade || 0) * 0.6),
      a: rnd(0.25, 0.6),
      gr,
    };
  }

  _criarEstrelas() {
    if (!this.W) return;
    if (this.estado.tipo !== 'noite') { this.estrelas = []; return; }
    const qtd = Math.round((this.W * this.H) / 6000);
    this.estrelas = Array.from({ length: Math.min(260, qtd) }, () => ({
      x: rnd(0, this.W), y: rnd(0, this.H * 0.75), r: rnd(0.4, 1.5), f: rnd(0, Math.PI * 2), v: rnd(0.6, 1.8),
    }));
  }

  // ------------------------------------------------------------ desenho
  _loop(agora) {
    if (!this.rodando) return;
    const dt = Math.min(0.05, (agora - this.ultimo) / 1000);
    this.ultimo = agora;
    this._passo(dt, agora);
    this._desenhar(agora);
    requestAnimationFrame(this._loop);
  }

  _quadroUnico() {
    if (!this.W) return;
    this.paleta = this.paletaAlvo.map((c) => [...c]);
    this._desenhar(performance.now());
  }

  _passo(dt, agora) {
    const k = Math.min(1, dt * 1.6);
    this.paleta = this.paleta.map((c, i) => lerpCor(c, this.paletaAlvo[i], k));
    const vento = (this.estado.vento || 12) / 12;
    for (const n of this.nuvens) {
      n.x += n.v * vento * dt * 18;
      if (n.x > this.W + 40) { n.x = -n.larg - rnd(0, 200); n.y = rnd(-n.larg * 0.15, this.H * 0.5); }
    }
    const incl = Math.min(0.45, 0.12 + (this.estado.vento || 12) / 120);
    for (const g of this.gotas) {
      g.y += g.v * dt * 60;
      g.x += g.v * incl * dt * 60;
      if (g.y > this.H + 20 || g.x > this.W + 80) Object.assign(g, this._novaGota(false));
    }
    if (this.estado.tipo === 'tempestade') {
      if (agora > this.proxRaio) {
        this.flash = 0.55;
        this.raio = this._gerarRaio();
        this.raioFim = agora + 220;
        // nunca mais do que um clarão a cada 4 s (segurança para fotossensibilidade)
        this.proxRaio = agora + rnd(4500, 11000);
      }
      this.flash = Math.max(0, this.flash - dt * 2.2);
      if (this.raio && agora > this.raioFim) this.raio = null;
    } else { this.flash = 0; this.raio = null; }
  }

  _gerarRaio() {
    let x = rnd(this.W * 0.15, this.W * 0.85);
    let y = 0;
    const pts = [[x, y]];
    while (y < this.H * rnd(0.45, 0.75)) {
      x += rnd(-38, 38);
      y += rnd(18, 42);
      pts.push([x, y]);
    }
    return pts;
  }

  _desenhar(agora) {
    const { ctx, W, H } = this;
    const [c0, c1, c2] = this.paleta;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, rgb(c0));
    g.addColorStop(0.55, rgb(c1));
    g.addColorStop(1, rgb(c2));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const t = (agora - this.t0) / 1000;
    const tipo = this.estado.tipo;

    if (tipo === 'sol') this._sol(t);
    if (tipo === 'noite') this._noite(t);

    for (const n of this.nuvens) {
      ctx.globalAlpha = n.a;
      ctx.drawImage(n.img, n.x, n.y, n.larg, n.larg * 0.5);
    }
    ctx.globalAlpha = 1;

    if (tipo === 'neblina') this._neblina(t);

    if (this.gotas.length) {
      const incl = Math.min(0.45, 0.12 + (this.estado.vento || 12) / 120);
      ctx.lineCap = 'round';
      for (const d of this.gotas) {
        if (d.gr) {
          ctx.fillStyle = `rgba(240,246,255,${d.a + 0.25})`;
          ctx.beginPath(); ctx.arc(d.x, d.y, 2.2, 0, Math.PI * 2); ctx.fill();
        } else {
          ctx.strokeStyle = `rgba(210,226,255,${d.a})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - d.c * incl, d.y - d.c); ctx.stroke();
        }
      }
    }

    if (this.raio) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.shadowColor = 'rgba(200,190,255,0.9)';
      ctx.shadowBlur = 18;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      this.raio.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.restore();
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(225,220,255,${this.flash * 0.45})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _sol(t) {
    const { ctx, W } = this;
    const x = W * (W < 700 ? 0.82 : 0.78);
    const y = W < 700 ? 120 : 170;
    const brilho = ctx.createRadialGradient(x, y, 0, x, y, Math.max(W, 900) * 0.5);
    brilho.addColorStop(0, 'rgba(255,240,190,0.85)');
    brilho.addColorStop(0.12, 'rgba(255,214,120,0.45)');
    brilho.addColorStop(0.4, 'rgba(255,200,120,0.12)');
    brilho.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(0, 0, W, this.H);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.03);
    ctx.fillStyle = 'rgba(255,236,170,0.06)';
    for (let i = 0; i < 12; i++) {
      ctx.rotate(Math.PI / 6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-34, 700); ctx.lineTo(34, 700); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,248,220,0.95)';
    ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
  }

  _noite(t) {
    const { ctx, W } = this;
    for (const e of this.estrelas) {
      const a = 0.45 + 0.45 * Math.sin(e.f + t * e.v);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
    }
    const x = W * 0.8, y = W < 700 ? 130 : 170;
    const halo = ctx.createRadialGradient(x, y, 10, x, y, 220);
    halo.addColorStop(0, 'rgba(220,225,255,0.35)');
    halo.addColorStop(1, 'rgba(220,225,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(x - 220, y - 220, 440, 440);
    ctx.fillStyle = '#EEF0FF';
    ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = rgb(this.paleta[0]);
    ctx.beginPath(); ctx.arc(x + 15, y - 10, 30, 0, Math.PI * 2); ctx.fill();
  }

  _neblina(t) {
    const { ctx, W, H } = this;
    for (let i = 0; i < 4; i++) {
      const y = H * (0.35 + i * 0.16);
      const desl = Math.sin(t * 0.08 + i) * 80;
      const g = ctx.createLinearGradient(0, y - 60, 0, y + 60);
      g.addColorStop(0, 'rgba(235,238,245,0)');
      g.addColorStop(0.5, `rgba(235,238,245,${0.22 + i * 0.05})`);
      g.addColorStop(1, 'rgba(235,238,245,0)');
      ctx.fillStyle = g;
      ctx.fillRect(-100 + desl, y - 60, W + 200, 120);
    }
  }
}
