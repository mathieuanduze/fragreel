/**
 * Compara duas strings de versão no formato `vX.Y.Z` (ou `X.Y.Z`).
 *
 * Retorna:
 *   <0  se `a` é menor que `b` (a é mais antiga)
 *    0  se iguais
 *   >0  se `a` é maior que `b`
 *
 * Aceita prefixo `v` opcional. Suffixos pré-release (-rc1, -beta) são
 * tratados como < release final do mesmo numero (semver loose).
 *
 * Exemplos:
 *   compareVersions("v0.2.7", "v0.2.9") === -1
 *   compareVersions("0.3.0", "v0.2.99") === 1
 *   compareVersions("v0.2.9", "v0.2.9") === 0
 */
export function compareVersions(a: string, b: string): number {
  const parse = (s: string) => {
    const stripped = s.trim().replace(/^v/i, "");
    const [core, pre] = stripped.split("-", 2);
    const parts = core.split(".").map((n) => parseInt(n, 10) || 0);
    while (parts.length < 3) parts.push(0);
    return { parts, pre: pre || null };
  };
  const A = parse(a);
  const B = parse(b);
  for (let i = 0; i < 3; i++) {
    if (A.parts[i] !== B.parts[i]) return A.parts[i] - B.parts[i];
  }
  // Mesmo X.Y.Z: pré-release é menor que release final.
  if (A.pre && !B.pre) return -1;
  if (!A.pre && B.pre) return 1;
  if (A.pre && B.pre) return A.pre.localeCompare(B.pre);
  return 0;
}

/** True se `local` é mais antigo que `required`. Tolerante a null/undefined. */
export function isOutdated(local: string | null | undefined, required: string): boolean {
  if (!local) return false; // versão desconhecida não é "outdated" — é offline
  return compareVersions(local, required) < 0;
}
