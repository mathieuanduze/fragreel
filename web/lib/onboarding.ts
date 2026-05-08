/**
 * Onboarding flags — controla quais banners de "primeira visita" o user
 * já dismissou.
 *
 * Sprint v5.7.9 (08/05/2026 Mathieu spec): "imagine um user que entra
 * pela primeira vez, ele já tem demos baixadas, vai aparecer umas demos
 * só que ele não vai entender de onde elas vieram, teria que ser mais
 * autoexplicativo".
 *
 * Storage: localStorage. Flags são opt-out (default false → banner
 * mostra). User clica X → flag vira true → nunca mais mostra (até
 * limpar storage manualmente).
 *
 * Keys:
 *   onboarding_minhas_demos: banner /matches "De onde vieram estas demos?"
 */

type OnboardingKey = "minhas_demos";

const PREFIX = "fragreel_onboarding_";

export function isOnboardingDismissed(key: OnboardingKey): boolean {
  if (typeof window === "undefined") return true; // SSR safe — não renderiza
  try {
    return localStorage.getItem(PREFIX + key) === "1";
  } catch {
    return true;
  }
}

export function dismissOnboarding(key: OnboardingKey): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, "1");
  } catch {
    // Quota / disabled storage — ignore (banner mostrará de novo, minor)
  }
}

/** Reset (admin / dev tool — não usado em UI normal). */
export function resetOnboarding(key: OnboardingKey): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PREFIX + key);
}
