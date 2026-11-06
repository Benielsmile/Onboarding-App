/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Plan National de Numérotation de la République Démocratique du Congo (RDC)
 * Conforme aux spécifications de l'Autorité de Régulation (ARPTC) :
 * 
 * 🟢 Vodacom RDC : 081, 082, 083, 086 (M-Pesa)
 * 🟠 Orange RDC  : 080, 084, 085, 089 (Orange Money)
 * 🔴 Airtel RDC  : 096, 097, 098, 099 (Airtel Money)
 * 🟣 Africell RDC: 090, 091 (Afrimoney)
 * 📞 Fixe RDC    : 01, 02 (SCPT, Congo Korea Telecom)
 * 📞 Assistance  : 1515 (Numéro vert unique ARPTC) · 155 (Plaintes & Recours)
 * 
 * Formats acceptés :
 * - Format National : 0 + Préfixe (2 chiffres) + 6 ou 7 chiffres (ex: 081 234 567 ou 080 324 0289)
 * - Format International : +243 + Préfixe (sans le 0) + 6 ou 7 chiffres (ex: +243 81 234 567 ou +243 803 240 289)
 */

export type DRCCarrierType = 
  | 'Vodacom RDC (M-Pesa)'
  | 'Orange RDC (Orange Money)'
  | 'Airtel RDC (Airtel Money)'
  | 'Africell RDC (Afrimoney)'
  | 'Téléphonie Fixe (SCPT / CKT)'
  | 'Numéro Spécial / Assistance (ARPTC)'
  | 'Unknown';

export interface DRCPhoneValidationResult {
  isValid: boolean;
  rawInput: string;
  formattedInternational: string; // e.g. "243803240289" or "24381234567"
  nationalDisplay: string;        // e.g. "080 324 0289" or "081 234 567"
  internationalDisplay: string;   // e.g. "+243 803 240 289" or "+243 81 234 567"
  carrier: DRCCarrierType;
  prefix: string;                 // e.g. "080", "081", "086", "096", "090"
  operatorColor: string;          // Hex code for badge
  errorMessage?: string;
}

export const DRC_OPERATOR_PREFIXES = {
  VODACOM: ['81', '82', '83', '86'],
  ORANGE: ['80', '84', '85', '89'],
  AIRTEL: ['96', '97', '98', '99'],
  AFRICELL: ['90', '91'],
  FIXED: ['01', '02', '1', '2'],
  SPECIAL: ['1515', '155']
} as const;

export function cleanAndValidateDRCPhone(input: string): DRCPhoneValidationResult {
  const raw = input ? String(input).trim() : '';

  if (!raw) {
    return {
      isValid: false,
      rawInput: raw,
      formattedInternational: '',
      nationalDisplay: '',
      internationalDisplay: '',
      carrier: 'Unknown',
      prefix: '',
      operatorColor: '#64748B',
      errorMessage: 'Le numéro de téléphone est obligatoire.'
    };
  }

  // Check special short codes first (1515, 155)
  const trimmed = raw.replace(/[^\d]/g, '');
  if (trimmed === '1515' || trimmed === '155') {
    return {
      isValid: true,
      rawInput: raw,
      formattedInternational: trimmed,
      nationalDisplay: trimmed,
      internationalDisplay: trimmed,
      carrier: 'Numéro Spécial / Assistance (ARPTC)',
      prefix: trimmed,
      operatorColor: '#3B82F6',
    };
  }

  // 1. Strip all non-digit characters except leading plus
  let cleaned = raw.replace(/[^\d+]/g, '');

  // 2. Remove leading + or 00
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  }

  // 3. Normalize into international string starting with 243
  let standardDigits = '';

  if (cleaned.startsWith('243')) {
    // Already prefixed with 243
    standardDigits = cleaned;
  } else if (cleaned.startsWith('0')) {
    // National format with leading 0 (e.g., 081234567 -> 24381234567 or 0803240289 -> 243803240289)
    standardDigits = '243' + cleaned.slice(1);
  } else if (cleaned.startsWith('8') || cleaned.startsWith('9') || cleaned.startsWith('1') || cleaned.startsWith('2')) {
    // Number provided without leading 0 or country code (e.g. 81234567 -> 24381234567)
    standardDigits = '243' + cleaned;
  } else {
    return {
      isValid: false,
      rawInput: raw,
      formattedInternational: cleaned,
      nationalDisplay: '',
      internationalDisplay: '',
      carrier: 'Unknown',
      prefix: '',
      operatorColor: '#64748B',
      errorMessage: 'Format invalide. Utilisez un format RDC valide (ex: 080 324 0289, 081 234 567 ou +243...).'
    };
  }

  // 4. Verify total length
  // In DRC mobile telephony:
  // - 9 digits national = 243 + 8 digits = 11 digits total (e.g. 243 81 234 567)
  // - 10 digits national = 243 + 9 digits = 12 digits total (e.g. 243 803 240 289)
  const digitsAfter243 = standardDigits.slice(3);
  const isValidLength = digitsAfter243.length === 8 || digitsAfter243.length === 9;

  if (!isValidLength) {
    return {
      isValid: false,
      rawInput: raw,
      formattedInternational: standardDigits,
      nationalDisplay: '',
      internationalDisplay: '',
      carrier: 'Unknown',
      prefix: '',
      operatorColor: '#64748B',
      errorMessage: `Longueur invalide (${digitsAfter243.length} chiffres après le 0 ou +243. Le plan national RDC requiert 8 ou 9 chiffres).`
    };
  }

  // 5. Extract 2-digit telecom prefix after 243
  const twoDigitPrefix = digitsAfter243.substring(0, 2);
  const displayPrefix = '0' + twoDigitPrefix;

  let carrier: DRCCarrierType = 'Unknown';
  let operatorColor = '#64748B';

  if ((DRC_OPERATOR_PREFIXES.VODACOM as readonly string[]).includes(twoDigitPrefix)) {
    carrier = 'Vodacom RDC (M-Pesa)';
    operatorColor = '#10B981'; // Green
  } else if ((DRC_OPERATOR_PREFIXES.ORANGE as readonly string[]).includes(twoDigitPrefix)) {
    carrier = 'Orange RDC (Orange Money)';
    operatorColor = '#F97316'; // Orange
  } else if ((DRC_OPERATOR_PREFIXES.AIRTEL as readonly string[]).includes(twoDigitPrefix)) {
    carrier = 'Airtel RDC (Airtel Money)';
    operatorColor = '#EF4444'; // Red
  } else if ((DRC_OPERATOR_PREFIXES.AFRICELL as readonly string[]).includes(twoDigitPrefix)) {
    carrier = 'Africell RDC (Afrimoney)';
    operatorColor = '#A855F7'; // Purple
  } else if ((DRC_OPERATOR_PREFIXES.FIXED as readonly string[]).includes(twoDigitPrefix) || digitsAfter243.startsWith('1') || digitsAfter243.startsWith('2')) {
    carrier = 'Téléphonie Fixe (SCPT / CKT)';
    operatorColor = '#64748B';
  } else {
    return {
      isValid: false,
      rawInput: raw,
      formattedInternational: standardDigits,
      nationalDisplay: '',
      internationalDisplay: '',
      carrier: 'Unknown',
      prefix: displayPrefix,
      operatorColor: '#64748B',
      errorMessage: `Préfixe réseau non reconnu (${displayPrefix}). Les séries officielles sont : Vodacom (081, 082, 083, 086), Orange (080, 084, 085, 089), Airtel (096, 097, 098, 099), Africell (090, 091).`
    };
  }

  // 6. Format national and international displays
  const rest = digitsAfter243.slice(2);
  let nationalDisplay = '';
  let internationalDisplay = '';

  if (rest.length === 6) {
    // 6-digit rest (e.g. 234 567)
    nationalDisplay = `${displayPrefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
    internationalDisplay = `+243 ${twoDigitPrefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
  } else {
    // 7-digit rest (e.g. 324 0289)
    nationalDisplay = `${displayPrefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
    internationalDisplay = `+243 ${twoDigitPrefix} ${rest.slice(0, 3)} ${rest.slice(3)}`;
  }

  return {
    isValid: true,
    rawInput: raw,
    formattedInternational: standardDigits,
    nationalDisplay,
    internationalDisplay,
    carrier,
    prefix: displayPrefix,
    operatorColor
  };
}
