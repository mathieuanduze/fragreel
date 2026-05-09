# Killfeed Icons — Source

**Repo**: https://github.com/exkludera-cssharp/killfeed-icons

**Status**: Mathieu confirmou (09/05/2026) que pode redistribuir.

## Uso pretendido

Sprint backlog (DEFER pós-test atual): renderizar modifier icons no killfeed
do editor (HighlightScene.tsx) ao lado do weapon icon — wallbang, jump,
noscope, blind kill, through smoke. Format CS2 vanilla.

Hoje killfeed renderiza `[KILLER] [weapon icon] [HS icon] [VICTIM]`.
Próximo sprint adicionar `[modifier icons]` entre weapon e HS.

## Fields que chegam no editor (PC diag confirmou populated)

```
kill.noscope        bool  — AWP no-scope
kill.thrusmoke      bool  — kill através de smoke
kill.penetrated     int   — wallbang count (0 = sem)
kill.attackerblind  bool  — attacker estava cego
kill.attackerinair  bool  — jumping kill
```

## TODO quando atacar sprint

1. Fork ou git submodule do repo killfeed-icons em `editor/public/cs2-icons/modifiers/`
2. Map field → SVG file:
   - `noscope` → `noscope.svg`
   - `thrusmoke` → `smoke.svg`
   - `penetrated > 0` → `penetration.svg` (ou `wallbang.svg`)
   - `attackerblind` → `blind.svg`
   - `attackerinair` → `jumping.svg`
3. Render condicional no killfeed row, entre weapon icon e HS icon
4. Tamanho proporcional ao weapon icon (~24×24 vertical, ~22×22 horizontal)
5. Cor mantém branco/accent — não inventar paleta nova

## Histórico

- v0.6.49: implementado WALLBANG/NO SCOPE labels grandes overlay no centro do gameplay → REMOVIDOS na v0.6.50 (Mathieu spec "nunca pedi essas tags")
- A diferença pra agora: ícones PEQUENOS no killfeed row (não overlay), igual CS2 vanilla
