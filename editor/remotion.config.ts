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
// Sprint v5.7.18 (Mathieu 09/05/2026 round 3 — CORREÇÃO da descoberta
// tardia anterior, que estava INVERTIDA):
//
// PIPELINE REAL (verificado em render_coordinator.py:929 e :980):
//   Caminho normal:  Remotion render → output_mp4 FINAL ← user baixa ESSE
//   Fallback (degraded, raro): ffmpeg concat → output_mp4 cru sem edição
//
// Logo: settings AQUI são o encode FINAL no caminho normal. CRF do
// hlae_runner.py:1973-1975 só vale no degraded path (sem Remotion).
//
// History:
//   v0.6.59: bitrate fixo 7M  → comentário Mathieu "70MB não nítido"
//   v0.6.60: CRF 23 + medium → ainda muito (mismo issue, achávamos era
//            re-encode duplo, na verdade era ESTE config no Remotion)
//   v0.6.62 + v0.6.63: tweaked hlae_runner.py CRF 22 + slow + 128k →
//            irrelevante pro caminho normal (degraded only)
//   v0.6.62 outputs 200MB pra 2:21 reel (CRF 18 ainda ativo aqui)
//   v0.6.65 (este): CRF 18 → 23. Cálculo:
//     - CRF 23 + h264 1080p30 + CS2 motion = ~2.5-3.5 Mbps avg
//     - 141s × 3 Mbps / 8 = ~53 MB ✅ target share-friendly
//
// Tradeoff CRF 23 vs 18:
//   - 23 = visivelmente bom em screens de phone/laptop, MP4 manageable
//   - 18 = "lossless" archival, but 4x file size, plataformas vão
//     re-encodar pra 2-4 Mbps mesmo então quality acima é jogado fora
Config.setCrf(23);

// preset slow = ~25% mais lento mas 10-15% melhor compressão por bitrate
// (libx264 docs). Render de 141s reel sai em ~2-3 min ao invés de 1.5-2,
// diferença trivial pro user. Quality boost ~free pro target file size.
Config.setX264Preset("slow");
Config.setEnforceAudioTrack(false);
