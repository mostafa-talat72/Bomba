/**
 * TypeScript declarations for languages module
 */

export interface Language {
    code: string;
    name: string;
    nativeName: string;
    rtl: boolean;
}

export const WORLD_LANGUAGES: Language[];

export function getLanguageByCode(code: string): Language | null;

export function isLanguageRTL(code: string): boolean;
