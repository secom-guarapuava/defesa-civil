"""Gera assets/docs/cartilha-chuvas-defesa-civil-guarapuava.pdf a partir de cartilha.html.

Edite o texto em scripts/cartilha/cartilha.html e rode:
    pip install playwright && python -m playwright install chromium
    python scripts/cartilha/gerar_cartilha.py
"""
import asyncio
import pathlib

from playwright.async_api import async_playwright

AQUI = pathlib.Path(__file__).resolve().parent
SAIDA = AQUI.parent.parent / "assets" / "docs" / "cartilha-chuvas-defesa-civil-guarapuava.pdf"


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.goto((AQUI / "cartilha.html").as_uri(), wait_until="networkidle")
        await pg.evaluate("document.fonts.ready")
        await pg.pdf(path=str(SAIDA), prefer_css_page_size=True, print_background=True)
        await b.close()
    print("Cartilha gerada em", SAIDA)


asyncio.run(main())
