export const phoneCodes = ['', '+84', '+65', '+1', '+44'] as const;
export function splitPhone(raw: string) {
  const match = raw.match(/^\+(84|65|1|44)\s?(.*)$/);
  return match ? { code: `+${match[1]}`, number: match[2] } : { code: '', number: raw };
}
export function choosePhoneCode(raw: string, code: string) {
  const { number } = splitPhone(raw);
  if (!code) return raw; // Full-number mode never discards an existing prefix.
  if (number.startsWith('+')) return raw; // Unknown prefix: keep the caller's number intact.
  return editPhoneNumber(code, number);
}
export function editPhoneNumber(code: string, rawNumber: string) {
  const number = code === '+84' && /^0\d/.test(rawNumber) ? rawNumber.slice(1) : rawNumber;
  return code ? `${code} ${number}`.trimEnd() : number;
}
