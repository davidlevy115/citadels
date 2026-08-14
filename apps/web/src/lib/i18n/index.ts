'use client';

import type {
  CharacterName, DistrictType, LogEntry, LogParams, LogParamValue, ErrorCode,
} from '@citadels/game-logic';
import type { Dictionary, Locale, UiKey, Gender } from './types';
import { en } from './en';
import { es } from './es';

export type { Locale, UiKey } from './types';
export { LOCALES } from './types';

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export const DEFAULT_LOCALE: Locale = 'en';
const STORAGE_KEY = 'citadels-locale';

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'es';
}

export function loadStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(stored) ? stored : DEFAULT_LOCALE;
}

export function storeLocale(locale: Locale): void {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, locale);
}

/** A rule violation as it travels over the wire. */
export interface WireError {
  code: ErrorCode;
  params?: LogParams;
}

// ── Article handling ────────────────────────────────────────────
// Spanish needs "la Bruja" but "el Rey", and contracts "a el"/"de el" into
// "al"/"del". English just prefixes "the".

function definite(locale: Locale, name: string, gender: Gender | undefined): string {
  if (locale === 'en') return `the ${name}`;
  return `${gender === 'f' ? 'la' : 'el'} ${name}`;
}

function dative(locale: Locale, name: string, gender: Gender | undefined): string {
  if (locale === 'en') return `the ${name}`;
  return gender === 'f' ? `a la ${name}` : `al ${name}`;
}

function genitive(locale: Locale, name: string, gender: Gender | undefined): string {
  if (locale === 'en') return `the ${name}'s`;
  return gender === 'f' ? `de la ${name}` : `del ${name}`;
}

// ── Translator ──────────────────────────────────────────────────

export interface Translator {
  locale: Locale;
  /** Interface chrome. */
  (key: UiKey, params?: LogParams): string;
  character(name: string): string;
  characterShort(name: string): string;
  characterFull(name: string): string;
  district(name: string): string;
  districtDescription(name: string): string | undefined;
  districtType(type: DistrictType): string;
  set(id: string): { name: string; blurb: string };
  log(entry: LogEntry): string;
  error(error: WireError | null | undefined): string;
}

function plain(value: LogParamValue): string {
  return Array.isArray(value) ? value.join(', ') : String(value);
}

export function createTranslator(locale: Locale): Translator {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];

  const characterText = (name: string) =>
    dict.characters[name as CharacterName] ?? { name, short: '', full: '' };
  const districtText = (name: string) =>
    dict.districts[name] ?? { name };

  /**
   * Replace {placeholders}. Character and district parameters also expose
   * article-aware variants, so each language can pick the form it needs:
   * {character}, {characterEl}, {characterA}, {characterDe}.
   */
  function format(template: string, params?: LogParams): string {
    if (!params) return template;

    const values: Record<string, string> = {};

    for (const [key, raw] of Object.entries(params)) {
      if (key === 'character' || key === 'character2') {
        const text = characterText(String(raw));
        values[key] = text.name;
        values[`${key}El`] = definite(locale, text.name, text.gender);
        values[`${key}A`] = dative(locale, text.name, text.gender);
        values[`${key}De`] = genitive(locale, text.name, text.gender);
      } else if (key === 'district' || key === 'district2') {
        const text = districtText(String(raw));
        values[key] = text.name;
        values[`${key}El`] = definite(locale, text.name, text.gender);
        values[`${key}A`] = dative(locale, text.name, text.gender);
        values[`${key}De`] = genitive(locale, text.name, text.gender);
      } else if (key === 'districtType') {
        values[key] = dict.districtTypes[raw as DistrictType] ?? String(raw);
      } else if (key === 'characters' && Array.isArray(raw)) {
        values[key] = raw.map(n => characterText(n).name).join(', ');
      } else {
        values[key] = plain(raw);
      }
    }

    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? values[name] : match
    );
  }

  const t = ((key: UiKey, params?: LogParams) =>
    format(dict.ui[key] ?? key, params)) as Translator;

  t.locale = locale;
  t.character = (name: string) => characterText(name).name;
  t.characterShort = (name: string) => characterText(name).short;
  t.characterFull = (name: string) => characterText(name).full;
  t.district = (name: string) => districtText(name).name;
  t.districtDescription = (name: string) => districtText(name).description;
  t.districtType = (type: DistrictType) => dict.districtTypes[type] ?? type;
  t.set = (id: string) => dict.sets[id] ?? { name: id, blurb: '' };

  t.log = (entry: LogEntry) => {
    const template = dict.log[entry.key];
    // An unknown key means the engine logged something the catalogue has not
    // caught up with. Show the key rather than an empty line.
    if (!template) return entry.key;
    return format(template, entry.params);
  };

  t.error = (error) => {
    if (!error) return '';
    const template = dict.err[error.code];
    if (!template) return error.code;
    return format(template, error.params);
  };

  return t;
}

/** Cached so components sharing a locale share one translator instance. */
const cache = new Map<Locale, Translator>();

export function getTranslator(locale: Locale): Translator {
  let t = cache.get(locale);
  if (!t) {
    t = createTranslator(locale);
    cache.set(locale, t);
  }
  return t;
}
