# HANDOVER_MAC — Round 4c PC → Mac (2026-04-22)

> **Pro Mac-Claude:** começo lendo este arquivo + `HANDOVER_PC.md` (§7.5.1 em diante). Round 4c — a parte Windows-only do pipeline — está **fechada e validada end-to-end**. O PC ficou pronto pra render one-click. O que falta é composição visual (Remotion), polish de UX e bundle — tudo fácil de fazer no Mac.

---

## TL;DR do que o PC-Claude fez

**Fluxo one-click validado:** user clica "Renderizar" no site → Python client roda CS2 invisível no PC via injeção ctypes → HLAE captura 1080p@300fps → ffmpeg vira ProRes 4444 → AdModal polla `/render/status` local enquanto ads rolam. Zero terminal, zero clique dentro do CS2, zero alteração de display mode, janela sem Alt+Tab, input bloqueado.

**Log do último run (2026-04-22):**

```
INFO CS2 launch resolution: 1920x1080 (desktop 1920x1080)
INFO injected AfxHookSource2.dll → hModule=0xbbd80000
INFO hid 1 CS2 window(s) offscreen (total 1)
INFO captured frames: 66 … 1374
INFO capture done: take=take0000 frames=1374
INFO cleaned up 7.9 GB of source TGAs at take0000
INFO ProRes written: C:\temp\test.mov  (3.4 GB, 1920x1080, ProRes 4444)
```

CS2 saiu sozinho via `mirv_cmd quit` — sem force-terminating.

---

## Arquivos novos / modificados

### Repo `main` (fragreel) — **commitar esses**

| Arquivo | O que mudou |
|---|---|
| `HANDOVER_PC.md` | §7.3, §7.4, §7.5, §7.5.1–7.5.6 — doc completa. Tabela Round 4 atualizada. |
| `HANDOVER_MAC.md` | (este arquivo) |
| `web/lib/local.ts` | +helpers: `renderPreflight`, `startLocalRender`, `getLocalRenderStatus`, `cancelLocalRender` + tipos `LocalRenderSession`, `LocalRenderPlan`, etc. |
| `web/app/match/[id]/MatchClient.tsx` | `handleStartGenerate` try-local-first: ping + preflight + convert ticks (×64) + startLocalRender. Fallback pro server se client offline. Modal "Feche o CS2" quando busy. |
| `web/components/AdModal.tsx` | Prop `localRenderMode`. Poll dual-target (`/render/status` local a cada 2s OU `getRenderStatus` server a cada 3s). Progresso da barra vem de `session.progress` quando local. Cancel chama `cancelLocalRender()` ao fechar. |

### Repo `client` (fragreel-client) — **commitar os .py, NÃO commitar vendor/**

| Arquivo | O que é |
|---|---|
| `cs2_launcher.py` **(novo)** | Injector ctypes: `CreateProcessW` suspended + `SetDllDirectoryW` + `LoadLibraryW(AfxHookSource2.dll)` + `ResumeThread`. Também: `move_process_windows_offscreen()`, `kill_running_cs2()`, `find_running_cs2_pids()`, `get_desktop_resolution()`, `_hide_and_disable()` (WS_EX_TOOLWINDOW + EnableWindow false). |
| `hlae_runner.py` **(novo)** | `HlaeRunner`: stage_capture_cfg, launch_cs2(INJECT), wait_for_capture (polling take dir), convert_tga_to_prores (ffmpeg + auto cleanup TGAs), render_remotion (stub). `RenderPlan` dataclass, `LaunchStrategy.INJECT | MANUAL`. CLI: `python hlae_runner.py --plan X.json --stage all`. |
| `render_coordinator.py` **(novo)** | State machine + threading. Uma render por vez. `preflight()`, `start(plan, force_kill_cs2=False)` raises `CS2BusyError`. Estados: staging/launching/capturing/converting/rendering/done/error/cancelled. Progress budget por stage. |
| `scripts/capture_script.py` **(novo)** | Gera `.cfg` com `mirv_cmd addAtTick` pra HLAE. Pre_seek automático (10000 ticks → seek a 9900 no tick 1 pra user não esperar 2min). Killfeed pin via `mirv_deathmsg localPlayer <xuid>`. Steam64→Account ID conversion. Graceful shutdown `quit` no end_tick+10. |
| `scripts/sample_plan.json` **(novo)** | Plan de teste CLI. |
| `scripts/__init__.py` **(novo)** | empty module marker. |
| `local_api.py` | +endpoints: `POST /render`, `GET /render/status`, `POST /render/cancel`, `GET /render/preflight`. Auto-builds `RenderCoordinator` via `_build_render_coordinator()` (detecta CS2 + HLAE). |

### Binários (NÃO commitar — 200MB+)

- `client/vendor/hlae/` — HLAE 2.189.9 (root = 32-bit CS:GO legacy, ignorar) + `x64/` (AfxHookSource2.dll 64-bit + 60 deps) + `ffmpeg/bin/ffmpeg.exe` (96MB gyan.dev 8.1-essentials).

**Ação sugerida:** adicionar `vendor/` ao `.gitignore` do client e criar `setup.py` ou `install_vendor.py` que baixa HLAE + ffmpeg na primeira instalação. Paths canônicos:

```
HLAE: https://github.com/advancedfx/advancedfx/releases (latest stable)
ffmpeg: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip
```

---

## 6 bugs descobertos e corrigidos (diário de caça)

Cada um custou uma iteração real com o user. Anoto pra futuro não cair de novo:

1. **`startmovie` silencioso em CS2.** É CS:GO-only. CS2 usa `mirv_streams add normal default` + `mirv_streams record name <x>` + `mirv_streams record start`. Output: **TGA** (não PNG), em `<CS2>/game/bin/win64/<record_name>/takeNNNN/<stream>/00000.tga`.

2. **`.vdm` adjacente não auto-carrega em CS2.** Source 2 abandonou a convenção VDM. Substituto é `mirv_cmd addAtTick <tick> <cmd>` — scheduler tick-based do HLAE. Uma linha por comando (não suporta `;`). Exporta/importa XML mas o padrão prático é gerar `.cfg` com N lines `addAtTick` e usar `exec <cfg>`.

3. **`AfxHookSource.dll` na raiz do HLAE é 32-bit (CS:GO legacy).** Pra CS2 (64-bit) usar **`x64/AfxHookSource2.dll`** (4.3MB, Source 2). Todas as deps 64-bit (msvcp140, Imath, OpenEXR, ucrtbase, …) estão em `x64/`. O SetDllDirectoryW tem que apontar pra `x64/`, não pro root.

4. **Minimizar janela quebra captura no Source 2.** `IsIconic(hwnd)` → engine skippa `Present()` → mirv_streams grava 0 frames. Fix: `SetWindowPos(hwnd, NULL, -32000, -32000, ...)`. Offscreen mas Windows considera "visible" → Present dispara normal.

5. **CS2 aparece em primeiro plano + user pode interagir.** Default poll era 250ms com settle 2s — janela visível+focada por 2s. Fix: poll 100ms sem settle, move ao ver primeira janela, continua watching 4s pra pegar splash→D3D main swap. Defesa em profundidade contra input: `EnableWindow(hwnd, FALSE)` (input bouncia) + `WS_EX_TOOLWINDOW | WS_EX_NOACTIVATE` (some do Alt+Tab, não rouba foco).

6. **Desktop fica em resolução baixa após render.** CS2 salvou fullscreen no config; `TerminateProcess` não deixa CS2 restaurar display mode → tudo vira gigante até user fixar manualmente. Fix triple: (a) `-windowed -w <desktop_w> -h <desktop_h>` (matching nativo pra não ter mode change); (b) `+mat_fullscreen 0` cvar; (c) `mirv_cmd addAtTick <end+10> quit` + `terminate_cs2()` espera 8s grace antes de force-kill.

---

## O que está pendente

### Prioritário (Round 4d start)

1. **Remotion integration real.** Hoje o runner para no `.mov` ProRes. O `render_remotion()` em `hlae_runner.py:370` é stub — assume que `editor/` tem a composition `HighlightsReel`. Precisa:
   - Render plan real do servidor → Remotion props (`gameplayVideoSrc`, `highlights`, `kills`, `mood`, `musicUrl`, `orientation`, …)
   - Composition `HighlightsReel` precisa aceitar `gameplayVideoSrc` como `<OffthreadVideo>` backdrop (HANDOVER §3.3)
   - Output final .mp4 em `%USERPROFILE%\Desktop\FragReel\<demo_basename>.mp4`

2. **Web build test + CTA polish.** Não tenho `node_modules` em `main/web/` na máquina do user. Precisa:
   - `cd main/web && npm install && npm run build` — verificar types/build passa
   - AdModal: quando `localRenderMode && state==="done"`, mostrar CTA "Abrir pasta" (file:// ou botão que copia path) em vez do botão "Baixar" (que está oculto porque `downloadUrl=null`).

3. **Setup vendor/ sem git.** Criar `client/setup_vendor.py` (ou integrar no `main.py`) que baixa HLAE + ffmpeg se `vendor/hlae/x64/AfxHookSource2.dll` não existir. Primeira run do client pós-install faz isso.

### Deferido (Round 4d polish / Round 5)

4. **PyInstaller bundle.** Atualizar `FragReel.spec` pra incluir vendor/hlae + scripts/. Testar que `.exe` resultante roda o fluxo one-click em máquina limpa. Target ~350MB.
5. **GitHub Actions release.** Atualizar `.github/workflows/release.yml` pra baixar HLAE/ffmpeg no build (caching cuidadoso, 10GB quota).
6. **Defuse Bar** (HANDOVER original 4b → movido pra Round 5).
7. **Lower Thirds em cena.** Componente `LowerThird.tsx` existe e está pronto, só não usado. Pode integrar no Outro ou em special scenes.

---

## Comandos pra retomar no Mac

```bash
# 1. Pull dos repos
cd ~/FragReel/fragreel && git pull
cd ~/FragReel/fragreel-client && git pull

# 2. Ler os handovers
open ~/FragReel/fragreel/HANDOVER_MAC.md
open ~/FragReel/fragreel/HANDOVER_PC.md

# 3. Continuar o trabalho (Remotion + UX polish)
cd ~/FragReel/fragreel/editor
npm run dev   # Remotion Studio
```

---

## Prompt pra iniciar a sessão Mac-Claude

> Cola isso no `claude` depois de abrir o repo no Mac. Inclui contexto suficiente pra Mac-Claude pegar de onde o PC-Claude parou, sem me forçar a re-explicar tudo.

```
Voltei do PC. O Round 4c (HLAE + CS2 headless) está fechado — tudo
validado end-to-end no Windows. Antes de qualquer coisa, lê na ordem:

1. HANDOVER_MAC.md (raiz do repo main) — resumo do que mudou + 6 bugs
   descobertos + pendências priorizadas.
2. HANDOVER_PC.md §7.5.1 em diante — arquitetura one-click completa.

Não execute nada, não crie plano ainda. Me mostra um resumo do que
entendeu do estado atual e me diz qual dos 3 prioritários tu atacaria
primeiro:

(A) Remotion integration: consumir o .mov do ProRes e compor .mp4 final
    com overlays/música (HighlightsReel composition precisa aceitar
    gameplayVideoSrc via OffthreadVideo).
(B) Web build: rodar npm install + npm run build em main/web/ e validar
    que os types das mudanças de local.ts/AdModal.tsx/MatchClient.tsx
    ficaram limpos. Polir o CTA "Abrir pasta" quando localRenderMode=done.
(C) Setup vendor/: criar setup_vendor.py que baixa HLAE+ffmpeg na primeira
    run do client (pra repo poder ser clonado sem os 200MB de binários).

Minha preferência é (A) — é onde o Mac tem vantagem (Remotion já está
ajustado aqui, dev server roda em segundos) e é o último bloqueio pro
user ter um .mp4 no Desktop no fim do flow. (B) e (C) são polish.
```
