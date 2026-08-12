export interface ColorPreview {
  background: string;
  color: "#111111" | "#FFFFFF";
}

function expandHex(hex: string) {
  if (hex.length === 7) return hex;
  return `#${hex.slice(1).split("").map((digit) => `${digit}${digit}`).join("")}`;
}

export function safeColorPreview(value: string): ColorPreview | null {
  const match = value.match(/#(?:[0-9a-f]{6}|[0-9a-f]{3})\b/i);
  if (!match) return null;
  const background = match[0].toUpperCase();
  const normalized = expandHex(background);
  const channels = [1, 3, 5].map((start) => Number.parseInt(normalized.slice(start, start + 2), 16) / 255);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return { background, color: luminance > 0.42 ? "#111111" : "#FFFFFF" };
}
