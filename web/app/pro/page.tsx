/**
 * Sprint #7 (05/05) — /pro deprecated em favor de /library (unified flow).
 *
 * Mathieu reportou: "começou a virar confuso ter upload de demo e minhas
 * demos. Poderia ser tudo no mesmo lugar". Source-agnostic UX > source-aware
 * split.
 *
 * /pro → 308 permanent redirect → /library. Old links ainda funcionam.
 */
import { redirect } from "next/navigation";

export default function ProPage() {
  redirect("/library");
}
