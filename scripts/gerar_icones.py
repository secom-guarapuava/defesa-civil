"""Gera o conjunto de ícones de tempo (SVG) usados no site, nas artes e no boletim.

Uso: python scripts/gerar_icones.py
Saída: assets/icons/*.svg e scripts/recursos/icones/*.png (para o PDF do boletim).
Só precisa rodar de novo se você alterar o desenho dos ícones.
"""
import os
import shutil
import subprocess

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST_SVG = os.path.join(RAIZ, "assets", "icons")
DEST_PNG = os.path.join(RAIZ, "scripts", "recursos", "icones")

DEFS = """<defs>
<radialGradient id="sol" cx="40%" cy="38%" r="70%"><stop offset="0" stop-color="#FFE680"/><stop offset="1" stop-color="#FFB21E"/></radialGradient>
<linearGradient id="lua" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#C9C6F2"/></linearGradient>
<linearGradient id="nb" gradientUnits="userSpaceOnUse" x1="0" y1="18" x2="0" y2="52"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#D3DAEB"/></linearGradient>
<linearGradient id="ng" gradientUnits="userSpaceOnUse" x1="0" y1="14" x2="0" y2="50"><stop offset="0" stop-color="#C3CBDD"/><stop offset="1" stop-color="#8E99B5"/></linearGradient>
<linearGradient id="ne" gradientUnits="userSpaceOnUse" x1="0" y1="10" x2="0" y2="44"><stop offset="0" stop-color="#8C96B3"/><stop offset="1" stop-color="#4F5878"/></linearGradient>
<linearGradient id="raio" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE14D"/><stop offset="1" stop-color="#FFA90A"/></linearGradient>
</defs>"""


def nuvem(x, y, s=1.0, fill="url(#nb)"):
    """Nuvem em coordenadas locais ~ 40x26, posicionada em (x, y) com escala s."""
    formas = (
        '<circle cx="12" cy="15" r="9"/>'
        '<circle cx="23" cy="10" r="11.5"/>'
        '<circle cx="33" cy="16" r="8"/>'
        '<rect x="3" y="14" width="38" height="11" rx="5.5"/>'
    )
    # contorno discreto por trás (fica visível em fundo claro, some no escuro)
    contorno = f'<g fill="#C2CADF" stroke="#C2CADF" stroke-width="{2.4 / s:.2f}">{formas}</g>'
    return f'<g transform="translate({x} {y}) scale({s})">{contorno}<g fill="{fill}">{formas}</g></g>'



def raios_sol(cx, cy, r1, r2, w=3.6):
    import math
    out = []
    for i in range(8):
        a = math.radians(i * 45)
        x1, y1 = cx + r1 * math.cos(a), cy + r1 * math.sin(a)
        x2, y2 = cx + r2 * math.cos(a), cy + r2 * math.sin(a)
        out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')
    return f'<g stroke="#FFB21E" stroke-width="{w}" stroke-linecap="round">' + "".join(out) + "</g>"


def lua(cx, cy, r):
    return (
        f'<mask id="mlua"><rect width="64" height="64" fill="#fff"/>'
        f'<circle cx="{cx + r * 0.62:.1f}" cy="{cy - r * 0.45:.1f}" r="{r * 0.82:.1f}" fill="#000"/></mask>'
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="url(#lua)" stroke="#B3ADE6" stroke-width="1.6" mask="url(#mlua)"/>'
    )


def gotas(pontos, cor="#3D8CF5", comp=8, w=3.4):
    linhas = "".join(
        f'<line x1="{x}" y1="{y}" x2="{x - comp * 0.38:.1f}" y2="{y + comp}"/>' for x, y in pontos
    )
    return f'<g stroke="{cor}" stroke-width="{w}" stroke-linecap="round">{linhas}</g>'


def raio(x, y, s=1.0):
    return (
        f'<path transform="translate({x} {y}) scale({s})" d="M9 0 L0 13 H7 L3 25 L16 9 H9 L13 0 Z" '
        'fill="url(#raio)" stroke="#E08600" stroke-width="1.2" stroke-linejoin="round"/>'
    )


ICONES = {
    "sol": DEFS + raios_sol(32, 32, 17.5, 25) + '<circle cx="32" cy="32" r="12.5" fill="url(#sol)"/>',
    "lua": DEFS + lua(30, 33, 17)
    + '<g fill="#FFFFFF"><circle cx="48" cy="40" r="1.6"/><circle cx="44" cy="50" r="1.1"/><circle cx="52" cy="28" r="1.2"/></g>',
    "sol-nuvem": DEFS + raios_sol(24, 23, 13, 18.5, 3.2) + '<circle cx="24" cy="23" r="9.5" fill="url(#sol)"/>'
    + nuvem(18, 24, 1.05),
    "lua-nuvem": DEFS + lua(24, 24, 13) + nuvem(18, 25, 1.05),
    "nublado": DEFS + nuvem(20, 11, 0.95, "url(#ng)") + nuvem(6, 22, 1.12),
    "neblina": DEFS + nuvem(12, 8, 1.0, "url(#ng)")
    + '<g stroke="#AEB7CF" stroke-width="3.6" stroke-linecap="round">'
    '<line x1="10" y1="41" x2="54" y2="41"/><line x1="16" y1="49" x2="48" y2="49"/><line x1="22" y1="57" x2="44" y2="57"/></g>',
    "garoa": DEFS + nuvem(12, 10, 1.0)
    + '<g fill="#3D8CF5"><circle cx="22" cy="46" r="2.2"/><circle cx="32" cy="50" r="2.2"/><circle cx="42" cy="46" r="2.2"/><circle cx="27" cy="57" r="2"/><circle cx="37" cy="57" r="2"/></g>',
    "chuva": DEFS + nuvem(12, 8, 1.0, "url(#ng)") + gotas([(22, 42), (32, 45), (42, 42)], comp=9),
    "chuva-forte": DEFS + nuvem(12, 6, 1.0, "url(#ne)")
    + gotas([(18, 40), (26, 44), (34, 40), (42, 44), (50, 40)], cor="#2F7CF0", comp=12, w=3.2),
    "tempestade": DEFS + nuvem(12, 6, 1.0, "url(#ne)") + gotas([(20, 42), (46, 42)], cor="#2F7CF0", comp=9)
    + raio(26, 33, 1.05),
    "granizo": DEFS + nuvem(12, 6, 1.0, "url(#ne)")
    + '<g fill="#FFFFFF" stroke="#7FB2FF" stroke-width="1.6">'
    '<circle cx="20" cy="45" r="3.4"/><circle cx="32" cy="49" r="3.4"/><circle cx="44" cy="45" r="3.4"/>'
    '<circle cx="26" cy="57" r="3"/><circle cx="38" cy="57" r="3"/></g>',
    "vento": DEFS
    + '<g fill="none" stroke="#5B8DEF" stroke-width="4" stroke-linecap="round">'
    '<path d="M8 24 H38 a7 7 0 1 0 -7 -7"/><path d="M8 34 H48 a7 7 0 1 1 -7 7"/><path d="M8 44 H28"/></g>',
    "raio": DEFS + raio(18, 6, 2.0),
    "alagamento": DEFS
    + '<path d="M14 30 L32 15 L50 30 V40 H14 Z" fill="#E7EAF5" stroke="#8E99B5" stroke-width="2.4" stroke-linejoin="round"/>'
    '<rect x="27" y="29" width="10" height="11" fill="#8E99B5"/>'
    '<g fill="none" stroke="#2F7CF0" stroke-width="3.6" stroke-linecap="round">'
    '<path d="M6 44 q6.5 -5 13 0 t13 0 t13 0 t13 0"/><path d="M6 53 q6.5 -5 13 0 t13 0 t13 0 t13 0"/></g>',
}


def main():
    os.makedirs(DEST_SVG, exist_ok=True)
    os.makedirs(DEST_PNG, exist_ok=True)
    tem_rsvg = shutil.which("rsvg-convert") is not None
    for nome, corpo in ICONES.items():
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
            + corpo
            + "</svg>"
        )
        caminho = os.path.join(DEST_SVG, f"{nome}.svg")
        with open(caminho, "w", encoding="utf-8") as f:
            f.write(svg)
        if tem_rsvg:
            subprocess.run(
                ["rsvg-convert", "-w", "256", "-h", "256", caminho, "-o", os.path.join(DEST_PNG, f"{nome}.png")],
                check=True,
            )
    print(f"{len(ICONES)} ícones gerados.")


if __name__ == "__main__":
    main()
