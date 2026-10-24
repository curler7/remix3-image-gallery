// Only Firefox/WebKit opt into CI fallback fonts; Chromium's defaults already match.
export function browserEnvironment() {
  return {
    ...process.env,
    ...(process.env.GALLERY_FONTCONFIG_FILE
      ? { FONTCONFIG_FILE: process.env.GALLERY_FONTCONFIG_FILE }
      : {}),
  };
}
