# Music — Royalty-free tracks (CC0)

Este diretório contém as tracks usadas pelos HighlightsReel por mood.

## Sprint #6.4 (05/05) — multi-variant per mood

Cada mood pode ter MÚLTIPLAS variants. User picks via UI no match-page.
Schema em `editor/src/theme.ts MOODS[mood].tracks` é um array `{ file, label }[]`.
UI variant picker em `web/app/match/[id]/MatchClient.tsx` aparece auto
quando mood tem >1 track.

## Arquivos atuais (1 variant per mood)

| Arquivo | Mood | BPM alvo | Sugestão Pixabay (CC0) |
|---|---|---|---|
| `eletronica.mp3` | Eletrônica (🎧) | 140 | "Cyberpunk 2099" by DimmySad · `pixabay.com/music/id-10269` |
| `acao.mp3` | Ação (⚡) | 128 | "Powerful Sport" by QubeSounds · `pixabay.com/music/id-123445` |
| `heroico.mp3` | Heroico (🦸) | 120 | "Epic Cinematic" by DanielLelux · `pixabay.com/music/id-116065` |
| `chill.mp3` | Chill (😎) | 90 | "Lofi Chill" by Coma-Media · `pixabay.com/music/id-112191` |

> Os IDs acima são exemplos. Escolha qualquer track CC0 do Pixabay Music que bata com o BPM alvo — o BPM está declarado em `src/theme.ts` e é usado para sync de cortes.

## Adicionar nova variant

**Sem código novo necessário** — basta drop o MP3 + 2 edits manuais:

1. Drop em `editor/public/music/<mood>-<variant>.mp3`. Ex:
   - `acao-driving.mp3`
   - `acao-trap.mp3`
   - `heroico-epic.mp3`

2. Edit `editor/src/theme.ts` `MOODS[mood].tracks` adicionar entry:
   ```ts
   tracks: [
     { file: "music/acao.mp3", label: "Original" },
     { file: "music/acao-driving.mp3", label: "Driving" },
     { file: "music/acao-trap.mp3", label: "Trap" },
   ],
   ```

3. Edit `web/app/match/[id]/MatchClient.tsx` `MOOD_VARIANTS[mood]` espelhando labels:
   ```ts
   acao: [
     { label: "Original" },
     { label: "Driving" },
     { label: "Trap" },
   ],
   ```

UI variant picker auto-aparece. Próximo render usa o variant escolhido.

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
