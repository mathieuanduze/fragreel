/**
 * weaponIcons.ts — Sprint Killfeed Icons (06/05).
 *
 * Mapeia weapon name vindo do demoparser2 → URL do SVG do ícone canônico.
 *
 * 07/05 PIVOT (Mathieu spec): bundle SVGs no editor/public/cs2-icons/
 * em vez de extrair do CS2 install. Razão: CS2 final empacota panorama
 * em VPKs (pak01_dir.vpk) — não dá pra extrair sem Source 2 Viewer.
 * Source dos SVGs: lexogrine/cs2-react-hud (MIT license, 70+ weapon
 * icons + HS/blind modifiers). Idênticos aos panorama originais.
 *
 * URL building: `staticFile('/cs2-icons/equipment/<filename>')` resolve
 * pra absolute URL servida pelo Remotion render server (offline-capable,
 * sem dependência de fragreel.gg ou install do CS2 do user).
 *
 * Mathieu spec (06/05): "minha questão é ele conversar com o que o usuário
 * já conhece do CS. Dá pra correlacionar os ícones e acontecimentos
 * corretos baseado no que o .dem te trás?". Sim — demoparser2 dá weapon
 * name limpo (ex: "ak47", "awp", "knife"), aqui mapeio pra filename
 * canônico da pasta editor/public/cs2-icons/equipment/.
 */
import { staticFile } from "remotion";

/** Map de weapon name (lowercase, sem prefix) → filename SVG no equipment/.
 *  Casos identicos (ak47 → ak47.svg) NÃO precisam estar aqui. Só os que
 *  precisam normalização (ex: hkp2000 → hkp2000.svg). Default lowercase
 *  passa direto.
 *
 *  07/05 atualizado pra match exatamente os filenames do bundle lexogrine:
 *    /cs2-icons/equipment/<file>.svg
 *  Lista de filenames disponíveis (70 SVGs):
 *    ak47, aug, awp, bayonet, bizon, c4, cz75a, deagle, decoy, elite,
 *    famas, fiveseven, flashbang, g3sg1, galilar, glock, hegrenade,
 *    hkp2000, incgrenade, inferno, knife, knife_bayonet, knife_butterfly,
 *    knife_canis, knife_cord, knife_css, knife_falchion, knife_flip,
 *    knife_gut, knife_gypsy_jackknife, knife_karambit, knife_m9_bayonet,
 *    knife_outdoor, knife_push, knife_skeleton, knife_stiletto,
 *    knife_survival_bowie, knife_t, knife_tactical, knife_ursus,
 *    knife_widowmaker, m249, m4a1, m4a1_silencer, m4a1_silencer_off,
 *    mac10, mag7, molotov, mp5sd, mp7, mp9, negev, nova, out, p250, p90,
 *    revolver, sawedoff, scar20, sg556, smokegrenade, ssg08, taser, tec9,
 *    trigger_hurt, ump45, usp_silencer, usp_silencer_off, world, xm1014.
 */
const WEAPON_TO_ICON: Record<string, string> = {
  // Pistols
  "glock": "glock18",          // demoparser usa "glock", panorama usa "glock18"
  "usp_silencer": "usp_silencer",
  "hkp2000": "hkp2000",
  "p250": "p250",
  "deagle": "deagle",
  "elite": "elite",            // dual berettas
  "fiveseven": "fiveseven",
  "five-seven": "fiveseven",
  "tec9": "tec9",
  "cz75a": "cz75a",
  "revolver": "revolver",

  // SMGs
  "mac10": "mac10",
  "mp9": "mp9",
  "mp7": "mp7",
  "mp5sd": "mp5sd",
  "ump45": "ump45",
  "p90": "p90",
  "bizon": "bizon",

  // Rifles
  "ak47": "ak47",
  "m4a4": "m4a4",
  "m4a1": "m4a1_silencer",     // demoparser pode dar "m4a1" pro silencer
  "m4a1_silencer": "m4a1_silencer",
  "famas": "famas",
  "galilar": "galilar",
  "aug": "aug",
  "sg556": "sg556",

  // Snipers
  "ssg08": "ssg08",
  "awp": "awp",
  "scar20": "scar20",
  "g3sg1": "g3sg1",

  // Heavy
  "nova": "nova",
  "xm1014": "xm1014",
  "sawedoff": "sawedoff",
  "mag7": "mag7",
  "negev": "negev",
  "m249": "m249",

  // Grenades (kills via grenade explosions)
  "hegrenade": "hegrenade",
  "molotov": "molotov",
  "incgrenade": "incgrenade",
  "smokegrenade": "smokegrenade",
  "flashbang": "flashbang",
  "decoy": "decoy",

  // Knives — demoparser2 reporta "knife" geral OU specific knife type.
  // Bundle lexogrine tem knife.svg generic + knife_t.svg + variants
  // específicos. Pra v1, "knife" → knife.svg (universal). Variants
  // mapeiam pra files exatos quando demoparser dá tipo específico.
  "knife": "knife",
  "knife_t": "knife_t",
  "bayonet": "bayonet",
  "knife_bayonet": "knife_bayonet",
  "knife_m9_bayonet": "knife_m9_bayonet",
  "knife_karambit": "knife_karambit",
  "knife_butterfly": "knife_butterfly",
  "knife_flip": "knife_flip",
  "knife_gut": "knife_gut",
  "knife_huntsman": "knife_tactical",  // panorama internal name
  "knife_tactical": "knife_tactical",
  "knife_falchion": "knife_falchion",
  "knife_daggers": "knife_push",       // shadow daggers panorama name
  "knife_push": "knife_push",
  "knife_ursus": "knife_ursus",
  "knife_navaja": "knife_gypsy_jackknife",
  "knife_gypsy_jackknife": "knife_gypsy_jackknife",
  "knife_stiletto": "knife_stiletto",
  "knife_widowmaker": "knife_widowmaker",
  "knife_skeleton": "knife_skeleton",
  "knife_outdoor": "knife_outdoor",
  "knife_cord": "knife_cord",          // paracord
  "knife_canis": "knife_canis",        // survival
  "knife_survival_bowie": "knife_survival_bowie",
  "knife_css": "knife_css",
  "knife_kukri": "knife",              // kukri ainda não no bundle, fallback knife generic

  // World kills (fall, train, etc) — bundle tem world.svg + trigger_hurt
  "world": "world",
  "trigger_hurt": "trigger_hurt",

  // Inferno (molotov burn deaths)
  "inferno": "inferno",
  "taser": "taser",
};

/**
 * Resolves weapon name from demoparser2 → URL of bundled SVG icon.
 *
 * 07/05 PIVOT: usa staticFile('/cs2-icons/equipment/<file>.svg') em vez
 * de URL externa. Bundle lexogrine MIT shippado em editor/public/.
 * Funciona offline (Remotion render server resolve o path local).
 *
 * Param `cs2IconsBaseUrl` mantido pra back-compat com prop antigo —
 * IGNORADO em v0.6.38+. Quando undefined, ainda funciona (sempre usa
 * staticFile bundle).
 *
 * @param weapon - weapon string from KillEvent.weapon (sem prefix
 *                 "weapon_", lowercase típico mas defensive normalize aqui).
 * @param _legacyBaseUrl - DEPRECATED, ignored. Mantido pra compat de
 *                         signature em codebases antigos.
 */
export function resolveWeaponIconUrl(
  weapon: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _legacyBaseUrl?: string,
): string | null {
  const key = (weapon || "").toLowerCase().trim().replace(/^weapon_/, "");
  if (!key) return null;

  // Lookup explicit mapping first
  let filename = WEAPON_TO_ICON[key];

  // Fallback: try direct match (lots of weapons match identically — ak47
  // → ak47.svg). Bundle lexogrine cobre maioria.
  if (filename === undefined) {
    filename = key;
  }

  if (!filename) return null; // empty string = explicit "no icon"

  return staticFile(`/cs2-icons/equipment/${filename}.svg`);
}

/**
 * Modifier icons (HS, blind) — death_notice/.
 * Bundle lexogrine MIT tem headshot.svg + blind.svg (renomeado de
 * flashed_kill.svg). Wallbang/smoke/noscope ainda fallback (não no
 * bundle — backlog se Mathieu pedir).
 */
export type KillModifier = "headshot" | "penetrate" | "smoke" | "blind" | "noscope";

export function resolveModifierIconUrl(
  modifier: KillModifier,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _legacyBaseUrl?: string,
): string | null {
  // Bundle disponível: headshot, blind. Outros retornam null → fallback.
  const available: Partial<Record<KillModifier, string>> = {
    headshot: "headshot",
    blind: "blind",
  };
  const filename = available[modifier];
  if (!filename) return null;
  return staticFile(`/cs2-icons/death_notice/${filename}.svg`);
}
