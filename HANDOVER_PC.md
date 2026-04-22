# HANDOVER_PC — FragReel (Mac → Windows)

> **Objetivo deste documento:** servir de contexto completo pra uma sessão do Claude Code iniciada no PC Windows. Assume que o Claude no PC **não tem acesso a** conversas anteriores, ao Obsidian vault (que fica no Mac), nem a arquivos locais não commitados. Tudo que importa está aqui dentro + nos dois repos GitHub.

**Última atualização:** 22 de abril de 2026 · versão cliente `v0.1.10`

---

## ⚡ TL;DR — primeiros passos no PC Windows

```powershell
# 1. Clone os dois repos lado a lado
mkdir C:\FragReel
cd C:\FragReel
git clone https://github.com/mathieuanduze/fragreel.git .
git clone https://github.com/mathieuanduze/fragreel-client.git client

# 2. Abra o Claude Code na raiz e mande esta frase inicial:
#    "Leia HANDOVER_PC.md e continue do Round 4c."
```

O documento abaixo cobre tudo. **Não siga instruções que não estejam aqui ou vindas direto do Mathieu no chat.**

---

## 1. O que é o FragReel

Ferramenta que transforma demos do CS2 de um jogador amador em um vídeo editado ("FragReel") com os melhores lances, pronto pra compartilhar no WhatsApp e redes sociais.

- **Público:** jogador de CS2 competitivo amador/intermediário
- **Deliverable:** MP4 vertical 1080×1920 (Reels/TikTok/Shorts) ou card 1 frame PNG
- **Distribuição:** web em `fragreel.vercel.app` + cliente desktop Windows (`.exe`) que detecta e envia demos
- **Monetização:** on-demand com ads (ver Arquitetura § "Modelo de negócio")

## 2. Repositórios e stack

| Repo | URL | Stack | Deploy |
|---|---|---|---|
| **Main** (`fragreel`) | https://github.com/mathieuanduze/fragreel | FastAPI (api/) · Next.js 15 App Router (web/) · Remotion 4.0.180 (editor/) | api → Railway · web → Vercel |
| **Client** (`fragreel-client`) | https://github.com/mathieuanduze/fragreel-client | Python 3.11 + Flask local + PyInstaller · MIT | GitHub Releases (`.exe`) |

### Dependências críticas

- **demoparser2** (Rust+PyO3) — parser das demos CS2. Exige `polars` + `pyarrow` bundlados.
- **Remotion 4.0.180** — renderização de vídeo via Chrome headless.
- **HLAE (Half-Life Advanced Effects)** — captura de gameplay real do CS2 (.vdm scripts → PNG sequence + WAV). Só roda em Windows.
- **ffmpeg** — encoding final, bundled no instalador.

## 3. Arquitetura de produto (estado atual)

> Esta seção é a síntese das notas 07, 08 e 09 do Obsidian (que está no Mac). Ler ela é suficiente pro PC.

### 3.1 Modelo de negócio — on-demand com ads

Decisão de produto (2026-04-22): o FragReel **não auto-processa** todas as demos. Usuário **escolhe** qual demo virar FragReel. Cada decisão dispara uma sessão de ads (mínimo 1 obrigatório) e libera o próximo passo via CTA.

Fluxo:

```
1. User abre fragreel.vercel.app/library
2. Vê lista de demos detectadas pelo client local
3. Clica "Gerar FragReel" em uma partida
4. ▶ Ad #1 roda enquanto servidor parseia + scoreia a .dem
5. Editor /match/{id}: escolhe formato (reel/recap/card), música, kills
6. Clica "Renderizar"
7. ▶ Ad #2 roda enquanto:
     - Client roda HLAE (CS2 abre em background) → captura PNGs
     - Client roda Remotion → compõe MP4 (gameplay + overlays + música)
     - ffmpeg encoda final
8. CTA "✓ Salvo em Desktop/FragReel/seu-reel.mp4"
```

### 3.2 Divisão de responsabilidades: Server × PC

```
┌──────────────────── SERVIDOR (Railway) ────────────────────┐
│ INTELIGÊNCIA                                               │
│  1. Recebe .dem do client                                  │
│  2. Parser (demoparser2) extrai eventos                    │
│  3. Scorer decide quais lances são highlights              │
│  4. Devolve "render plan" (cenas, ticks, mood, trilha)     │
└────────────────────────────────────────────────────────────┘
                            │
                            │ render plan JSON
                            ▼
┌──────────────────── PC USUÁRIO ────────────────────────────┐
│ EXECUÇÃO                                                   │
│  5. Client recebe plan                                     │
│  6. HLAE abre CS2 + reproduz demo no tick certo            │
│     - .vdm script controla câmera/playback                 │
│     - Captura PNG sequence + WAV (sem UI, sem HUD)         │
│  7. Remotion lê PNG seq + adiciona overlays + música       │
│  8. ffmpeg encoda MP4 final                                │
│  9. Salva no Desktop do user                               │
└────────────────────────────────────────────────────────────┘
```

**Princípio:** inteligência centralizada (1 backend, iteração fácil), execução distribuída (zero custo de GPU no Railway, escala com a base instalada).

### 3.3 Por que Remotion é testado SEM gameplay no Mac hoje

Explicação técnica que vai responder uma dúvida recorrente:

1. **Camadas separadas, dependências separadas:** Remotion roda em Node (Mac+Win). HLAE só roda em Windows+CS2. Iterar no Remotion no Mac permite validar a "linguagem visual" (kill feed, timing, música) sem depender do PC.
2. **Bottom-up:** placeholders (gradient + crosshair) validam animação/pacing. Quando HLAE capturar, substituímos o placeholder por `<OffthreadVideo src={pngSequence} />` — linha única, animações todas já validadas.
3. **Custo de iteração:** render Mac com placeholder = ~30s. Render + HLAE real = 5-10min. Calibrar animação sem placeholder seria proibitivo.

## 4. Stack de edição — padrões canônicos (do guia `Edição_FragReel_Best_Practices.txt`)

### 4.1 Codec de output (aplicado em `editor/remotion.config.ts`)

| Parâmetro | Valor | Status |
|---|---|---|
| Codec | H.264 High 4.2 | ✅ |
| Target bitrate | 50 Mbps | ✅ (real ~40 Mbps medido) |
| Pixel format | yuv420p (compat máxima) | ✅ |
| Color levels | Studio RGB (16-235) | ❌ TODO (ffmpeg post-process, Round 4c) |

### 4.2 Configuração HLAE canônica (a aplicar no Round 4c)

Para captura estruturada (layers separáveis):

- Injeção via **Custom Loader** (`AfxHookSource.dll`) — não add-on
- **Antes de cada captura:** `exec afx/updateworkaround` (evita flicker no z-buffer)
- GPU AMD: copiar `d3d9.dll` de `System32` pra pasta do CS2 (senão quebra z-buffer)
- Resolução padrão `1920×1080`. Ultrawide: `-width 1920 -height 810`

Streams mínimas via `mirv_streams`:

- `world` (mundo sem HUD)
- `worldDepth` (z-buffer pra DoF programático)
- `hud` (HUD isolado — pra compor killfeed customizado)
- `glow` (mascarado por shader)

Killfeed manipulável:

- Pegar XUID via `mirv_list_entities isPlayer=1`
- `mirv_deathmessage localPlayer [XUID]` → destaque vermelho no feed
- `mirv_deathmessage lifetime 90` → kill fica visível na cena toda
- `mirv_replace_name_filter add [XUID] "novo_nome"` → normalização

Frame rate na captura:

- `host_framerate 300` no CS2
- `host_timescale 0` → engine processa cada frame individualmente
- Mapeamento: source 300fps → Remotion 60fps = velocidade normal é `remotionFrame * 5`

### 4.3 Workflow de assets

- TGA seq → **Apple ProRes 4444** via ffmpeg (mantém alpha, performante no Chromium):
  ```bash
  ffmpeg -i frame_%04d.tga -c:v prores_ks -profile:v 4444 output.mov
  ```
- Evitar AVI uncompressed (Lagarith) — derruba o Chromium.

## 5. Estado atual do código (o que foi feito hoje no Mac)

### 5.1 Client desktop (`fragreel-client`)

**v0.1.10** — mudanças principais desde v0.1.5:

- `version.py`: `__version__ = "v0.1.10"` (source of truth)
- `local_api.py`: endpoint `/version` + campo `version` no `/health`
- `scanner.py`: `CACHE_VERSION = 5` · cache mantém demos já processadas (não some do scan após upload) · `mark_processed()` preserva meta
- Deps bundled no PyInstaller: `demoparser2` + `polars` + `pyarrow`

### 5.2 Web (`fragreel/web`)

- `lib/version.ts` bumped pra `v0.1.10` (sync com client)
- `lib/local.ts`: tipos `LocalDemo.match_id` + `processed_at` · função `getLocalClientVersion()`
- `components/LibraryContent.tsx`: `onPick` roteia pra `/match/{match_id}` se demo já processada · botão "Gerar outro formato" pra re-render · card borda verde + badge "✓ FragReel pronto"
- `components/AdModal.tsx`: download via `fetch+blob` com validação content-type · barra capa em 95% até `serverStatus.status === "done"` · botão always-visible com tooltip explicando estado · confirmação no X durante render
- `components/MatchList.tsx`: estética alinhada com Library · placar "—" quando 0-0 · empty state com CTA pra /library
- `components/DashboardContent.tsx`: banner "nova versão disponível" comparando `clientVersion` com `getLocalClientVersion()`
- `app/match/[id]/MatchClient.tsx`: mood selector habilitado pra `reel || recap`

### 5.3 Editor Remotion (`fragreel/editor`)

- **`Recap` composition implementada** — retrospectivo da partida (intro 4s + timeline 12s + N highlights + outro 3s)
- **Duração variável por highlight** — `h.end - h.start` clampado em `[3, 7]s` no Reel e `[4, 10]s` no Recap (não é mais 4s fixo)
- **Score interno removido do vídeo** — `highlight.score` é ferramenta interna de ranking, não aparece mais no MP4 final
- **Kill feed top-right + timing-aware** — convenção CS2 vanilla. Cada kill aparece no tempo real (`kill.time` relativo a `highlight.start`); fallback uniforme se parser ainda não envia `time`. Card fica visível por 3.5s + fade out de 0.4s.
- **Toggle vertical/horizontal** — `ReelProps.orientation: "vertical" | "horizontal"`. `calculateMetadata` em `Root.tsx` resolve dimensões em runtime (1080×1920 vs 1920×1080). Card é sempre vertical (semântico).
- **4 trilhas Pixabay CC0** bundled em `editor/public/music/`:
  - `eletronica.mp3` (Cyberpunk synthwave)
  - `acao.mp3` (Action Sport Rock Trailer)
  - `heroico.mp3` (Epic Heroic Orchestral Trailer Cinematic)
  - `chill.mp3` (Lofi Study)
- `theme.ts`: `MUSIC_ENABLED = true` · `DIMENSIONS`/`getDimensions()` · helpers `s2f`, `clampHighlightSec`, `killTimeInSceneSec`, bounds por formato
- `remotion.config.ts`: codec H.264 50 Mbps bitrate-fixed (ver 4.1)

### 5.4 API (`fragreel/api`)

- `routes/renders.py`: 
  - `_format_config` mapeia `recap` → composition `Recap` (não cai mais em reel)
  - `_run_render` migrou pra `Popen` + streaming de stdout
  - `_parse_progress` extrai progresso real via regex (`Rendered X/Y`, `Stitched X/Y`, `XX.X%`)
  - `job.progress` cresce de 0→0.95 durante render · vira 1.0 só quando subprocess sai com 0
- `routes/matches.py`: `generate_video` injeta `orientation` nas props enviadas pro Remotion. Card sempre vertical.
- `models.py`:
  - `HighlightOut.start/end: float` (segundos)
  - `KillOut.time: Optional[float]` — opcional. Quando o parser CS2 não fornece, o editor estima distribuindo as kills uniformemente entre `start` e `end`. **TODO parser:** preencher `time` real via tick do demo.
  - `Orientation` enum + `GenerateRequest.orientation: Orientation = vertical`

### 5.5 Web (`fragreel/web`) — adicional Round 4b

- `lib/api.ts`: tipo `Orientation` + parâmetro opcional `orientation` em `generateVideo()`
- `app/match/[id]/MatchClient.tsx`: novo seletor de orientação ("Onde você vai postar?") aparece pra `reel`/`recap` antes do CTA. Default vertical.

## 6. Onde estamos no plano — Round 4

O trabalho está dividido em 4 sub-rounds:

| Round | Escopo | Onde | Status |
|---|---|---|---|
| **4a** | Trilhas + Recap + progresso real + codec canônico | Mac | ✅ concluído |
| **4b** | Kill feed timing/posição + orientation toggle + Defuse Bar/Lower Thirds + endpoint `/render-plan` + spike Python↔Node | Mac | 🟡 em andamento (kill feed + orientation ✅, resto pendente) |
| **4c** | HLAE integration + bundle `.exe` de 350MB com Node+Remotion+HLAE | **PC (amanhã)** | ⏳ pendente |
| **4d** | Polish + entregar v0.2.0 ponta-a-ponta | Mac+PC | ⏳ pendente |

## 7. Tarefas concretas pra executar no PC (Round 4c)

> **Pré-requisitos:** Windows 10+ · CS2 instalado · Node 20+ · Python 3.11 · Git.

### 7.1 Preparação

```powershell
# No diretório onde clonou os repos
cd C:\FragReel\client
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

cd C:\FragReel\editor
npm install
npx remotion browser ensure   # pré-baixa Chromium headless
```

### 7.2 Download do HLAE

- URL oficial: https://www.advancedfx.org/
- Pegar a versão mais recente estável pro CS2 (não CS:GO antiga)
- Extrair em `C:\FragReel\client\vendor\hlae\`
- Validar: `C:\FragReel\client\vendor\hlae\HLAE.exe` existe

### 7.3 Primeiro spike: rodar HLAE manualmente contra uma demo

Antes de automatizar, validar que HLAE+CS2 funciona no teu PC:

1. Abrir HLAE.exe
2. "Launch Custom Loader" → selecionar CS2.exe
3. No console do CS2: `exec afx/updateworkaround`
4. Abrir demo: `playdemo <caminho-da-.dem>`
5. `demo_gototick 1610` (vai pro tick do primeiro highlight do mock)
6. Capturar via `startmovie fragreel/frame png` por 12s
7. Parar: `endmovie`
8. Verificar se gerou PNGs em `<CS2>/fragreel/frame_0000.png...`

### 7.4 Automatizar via .vdm script

Criar `scripts/vdm_generator.py` no client que recebe:

```python
generate_vdm(demo_path, start_tick, end_tick, output_dir) -> Path
```

E escreve um `.vdm` com:

```
"demoactions"
{
  "1"  { "name" "start_capture" "factory" "PlayCommands" 
         "starttick" "<start>" "commands" "startmovie fragreel/frame png;host_framerate 300" }
  "2"  { "name" "stop_capture" "factory" "PlayCommands"
         "starttick" "<end>" "commands" "endmovie" }
}
```

### 7.5 Integração Python↔Node↔HLAE

Criar `client/hlae_runner.py` que:

1. Recebe render plan do servidor (`POST /matches/{id}/render-plan`)
2. Lança CS2 via HLAE Custom Loader (subprocess, headless)
3. Passa `.vdm` como playdemo arg
4. Monitora pasta de output do CS2 pra saber quando capture termina
5. Chama `npx remotion render HighlightsReel --props '<plan>'` com `gameplayPngDir` no props
6. Retorna path do MP4 final

### 7.6 Bundle no PyInstaller (`.exe`)

Atualizar `client.spec` pra incluir:

- `vendor/hlae/**` (binários HLAE)
- `vendor/node/**` (Node 20 portable)
- `vendor/remotion/**` (preciso descobrir o melhor jeito — talvez `npm pack` → bundle tarball)
- `vendor/ffmpeg/ffmpeg.exe`

Target: `.exe` instalador ~350MB (aceito pelo Mathieu).

### 7.7 GitHub Actions update

Atualizar `.github/workflows/release.yml` pra baixar HLAE + Node + Remotion + ffmpeg no build. Cuidado com quota de 10GB do GitHub Actions cache.

## 8. Regras inegociáveis

1. **Código público do client tem que permanecer MIT** (pré-requisito do SignPath Foundation pra code signing).
2. **Nunca expor JWT secret, API keys ou credenciais** em código commitado.
3. **Downloads de arquivos (HLAE, Node portable, etc.)** sempre precisam de OK explícito do Mathieu no chat — mesmo em auto mode.
4. **Não fazer force push em `main`** de nenhum repo.
5. **Testes do .exe antes de release** — rodar localmente no PC, validar que CS2 abre, HLAE captura, Remotion encoda, MP4 sai no Desktop.

## 9. Quando terminar no PC

Volta pro Mac e me (Mac-Claude) fala o que foi feito pelo chat. Se tiver bugs que precisam investigação cruzada, commita um `HANDOVER_MAC.md` na raiz listando o que descobriu, e eu retomo daqui.

## 10. Referências

- Repo main: https://github.com/mathieuanduze/fragreel
- Repo client: https://github.com/mathieuanduze/fragreel-client
- HLAE: https://www.advancedfx.org/
- Remotion docs: https://www.remotion.dev/docs
- Demoparser2 (rust): https://github.com/LaihoE/demoparser
- SignPath Foundation (code signing grátis OSS): https://signpath.org
