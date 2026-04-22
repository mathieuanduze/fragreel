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
- `theme.ts`: `MUSIC_ENABLED = true` · `DIMENSIONS`/`getDimensions()` · helpers `s2f`, `clampHighlightSec`, `killTimeInSceneSec`, bounds por formato · `SPRING` tokens canônicos (punch/pop/glide)
- **Novo `components/LowerThird.tsx`** — banner broadcast (esquerda ou centro) com title + subtitle + barra de acento mood color. Pronto pra usar em qualquer cena (Outro, scenes especiais, defuse moments). Adapta vertical/horizontal automaticamente.
- `remotion.config.ts`: codec H.264 50 Mbps bitrate-fixed (ver 4.1)

### 5.4 API (`fragreel/api`)

- `routes/renders.py`: 
  - `_format_config` mapeia `recap` → composition `Recap` (não cai mais em reel)
  - `_run_render` migrou pra `Popen` + streaming de stdout
  - `_parse_progress` extrai progresso real via regex (`Rendered X/Y`, `Stitched X/Y`, `XX.X%`)
  - `job.progress` cresce de 0→0.95 durante render · vira 1.0 só quando subprocess sai com 0
- `routes/matches.py`:
  - `generate_video` injeta `orientation` nas props enviadas pro Remotion. Card sempre vertical.
  - **Novo:** `POST /matches/{id}/render-plan` retorna preview de duração antes do render. Mesma seleção do `/generate` mas só calcula. Útil pra UI mostrar "vídeo terá X s · Y cenas" antes do user assistir o ad.
  - Constants espelham editor (`_REEL_INTRO_SEC=2.0`, `_RECAP_BOUNDS=(4,10)`, etc) — TODO: extrair pra `editor_constants.py` quando crescer.
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
| **4b** | Kill feed timing/posição + orientation toggle + endpoint `/render-plan` + spike Python↔Node. Defuse Bar movido pro Round 5; Lower Thirds componente pronto (não usado em cena ainda) | Mac | ✅ concluído |
| **4c** | HLAE spike + capture_script.py (mirv_cmd) + hlae_runner.py MVP. Auto-launch CS2 + bundle .exe → deferido 4d | **PC** | 🟡 7.2-7.5 MVP pronto · 7.6/7.7 pendentes |
| **4d** | Auto-launch CS2, Remotion integration, bundle PyInstaller 350MB, polish, v0.2.0 ponta-a-ponta | Mac+PC | ⏳ pendente |

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

### 7.3 Primeiro spike: rodar HLAE manualmente contra uma demo ✅ validado 2026-04-22

Antes de automatizar, validar que HLAE+CS2 funciona no teu PC:

1. Abrir HLAE.exe
2. Launcher → **Counter-Strike 2** (não "Launch any program") → aponta pro `cs2.exe`, argumentos `-insecure -novid +playdemo replays/<basename>`, checkbox "Custom Loader / AfxHookSource" marcado → Run
3. Console do CS2 (`~`). **Nota:** em CS2 moderno o `exec afx/updateworkaround` falha silenciosamente — o cfg não vem mais no HLAE. Ignorar; só reativar se z-buffer vier com flicker (caso AMD).
4. Confere que o hook está injetado: `mirv_streams` (sem args) deve imprimir subcomandos `add / edit / remove / print / record / settings`. Se der "Unknown command", o hook não injetou e CS2 foi aberto fora do Custom Loader.
5. Com demo tocando: `demo_pause` → `demo_gototick <N>`
6. Captura canônica (substitui `startmovie`, que é vestígio de CS:GO e **não gera arquivos** em CS2):
   ```
   mirv_streams add normal default
   mirv_streams record name fragreel
   host_framerate 300
   host_timescale 0
   mirv_streams record start
   demo_resume
   ```
7. Após alguns segundos: `mirv_streams record end`
8. Output: `<CS2>/game/bin/win64/fragreel/take0000/default/NNNNN.tga` + `audio.wav`. Formato default é **TGA** 1920×1080 RGB24 (~6.2 MB/frame), não PNG.

**Resultado do spike (PC-Windows, 2026-04-22):** 1000 frames TGA, 3.33s @ 300fps, sem flicker z-buffer (AMD workaround não necessário neste PC). HLAE v2.189.9 em `C:\FragReel\client\vendor\hlae\`.

### 7.4 Automatizar via script .cfg com `mirv_cmd`

**⚠️ Descoberta 2026-04-22:** `.vdm` adjacente **NÃO é auto-carregado** em CS2. A convenção foi abandonada na migração Source 1 → Source 2. Em seu lugar, HLAE expõe `mirv_cmd` como scheduler tick-based canônico:

```
mirv_cmd addAtTick <iTick> <command-parts…>   # agenda 1 comando
mirv_cmd clear | print | load <xml> | save <xml>
```

Cada `addAtTick` agenda **exatamente um** comando (sem `;` multiplexado). Pra vários comandos no mesmo tick, emite várias linhas.

Criar `scripts/capture_script.py` (substitui o `vdm_generator.py` descartado):

```python
generate_capture_cfg(output_path, segments, *,
                     user_account_id=None, user_steamid64=None,
                     record_name="fragreel", stream_name="default",
                     host_framerate=300, killfeed_lifetime_sec=90,
                     extra_start_commands=(), extra_end_commands=()) -> Path
```

- `segments`: lista de `(start_tick, end_tick)` — suporta N highlights num único .cfg
- `user_steamid64`: SteamID64 do user (de `steam_detect.find_active_steamid()`); convertido internamente pra Account ID (SteamID3 = SteamID64 - 76561197960265728). Plugado em `mirv_deathmsg localPlayer <xuid>` pra pinar killfeed do user.

Estrutura do `.cfg` gerado (exemplo: 1 segmento 10000..10900, user XUID 311341615):

```
mirv_cmd clear

// segment 0: ticks 10000 .. 10900
mirv_cmd addAtTick 10000 mirv_streams add normal default
mirv_cmd addAtTick 10000 mirv_streams record name fragreel
mirv_cmd addAtTick 10000 mirv_deathmsg lifetime 90
mirv_cmd addAtTick 10000 mirv_deathmsg localPlayer 311341615
mirv_cmd addAtTick 10000 host_framerate 300
mirv_cmd addAtTick 10000 host_timescale 0
mirv_cmd addAtTick 10000 mirv_streams record start
mirv_cmd addAtTick 10900 mirv_streams record end
mirv_cmd addAtTick 10900 host_framerate 0
mirv_cmd addAtTick 10900 host_timescale 1
```

**Placement:** `<CS2>/game/csgo/cfg/fragreel/capture.cfg`. Uso: `exec fragreel/capture` no console do CS2 **após** `playdemo` e **antes** do tick de start.

**Validação 7.3+7.4:** spike manual direto no console funcionou (1000 frames TGA). VDM adjacente NÃO disparou. `mirv_cmd` validado via docs HLAE + parcialmente via spike. `.cfg` gerado aguarda teste end-to-end in-game.

### 7.5 Integração Python↔HLAE↔Remotion

`client/hlae_runner.py` orquestra o lado PC:

```
render_plan (JSON do servidor /matches/{id}/render-plan)
   ↓
[stage_capture_cfg]   chama generate_capture_cfg → escreve
                      <CS2>/game/csgo/cfg/fragreel/capture.cfg
   ↓
[launch_cs2]          MVP: LaunchStrategy.MANUAL (imprime instruções)
                      TODO 4d: LaunchStrategy.HLAE_CLI ou INJECTOR
   ↓
[wait_for_capture]    polling em <CS2>/game/bin/win64/<record>/takeNNNN
                      detecta novo take + estabilidade de frame count
   ↓
[convert_tga_to_prores]  ffmpeg TGA seq + audio.wav → ProRes 4444 .mov
                         (pix_fmt yuva444p10le, compat Chromium/Remotion)
   ↓
CaptureResult           passa pra Remotion render (stage 5, chain externa)
```

**API (dataclasses):**

```python
RenderPlan(demo_path, segments: tuple[(start_tick, end_tick), ...],
           user_steamid64, record_name="fragreel", stream_name="default")
HlaeRunnerConfig(cs2_install, hlae_dir, ffmpeg_exe=None)
CaptureResult(take_dir, stream_dir, frame_count, audio_path)
LaunchStrategy.MANUAL | HLAE_CLI | INJECTOR
```

CLI: `python hlae_runner.py --plan plan.json --stage {cfg|launch|wait|convert|all}`.

**Estado atual (PC spike 2026-04-22):**

- ✅ `stage_capture_cfg` validado (gera .cfg idempotente, killfeed pinado, pre_seek automático antes do primeiro highlight pra não esperar 2min de playback)
- ✅ `launch_cs2(INJECT)` — **injetor Python nativo via ctypes** (`client/cs2_launcher.py`). CreateProcess CS2 suspended + SetDllDirectoryW + LoadLibraryW(`AfxHookSource.dll`) + ResumeThread. Mesmo padrão que `injector.exe` do HLAE, mas sem GUI. Zero dependência externa (só stdlib). Args passados: `-insecure -novid +playdemo replays/X +exec fragreel/capture` → fluxo fully-auto.
- ✅ `launch_cs2(MANUAL)` fallback preservado (imprime instruções pra user clicar no HLAE.exe)
- ✅ `wait_for_capture` testado via simulação (take dir + frame stability)
- ✅ `convert_tga_to_prores` implementado; aguarda teste com TGAs reais
- ⏳ Integração Remotion (`npx remotion render` consumindo `.mov`) — próximo step depois que o fluxo end-to-end for confirmado

**Comando one-shot (dev, via CLI):**

```powershell
cd C:\FragReel\client
python hlae_runner.py --plan scripts\sample_plan.json --stage all --timeout 120 --output-mov C:\temp\test.mov
```

Faz tudo: escreve cfg → spawna CS2 injetado → CS2 abre sozinho → demo carrega → auto-seek pra ~100 ticks antes do highlight → captura dispara → end_tick auto-finaliza → ffmpeg TGA→ProRes → CS2 fechado → path do .mov impresso. **Zero clique do usuário dentro do CS2.**

### 7.5.1 Fluxo production: um clique no site (arquitetura)

> Modelo de negócio exige que o user fique na página assistindo ads enquanto a mágica acontece. CLI é só pra dev.

Componentes novos no client (2026-04-22):

- **`client/render_coordinator.py`** — máquina de estados: `idle → staging → launching → capturing → converting → rendering → done`. Uma render por vez (paralelo quebra compartilhamento do `fragreel/take0000/`). Callback de progresso incrementa `frames_captured / frames_expected` — estimativa é `Σ(end-start) × 300/64` frames.
- **`client/cs2_launcher.py`** ganha:
  - `kill_running_cs2()` via `taskkill /F /IM cs2.exe` — CS2 aberto do user é terminado antes do render (colisão com `fragreel/take*`). Future: detectar se já é nosso hook + attach em vez de killar.
  - Janela **minimizada** (`SW_SHOWMINNOACTIVE` no STARTUPINFO + `ShowWindow(SW_MINIMIZE)` após window aparecer via `EnumWindows`). `-windowed -w 1280 -h 720` evita fullscreen (que rouba foco).
  - `minimize_process_windows(pid)` roda em thread daemon depois do resume.
- **`client/local_api.py`** ganha endpoints:
  - `POST /render` — body `{demo_path, segments:[{start_tick,end_tick}...], user_steamid64?}`. Retorna 202 + `RenderSession`.
  - `GET /render/status` — poll target do `AdModal` no web. Retorna state + progress 0..1 + paths de output quando ready.
  - `POST /render/cancel` — mata CS2 + estado vira `cancelled`.
  - `_build_render_coordinator()` auto-detecta CS2 (via `steam_detect._cs2_roots()`), HLAE (em `vendor/hlae`), `output_dir = ~/Desktop/FragReel`, `editor_dir = ../main/editor`. Se algo faltar, endpoints retornam 503 e web degrada graciosamente.

**Fluxo web:**

```
fragreel.vercel.app/match/{id}
  ↓ usuário clica "Renderizar"
  ↓ AdModal inicia ad #2
POST http://127.0.0.1:5775/render  {demo_path, segments}
  ← 202 Accepted {render_id, state:staging, progress:0.03}
  ↓
loop 2s: GET /render/status
  ← {state:capturing, progress:0.42, frames_captured:590, ...}
  ← {state:converting, progress:0.82, output_mov:"...Desktop\FragReel\xyz.mov"}
  ← {state:done, progress:1.0, output_mp4:"...Desktop\FragReel\xyz.mp4"}
  ↓ ad termina, CTA "✓ Salvo em Desktop\FragReel\"
```

CS2 roda minimizado na bandeja do Windows; user pode navegar, alt-tab, minimizar o próprio navegador. Não precisa clicar em nada dentro de CS2 nem do HLAE. Mouse/teclado totalmente livres pro ad.

### 7.5.2 Testes passantes

- `capture_script.py`: 13 testes (validação, cfg content, pre_seek)
- `hlae_runner.py`: 6 testes (RenderPlan, stage_capture_cfg, take detection, wait_for_capture via simulação, MANUAL launch, INJECT path resolution)
- `render_coordinator.py` / `local_api.py`: import + coord build + Flask routes OK
- Capture pipeline validado end-to-end 2 vezes em demo real (1405 frames auto, 1395 frames auto)
- ffmpeg 8.1 essentials (gyan.dev) instalado em `vendor/hlae/ffmpeg/bin/ffmpeg.exe` (96MB) — `resolved_ffmpeg()` retorna o path

### 7.5.3 Etiqueta com CS2 aberto

Decisão 2026-04-22: **não matamos** o CS2 do user por padrão. Fluxo:

- `kill_existing=False` agora é default em `launch_cs2_injected()`
- `RenderCoordinator.start()` levanta `CS2BusyError` se `find_running_cs2_pids()` retorna algo
- `POST /render` → **409 Conflict** `{error:"cs2_running", cs2_pids:[…], detail:"Close CS2 before rendering, or POST again with {force:true}"}`
- `GET /render/preflight` → web chama **antes** de abrir o AdModal (antes do ad começar), evitando gastar a dose de ad pra nada. Retorna `{ready:false, reason:"cs2_running"}` se ocupado.
- User quer forçar? POST body `{force:true}` chama `kill_running_cs2()` antes de lançar.

### 7.5.4 Web totalmente wired (one-click real)

- `web/lib/local.ts` — helpers: `renderPreflight()`, `startLocalRender(plan)`, `getLocalRenderStatus()`, `cancelLocalRender()`. Tipos: `LocalRenderState`, `LocalRenderSession`, `LocalRenderPlan`, `RenderPreflight`.
- `web/app/match/[id]/MatchClient.tsx` — `handleStartGenerate` tenta local primeiro: `pingLocalClient()` → `getLocalDemos()` pra achar `demo_path` do match → `renderPreflight()`. Se pronto, converte `highlight.start/end` (segundos) em ticks (`× 64`) e chama `startLocalRender()`. Se CS2 rodando, abre modal "Feche o CS2". Se cliente offline, fallback pra server.
- `web/components/AdModal.tsx` — nova prop `localRenderMode`. Quando true, polling bate `/render/status` local (a cada 2s) em vez de `/renders/{id}/{format}/status` no servidor. Progresso vem de `session.progress` (frames capturados / estimado). Cancel chama `cancelLocalRender()` ao fechar modal.

### 7.5.5 Breakthroughs do headless (diário de caça ao bug)

- **Minimizar quebra captura.** Source 2 skippa `Present()` em `IsIconic(hwnd)` → mirv_streams grava 0 frames. Fix: mover janela pra (-32000,-32000) via `SetWindowPos`. Windows considera "visible", Present dispara, TGAs caem normalmente.
- **CS2 aparece em primeiro plano na boot.** Resolvido com poll 100ms (em vez de 2s de settle): move offscreen na primeira janela vista + continua watching 4s pra pegar splash→main swap.
- **User acidentalmente pausa/acelera demo.** Resolvido com (a) `EnableWindow(FALSE)` — input bouncia, teclado não chega; (b) `WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE` — janela fora do Alt+Tab.
- **Desktop fica enorme quando CS2 é killado.** CS2 salva fullscreen no config; ao ser TerminateProcess, não restaura display mode. Fix: `mirv_cmd addAtTick <end+10> quit` (shutdown gracioso) + `-windowed -w <native> -h <native>` (sem mode change) + `terminate_cs2()` vira safety net com 8s grace.
- **`AfxHookSource.dll` root é 32-bit (CS:GO legacy).** Pra CS2 é `x64/AfxHookSource2.dll` (4.3MB, Source 2). Deps 64-bit todas em `x64/`.
- **ffmpeg não vem no HLAE.** Pasta `ffmpeg/` vem vazia (só readme). Baixamos `gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip` 8.1, 96MB, instalamos em `vendor/hlae/ffmpeg/bin/`. `resolved_ffmpeg()` busca em `<hlae>/ffmpeg/bin/ffmpeg.exe`.
- **Disk usage.** 1920×1080 TGA = ~6.2MB/frame. 5s captura ≈ 1400 frames ≈ 8 GB. `convert_tga_to_prores(cleanup_tgas=True)` apaga o take dir após ProRes sair — MVP leve no disco.

### 7.5.6 Validado end-to-end (2026-04-22)

Run completo, CS2 **invisível do começo ao fim**, user **não consegue interagir**:

```
INFO cfg written
INFO CS2 launch resolution: 1920x1080 (desktop 1920x1080)
INFO injected AfxHookSource2.dll → hModule=0xbbd80000
INFO CS2 running, pid=3960
INFO hid 1 CS2 window(s) offscreen (total 1)
INFO captured frames: 66 … 1374
INFO capture done: take=take0000 frames=1374 audio=…audio.wav
INFO ffmpeg TGA→ProRes: …
INFO cleaned up 7.9 GB of source TGAs at take0000
INFO ProRes written: C:\temp\test.mov  (3.4 GB, 1920x1080, 300fps, ProRes 4444)
```

Graceful quit: CS2 saiu sozinho via `mirv_cmd addAtTick 10310 quit` — zero force-terminating.

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
