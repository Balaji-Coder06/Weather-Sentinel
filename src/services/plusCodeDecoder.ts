/**
 * Open Location Code (Plus Code) Robust Decoder & Utility
 * Compliant with Google Open Location Code (OLC) specification.
 * Supports:
 * - Full Plus Codes (e.g., "7M5237J9+8H", "87G8P27Q+5M")
 * - Compound / Short Plus Codes (e.g., "37J9+8H Chennai, Tamil Nadu")
 */

const CODE_ALPHABET = '23456789CFGHJMPQRVWX';
const SEPARATOR = '+';
const SEPARATOR_POSITION = 8;
const PADDING_CHARACTER = '0';
const ENCODING_BASE = 20;

export interface PlusCodeCoordinates {
  latitude: number;
  longitude: number;
  latitudeLo: number;
  longitudeLo: number;
  latitudeHi: number;
  longitudeHi: number;
  codeLength: number;
}

export class PlusCodeDecoder {
  /**
   * Detects if a query string contains or represents a Plus Code
   */
  public static isPlusCode(query: string): boolean {
    const trimmed = query.trim();
    const plusIndex = trimmed.indexOf(SEPARATOR);
    if (plusIndex === -1) return false;

    const tokens = trimmed.split(/[\s,]+/);
    for (const token of tokens) {
      const idx = token.indexOf(SEPARATOR);
      if (idx >= 2 && idx <= SEPARATOR_POSITION) {
        const clean = token.toUpperCase().replace(SEPARATOR, '');
        if (/^[23456789CFGHJMPQRVWX0]+$/.test(clean)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Extracts the code portion and locality reference from a compound string
   * e.g., "37J9+8H Chennai, Tamil Nadu" -> { code: "37J9+8H", locality: "Chennai, Tamil Nadu" }
   */
  public static parseCompoundCode(query: string): { code: string; locality: string } | null {
    const trimmed = query.trim();
    const tokens = trimmed.split(/[\s,]+/);
    let codeToken = '';

    for (const token of tokens) {
      const idx = token.indexOf(SEPARATOR);
      if (idx >= 2 && idx <= SEPARATOR_POSITION) {
        const clean = token.toUpperCase().replace(SEPARATOR, '');
        if (/^[23456789CFGHJMPQRVWX0]+$/.test(clean)) {
          codeToken = token;
          break;
        }
      }
    }

    if (!codeToken) return null;

    const locality = trimmed
      .replace(codeToken, '')
      .replace(/^[\s,]+/, '')
      .replace(/[\s,]+$/, '');

    return {
      code: codeToken.toUpperCase(),
      locality: locality || 'Chennai',
    };
  }

  /**
   * Decodes a Full Plus Code into lat/lon coordinates
   */
  public static decodeFullCode(code: string): PlusCodeCoordinates {
    const cleanCode = code.toUpperCase().replace(SEPARATOR, '').replace(new RegExp(PADDING_CHARACTER, 'g'), '');
    let latVal = 0;
    let lngVal = 0;
    let resolution = 20.0;

    for (let i = 0; i < Math.min(cleanCode.length, 10); i += 2) {
      const latDigit = CODE_ALPHABET.indexOf(cleanCode.charAt(i));
      const lngDigit = CODE_ALPHABET.indexOf(cleanCode.charAt(i + 1));

      if (latDigit === -1 || lngDigit === -1) break;

      latVal += latDigit * resolution;
      lngVal += lngDigit * resolution;

      resolution /= ENCODING_BASE;
    }

    // Grid refinement for length > 10
    if (cleanCode.length > 10) {
      let gridLatRes = resolution;
      let gridLngRes = resolution;
      for (let i = 10; i < cleanCode.length; i++) {
        const digit = CODE_ALPHABET.indexOf(cleanCode.charAt(i));
        if (digit === -1) break;

        const row = Math.floor(digit / 4);
        const col = digit % 4;

        gridLatRes /= 5;
        gridLngRes /= 4;

        latVal += row * gridLatRes;
        lngVal += col * gridLngRes;
      }
      resolution = gridLatRes;
    }

    const latitudeLo = latVal - 90.0;
    const longitudeLo = lngVal - 180.0;
    const latitudeHi = latitudeLo + resolution;
    const longitudeHi = longitudeLo + resolution;
    const latitude = Number(((latitudeLo + latitudeHi) / 2.0).toFixed(6));
    const longitude = Number(((longitudeLo + longitudeHi) / 2.0).toFixed(6));

    return {
      latitude,
      longitude,
      latitudeLo,
      longitudeLo,
      latitudeHi,
      longitudeHi,
      codeLength: cleanCode.length,
    };
  }

  /**
   * Recovers a full Plus Code from a short code and a reference coordinate (lat, lon)
   */
  public static recoverNearest(shortCode: string, refLat: number, refLon: number): string {
    const cleanShort = shortCode.toUpperCase();
    const separatorIdx = cleanShort.indexOf(SEPARATOR);
    const prefixLen = SEPARATOR_POSITION - separatorIdx;

    if (prefixLen <= 0) {
      return cleanShort;
    }

    const refLatShifted = refLat + 90.0;
    const refLonShifted = refLon + 180.0;

    const lat0 = Math.floor(refLatShifted / 20.0);
    const lon0 = Math.floor(refLonShifted / 20.0);

    const lat1 = Math.floor((refLatShifted % 20.0) / 1.0);
    const lon1 = Math.floor((refLonShifted % 20.0) / 1.0);

    let prefix = '';
    if (prefixLen === 4) {
      prefix = `${CODE_ALPHABET.charAt(lat0)}${CODE_ALPHABET.charAt(lon0)}${CODE_ALPHABET.charAt(lat1)}${CODE_ALPHABET.charAt(lon1)}`;
    } else if (prefixLen === 2) {
      prefix = `${CODE_ALPHABET.charAt(lat1)}${CODE_ALPHABET.charAt(lon1)}`;
    } else {
      prefix = `${CODE_ALPHABET.charAt(lat0)}${CODE_ALPHABET.charAt(lon0)}${CODE_ALPHABET.charAt(lat1)}${CODE_ALPHABET.charAt(lon1)}`;
    }

    const fullCandidate = prefix + cleanShort;
    return fullCandidate;
  }
}
