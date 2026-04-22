import { Config } from "@remotion/cli/config";

// Config alinhado ao guia "Best Practices de Edição CS:GO para Remotion"
// (ver Obsidian: nota 09). Target: H.264 High 4.2, 50 Mbps target / 60 Mbps max,
// CRF 18 pra qualidade superior, pixel format yuv420p pra compat máxima.

Config.setVideoImageFormat("jpeg");
Config.setConcurrency(1); // single-thread pra estabilidade no Railway/PC modesto
Config.setCodec("h264");
Config.setPixelFormat("yuv420p");
// Guia canônico (Obsidian nota 09): target 50 Mbps, max 60 Mbps. Remotion não
// aceita CRF + bitrate juntos — escolhemos bitrate fixo pra atingir o target
// declarado do guia. Trade-off: bitrate fixo é menos "smart" que CRF, mas
// reproduz exatamente a qualidade-alvo recomendada pra fragmovies CS.
Config.setVideoBitrate("50M");
Config.setEnforceAudioTrack(false);
