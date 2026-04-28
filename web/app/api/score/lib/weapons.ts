/**
 * Weapon display names + bonus lookup.
 *
 * Port direto de api/parser/scorer.py _WEAPON_NAMES + WEAPON_BONUS.
 */

export const WEAPON_NAMES: Record<string, string> = {
  awp: "AWP",
  ak47: "AK-47",
  m4a1: "M4A1-S",
  m4a1_silencer: "M4A1-S",
  m4a4: "M4A4",
  deagle: "Desert Eagle",
  ssg08: "SSG 08",
  famas: "FAMAS",
  galilar: "Galil AR",
  sg556: "SG 553",
  aug: "AUG",
  knife: "Knife",
  bayonet: "Bayonet",
  knife_t: "Knife",
  mp9: "MP9",
  mac10: "MAC-10",
  ump45: "UMP-45",
  p90: "P90",
  bizon: "PP-Bizon",
  mp5sd: "MP5-SD",
  mp7: "MP7",
  nova: "Nova",
  xm1014: "XM1014",
  mag7: "MAG-7",
  sawedoff: "Sawed-Off",
  negev: "Negev",
  m249: "M249",
  p250: "P250",
  cz75a: "CZ75-Auto",
  fiveseven: "Five-SeveN",
  tec9: "Tec-9",
  usp_silencer: "USP-S",
  glock: "Glock-18",
  hkp2000: "P2000",
  revolver: "R8 Revolver",
  p2000: "P2000",
};

/** Weapons com bonus em pontos (substring match, lowercase). */
export const WEAPON_BONUS: Array<[string, number]> = [
  ["awp", 50],
  ["ssg08", 30],
  ["knife", 100],
  ["bayonet", 100],
  ["knife_t", 100],
  ["knifegg", 100],
  ["deagle", 20],
  ["revolver", 20],
];

export function weaponDisplay(weapon: string): string {
  const lower = weapon.toLowerCase();
  return WEAPON_NAMES[lower] ?? weapon.toUpperCase();
}

export function weaponBonus(weapon: string): number {
  const lower = weapon.toLowerCase();
  for (const [key, pts] of WEAPON_BONUS) {
    if (lower.includes(key)) return pts;
  }
  return 0;
}
