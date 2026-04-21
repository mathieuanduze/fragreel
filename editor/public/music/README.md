# Music — Royalty-free tracks (CC0)

Este diretório contém as 4 tracks usadas pelos HighlightsReel por mood.

## Arquivos obrigatórios

| Arquivo | Mood | BPM alvo | Sugestão Pixabay (CC0) |
|---|---|---|---|
| `eletronica.mp3` | Eletrônica (🎧) | 140 | "Cyberpunk 2099" by DimmySad · `pixabay.com/music/id-10269` |
| `acao.mp3` | Ação (⚡) | 128 | "Powerful Sport" by QubeSounds · `pixabay.com/music/id-123445` |
| `heroico.mp3` | Heroico (🦸) | 120 | "Epic Cinematic" by DanielLelux · `pixabay.com/music/id-116065` |
| `chill.mp3` | Chill (😎) | 90 | "Lofi Chill" by Coma-Media · `pixabay.com/music/id-112191` |

> Os IDs acima são exemplos. Escolha qualquer track CC0 do Pixabay Music que bata com o BPM alvo — o BPM está declarado em `src/theme.ts` e é usado para sync de cortes.

## Como adicionar

1. Baixar o MP3 do Pixabay (botão "Download" na página da música — login grátis)
2. Renomear pro nome exato acima
3. Colocar neste diretório
4. Rodar `npm run dev` no `/editor` para confirmar no Studio

## Duração

O reel mais longo possível é ~40s (1 intro + 8 highlights + outro). Tracks de 2-4 minutos são suficientes. O Remotion corta automaticamente no `durationInFrames` da composição.

## Licença

Todas as tracks devem ser CC0 (Creative Commons Zero) ou explicitamente royalty-free com uso comercial permitido. Pixabay Music é o melhor lugar — tudo lá é CC0.

**NÃO use YouTube Audio Library** — muitas tracks lá exigem atribuição, o que polui o outro do vídeo.
