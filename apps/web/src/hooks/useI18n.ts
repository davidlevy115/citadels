'use client';

import { useEffect } from 'react';
import { create } from 'zustand';
import { getTranslator, loadStoredLocale, storeLocale, DEFAULT_LOCALE, type Locale, type Translator } from '@/lib/i18n';

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

/**
 * Language is a client preference, chosen on the setup screen and remembered.
 * Because the engine logs events as keys rather than sentences, two players in
 * the same game can happily read it in different languages.
 */
export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: DEFAULT_LOCALE,
  setLocale: (locale) => {
    storeLocale(locale);
    set({ locale });
  },
}));

/** Restore the saved language once the client has mounted. */
export function useRestoreLocale(): void {
  const setLocale = useLocaleStore(s => s.setLocale);
  useEffect(() => {
    const stored = loadStoredLocale();
    if (stored !== DEFAULT_LOCALE) setLocale(stored);
  }, [setLocale]);
}

/** The translator for the current language. */
export function useT(): Translator {
  const locale = useLocaleStore(s => s.locale);
  return getTranslator(locale);
}
