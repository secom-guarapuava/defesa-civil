"""Gera data/boletim-guarapuava.pdf a partir de data/clima.json e data/alerta.json.

É chamado automaticamente por atualizar_dados.py. Para rodar sozinho:
    python scripts/gerar_boletim.py
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timedelta, timezone

from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
REC = os.path.join(AQUI, "recursos")
SAIDA = os.path.join(RAIZ, "data", "boletim-guarapuava.pdf")
TZ = timezone(timedelta(hours=-3))

CANAL_WHATSAPP = "https://whatsapp.com/channel/0029Vb8W13N0G0XZkOXPLw2s"

# Paleta
INDIGO = HexColor("#24189A")
INDIGO_ESC = HexColor("#150E5C")
TINTA = HexColor("#1A1640")
CINZA = HexColor("#5B5878")
LINHA = HexColor("#E2E1EF")
FUNDO = HexColor("#F3F3FA")
CHUVA = HexColor("#2F6FE0")

NIVEIS = {
    "baixo": {"nome": "Risco baixo", "cor": "#17834A", "texto": "#FFFFFF", "faixa": "Verde"},
    "moderado": {"nome": "Risco moderado", "cor": "#F7C600", "texto": "#1A1640", "faixa": "Amarelo"},
    "alto": {"nome": "Risco alto", "cor": "#F27405", "texto": "#1A1640", "faixa": "Laranja"},
    "muito-alto": {"nome": "Risco muito alto", "cor": "#D11E2D", "texto": "#FFFFFF", "faixa": "Vermelho"},
}

ESCALA = [
    ("baixo", "Condições meteorológicas com baixo potencial de danos. Pancadas de chuva, temporais isolados, alagamentos pontuais."),
    ("moderado", "Observação: ocorrências com potencial para provocar danos e interromper algumas atividades. Temporais isolados com rajadas de vento, granizo pontual, chuva intensa, alagamentos e enxurradas pontuais."),
    ("alto", "Atenção: alto potencial de danos e transtornos, com possível interrupção de serviços. Tempestades pontualmente severas, intensas rajadas de vento, granizo, chuva forte em curto espaço de tempo, enxurradas e alagamentos."),
    ("muito-alto", "Alerta: grande probabilidade de danos severos e riscos à integridade física. Fortes impactos na infraestrutura e serviços públicos. Tempestades excepcionalmente severas, granizo destrutivo, microexplosões e tornados, chuva torrencial, inundações e enxurradas."),
]

DIAS_SEMANA = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
DIAS_CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]

ICONE_DE = {
    ("limpo", True): "sol", ("limpo", False): "lua",
    ("poucas-nuvens", True): "sol-nuvem", ("poucas-nuvens", False): "lua-nuvem",
    "nublado": "nublado", "neblina": "neblina", "garoa": "garoa", "chuva": "chuva",
    "chuva-forte": "chuva-forte", "tempestade": "tempestade", "granizo": "granizo",
}

_fontes_ok = False


def registrar_fontes():
    global _fontes_ok
    if _fontes_ok:
        return
    pasta = os.path.join(REC, "fontes")
    for nome, arq in [
        ("Display", "Saira-SemiCondExtraBold.ttf"),
        ("DisplayBold", "Saira-SemiCondBold.ttf"),
        ("DisplayCond", "Saira-CondBlack.ttf"),
        ("Medium", "Saira-Medium.ttf"),
        ("Texto", "Atkinson-Regular.ttf"),
        ("TextoBold", "Atkinson-Bold.ttf"),
    ]:
        pdfmetrics.registerFont(TTFont(nome, os.path.join(pasta, arq)))
    pdfmetrics.registerFontFamily("Texto", normal="Texto", bold="TextoBold", italic="Texto", boldItalic="TextoBold")
    _fontes_ok = True


def icone(cond: str, dia: bool = True) -> str:
    nome = ICONE_DE.get((cond, dia)) or ICONE_DE.get(cond) or "nublado"
    return os.path.join(REC, "icones", f"{nome}.png")


def dt(s):
    if not s:
        return None
    d = datetime.fromisoformat(s)
    return d if d.tzinfo else d.replace(tzinfo=TZ)


def fmt_num(v, casas=0, sufixo=""):
    if v is None:
        return "–"
    if casas == 0:
        return f"{round(float(v)):d}{sufixo}"
    return f"{float(v):.{casas}f}".replace(".", ",") + sufixo


def fmt_data_hora(d: datetime) -> str:
    return d.strftime("%d/%m/%Y às %Hh%M")


def fmt_quando(d: datetime) -> str:
    return f"{DIAS_CURTOS[d.weekday()]} {d.strftime('%d/%m')} às {d.strftime('%Hh%M').replace('h00', 'h')}"


def fmt_vigencia(ini: datetime, fim: datetime) -> str:
    """Dias inteiros (00h00 a 23h59) aparecem como nos boletins do SIMEPAR: "de sex 06/11 a sáb 07/11"."""
    if ini.strftime("%H:%M") == "00:00" and fim.strftime("%H:%M") == "23:59":
        a = f"{DIAS_CURTOS[ini.weekday()]} {ini.strftime('%d/%m')}"
        b = f"{DIAS_CURTOS[fim.weekday()]} {fim.strftime('%d/%m')}"
        return f"{a} (o dia todo)" if ini.date() == fim.date() else f"de {a} a {b}"
    return f"{fmt_quando(ini)} até {fmt_quando(fim)}"


def alerta_vigente(alerta: dict, agora: datetime):
    if not alerta or not alerta.get("ativo"):
        return None
    fim = dt(alerta.get("fim"))
    if fim and fim < agora:
        return None
    if alerta.get("nivel") not in NIVEIS:
        return None
    return alerta


def estilo(nome, fonte="Texto", tam=9.5, cor=TINTA, entre=1.32, **kw):
    return ParagraphStyle(nome, fontName=fonte, fontSize=tam, leading=tam * entre, textColor=cor, alignment=TA_LEFT, **kw)


def paragrafo(c, texto, x, y_topo, largura, st):
    p = Paragraph(texto, st)
    _, h = p.wrap(largura, 1000)
    p.drawOn(c, x, y_topo - h)
    return h


def rodape(c, pagina, gerado):
    W, _ = A4
    c.setStrokeColor(LINHA)
    c.setLineWidth(0.6)
    c.line(18 * mm, 16 * mm, W - 18 * mm, 16 * mm)
    c.setFont("Texto", 7.5)
    c.setFillColor(CINZA)
    c.drawString(18 * mm, 11.5 * mm, f"Defesa Civil de Guarapuava  |  Gerado automaticamente em {fmt_data_hora(gerado)}")
    c.drawRightString(W - 18 * mm, 11.5 * mm, f"#DEFESACIVILSOMOSTODOSNÓS   {pagina}/2")


def cabecalho(c, gerado, dias):
    W, H = A4
    alt = 34 * mm
    c.setFillColor(INDIGO)
    c.rect(0, H - alt, W, alt, stroke=0, fill=1)
    # faixa laranja fina (identidade da Defesa Civil)
    c.setFillColor(HexColor("#E67817"))
    c.rect(0, H - alt - 1.6 * mm, W, 1.6 * mm, stroke=0, fill=1)
    logo = ImageReader(os.path.join(REC, "defesa-civil.png"))
    c.drawImage(logo, 16 * mm, H - alt + 5 * mm, 24 * mm, 24 * mm, mask="auto")
    c.setFillColor(white)
    c.setFont("Display", 21)
    c.drawString(45 * mm, H - 16 * mm, "Boletim do tempo — Guarapuava")
    c.setFont("Medium", 10.5)
    c.setFillColor(HexColor("#D9D6FF"))
    c.drawString(45 * mm, H - 22.5 * mm, "Defesa Civil de Guarapuava  ·  Paraná")
    if dias:
        d0, d1 = dt(dias[0]["data"] + "T00:00"), dt(dias[-1]["data"] + "T00:00")
        c.drawString(45 * mm, H - 28 * mm, f"Previsão de {d0.strftime('%d/%m')} a {d1.strftime('%d/%m/%Y')}")
    c.setFont("TextoBold", 8.5)
    c.setFillColor(white)
    c.drawRightString(W - 16 * mm, H - 12 * mm, "ATUALIZADO EM")
    c.setFont("Display", 12)
    c.drawRightString(W - 16 * mm, H - 18 * mm, gerado.strftime("%d/%m/%Y"))
    c.drawRightString(W - 16 * mm, H - 23.5 * mm, gerado.strftime("às %Hh%M"))
    return H - alt - 1.6 * mm


def bloco_alerta(c, y, alerta, avisos_inmet):
    W, _ = A4
    x, larg = 18 * mm, W - 36 * mm
    if alerta:
        n = NIVEIS[alerta["nivel"]]
        cor, cor_txt = HexColor(n["cor"]), HexColor(n["texto"])
        # mede o conteúdo antes de desenhar a caixa
        st_tit = estilo("tit", "Display", 17, cor_txt, 1.05)
        st_txt = estilo("txt", "Texto", 9.6, cor_txt, 1.35)
        st_dia = estilo("dia", "TextoBold", 9.6, cor_txt, 1.35)
        partes = [("tit", alerta.get("titulo", "").upper(), st_tit)]
        if alerta.get("resumo"):
            partes.append(("txt", alerta["resumo"], st_txt))
        for d in alerta.get("dias", []) or []:
            partes.append(("dia", d.get("rotulo", ""), st_dia))
            partes.append(("txt", d.get("texto", ""), st_txt))
        if alerta.get("impactos"):
            partes.append(("txt", "<b>Podem ocorrer:</b> " + ", ".join(alerta["impactos"]) + ".", st_txt))
        alturas = [Paragraph(t, s).wrap(larg - 12 * mm, 1000)[1] for _, t, s in partes]
        h_total = 16 * mm + sum(alturas) + 2.2 * mm * len(partes) + 8 * mm
        c.setFillColor(cor)
        c.roundRect(x, y - h_total, larg, h_total, 4 * mm, stroke=0, fill=1)
        c.setFillColor(cor_txt)
        c.setFont("TextoBold", 8.5)
        ini, fim = dt(alerta.get("inicio")), dt(alerta.get("fim"))
        c.drawString(x + 6 * mm, y - 8 * mm, f"ALERTA {n['faixa'].upper()}  ·  {n['nome'].upper()}")
        if ini and fim:
            c.drawRightString(x + larg - 6 * mm, y - 8 * mm, f"Vigência: {fmt_vigencia(ini, fim)}")
        yy = y - 13 * mm
        for (tipo, t, s), h in zip(partes, alturas):
            paragrafo(c, t, x + 6 * mm, yy, larg - 12 * mm, s)
            yy -= h + 2.2 * mm
        c.setFont("Texto", 7.8)
        fonte = alerta.get("fonte") or "Defesa Civil de Guarapuava"
        c.drawString(x + 6 * mm, y - h_total + 4.5 * mm, f"Fonte: {fonte}"[:140])
        return y - h_total - 6 * mm

    # sem alerta da Defesa Civil: mostra aviso do INMET, se houver, ou status tranquilo
    if avisos_inmet:
        a = sorted(avisos_inmet, key=lambda v: list(NIVEIS).index(v.get("nivel", "baixo")))[-1]
        n = NIVEIS.get(a.get("nivel"), NIVEIS["moderado"])
        h = 24 * mm
        c.setFillColor(FUNDO)
        c.roundRect(x, y - h, larg, h, 4 * mm, stroke=0, fill=1)
        c.setFillColor(HexColor(n["cor"]))
        c.roundRect(x, y - h, 4 * mm, h, 2 * mm, stroke=0, fill=1)
        c.setFillColor(TINTA)
        c.setFont("TextoBold", 8.5)
        c.drawString(x + 9 * mm, y - 8 * mm, f"AVISO METEOROLÓGICO DO INMET  ·  {a.get('severidade', '').upper()}")
        c.setFont("Display", 15)
        c.drawString(x + 9 * mm, y - 15 * mm, a.get("evento", "Aviso meteorológico"))
        ini, fim = dt(a.get("inicio")), dt(a.get("fim"))
        c.setFont("Texto", 9)
        if ini and fim:
            c.drawString(x + 9 * mm, y - 20.5 * mm, f"Vigência: {fmt_vigencia(ini, fim)}  ·  {a.get('link', '')}")
        return y - h - 6 * mm

    h = 17 * mm
    c.setFillColor(FUNDO)
    c.roundRect(x, y - h, larg, h, 4 * mm, stroke=0, fill=1)
    c.setFillColor(TINTA)
    c.setFont("Display", 14)
    c.drawString(x + 7 * mm, y - 8 * mm, "Sem alerta vigente para Guarapuava")
    c.setFont("Texto", 9)
    c.setFillColor(CINZA)
    c.drawString(x + 7 * mm, y - 13 * mm, "Acompanhe as atualizações: o tempo pode mudar rápido nesta época do ano.")
    return y - h - 6 * mm


def titulo_secao(c, y, texto):
    c.setFillColor(TINTA)
    c.setFont("Display", 13)
    c.drawString(18 * mm, y, texto)
    return y - 5 * mm


def bloco_agora(c, y, d):
    W, _ = A4
    a = d.get("atual") or {}
    if not a:
        return y
    y = titulo_secao(c, y, "Agora em Guarapuava")
    x = 18 * mm
    c.drawImage(ImageReader(icone(a.get("condicao", "nublado"), a.get("dia", True))), x, y - 22 * mm, 22 * mm, 22 * mm, mask="auto")
    c.setFillColor(TINTA)
    c.setFont("DisplayCond", 40)
    c.drawString(x + 25 * mm, y - 17 * mm, fmt_num(a.get("temp"), 0, "°"))
    c.setFont("DisplayBold", 12)
    c.drawString(x + 25 * mm, y - 22.5 * mm, a.get("descricao") or "")
    itens = [
        ("Sensação", fmt_num(a.get("sensacao"), 0, "°C")),
        ("Umidade", fmt_num(a.get("umidade"), 0, "%")),
        ("Vento", f"{fmt_num(a.get('vento'), 0, ' km/h')} {a.get('vento_dir') or ''}".strip()),
        ("Rajadas", fmt_num(a.get("rajada"), 0, " km/h")),
        ("Chuva 24 h", fmt_num(d.get("chuva_24h_mm"), 1, " mm")),
    ]
    xx = x + 78 * mm
    larg = (W - 18 * mm - xx) / 3
    for k, (rot, val) in enumerate(itens):
        cx = xx + (k % 3) * larg
        cy = y - 6 * mm - (k // 3) * 11 * mm
        c.setFont("Texto", 8)
        c.setFillColor(CINZA)
        c.drawString(cx, cy, rot)
        c.setFont("DisplayBold", 12.5)
        c.setFillColor(TINTA)
        c.drawString(cx, cy - 5 * mm, val)
    return y - 32 * mm


def bloco_dias(c, y, dias):
    W, _ = A4
    dias = dias[:5]
    if not dias:
        return y
    y = titulo_secao(c, y, "Próximos dias")
    x0, larg_total = 18 * mm, W - 36 * mm
    gap = 3 * mm
    larg = (larg_total - gap * (len(dias) - 1)) / len(dias)
    h = 56 * mm
    hoje = datetime.now(TZ).date().isoformat()
    for k, d in enumerate(dias):
        x = x0 + k * (larg + gap)
        c.setFillColor(FUNDO)
        c.roundRect(x, y - h, larg, h, 3 * mm, stroke=0, fill=1)
        data = dt(d["data"] + "T12:00")
        nome = "Hoje" if d["data"] == hoje else DIAS_SEMANA[data.weekday()].split("-")[0].capitalize()
        c.setFillColor(TINTA)
        c.setFont("DisplayBold", 11)
        c.drawCentredString(x + larg / 2, y - 7 * mm, nome)
        c.setFont("Texto", 8)
        c.setFillColor(CINZA)
        c.drawCentredString(x + larg / 2, y - 11 * mm, data.strftime("%d/%m"))
        c.drawImage(ImageReader(icone(d.get("condicao", "nublado"), True)), x + larg / 2 - 8 * mm, y - 29 * mm, 16 * mm, 16 * mm, mask="auto")
        c.setFillColor(TINTA)
        c.setFont("Display", 13)
        c.drawCentredString(x + larg / 2, y - 35 * mm, f"{fmt_num(d.get('max'), 0, '°')}  ")
        c.setFont("DisplayBold", 11)
        c.setFillColor(CINZA)
        c.drawCentredString(x + larg / 2 + 9 * mm, y - 35 * mm, fmt_num(d.get("min"), 0, "°"))
        c.setFillColor(TINTA)
        desc = (d.get("descricao") or "")[:26]
        c.setFont("Texto", 7.6)
        c.drawCentredString(x + larg / 2, y - 40 * mm, desc)
        c.setFillColor(CHUVA)
        c.setFont("TextoBold", 8.6)
        c.drawCentredString(x + larg / 2, y - 46 * mm, f"Chuva {fmt_num(d.get('chuva_mm'), 0, ' mm')} · {fmt_num(d.get('prob'), 0, '%')}")
        c.setFillColor(CINZA)
        c.setFont("Texto", 7.8)
        if d.get("rajada") is not None:
            c.drawCentredString(x + larg / 2, y - 51 * mm, f"Rajadas até {fmt_num(d.get('rajada'), 0, ' km/h')}")
        elif d.get("vento") is not None:
            c.drawCentredString(x + larg / 2, y - 51 * mm, f"Vento {fmt_num(d.get('vento'), 0, ' km/h')}")
    return y - h - 7 * mm


def bloco_chuva_horas(c, y, horas):
    W, _ = A4
    horas = horas[:24]
    if not horas:
        return y
    alt = min(30 * mm, y - 58 * mm)
    if alt < 14 * mm:
        return y
    y = titulo_secao(c, y, "Chuva prevista hora a hora (mm) — próximas 24 horas")
    x0, larg = 26 * mm, W - 44 * mm
    base = y - alt - 4 * mm
    maximo = max(4.0, max((h.get("chuva_mm") or 0) for h in horas))
    passo = 2 if maximo <= 8 else 5 if maximo <= 25 else 10
    topo = passo * (int(maximo / passo) + 1)
    c.setFont("Texto", 7)
    for v in range(0, int(topo) + 1, passo):
        yy = base + alt * v / topo
        c.setStrokeColor(LINHA)
        c.setLineWidth(0.4)
        c.line(x0, yy, x0 + larg, yy)
        c.setFillColor(CINZA)
        c.drawRightString(x0 - 2 * mm, yy - 1, f"{v}")
    bw = larg / len(horas)
    for k, h in enumerate(horas):
        v = h.get("chuva_mm") or 0
        hh = alt * v / topo
        x = x0 + k * bw + 0.5 * mm
        if hh > 0.3:
            c.setFillColor(CHUVA)
            c.roundRect(x, base, bw - 1 * mm, hh, 0.8 * mm, stroke=0, fill=1)
        if k % 3 == 0:
            c.setFillColor(CINZA)
            c.setFont("Texto", 7)
            c.drawCentredString(x + (bw - 1 * mm) / 2, base - 3.5 * mm, dt(h["t"]).strftime("%Hh"))
    return base - 11 * mm


def pagina_2(c, y):
    W, _ = A4
    x, larg = 18 * mm, W - 36 * mm
    y = titulo_secao(c, y, "Como ler os níveis de risco")
    st = estilo("esc", "Texto", 8.8, TINTA, 1.32)
    for chave, texto in ESCALA:
        n = NIVEIS[chave]
        p = Paragraph(texto, st)
        _, h = p.wrap(larg - 46 * mm, 500)
        h_lin = max(h + 4 * mm, 11 * mm)
        c.setFillColor(HexColor(n["cor"]))
        c.roundRect(x, y - h_lin + 1 * mm, 40 * mm, h_lin - 2 * mm, 2 * mm, stroke=0, fill=1)
        c.setFillColor(HexColor(n["texto"]))
        c.setFont("DisplayBold", 10)
        c.drawString(x + 3 * mm, y - h_lin / 2 + 0.5 * mm, n["nome"])
        c.setFont("Texto", 7.5)
        c.drawString(x + 3 * mm, y - h_lin / 2 - 3.2 * mm, n["faixa"])
        p.drawOn(c, x + 44 * mm, y - (h_lin + h) / 2 + 0.4 * mm)
        y -= h_lin + 1 * mm
    c.setFont("Texto", 7.4)
    c.setFillColor(CINZA)
    c.drawString(x, y - 1 * mm, "Escala de avaliação de risco meteorológico usada nos boletins da Defesa Civil do Paraná e do SIMEPAR.")
    y -= 10 * mm

    y = titulo_secao(c, y, "O que fazer em caso de tempestade")
    col = (larg - 8 * mm) / 2
    st_t = estilo("ot", "TextoBold", 9.5, TINTA, 1.3)
    st_i = estilo("oi", "Texto", 8.8, TINTA, 1.34, bulletIndent=0, leftIndent=8)
    blocos = [
        ("Durante temporais e vendavais", [
            "Fique em local abrigado e longe de janelas e portas de vidro.",
            "Não se abrigue sob árvores, placas, marquises ou redes elétricas.",
            "Desligue aparelhos elétricos da tomada e evite usar o chuveiro durante raios.",
            "Se estiver dirigindo, pare em local seguro, longe de árvores e postes.",
        ]),
        ("Alagamentos e enxurradas", [
            "Nunca atravesse ruas alagadas, nem a pé nem de carro: 15 cm de água em movimento podem derrubar um adulto.",
            "Mantenha distância de córregos, rios e bueiros.",
            "Desligue a energia da casa se a água começar a entrar.",
            "Evite contato com a água da enchente (risco de leptospirose).",
        ]),
        ("Depois da chuva", [
            "Não toque em fios caídos: avise a Copel pelo 0800 51 00 116.",
            "Observe rachaduras, árvores inclinadas e água barrenta minando do solo: são sinais de risco de deslizamento.",
            "Registre os danos e comunique a Defesa Civil.",
        ]),
        ("Prepare-se antes", [
            "Limpe calhas e ralos e recolha objetos soltos do quintal.",
            "Guarde documentos em saco plástico e tenha lanterna, rádio a pilha e água potável.",
            "Cadastre-se para receber alertas (veja abaixo).",
        ]),
    ]
    alturas = []
    for tit, itens in blocos:
        h = Paragraph(tit, st_t).wrap(col, 500)[1] + 2 * mm
        for i in itens:
            h += Paragraph(i, st_i, bulletText="•").wrap(col, 500)[1] + 1.2 * mm
        alturas.append(h)
    for linha in range(2):
        h_lin = max(alturas[linha * 2], alturas[linha * 2 + 1])
        for colk in range(2):
            tit, itens = blocos[linha * 2 + colk]
            xx = x + colk * (col + 8 * mm)
            yy = y
            yy -= paragrafo(c, tit, xx, yy, col, st_t) + 2 * mm
            for i in itens:
                p = Paragraph(i, st_i, bulletText="•")
                _, h = p.wrap(col, 500)
                p.drawOn(c, xx, yy - h)
                yy -= h + 1.2 * mm
        y -= h_lin + 5 * mm

    # Contatos
    y = titulo_secao(c, y, "Contatos de emergência")
    contatos = [
        ("193", "Corpo de Bombeiros"),
        ("199", "Defesa Civil"),
        ("(42) 98427-0618", "Defesa Civil Guarapuava · 24 h"),
        ("192", "SAMU"),
        ("190", "Polícia Militar"),
        ("0800 51 00 116", "Copel · fios caídos, sem luz"),
        ("0800 200 0115", "Sanepar · água e esgoto"),
    ]
    larg_c = (larg - 3 * 3 * mm) / 4
    for k, (num, nome) in enumerate(contatos):
        cx = x + (k % 4) * (larg_c + 3 * mm)
        cy = y - (k // 4) * 14 * mm
        c.setFillColor(FUNDO)
        c.roundRect(cx, cy - 12 * mm, larg_c, 12 * mm, 2.5 * mm, stroke=0, fill=1)
        c.setFillColor(INDIGO)
        c.setFont("Display", 13)
        c.drawString(cx + 3.5 * mm, cy - 6 * mm, num)
        c.setFillColor(CINZA)
        c.setFont("Texto", 6.9)
        c.drawString(cx + 3.5 * mm, cy - 10 * mm, nome[:44])
    y -= 2 * 14 * mm + 3 * mm

    # Receba alertas
    h = 24 * mm
    c.setFillColor(INDIGO)
    c.roundRect(x, y - h, larg, h, 4 * mm, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Display", 13)
    c.drawString(x + 6 * mm, y - 8 * mm, "Receba os alertas no celular")
    c.setFont("Texto", 9)
    c.drawString(x + 6 * mm, y - 13.5 * mm, "SMS: envie o seu CEP para 40199   ·   WhatsApp da Defesa Civil: mande “oi” para (61) 2034-4611")
    c.drawString(x + 6 * mm, y - 18.5 * mm, f"Canal da Defesa Civil de Guarapuava no WhatsApp: {CANAL_WHATSAPP.replace('https://', '')}")
    return y - h - 6 * mm


def gerar_boletim(dados: dict, alerta: dict | None = None, saida: str = SAIDA) -> str:
    if dados.get("exemplo"):
        raise ValueError("clima.json contém dados de exemplo; o boletim só é gerado com dados reais")
    registrar_fontes()
    agora = datetime.now(TZ)
    gerado = dt(dados.get("gerado_em")) or agora
    alerta = alerta_vigente(alerta or {}, agora)
    avisos = [a for a in dados.get("avisos_inmet", []) if not a.get("fim") or dt(a["fim"]) > agora]
    os.makedirs(os.path.dirname(saida), exist_ok=True)
    c = canvas.Canvas(saida, pagesize=A4)
    c.setTitle("Boletim do tempo — Guarapuava")
    c.setAuthor("Defesa Civil de Guarapuava")
    c.setSubject("Previsão do tempo e alertas para Guarapuava (PR)")

    y = cabecalho(c, gerado, dados.get("dias", [])[:5]) - 8 * mm
    y = bloco_alerta(c, y, alerta, avisos)
    y = bloco_agora(c, y, dados)
    y = bloco_dias(c, y, dados.get("dias", []))
    y = bloco_chuva_horas(c, y, dados.get("horas", []))
    # fontes
    f = dados.get("fontes", {})
    usadas = []
    if f.get("simepar", {}).get("ok"):
        usadas.append("SIMEPAR (simepar.br)")
    if f.get("openmeteo", {}).get("ok"):
        usadas.append("Open-Meteo (modelo numérico, complementar)")
    if f.get("inmet", {}).get("ok"):
        usadas.append("INMET (avisos)")
    st = estilo("fonte", "Texto", 7.6, CINZA, 1.35)
    paragrafo(
        c,
        "<b>Fontes:</b> " + "; ".join(usadas or ["SIMEPAR"]) + ". Alertas: Defesa Civil de Guarapuava. "
        "Documento informativo gerado automaticamente; em caso de divergência, prevalecem os boletins oficiais "
        "da Defesa Civil do Paraná e do SIMEPAR.",
        18 * mm, 31 * mm, A4[0] - 36 * mm, st,
    )
    rodape(c, 1, gerado)
    c.showPage()

    # página 2
    W, H = A4
    c.setFillColor(INDIGO)
    c.rect(0, H - 14 * mm, W, 14 * mm, stroke=0, fill=1)
    c.setFillColor(white)
    c.setFont("Display", 12)
    c.drawString(18 * mm, H - 9 * mm, "Boletim do tempo — Guarapuava")
    c.setFont("Texto", 8.5)
    c.drawRightString(W - 18 * mm, H - 9 * mm, f"Atualizado em {fmt_data_hora(gerado)}")
    pagina_2(c, H - 24 * mm)
    pref = ImageReader(os.path.join(REC, "prefeitura.png"))
    iw, ih = pref.getSize()
    lw = 70 * mm
    c.drawImage(pref, W - 18 * mm - lw, 20 * mm, lw, lw * ih / iw, mask="auto")
    c.drawImage(ImageReader(os.path.join(REC, "defesa-civil.png")), 18 * mm, 19 * mm, 16 * mm, 16 * mm, mask="auto")
    rodape(c, 2, gerado)
    c.save()
    return saida


if __name__ == "__main__":
    with open(os.path.join(RAIZ, "data", "clima.json"), encoding="utf-8") as f:
        d = json.load(f)
    al = {}
    p = os.path.join(RAIZ, "data", "alerta.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            al = json.load(f)
    print(gerar_boletim(d, al))
