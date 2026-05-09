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
// Sprint v5.7.16 (Mathieu 09/05/2026 round 2 — descoberta tardia):
// PIPELINE TEM 2 ENCODINGS:
//   1. Remotion render → .mov intermediário (este config)
//   2. ffmpeg concat (hlae_runner.py) → MP4 final ← REAL output user vê
//
// Settings AQUI afetam só o intermediário .mov. Como ffmpeg sempre
// re-encoda pra MP4 final, settings finais (preset, crf) vivem no
// hlae_runner.py:1954-1962.
//
// Manter Remotion intermediate em alta qualidade (CRF 18 = quase
// lossless) garante que ffmpeg final tem source bom pra trabalhar.
// .mov intermediário é deletado pós-render, filesize não importa.
Config.setCrf(18);
Config.setEnforceAudioTrack(false);
