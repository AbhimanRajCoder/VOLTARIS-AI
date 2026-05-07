'use client';

import { useLanguage } from '@/context/LanguageContext';
import { en, kn, TranslationKeys } from '@/lib/translations';

type Leaves<T> = T extends object ? { [K in keyof T]: `${Exclude<K, symbol>}${Leaves<T[K]> extends never ? "" : `.${Leaves<T[K]>}`}` }[keyof T] : never;

export type TranslationKey = Leaves<TranslationKeys>;

export function useTranslation() {
  const { language } = useLanguage();
  const translations = language === 'kn' ? kn : en;

  const t = (key: TranslationKey, variables?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: any = translations;
    let fallbackValue: any = en;

    for (const k of keys) {
      value = value?.[k];
      fallbackValue = fallbackValue?.[k];
    }

    let result = value || fallbackValue || key;

    if (variables) {
      Object.entries(variables).forEach(([name, val]) => {
        result = result.replace(`{${name}}`, String(val));
      });
    }

    return result;
  };

  return { t, language };
}
