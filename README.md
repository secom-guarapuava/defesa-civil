# Defesa Civil de Guarapuava — Tempo e alertas

Site de apoio para a população e para os servidores acompanharem o tempo em Guarapuava todos os dias.

- **Tempo agora, próximas 24 h e próximos dias**, atualizados sozinhos a cada 30 minutos com a previsão do **SIMEPAR**.
- **Faixa de alerta** nas cores da Defesa Civil (verde, amarelo, laranja, vermelho), com vigência e contagem regressiva. Quando passa o horário final, o alerta some sozinho.
- **Céu animado** que muda conforme o tempo: sol, nuvens, chuva, tempestade com relâmpagos, granizo, neblina e noite.
- **Compartilhar no WhatsApp**: gera a arte (status 9:16 ou post 4:5) do alerta, do tempo agora ou da previsão, com legenda pronta. Também dá para mandar só o texto.
- **Boletim em PDF** de Guarapuava, refeito a cada atualização.
- **El Niño**: seção explicando por que está chovendo mais.
- **Orientações** (antes, durante e depois), kit de emergência, **cartilha em PDF**, canais de alerta e telefones.
- **Painel** (`painel.html`) para deixar aberto nos computadores da equipe, com relógio, aviso sonoro e notificação quando o alerta muda.
- **Gestão** (`gerenciar.html`) para a equipe publicar o alerta e baixar a arte pronta.

---

## 1. Colocar no ar (uma vez)

1. Crie um repositório no GitHub (ex.: `site-defesa-civil`). Pode ser público.
2. Envie **todos** os arquivos desta pasta para o repositório: *Add file → Upload files* (arraste o conteúdo da pasta, inclusive a pasta `.github`).
   > A pasta `.github` começa com ponto e pode ficar escondida no Windows/Mac. Se o upload pelo navegador não pegar essa pasta, crie o arquivo pelo GitHub: *Add file → Create new file*, nome `.github/workflows/atualizar.yml`, e cole o conteúdo do arquivo.
3. Em **Settings → Pages → Build and deployment → Source**, escolha **GitHub Actions**.
4. Na aba **Actions**, abra *Atualizar tempo e publicar site* e clique em **Run workflow**.
5. Em 1 ou 2 minutos o site estará em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.

Depois disso, o robô roda sozinho a cada 30 minutos (e a cada alteração no repositório).

### Ajustes recomendados em `assets/js/config.js`
- `urlSite`: o endereço final do site (aparece nas artes e legendas).
- `github.usuario` e `github.repositorio`: para a página de gestão já vir preenchida.
- `contatos`, `canalWhatsApp`, links: tudo que aparece no site e nas artes.

> Os telefones também aparecem no boletim em PDF (`scripts/gerar_boletim.py`, função `pagina_2`) e na cartilha (`scripts/cartilha/cartilha.html`). Se mudar um número, mude nos três.

### Domínio próprio (opcional)
Para usar algo como `defesacivil.guarapuava.pr.gov.br`: em *Settings → Pages → Custom domain*, informe o domínio e peça à TI um registro **CNAME** apontando para `SEU-USUARIO.github.io`. Depois troque o `og:image` do `index.html` pelo endereço completo da imagem (o WhatsApp só mostra a miniatura com endereço completo).

---

## 2. Publicar um alerta

### Pela página de gestão (mais fácil)
1. Abra `gerenciar.html` (link “Área da equipe” no rodapé do site).
2. Escolha o nível, escreva título, resumo, vigência, fenômenos e o texto de cada dia.
3. Clique em **Publicar no site**. Em 1 a 2 minutos o site, o painel e o boletim mostram o alerta.
4. Baixe a arte e copie a legenda para o Instagram e o canal do WhatsApp.

Na primeira vez, crie um **token** no GitHub: *Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*. Em *Repository access* escolha só este repositório e, em *Permissions → Contents*, marque **Read and write**. Cole o token na página de gestão.

### Sem token
Na página de gestão clique em **Baixar alerta.json** e envie o arquivo para a pasta `data` do repositório (*Add file → Upload files*), substituindo o anterior.

### Encerrar antes do horário
Na página de gestão escolha **Encerrar alerta** e publique. (Se não fizer nada, o alerta some sozinho no fim da vigência.)

---

## 3. De onde vêm os dados

| O quê | Fonte | Observação |
|---|---|---|
| Previsão por hora e por dia | SIMEPAR | Fonte principal |
| Reserva e complemento (umidade, nascer do sol, chuva das últimas 24 h) | Open-Meteo | Usada se o SIMEPAR não responder |
| Avisos meteorológicos | INMET | Só os que incluem Guarapuava |
| Alerta oficial | Defesa Civil de Guarapuava | Arquivo `data/alerta.json` |

- O robô (`scripts/atualizar_dados.py`) grava `data/clima.json` e `data/boletim-guarapuava.pdf`.
- Se os dados do robô tiverem mais de 100 minutos, o próprio navegador busca a previsão no Open-Meteo para não mostrar informação velha.
- Sem alerta da Defesa Civil, a faixa mostra o aviso do INMET mais grave para Guarapuava (identificado como “aviso automático do INMET”). Para desligar: `usarAvisosINMET: false` em `config.js`.
- O rodapé do site e do painel mostra se cada fonte respondeu na última tentativa.

**Atenção:** o SIMEPAR não oferece uma API pública. O robô lê a página da previsão de Guarapuava. Se o SIMEPAR mudar o layout ou bloquear o acesso, o site continua funcionando com o Open-Meteo, e o rodapé indica a falha. Vale pedir ao SIMEPAR um acesso oficial aos dados para Guarapuava.

**GitHub e repositórios parados:** em repositório público, o GitHub pode pausar tarefas agendadas depois de 60 dias sem atividade. Se isso acontecer, aparece um aviso na aba **Actions**: basta clicar em **Enable workflow**.

---

## 4. Testar e treinar sem alerta real

Acrescente ao endereço:

- `?simular=tempestade&alerta=alto`
- `?simular=chuva-forte&alerta=muito-alto`
- `?simular=sol`, `?simular=noite`, `?simular=neblina`, `?simular=granizo`, `?simular=nublado`

Uma faixa listrada avisa que é simulação. Funciona também no `painel.html`.

### Ver no computador antes de publicar
Na pasta do site: `python -m http.server 8000` e abra `http://localhost:8000`. (Abrir o `index.html` com duplo clique não funciona, porque o navegador bloqueia a leitura dos dados.)

---

## 5. Painel para os computadores da equipe

Abra `painel.html`, clique em **Tela cheia** e em **Ativar aviso sonoro**. O navegador vai pedir para permitir notificações: permita. Quando o alerta mudar, o computador apita e mostra uma notificação. O painel se atualiza a cada 5 minutos e recarrega sozinho a cada 6 horas.

---

## 6. Estrutura

```
index.html              site principal
painel.html             painel de monitoramento
gerenciar.html          publicar alerta e gerar artes
data/alerta.json        alerta publicado pela equipe
data/clima.json         previsão (gerada pelo robô)
data/boletim-...pdf     boletim (gerado pelo robô)
assets/js/config.js     contatos, links e configurações
assets/js/clima.js      dados, níveis de risco e alertas
assets/js/ceu.js        céu animado
assets/js/arte.js       modelos das artes para WhatsApp/Instagram
assets/docs/            cartilha em PDF
scripts/                robô de atualização, boletim, ícones e cartilha
.github/workflows/      agenda do robô (a cada 30 min)
```

Créditos dos dados: SIMEPAR, INMET, Open-Meteo (CC BY 4.0). #DEFESACIVILSOMOSTODOSNÓS
