/**
 * utils.ts — shadcn/ui helpers.
 *
 * Sprint DEMO-3 v2 (08/05/2026) — UI redesign com Shadcn/ui base.
 *
 * cn() é o utility padrão do shadcn pra merge de Tailwind classes
 * com suporte a conditional classes (clsx) + auto-dedup conflicting
 * Tailwind classes (twMerge).
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
