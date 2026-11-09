"""Coleta o tempo de Guarapuava e grava data/clima.json (+ boletim em PDF).

Fontes, em ordem de prioridade:
  1. SIMEPAR  - previsão oficial por município (página forecast_by_counties/4109401)
  2. Open-Meteo - modelo numérico gratuito, completa o que faltar e serve de reserva
  3. INMET    - avisos meteorológicos ativos que incluem Guarapuava

Roda sozinho no GitHub Actions a cada 30 minutos (.github/workflows/atualizar.yml).
Para testar no computador:  pip install -r scripts/requirements.txt
                            python scripts/atualizar_dados.py
Nenhuma falha de uma fonte derruba o processo: o arquivo sempre é gravado com o que deu certo.
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import traceback
import xml.etree.ElementTree as ET
from datetime import date, datetime, timedelta, timezone

import requests

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ARQ_CLIMA = os.path.join(RAIZ, "data", "clima.json")
ARQ_ALERTA = os.path.join(RAIZ, "data", "alerta.json")

IBGE = 4109401
LAT, LON = -25.3902, -51.4623
TZ = timezone(timedelta(hours=-3))  # America/Sao_Paulo (sem horário de verão desde 2019)

URL_SIMEPAR = f"https://www.simepar.br/simepar/forecast_by_counties/{IBGE}"
URL_OPENMETEO = "https://api.open-meteo.com/v1/forecast"
URL_INMET_ATIVOS = "https://apiprevmet3.inmet.gov.br/avisos/ativos"
URL_INMET_RSS = "https://apiprevmet3.inmet.gov.br/avisos/rss"

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
TIMEOUT = 25


def agora() -> datetime:
    return datetime.now(TZ)


def iso(dt: datetime) -> str:
    return dt.astimezone(TZ).isoformat(timespec="minutes")


def log(*a):
    print("[clima]", *a, flush=True)


def num(txt, padrao=None):
    """Extrai o primeiro número de um texto ('23,5 °C' -> 23.5)."""
    if txt is None:
        return padrao
    if isinstance(txt, (int, float)):
        return float(txt)
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(txt))
    return float(m.group(0).replace(",", ".")) if m else padrao


# --------------------------------------------------------------------------------------
# Condição do tempo: tudo vira uma destas chaves
#   limpo | poucas-nuvens | nublado | neblina | garoa | chuva | chuva-forte | tempestade | granizo
# --------------------------------------------------------------------------------------
DESCRICAO_PADRAO = {
    "limpo": "Céu limpo",
    "poucas-nuvens": "Parcialmente nublado",
    "nublado": "Nublado",
    "neblina": "Neblina",
    "garoa": "Garoa",
    "chuva": "Chuva",
    "chuva-forte": "Chuva forte",
    "tempestade": "Tempestade",
    "granizo": "Tempestade com granizo",
}

WMO = {
    0: ("limpo", "Céu limpo"),
    1: ("poucas-nuvens", "Predomínio de sol"),
    2: ("poucas-nuvens", "Parcialmente nublado"),
    3: ("nublado", "Nublado"),
    45: ("neblina", "Neblina"),
    48: ("neblina", "Neblina com geada"),
    51: ("garoa", "Garoa fraca"),
    53: ("garoa", "Garoa"),
    55: ("garoa", "Garoa forte"),
    56: ("garoa", "Garoa congelante"),
    57: ("garoa", "Garoa congelante"),
    61: ("chuva", "Chuva fraca"),
    63: ("chuva", "Chuva moderada"),
    65: ("chuva-forte", "Chuva forte"),
    66: ("chuva", "Chuva congelante"),
    67: ("chuva-forte", "Chuva congelante forte"),
    71: ("nublado", "Neve fraca"),
    73: ("nublado", "Neve"),
    75: ("nublado", "Neve forte"),
    77: ("nublado", "Grãos de neve"),
    80: ("chuva", "Pancadas de chuva"),
    81: ("chuva", "Pancadas de chuva moderadas"),
    82: ("chuva-forte", "Pancadas de chuva forte"),
    85: ("nublado", "Pancadas de neve"),
    86: ("nublado", "Pancadas de neve"),
    95: ("tempestade", "Tempestade"),
    96: ("granizo", "Tempestade com granizo"),
    99: ("granizo", "Tempestade com granizo"),
}


def condicao_wmo(code):
    try:
        return WMO[int(code)]
    except (TypeError, ValueError, KeyError):
        return ("nublado", "Nublado")


def condicao_texto(icone: str = "", titulo: str = ""):
    """Converte o ícone (classe wi-*) e o título do SIMEPAR em uma chave de condição."""
    i = (icone or "").lower()
    t = (titulo or "").lower()
    alvo = f"{i} {t}"
    if "granizo" in alvo or "hail" in alvo:
        return "granizo"
    if any(k in alvo for k in ("thunder", "storm", "lightning", "tempestade", "trovoada", "temporal")):
        return "tempestade"
    if any(k in t for k in ("chuva forte", "chuva intensa", "chuvoso", "chuva volumosa")):
        return "chuva-forte"
    if any(k in alvo for k in ("sprinkle", "drizzle", "garoa", "chuvisco")):
        return "garoa"
    if any(k in alvo for k in ("rain", "shower", "chuva", "pancada")):
        return "chuva"
    if any(k in alvo for k in ("fog", "haze", "smog", "neblina", "nevoeiro", "névoa", "nevoa", "bruma")):
        return "neblina"
    if any(k in alvo for k in ("day-cloudy", "alt-cloudy", "partly", "parcial", "poucas nuvens", "sol entre", "variação")):
        return "poucas-nuvens"
    if any(k in alvo for k in ("cloud", "overcast", "nublado", "encoberto", "nuvens")):
        return "nublado"
    if any(k in alvo for k in ("sunny", "clear", "sol", "limpo", "claro")):
        return "limpo"
    return "nublado"


DIRECOES = ["N", "NE", "L", "SE", "S", "SO", "O", "NO"]


def direcao_graus(g):
    if g is None:
        return None
    return DIRECOES[int((float(g) % 360) / 45 + 0.5) % 8]


# --------------------------------------------------------------------------------------
# SIMEPAR
# --------------------------------------------------------------------------------------
def data_do_id(id_attr) -> date | None:
    n = num(re.sub(r"[^\d]", " ", str(id_attr or "")))
    if n is None:
        return None
    try:
        return datetime.fromtimestamp(int(n) + 10800, tz=timezone.utc).date()
    except (OverflowError, OSError, ValueError):
        return None


def buscar_simepar() -> dict:
    from bs4 import BeautifulSoup

    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9"})
    s.get("https://www.simepar.br/", timeout=TIMEOUT)
    r = s.get(
        URL_SIMEPAR,
        headers={"Referer": "https://www.simepar.br/", "X-Requested-With": "XMLHttpRequest"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    r.encoding = "utf-8"
    html = r.text
    soup = BeautifulSoup(html, "html.parser")
    resultado = {"atual": None, "horas": [], "dias": [], "avisos_texto": []}

    # ---- condições atuais (estação/observação) ----
    try:
        cc = soup.find(class_="currentTemp")
        temp = num(cc.get_text()) if cc else None
        extra = soup.select(".acci span") or []
        textos = [e.get_text(" ", strip=True) for e in extra]

        def depois(rotulo_regex):
            for k, t in enumerate(textos):
                if re.search(rotulo_regex, t, re.I) and k + 1 < len(textos):
                    return textos[k + 1]
            return None

        vento_txt = depois(r"^vento") or (textos[5] if len(textos) > 5 else None)
        atual = {
            "temp": temp,
            "sensacao": num(depois(r"sensa") or (textos[1] if len(textos) > 1 else None)),
            "chuva_mm": num(depois(r"precip|chuva") or (textos[3] if len(textos) > 3 else None)),
            "vento": num(vento_txt),
            "vento_dir": (re.findall(r"\b(N|NE|NO|S|SE|SO|L|O|E|W|NW|SW)\b", vento_txt or "") or [None])[0],
            "rajada": num(depois(r"rajada") or (textos[7] if len(textos) > 7 else None)),
        }
        cont = soup.find(class_="cc") or cc.parent if cc else None
        icone = cont.find("i", class_=re.compile(r"wi-")) if cont else None
        if icone:
            classes = " ".join(icone.get("class", []))
            atual["condicao"] = condicao_texto(classes, icone.get("title", ""))
            atual["descricao"] = (icone.get("title") or "").strip() or None
        if temp is not None:
            resultado["atual"] = atual
    except Exception as e:  # noqa: BLE001
        log("SIMEPAR: não consegui ler condições atuais:", e)

    # ---- previsão hora a hora (hoje e amanhã) ----
    try:
        for aba in soup.select(".table-hourly"):
            dia = data_do_id(aba.get("id"))
            if not dia:
                continue
            cabecalhos = aba.select(".ah-header")
            corpos = aba.select(".ah-body")
            for k, cab in enumerate(cabecalhos):
                hora = num((cab.select_one(".ah-time") or cab).get_text())
                if hora is None:
                    continue
                t = datetime(dia.year, dia.month, dia.day, int(hora) % 24, tzinfo=TZ)
                ic = cab.find("i")
                classes = " ".join(ic.get("class", [])) if ic else ""
                titulo = (ic.get("title") or "").strip() if ic else ""
                vento_txt = (cab.select_one(".ah-wind") or cab).get_text(" ", strip=True)
                vals = corpos[k].select(".val") if k < len(corpos) else []
                v = [x.get_text(" ", strip=True) for x in vals]
                resultado["horas"].append(
                    {
                        "t": iso(t),
                        "temp": num((cab.select_one(".ah-temp") or cab).get_text()),
                        "chuva_mm": num((cab.select_one(".ah-prec") or cab).get_text(), 0.0),
                        "vento": num(vento_txt),
                        "sensacao": num(v[0]) if len(v) > 0 else None,
                        "umidade": num(v[1]) if len(v) > 1 else None,
                        "prob": num(v[2]) if len(v) > 2 else None,
                        "rajada": num(v[3]) if len(v) > 3 else None,
                        "condicao": condicao_texto(classes, titulo),
                        "descricao": titulo or None,
                        "fonte": "simepar",
                    }
                )
        resultado["horas"].sort(key=lambda h: h["t"])
    except Exception as e:  # noqa: BLE001
        log("SIMEPAR: não consegui ler previsão horária:", e)

    # ---- previsão diária (até 15 dias) ----
    try:
        bloco_json = re.search(r"json[^{]*(\{.*?a>\"\})", html, re.S)
        lista_html = list(json.loads(bloco_json.group(1)).values()) if bloco_json else []
        temps = re.findall(r"data:\s*\[([\d,.\s-]*)\]", html)
        maximas = [num(x) for x in temps[0].split(",")] if len(temps) > 0 else []
        minimas = [num(x) for x in temps[1].split(",")] if len(temps) > 1 else []
        abas = soup.select(".daily_infos-wrapper")
        for k, aba in enumerate(abas):
            dia = data_do_id(aba.get("id"))
            if not dia:
                continue
            vals = [x.get_text(" ", strip=True) for x in aba.select(".val")]
            trecho = lista_html[k] if k < len(lista_html) else ""
            m_ic = re.search(r"wi\s(wi-[\w-]+)", trecho)
            m_tt = re.search(r'title="([^"]+)"', trecho)
            titulo = m_tt.group(1).strip() if m_tt else ""
            vento_txt = vals[3] if len(vals) > 3 else ""
            resultado["dias"].append(
                {
                    "data": dia.isoformat(),
                    "max": maximas[k] if k < len(maximas) else None,
                    "min": minimas[k] if k < len(minimas) else None,
                    "chuva_mm": num(vals[1]) if len(vals) > 1 else None,
                    "prob": num(vals[2]) if len(vals) > 2 else None,
                    "vento": num(vento_txt),
                    "vento_dir": (re.findall(r"\b(N|NE|NO|S|SE|SO|L|O)\b", vento_txt) or [None])[0],
                    "condicao": condicao_texto(m_ic.group(1) if m_ic else "", titulo),
                    "descricao": titulo or None,
                    "fonte": "simepar",
                }
            )
    except Exception as e:  # noqa: BLE001
        log("SIMEPAR: não consegui ler previsão diária:", e)

    if not (resultado["atual"] or resultado["horas"] or resultado["dias"]):
        raise RuntimeError("página do SIMEPAR veio sem dados reconhecíveis (o layout pode ter mudado)")
    return resultado


# --------------------------------------------------------------------------------------
# Open-Meteo
# --------------------------------------------------------------------------------------
def buscar_openmeteo() -> dict:
    params = {
        "latitude": LAT,
        "longitude": LON,
        "timezone": "America/Sao_Paulo",
        "forecast_days": 8,
        "past_days": 1,
        "wind_speed_unit": "kmh",
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,"
        "weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
        "hourly": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation_probability,"
        "precipitation,weather_code,wind_speed_10m,wind_gusts_10m,is_day",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,"
        "precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,"
        "wind_direction_10m_dominant,sunrise,sunset,uv_index_max",
    }
    r = requests.get(URL_OPENMETEO, params=params, timeout=TIMEOUT, headers={"User-Agent": "DefesaCivilGuarapuava/1.0"})
    r.raise_for_status()
    return normalizar_openmeteo(r.json())


def _local(s: str) -> datetime:
    return datetime.fromisoformat(s).replace(tzinfo=TZ)


def normalizar_openmeteo(j: dict) -> dict:
    agora_ = agora()
    c = j.get("current", {})
    cond, desc = condicao_wmo(c.get("weather_code"))
    atual = {
        "temp": c.get("temperature_2m"),
        "sensacao": c.get("apparent_temperature"),
        "umidade": c.get("relative_humidity_2m"),
        "chuva_mm": c.get("precipitation"),
        "vento": c.get("wind_speed_10m"),
        "vento_dir": direcao_graus(c.get("wind_direction_10m")),
        "rajada": c.get("wind_gusts_10m"),
        "nuvens": c.get("cloud_cover"),
        "dia": bool(c.get("is_day", 1)),
        "condicao": cond,
        "descricao": desc,
        "hora": iso(_local(c["time"])) if c.get("time") else iso(agora_),
        "fonte": "openmeteo",
    }
    h = j.get("hourly", {})
    horas, chuva_24h = [], 0.0
    for k, t in enumerate(h.get("time", [])):
        dt = _local(t)
        p = (h.get("precipitation") or [0])[k] or 0
        if agora_ - timedelta(hours=24) < dt <= agora_:
            chuva_24h += p
        cond, desc = condicao_wmo((h.get("weather_code") or [None])[k])
        horas.append(
            {
                "t": iso(dt),
                "temp": h["temperature_2m"][k],
                "sensacao": h["apparent_temperature"][k],
                "umidade": h["relative_humidity_2m"][k],
                "chuva_mm": p,
                "prob": h["precipitation_probability"][k],
                "vento": h["wind_speed_10m"][k],
                "rajada": h["wind_gusts_10m"][k],
                "dia": bool(h["is_day"][k]),
                "condicao": cond,
                "descricao": desc,
                "fonte": "openmeteo",
            }
        )
    d = j.get("daily", {})
    dias = []
    for k, t in enumerate(d.get("time", [])):
        cond, desc = condicao_wmo(d["weather_code"][k])
        dias.append(
            {
                "data": t,
                "max": d["temperature_2m_max"][k],
                "min": d["temperature_2m_min"][k],
                "chuva_mm": d["precipitation_sum"][k],
                "prob": d["precipitation_probability_max"][k],
                "vento": d["wind_speed_10m_max"][k],
                "rajada": d["wind_gusts_10m_max"][k],
                "vento_dir": direcao_graus(d["wind_direction_10m_dominant"][k]),
                "nascer": iso(_local(d["sunrise"][k])) if d.get("sunrise") else None,
                "por": iso(_local(d["sunset"][k])) if d.get("sunset") else None,
                "uv": d["uv_index_max"][k],
                "condicao": cond,
                "descricao": desc,
                "fonte": "openmeteo",
            }
        )
    return {"atual": atual, "horas": horas, "dias": dias, "chuva_24h_mm": round(chuva_24h, 1)}


# --------------------------------------------------------------------------------------
# INMET - avisos meteorológicos que incluem Guarapuava
# --------------------------------------------------------------------------------------
def nivel_inmet(sev: str) -> str:
    s = (sev or "").lower()
    if "grande" in s or "extreme" in s:
        return "muito-alto"
    if "potencial" in s or "moderate" in s:
        return "moderado"
    if "perigo" in s or "severe" in s:
        return "alto"
    return "baixo"


def ponto_no_poligono(lat, lon, pontos):
    dentro = False
    j = len(pontos) - 1
    for i in range(len(pontos)):
        yi, xi = pontos[i]
        yj, xj = pontos[j]
        if (yi > lat) != (yj > lat) and lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi:
            dentro = not dentro
        j = i
    return dentro


def _data_inmet(d: dict, prefixo: str):
    """Monta data/hora a partir dos campos usuais do INMET (inicio/fim, data_inicio + hora_inicio)."""
    for chave in (prefixo, f"{prefixo}_aviso"):
        if d.get(chave):
            try:
                dt = datetime.fromisoformat(str(d[chave]).replace("Z", "+00:00"))
                return dt if dt.tzinfo else dt.replace(tzinfo=TZ)
            except ValueError:
                pass
    data_txt, hora_txt = d.get(f"data_{prefixo}"), d.get(f"hora_{prefixo}") or "00:00"
    if data_txt:
        try:
            return datetime.fromisoformat(f"{str(data_txt)[:10]}T{str(hora_txt)[:5]}").replace(tzinfo=TZ)
        except ValueError:
            return None
    return None


def buscar_inmet() -> list:
    avisos = []
    agora_ = agora()
    try:
        r = requests.get(URL_INMET_ATIVOS, timeout=TIMEOUT, headers={"User-Agent": UA})
        r.raise_for_status()
        dados = r.json()

        def percorrer(o):
            if isinstance(o, dict):
                if any(k in o for k in ("severidade", "descricao")) and str(IBGE) in json.dumps(o, ensure_ascii=False):
                    yield o
                else:
                    for v in o.values():
                        yield from percorrer(v)
            elif isinstance(o, list):
                for v in o:
                    yield from percorrer(v)

        vistos = set()
        for a in percorrer(dados):
            ident = str(a.get("id") or a.get("id_aviso") or json.dumps(a)[:80])
            if ident in vistos:
                continue
            vistos.add(ident)
            fim = _data_inmet(a, "fim")
            if fim and fim < agora_:
                continue
            inicio = _data_inmet(a, "inicio")
            sev = a.get("severidade") or a.get("grau") or ""
            avisos.append(
                {
                    "id": ident,
                    "evento": (a.get("descricao") or a.get("evento") or "Aviso meteorológico").strip(),
                    "severidade": sev,
                    "nivel": nivel_inmet(sev),
                    "inicio": iso(inicio) if inicio else None,
                    "fim": iso(fim) if fim else None,
                    "riscos": a.get("riscos"),
                    "instrucoes": a.get("instrucoes"),
                    "link": f"https://alertas2.inmet.gov.br/{a.get('id')}" if a.get("id") else "https://alertas2.inmet.gov.br/",
                }
            )
        return avisos
    except Exception as e:  # noqa: BLE001
        log("INMET (json) indisponível, tentando RSS/CAP:", e)

    # Reserva: RSS + CAP (padrão internacional de alertas)
    r = requests.get(URL_INMET_RSS, timeout=TIMEOUT, headers={"User-Agent": UA})
    r.raise_for_status()
    rss = ET.fromstring(r.content)
    cap = "{urn:oasis:names:tc:emergency:cap:1.2}"
    for item in list(rss.iter("item"))[:60]:
        links = [(item.findtext("guid") or "").strip(), (item.findtext("link") or "").strip()]
        for url in [u for u in links if u.startswith("http")]:
            try:
                rc = requests.get(url, timeout=TIMEOUT, headers={"User-Agent": UA})
                xml = ET.fromstring(rc.content)
            except Exception:  # noqa: BLE001
                continue
            info = xml.find(f"{cap}info")
            if info is None:
                continue
            texto = rc.text
            casa = str(IBGE) in texto
            if not casa:
                for poly in xml.iter(f"{cap}polygon"):
                    pts = []
                    for par in (poly.text or "").split():
                        try:
                            la, lo = par.split(",")
                            pts.append((float(la), float(lo)))
                        except ValueError:
                            pass
                    if len(pts) > 2 and ponto_no_poligono(LAT, LON, pts):
                        casa = True
                        break
            if not casa:
                break
            exp = info.findtext(f"{cap}expires")
            fim = datetime.fromisoformat(exp) if exp else None
            if fim and fim < agora_:
                break
            ini = info.findtext(f"{cap}onset")
            sev = info.findtext(f"{cap}severity") or ""
            avisos.append(
                {
                    "id": xml.findtext(f"{cap}identifier") or url,
                    "evento": info.findtext(f"{cap}event") or info.findtext(f"{cap}headline") or "Aviso meteorológico",
                    "severidade": sev,
                    "nivel": nivel_inmet(sev),
                    "inicio": iso(datetime.fromisoformat(ini)) if ini else None,
                    "fim": iso(fim) if fim else None,
                    "riscos": info.findtext(f"{cap}description"),
                    "instrucoes": info.findtext(f"{cap}instruction"),
                    "link": (item.findtext("link") or "https://alertas2.inmet.gov.br/").strip(),
                }
            )
            break
    return avisos


# --------------------------------------------------------------------------------------
# Junta tudo
# --------------------------------------------------------------------------------------
def combinar(sim: dict | None, om: dict | None, inmet: list, fontes: dict) -> dict:
    agora_ = agora()
    hoje = agora_.date().isoformat()

    # Nascer/pôr do sol por data (para saber se cada hora é dia ou noite)
    sol = {d["data"]: (d.get("nascer"), d.get("por")) for d in (om or {}).get("dias", [])}

    def eh_dia(t_iso: str) -> bool:
        dt = datetime.fromisoformat(t_iso)
        n, p = sol.get(dt.date().isoformat(), (None, None))
        if n and p:
            return datetime.fromisoformat(n) <= dt < datetime.fromisoformat(p)
        return 6 <= dt.hour < 19

    # ---- horas: próximas 48 h ----
    por_hora = {}
    for h in (om or {}).get("horas", []):
        por_hora[h["t"]] = dict(h)
    for h in (sim or {}).get("horas", []):
        base = por_hora.get(h["t"], {})
        base.update({k: v for k, v in h.items() if v is not None})
        por_hora[h["t"]] = base
    limite_ini = agora_.replace(minute=0, second=0, microsecond=0)
    horas = []
    for t in sorted(por_hora):
        dt = datetime.fromisoformat(t)
        if limite_ini <= dt < limite_ini + timedelta(hours=48):
            h = por_hora[t]
            h["dia"] = eh_dia(t)
            horas.append(h)

    # ---- dias: de hoje em diante ----
    por_dia = {d["data"]: dict(d) for d in (om or {}).get("dias", [])}
    for d in (sim or {}).get("dias", []):
        base = por_dia.get(d["data"], {})
        base.update({k: v for k, v in d.items() if v is not None})
        por_dia[d["data"]] = base
    dias = [por_dia[k] for k in sorted(por_dia) if k >= hoje][:10]

    # ---- agora ----
    atual = dict((om or {}).get("atual") or {})
    if sim and sim.get("atual"):
        atual.update({k: v for k, v in sim["atual"].items() if v is not None})
        atual["fonte"] = "simepar"
        atual["hora"] = iso(agora_.replace(minute=0, second=0, microsecond=0))
        # SIMEPAR não informa umidade/condição no bloco atual: usa a hora corrente da previsão
        if horas:
            h0 = horas[0]
            for k in ("umidade", "condicao", "descricao"):
                if atual.get(k) is None and h0.get(k) is not None:
                    atual[k] = h0[k]
    if atual:
        atual["dia"] = eh_dia(atual.get("hora") or iso(agora_))
        if not atual.get("descricao"):
            atual["descricao"] = DESCRICAO_PADRAO.get(atual.get("condicao"), "")

    return {
        "versao": 1,
        "municipio": {"nome": "Guarapuava", "uf": "PR", "ibge": IBGE, "lat": LAT, "lon": LON},
        "gerado_em": iso(agora_),
        "fontes": fontes,
        "atual": atual or None,
        "chuva_24h_mm": (om or {}).get("chuva_24h_mm"),
        "horas": horas,
        "dias": dias,
        "avisos_inmet": inmet,
    }


def main() -> int:
    fontes = {}
    anterior = {}
    if os.path.exists(ARQ_CLIMA):
        try:
            with open(ARQ_CLIMA, encoding="utf-8") as f:
                anterior = json.load(f)
        except Exception:  # noqa: BLE001
            anterior = {}

    sim = om = None
    inmet = []

    try:
        sim = buscar_simepar()
        fontes["simepar"] = {"ok": True, "url": URL_SIMEPAR, "em": iso(agora())}
        log(f"SIMEPAR ok: {len(sim['dias'])} dias, {len(sim['horas'])} horas")
    except Exception as e:  # noqa: BLE001
        fontes["simepar"] = {"ok": False, "url": URL_SIMEPAR, "erro": str(e)[:200], "em": iso(agora())}
        log("SIMEPAR falhou:", e)

    try:
        om = buscar_openmeteo()
        fontes["openmeteo"] = {"ok": True, "url": "https://open-meteo.com/", "em": iso(agora())}
        log("Open-Meteo ok")
    except Exception as e:  # noqa: BLE001
        fontes["openmeteo"] = {"ok": False, "erro": str(e)[:200], "em": iso(agora())}
        log("Open-Meteo falhou:", e)

    try:
        inmet = buscar_inmet()
        fontes["inmet"] = {"ok": True, "url": "https://alertas2.inmet.gov.br/", "em": iso(agora())}
        log(f"INMET ok: {len(inmet)} aviso(s) para Guarapuava")
    except Exception as e:  # noqa: BLE001
        fontes["inmet"] = {"ok": False, "erro": str(e)[:200], "em": iso(agora())}
        inmet = [a for a in anterior.get("avisos_inmet", []) if a.get("fim") and a["fim"] > iso(agora())]
        log("INMET falhou (mantidos avisos anteriores ainda vigentes):", e)

    if not sim and not om:
        log("Nenhuma fonte de previsão respondeu. Mantendo o arquivo anterior.")
        if anterior and not anterior.get("exemplo"):
            anterior.setdefault("fontes", {}).update(fontes)
            anterior["avisos_inmet"] = inmet
            dados = anterior
        else:
            return 1
    else:
        dados = combinar(sim, om, inmet, fontes)

    os.makedirs(os.path.dirname(ARQ_CLIMA), exist_ok=True)
    with open(ARQ_CLIMA, "w", encoding="utf-8") as f:
        json.dump(dados, f, ensure_ascii=False, indent=1)
    log("Gravado", ARQ_CLIMA)

    # Boletim em PDF (não interrompe se falhar)
    try:
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        from gerar_boletim import gerar_boletim

        alerta = {}
        if os.path.exists(ARQ_ALERTA):
            with open(ARQ_ALERTA, encoding="utf-8") as f:
                alerta = json.load(f)
        caminho = gerar_boletim(dados, alerta)
        log("Boletim gerado:", caminho)
    except Exception:  # noqa: BLE001
        log("Falha ao gerar boletim:")
        traceback.print_exc()
    return 0


if __name__ == "__main__":
    sys.exit(main())
