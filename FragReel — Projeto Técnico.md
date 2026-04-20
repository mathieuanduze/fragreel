---
type: project-doc
area: projetos-paralelos
tags: [fragreel, cs2, highlights, video, produto, nextjs, fastapi, python]
updated: 2026-04-20
---

# FragReel — Documentação Técnica do Projeto

> Plataforma que transforma demos do CS2 em vídeos editados automaticamente — pronto para TikTok, Reels e WhatsApp. 100% gratuito, sustentado por anúncios em vídeo.

Ver também: [[FragReel/FragReel]]

---

## O que é o FragReel

O jogador instala um client leve no Windows. O client fica rodando em background, detecta quando uma nova demo do CS2 é salva, envia para a API, e depois da partida o jogador recebe uma notificação com os highlights rankeados por IA. Ele escolhe o formato, assiste 1 anúncio de ~30s enquanto o vídeo renderiza, e baixa o resultado.

**Sem upload manual. Sem assinatura. Sem surpresa.**

---

## Fluxo completo

```
Jogador termina partida no CS2
        ↓
Client detecta o arquivo .dem (watchdog)
        ↓
POST /demo/upload → API FastAPI
        ↓
demoparser2 extrai kills, timestamps, armas
        ↓
IA rankeia highlights (ACE, clutch, knife, noscope…)
        ↓
Notificação desktop → abre dashboard no browser
        ↓
Jogador seleciona highlights + formato (Reel / Recap / Card)
        ↓
Clica "Assistir anúncio e gerar"
        ↓
API inicia render → AdModal abre com ads em loop
        ↓
Barra de progresso de renderização em tempo real
        ↓
Botão "⬇ Baixar Frag Reel" aparece quando termina
```

---

## Stack técnica

### Frontend — `/web`

| Tecnologia | Versão | Uso |
|---|---|---|
| Next.js | 16.2.4 | App Router, server + client components |
| React | 19 | UI, estado interativo |
| Tailwind CSS | v4 | Estilo global via `@import "tailwindcss"` |
| TypeScript | — | Tipagem em todo o frontend |

**Porta local:** `localhost:3033`

**Páginas:**
- `/` — Landing page (CS2-focused, mapa icons, stat badges, how-it-works)
- `/login` — Login via Steam OpenID
- `/dashboard` — Lista de partidas processadas, stats, ads estáticos
- `/match/[id]` — Detalhes da partida, seleção de highlights, geração de vídeo

**Componentes principais:**
- `Nav.tsx` — Adaptativo: visitante vs logado
- `AdModal.tsx` — Modal de anúncio em vídeo não-pulável com barra de render paralela
- `AdSlot.tsx` — Placeholder de ads estáticos (leaderboard, banner, native, rectangle)

### Backend — `/api`

| Tecnologia | Uso |
|---|---|
| FastAPI + Uvicorn | REST API na porta 8001 |
| Pydantic | Modelos de request/response tipados |
| demoparser2 | Parser de arquivos .dem do CS2 |
| CORS | Liberado para `localhost:3000` e `localhost:3033` |

**Endpoints:**
- `GET  /matches` → lista de partidas processadas
- `GET  /matches/{id}` → detalhes + highlights rankeados
- `POST /matches/{id}/generate` → inicia renderização, retorna `job_id` + `estimated_seconds`
- `POST /demo/upload` → recebe arquivo .dem, enfileira processamento

### Client Windows — `/client`

| Arquivo | Função |
|---|---|
| `main.py` | Entry point com argparse (`--demo-dir`, `--steamid`) |
| `watcher.py` | watchdog: detecta `.dem` novo e chama a API |
| `steam_detect.py` | Descobre pasta Steam, CS2 e SteamID ativo via `loginusers.vdf` |
| `notifier.py` | Notificação desktop (plyer) + abre browser no dashboard |
| `config.py` | Constantes: `API_URL`, `DEMO_DIR`, `POLL_INTERVAL`, `MIN_DEMO_BYTES` |

---

## Monetização

**Modelo: rewarded ad — sem assinatura, sem créditos**

- Cada geração de vídeo exige assistir **1 anúncio de 30s** (não-pulável, como Gamers Club)
- O tempo do anúncio ≈ tempo de renderização → narrativa honesta para o usuário
- Formatos de ad implementados:
  - **Vídeo rewarded** (AdModal) — roda em loop enquanto o vídeo renderiza
  - **Display estático** (AdSlot) — leaderboard no dashboard, banner e native na página de partida
- Receita estimada: ~R$0,10–0,30 por geração (CPM de gaming BR)

**Espaços de ad disponíveis para venda:**
| Slot | Tamanho | Página |
|---|---|---|
| `dashboard-leaderboard` | 728×90 | Dashboard (acima da lista) |
| `dashboard-native` | 100%×120 | Dashboard (abaixo da lista) |
| `match-rectangle` | 100%×60 | Página de partida |
| AdModal vídeo | 16:9 fullscreen | Modal de geração |

---

## Formatos de output

| Formato | Dimensão | Duração | Destino |
|---|---|---|---|
| Highlights Reel | 9:16 vertical | ~47s | TikTok, Reels, WhatsApp Status |
| Recap Completo | 16:9 horizontal | ~2m34s | YouTube, Discord, Twitter |
| Story Card | 9:16 imagem estática | — | Instagram Stories, WhatsApp |

Cada formato = 1 anúncio. Para gerar outro formato da mesma partida, assiste mais 1 ad.

---

## Mapas suportados

Todos os 8 mapas do pool competitivo atual do CS2, com ícones reais (`/public/maps/*.png`):

`de_dust2` · `de_mirage` · `de_inferno` · `de_nuke` · `de_ancient` · `de_anubis` · `de_vertigo` · `de_overpass`

Fonte dos ícones: `github.com/vgalisson/csgo-map-icons`

---

## Detalhes de implementação relevantes

### AdModal — novo comportamento (2026-04-20)
- Anúncios **não-puláveis** (sem skip button)
- Dois timers paralelos independentes:
  1. **Ad timer** (30s por ad, loop automático) — troca de anúncio a cada 30s
  2. **Render timer** (vem de `estimated_seconds` da API) — barra de progresso laranja
- Quando render termina → botão **"⬇ Baixar Frag Reel"** aparece com animação
- Ads continuam rodando até o usuário fechar

### Next.js App Router — gotchas
- `params` em rotas dinâmicas é `Promise<{id: string}>` → obrigatório `await params`
- Event handlers (`onError`, `onClick`) não podem ser passados de Server Components → usar `"use client"` ou remover
- Componentes interativos ficam em `*Client.tsx` separados do server wrapper

### Python 3.9 — compatibilidade
- `str | None` não funciona → usar `Optional[str]` ou string annotations `"str | None"`

---

## Estrutura de pastas

```
FragReel/
├── web/                    # Next.js frontend
│   ├── app/
│   │   ├── page.tsx        # Landing page
│   │   ├── login/          # Steam login
│   │   ├── dashboard/      # Lista de partidas
│   │   └── match/[id]/     # Detalhes + geração
│   ├── components/
│   │   ├── Nav.tsx
│   │   ├── AdModal.tsx     # Modal rewarded ad + render progress
│   │   └── AdSlot.tsx      # Display ads estáticos
│   ├── lib/
│   │   └── api.ts          # Cliente HTTP para a API
│   └── public/
│       └── maps/           # Ícones PNG dos mapas CS2
├── api/                    # FastAPI backend
│   ├── main.py
│   └── routes/
│       ├── matches.py
│       └── demo.py
└── client/                 # Client Windows
    ├── main.py
    ├── watcher.py
    ├── steam_detect.py
    ├── notifier.py
    └── config.py
```

---

## O que falta construir

- [ ] **Render real com HLAE + FFmpeg** — exportar POV da demo e cortar os clipes
- [ ] **Remotion** — edição automática (música, slow-mo, intro/outro)
- [ ] **Polling de job status** — frontend consulta `/jobs/{id}` para atualizar barra de render com dado real
- [ ] **Auth Steam real** — integração OpenID completa (hoje é mock)
- [ ] **Empacotamento do client** — PyInstaller para `.exe` instalável no Windows
- [ ] **Integração com rede de ads real** — Google AdSense, ironSource ou parceria direta
- [ ] **Testes com demo real** — validar `demoparser2` com arquivo `.dem` de partida real

---

## Como rodar localmente

```bash
# Frontend
cd web && npm run dev          # localhost:3033

# Backend
cd api && uvicorn main:app --port 8001 --reload

# Client (simulado)
cd client && python main.py --demo-dir ~/demos --steamid 76561198000000000
```
