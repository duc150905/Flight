// Pure media mapping shared by admin validation and customer rendering.
const bundleCodes: Record<string, string> = {
  'han.jpg': 'HAN', 'ha-noi.jpg': 'HAN',
  'dad.jpg': 'DAD', 'da-nang.jpg': 'DAD',
  'pqc.jpg': 'PQC', 'phu-quoc.jpg': 'PQC',
  'cxr.jpg': 'CXR', 'nha-trang.jpg': 'CXR',
  'dli.jpg': 'DLI', 'da-lat.jpg': 'DLI',
  'hui.jpg': 'HUI', 'hue.jpg': 'HUI',
  'sin.jpg': 'SIN', 'singapore.jpg': 'SIN',
  'bkk.jpg': 'BKK', 'bangkok.jpg': 'BKK',
};

export function isHttpsMediaPath(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch { return false; }
}

export function resolveDestinationMedia(path: string | null | undefined, airportCode?: string): { uri: string } | { bundleCode: string } | null {
  const value = path?.trim();
  if (!value) return airportCode && Object.values(bundleCodes).includes(airportCode) ? { bundleCode: airportCode } : null;
  if (isHttpsMediaPath(value)) return { uri: value };
  const bundleCode = value.startsWith('destinations/') ? bundleCodes[value.slice('destinations/'.length)] : undefined;
  return bundleCode ? { bundleCode } : null;
}

export function validateDestinationMedia(path: string | null | undefined) {
  const valid = !path?.trim() || resolveDestinationMedia(path) != null;
  return { valid, message: valid ? '' : 'Use an HTTPS image URL or a bundled destination path, for example destinations/da-nang.jpg.' };
}

export function validateAirlineMedia(path: string | null | undefined, originalPath?: string | null) {
  const value = path?.trim();
  const valid = !value || isHttpsMediaPath(value) || (value === originalPath && /^airlines\/[a-z0-9_-]+\.(png|svg)$/i.test(value));
  return { valid, message: valid ? '' : 'Use an HTTPS logo URL. Legacy relative airline paths only display the airline initial.' };
}
