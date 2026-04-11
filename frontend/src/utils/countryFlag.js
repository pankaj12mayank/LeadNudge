/** ISO 3166-1 alpha-2 → regional indicator flag emoji (e.g. US → 🇺🇸). */
export function countryFlagEmoji(countryCode) {
  if (!countryCode || typeof countryCode !== "string") return "";
  const cc = countryCode.trim().toUpperCase();
  if (cc.length !== 2 || /[^A-Z]/.test(cc)) return "";
  const A = 0x1f1e6;
  const chars = [...cc].map((c) => A + (c.codePointAt(0) - 65));
  try {
    return String.fromCodePoint(...chars);
  } catch {
    return "";
  }
}
