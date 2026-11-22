import { FEW_LAYOUTS } from "./dispositions/few";
import type { LayoutDef } from "./dispositions/helpers";
import { MANY_LAYOUTS } from "./dispositions/many";
import { SINGLE_LAYOUTS } from "./dispositions/single";
import { TEXT_LAYOUTS } from "./dispositions/text";

export type { LayoutDef } from "./dispositions/helpers";

/**
 * Bibliothèque des dispositions, rangée par nombre de photos dans `dispositions/`.
 * Ajouter une disposition = ajouter une entrée dans le bon fichier (le moteur la propose
 * automatiquement, `layouts.test.ts` vérifie qu'elle reste dans l'image dans tous les formats).
 */
export const LAYOUTS: LayoutDef[] = [...TEXT_LAYOUTS, ...SINGLE_LAYOUTS, ...FEW_LAYOUTS, ...MANY_LAYOUTS];
