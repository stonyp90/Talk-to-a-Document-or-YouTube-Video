export type Dictionary = Readonly<Record<string, string>>;
export type Values = Readonly<Record<string, string | number>>;
export type Translate = (key: string, values?: Values) => string;

/**
 * Builds a translator over an English-keyed dictionary. A missing entry
 * returns the English key itself, so the interface never shows a blank or a
 * raw identifier when a translation is late.
 */
export function createTranslator(dictionary: Dictionary): Translate {
  return (key, values) => {
    const text = dictionary[key] ?? key;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in values ? String(values[name]) : match,
    );
  };
}
