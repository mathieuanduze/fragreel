import { Config } from "@remotion/cli/config";

// Config alinhado ao guia "Best Practices de Edição CS:GO para Remotion"
// (ver Obsidian: nota 09). Target inicial era H.264 High 4.2, 50 Mbps —
// REVISADO em Fase 1.11 (ver abaixo): bitrate dropado pra 4M.

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(1); // single-thread pra estabilidade no Railway/PC modesto
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Round 4c Fase 1.11 — Mathieu reportou MP4 final 180MB ("não dá pra
// compartilhar vídeo desse tamanho"). Guia original sugeria 50Mbps mirando
// "qualidade superior pra fragmovie", mas os destinos finais (Reels/TikTok/
// Shorts/Discord/WhatsApp) re-encodam tudo em 2-4Mbps de qualquer jeito —
// uploadar em 50Mbps é desperdício de bandwidth + bloqueia compartilhamento
// (Discord free 25MB, WhatsApp 100MB, Telegram 2GB).
//
// Novo target: 4Mbps. Cálculo: 4Mbps × 90s = 45MB. Cabe em Discord Nitro
// (50MB) e perto do limite WhatsApp/Telegram. Plataformas vão re-encodar
// pra 2-4Mbps então estamos no sweet spot — qualquer bit acima é jogado fora.
//
// Sprint v5.7.16 (Mathieu 09/05/2026): "70mb pra 2min é pesado? blur
// backdrop tá deixando pesado?"
//
// Diagnóstico: setVideoBitrate("7M") força bitrate FIXO em cada frame.
// Cenas estáticas (intro fade, blur backdrop calmo, outro) gastam 7M
// igual cenas de ação. Desperdício: ~30-40% do filesize são bits que
// não melhoram qualidade visual.
//
// Switch pra CRF (Constant Rate Factor):
//   - ffmpeg decide bitrate por região/frame
//   - Áreas blurry/estáticas → low bitrate (eficiente)
//   - Gameplay sharp + ação rápida → high bitrate (preserva detalhe)
//   - Mesma qualidade VISUAL, filesize ~30-40% menor
//
// CRF 23 é o sweet spot ffmpeg "good quality":
//   18 = visually lossless (huge files)
//   23 = high quality (default ffmpeg)
//   28 = acceptable quality (smaller files)
//
// Trade: filesize varia (não é previsível como bitrate fixo). Cenas
// sintéticas (Outro stats) podem render em 1-2MB. Cenas com gameplay
// rápido em 6-8MB. Average para reel 90s típico: 30-50MB.
//
// Numbers esperados pra 2min reel mixed (gameplay + intro/outro):
//   antes (7M fixed): ~70MB
//   depois (CRF 23):  ~40-50MB (~35% redução)
Config.setCrf(23);
Config.setEnforceAudioTrack(false);
