import en from './en';
import zhTW from './zh-TW';
import type { TranslationKeys } from './en';

export type Language = 'en' | 'zh-TW';

export const translations: Record<Language, Record<TranslationKeys, string>> = {
  en,
  'zh-TW': zhTW,
};

export const languageNames: Record<Language, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
};

export type { TranslationKeys };
