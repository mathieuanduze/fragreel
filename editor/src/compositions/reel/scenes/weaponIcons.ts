/**
 * weaponIcons.ts — Sprint Killfeed Icons (06/05).
 *
 * Mapeia weapon name vindo do demoparser2 → filename do SVG canônico
 * extraído de `<CS2>/game/csgo/panorama/images/icons/equipment/`.
 *
 * Decisão de extração: ícones são copiados do install do CS2 do user pelo
 * setup_cs2_icons.py em first-run / pre-render. URL servida via
 * `${cs2IconsBaseUrl}/equipment/<filename>`. Se 404 ou URL undefined,
 * editor cai pra fallback text-only weapon name.
 *
 * Mathieu spec (06/05): "minha questão é ele conversar com o que o usuário
 * já conhece do CS. Dá pra correlacionar os ícones e acontecimentos
 * corretos baseado no que o .dem te trás?". Resposta: sim, demoparser2 dá
 * weapon name limpo (ex: "ak47", "awp", "knife"), aqui mapeio pra
 * filename CS2 canônico (caso difere) ou direto.
 *
 * Lista canônica baseada em CS2 panorama equipment/ files (como de fim
 * 2025). Se CS2 add weapon novo (ex: case knife), fallback retorna
 * filename normalizado e SE não existir no folder, retorna null →
 * editor renderiza text fallback.
 */

/** Map de weapon name (lowercase, sem prefix) → filename SVG no equipment/.
 *  Casos identicos (ak47 → ak47.svg) NÃO precisam estar aqui. Só os que
 *  precisam normalização (ex: hkp2000 → hkp2000.svg). Default lowercase
 *  passa direto. */
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
  // CS2 panorama tem default_ct.svg, default_t.svg, e variants (bayonet,
  // karambit, etc). Pra v1, mapear knives pro default_ct (CT) — quase
  // todas as kills aparecem assim. Variants ficam pro futuro se Mathieu
  // pedir.
  "knife": "default_ct",
  "knife_t": "default_t",
  "bayonet": "bayonet",
  "knife_bayonet": "bayonet",
  "knife_karambit": "knife_karambit",
  "knife_butterfly": "knife_butterfly",
  "knife_flip": "knife_flip",
  "knife_gut": "knife_gut",
  "knife_huntsman": "knife_tactical",  // panorama internal name
  "knife_falchion": "knife_falchion",
  "knife_daggers": "knife_push",       // shadow daggers panorama name
  "knife_ursus": "knife_ursus",
  "knife_navaja": "knife_gypsy_jackknife",
  "knife_stiletto": "knife_stiletto",
  "knife_widowmaker": "knife_widowmaker",
  "knife_skeleton": "knife_skeleton",
  "knife_outdoor": "knife_outdoor",
  "knife_cord": "knife_cord",          // paracord
  "knife_canis": "knife_canis",        // survival
  "knife_kukri": "knife_kukri",

  // World kills (fall, train, etc) — sem icon, fallback text
  "world": "",                  // empty → null → fallback text
};

/**
 * Resolves weapon name from demoparser2 → URL of CS2 panorama SVG icon.
 *
 * Returns null se base URL undefined OU weapon não mapeável → editor
 * cai pra fallback text-only.
 *
 * @param weapon - weapon string from KillEvent.weapon (sem prefix
 *                 "weapon_", lowercase típico mas defensive normalize aqui).
 * @param cs2IconsBaseUrl - base URL do HTTP server local servindo
 *                          cs2-icons/. Tipicamente
 *                          `http://127.0.0.1:<port>/cs2-icons`.
 */
export function resolveWeaponIconUrl(
  weapon: string,
  cs2IconsBaseUrl: string | undefined,
): string | null {
  if (!cs2IconsBaseUrl) return null;
  const key = (weapon || "").toLowerCase().trim().replace(/^weapon_/, "");
  if (!key) return null;

  // Lookup explicit mapping first
  let filename = WEAPON_TO_ICON[key];

  // Fallback: try direct match (lots of weapons match identically — ak47
  // → ak47.svg). Less prone to drift than maintaining huge map.
  if (filename === undefined) {
    filename = key;
  }

  if (!filename) return null; // empty string = explicit "no icon"

  return `${cs2IconsBaseUrl}/equipment/${filename}.svg`;
}

/**
 * Modifier icons (HS, wallbang, smoke, blind, noscope) — death_notice/.
 * Used pra renderizar ícones modificadores do killfeed (igual CS2 vanilla
 * que mostra ícone HS depois do weapon, etc).
 */
export type KillModifier = "headshot" | "penetrate" | "smoke" | "blind" | "noscope";

export function resolveModifierIconUrl(
  modifier: KillModifier,
  cs2IconsBaseUrl: string | undefined,
): string | null {
  if (!cs2IconsBaseUrl) return null;
  // Panorama death_notice/ filenames (verificar com Mathieu test post-deploy
  // se algum modifier não bater — fácil ajuste)
  const map: Record<KillModifier, string> = {
    headshot: "headshot",
    penetrate: "penetrate",   // wallbang
    smoke: "smoke",
    blind: "blind",            // attacker blind (flashbanged)
    noscope: "noscope",
  };
  return `${cs2IconsBaseUrl}/death_notice/${map[modifier]}.svg`;
}
