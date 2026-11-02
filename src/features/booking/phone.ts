export const phoneCodes = ['', '+84', '+65', '+1', '+44'] as const;
export function splitPhone(raw: string) {
  const match = raw.match(/^\+(84|65|1|44)\s?(.*)$/);
  return match ? { code: `+${match[1]}`, number: match[2] } : { code: '', number: raw };
}
export function choosePhoneCode(raw: string, code: string) {
  let { number } = splitPhone(raw);
  if (!code) return raw; // Full-number mode never discards an existing prefix.
  if (number.startsWith('+')) return raw; // Unknown prefix: keep the caller's number intact.
  if (code === '+84' && /^0\d/.test(number)) number = number.slice(1);
  return `${code} ${number}`.trimEnd();
}
