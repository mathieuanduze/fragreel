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
// Sprint v5.7.15 (Mathieu 09/05/2026): "tô achando a qualidade muito
// baixa, não tem uma qualidade um pouco melhor, mas que não pegue tanto
// espaço pra baixar?"
// Bumped 4M → 7M. Numbers reais:
//   4 Mbps × 90s = 45 MB
//   7 Mbps × 90s = 79 MB
// 7M é o "sweet spot" entre qualidade e share — TikTok/Instagram aceitam
// até 25Mbps mas re-comprimem agressivamente acima de 8Mbps. 7M dá
// preserva mais detalhe na recompression sem sair do "shareable".
// Trade: filesize ~75% maior, mas ainda dentro do limite de Discord
// Nitro (50MB) / Whatsapp (100MB) pra reels curtos.
Config.setVideoBitrate("7M");
Config.setEnforceAudioTrack(false);
