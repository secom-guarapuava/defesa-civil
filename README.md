# Defesa Civil de Guarapuava — Tempo e alertas

Site para a população e os servidores acompanharem o tempo em Guarapuava todos os dias.

**Site público (só para acompanhar)**
- Tempo agora, próximas 24 h e próximos dias, atualizados sozinhos a cada 30 minutos com a previsão do **SIMEPAR**.
- **Faixa de alerta** nas cores da Defesa Civil (verde, amarelo, laranja, vermelho), com vigência e contagem regressiva. Quando passa o horário final, o alerta some sozinho.
- **Céu animado** que muda conforme o tempo.
- **El Niño**, orientações (antes, durante e depois), kit de emergência, **Cartilha de Segurança — Plano de Ação El Niño** em PDF, canal da Defesa Civil no WhatsApp, SMS 40199 e telefones.
- No celular, barra fixa com **Ligar 193** e **WhatsApp do plantão da Defesa Civil**.

**Para a equipe**
- `gerenciar.html` — **área da equipe com senha**: gera as artes (alerta, tempo agora, próximos 3 dias) em post 4:5 e status 9:16, com legenda pronta.
- `painel.html` — painel para deixar aberto nos computadores, com relógio, aviso sonoro e notificação quando o alerta muda.

Esses dois endereços não aparecem no site público. Salve-os nos favoritos dos computadores da equipe.

---

## 1. Colocar no ar (uma vez)

1. Crie um repositório no GitHub e envie **todos** os arquivos desta pasta (*Add file → Upload files*), inclusive a pasta `.github`.
   > A pasta `.github` começa com ponto e pode ficar escondida no Windows/Mac. Se o upload não pegar essa pasta, crie o arquivo pelo GitHub: *Add file → Create new file*, nome `.github/workflows/atualizar.yml`, e cole o conteúdo do arquivo.
2. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
3. Na aba **Actions**, abra *Atualizar tempo e publicar site* e clique em **Run workflow**.
4. Em 1 ou 2 minutos o site estará em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Depois disso, o robô roda sozinho a cada 30 minutos (e a cada alteração no repositório). O rodapé do site mostra se o SIMEPAR respondeu (bolinha verde).

### Ajustes em `assets/js/config.js`
- `urlSite`: o endereço final do site (aparece nas artes e legendas).
- `contatos`, `whatsappPlantao`, `canalWhatsApp`, links: tudo que aparece no site e nas artes.

---

## 2. Área da equipe (`gerenciar.html`)

- Na primeira vez, o computador pede a **senha da equipe**. Com “Lembrar neste computador” marcado, não pede mais. O botão **Sair** apaga o acesso daquele computador.
- **Troque a senha inicial logo no primeiro uso** (ela não fica escrita neste repositório, que é público): na própria página, abra *Trocar a senha da equipe*, digite a nova senha e clique em *Gerar linha*. Depois abra `assets/js/config.js` no GitHub (lápis de editar), troque a linha que começa com `senhaEquipe` pela linha gerada e salve (*Commit changes*). Em 1 a 2 minutos a senha nova passa a valer e todos precisam entrar de novo.
- A senha não fica escrita no site, só uma “impressão digital” dela. É uma trava para a página não virar ferramenta da população. Não é um cofre: o código do site é público, e uma pessoa com conhecimento técnico poderia montar artes parecidas por conta própria. Por isso, as artes oficiais valem quando publicadas nos canais oficiais.
- A página **não altera o site**: ela só gera as artes e as legendas.

### Alerta na faixa do site
- Sem alerta da Defesa Civil, a faixa mostra sozinha o aviso do INMET mais grave que inclui Guarapuava. Para desligar: `usarAvisosINMET: false` em `config.js`.
- Para mostrar um alerta próprio da Defesa Civil, edite `data/alerta.json` no GitHub (modelo abaixo). Ele some sozinho depois do horário de `fim`.

```json
{
  "ativo": true,
  "nivel": "alto",
  "titulo": "Risco alto de tempestades",
  "resumo": "Chuva forte em pouco tempo, rajadas de vento, raios e granizo localizado.",
  "inicio": "2026-11-06T00:00:00-03:00",
  "fim": "2026-11-07T23:59:00-03:00",
  "fenomenos": ["chuva-forte", "rajadas", "raios", "granizo"],
  "dias": [{ "rotulo": "Sexta-feira (06/11)", "nivel": "alto", "texto": "..." }],
  "impactos": ["queda de árvores", "alagamentos", "destelhamentos"],
  "fonte": "Defesa Civil de Guarapuava"
}
```
Níveis: `baixo` (verde), `moderado` (amarelo), `alto` (laranja), `muito-alto` (vermelho). Para encerrar, troque `"ativo": true` por `"ativo": false`.

---

## 3. De onde vêm os dados

| O quê | Fonte | Observação |
|---|---|---|
| Previsão por hora e por dia | SIMEPAR | Fonte principal |
| Reserva e complemento | Open-Meteo | Usada se o SIMEPAR não responder |
| Avisos meteorológicos | INMET | Só os que incluem Guarapuava; vigência do próprio INMET |
| Alerta da Defesa Civil | `data/alerta.json` | Opcional, editado pela equipe |

- O robô (`scripts/atualizar_dados.py`) grava `data/clima.json`.
- Se os dados do robô tiverem mais de 100 minutos, o próprio navegador busca a previsão no Open-Meteo.
- O SIMEPAR não oferece API pública: o robô lê a página da previsão de Guarapuava. Se o layout mudar ou o acesso for bloqueado, o site continua com o Open-Meteo e o rodapé indica a falha. Vale pedir ao SIMEPAR um acesso oficial aos dados.
- Em repositório público, o GitHub pode pausar tarefas agendadas depois de 60 dias sem atividade. Se aparecer o aviso na aba **Actions**, clique em **Enable workflow**.

---

## 4. Ver no computador antes de publicar
Na pasta do site: `python -m http.server 8000` e abra `http://localhost:8000`. (Abrir o `index.html` com duplo clique não funciona.)

---

## 5. Estrutura

```
index.html              site público
painel.html             painel de monitoramento (equipe)
gerenciar.html          área da equipe com senha: artes e legendas
data/alerta.json        alerta da Defesa Civil (opcional)
data/clima.json         previsão (gerada pelo robô)
assets/js/config.js     contatos, links e senha da equipe
assets/js/acesso.js     tela de senha
assets/js/arte.js       modelos das artes
assets/docs/            cartilha em PDF (para trocar, substitua mantendo o mesmo nome)
scripts/                robô de atualização e ícones
.github/workflows/      agenda do robô (a cada 30 min)
```

Créditos dos dados: SIMEPAR, INMET, Open-Meteo (CC BY 4.0). #DEFESACIVILSOMOSTODOSNÓS
