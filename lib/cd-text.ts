import { CD_TEXT_MAX_LENGTH } from "./constants";

export type CdTextEncoding = "latin1" | "ascii" | "unicode";

export const DEFAULT_CD_TEXT_ENCODING: CdTextEncoding = "latin1";

export const CD_TEXT_ENCODING_HELP: Record<CdTextEncoding, string> = {
  latin1:
    "Recommended. CD-Text on disc uses ISO-8859-1 (Latin-1). Accents are simplified; other scripts become ?.",
  ascii:
    "Strict 7-bit ASCII only. Safest for old burners and players; non-English characters become ?.",
  unicode:
    "Keep Unicode in the CUE file only. Does not produce valid on-disc CD-Text for most burners/players.",
};

function truncateCdText(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= CD_TEXT_MAX_LENGTH) {
    return trimmed;
  }

  return `${trimmed.slice(0, CD_TEXT_MAX_LENGTH - 1).trimEnd()}…`;
}

function toLatin1(text: string): string {
  const withoutMarks = text.normalize("NFD").replace(/\p{M}/gu, "");
  let output = "";

  for (const char of withoutMarks) {
    const code = char.charCodeAt(0);
    if (code <= 0xff) {
      output += char;
    } else {
      output += "?";
    }
  }

  return output;
}

function toAscii(text: string): string {
  let output = "";

  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 0x20 && code <= 0x7e) {
      output += char;
    } else {
      output += "?";
    }
  }

  return output;
}

export function formatCdTextValue(
  value: string,
  encoding: CdTextEncoding,
): string {
  const truncated = truncateCdText(value);
  if (!truncated) {
    return "";
  }

  switch (encoding) {
    case "ascii":
      return toAscii(truncated);
    case "unicode":
      return truncated;
    case "latin1":
    default:
      return toLatin1(truncated);
  }
}
