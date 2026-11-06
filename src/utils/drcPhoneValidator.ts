/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Strict DRC (Democratic Republic of Congo) Phone Cleaner & Validator
 * Enforces conversion of raw user input (e.g. 081 234 5678, +243 89-000-000, 00243...)
 * into the standardized international format "243XXXXXXXXX" (12 digits).
 */

export interface DRCPhoneValidationResult {
  isValid: boolean;
  rawInput: string;
  formattedInternational: string; // e.g. "243812345678"
  nationalDisplay: string;        // e.g. "081 234 5678"
  internationalDisplay: string;   // e.g. "+243 812 345 678"
  carrier: 'Vodacom (M-Pesa)' | 'Orange DRC (Orange Money)' | 'Airtel DRC (Airtel Money)' | 'Africell' | 'Unknown';
  errorMessage?: string;
}

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
      errorMessage: 'Le numéro de téléphone est obligatoire.'
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

  // 3. Normalize DRC Country Code (243)
  let standard12Digits = '';

  if (cleaned.startsWith('243')) {
    // Already has 243 prefix
    standard12Digits = cleaned;
  } else if (cleaned.startsWith('0') && cleaned.length === 10) {
    // National format with leading 0 (e.g., 0812345678 -> 243812345678)
    standard12Digits = '243' + cleaned.slice(1);
  } else if ((cleaned.startsWith('8') || cleaned.startsWith('9')) && cleaned.length === 9) {
    // National format without leading 0 (e.g., 812345678 -> 243812345678)
    standard12Digits = '243' + cleaned;
  } else {
    return {
      isValid: false,
      rawInput: raw,
      formattedInternational: cleaned,
      nationalDisplay: '',
      internationalDisplay: '',
      carrier: 'Unknown',
      errorMessage: 'Format invalide. Utilisez un format RDC (ex: 0812345678 ou +243812345678).'
    };
  }

  // 4. Strict length and regex validation for 243 + 9 digits
  if (standard12Digits.length !== 12) {
    return {
      isValid: false,
      rawInput: raw,
      formattedInternational: standard12Digits,
      nationalDisplay: '',
      internationalDisplay: '',
      carrier: 'Unknown',
      errorMessage: `Longueur invalide (${standard12Digits.length} chiffres au lieu de 12 attendus pour l'indicatif 243).`
    };
  }

  // DRC Telecom Prefixes:
  // Vodacom: 81, 82, 83
  // Orange: 84, 85, 89
  // Airtel: 97, 98, 99
  // Africell: 90, 91
  const prefix = standard12Digits.substring(3, 5); // 2-digit prefix after 243
  let carrier: DRCPhoneValidationResult['carrier'] = 'Unknown';

  if (['81', '82', '83'].includes(prefix)) {
    carrier = 'Vodacom (M-Pesa)';
  } else if (['84', '85', '89'].includes(prefix)) {
    carrier = 'Orange DRC (Orange Money)';
  } else if (['97', '98', '99'].includes(prefix)) {
    carrier = 'Airtel DRC (Airtel Money)';
  } else if (['90', '91'].includes(prefix)) {
    carrier = 'Africell';
  } else {
    return {
      isValid: false,
      rawInput: raw,
      formattedInternational: standard12Digits,
      nationalDisplay: '',
      internationalDisplay: '',
      carrier: 'Unknown',
      errorMessage: `Préfixe réseau non reconnu (${prefix}). Doit débuter par 081-085, 089, 090-091, ou 097-099.`
    };
  }

  // Formatting strings for pleasant UI display
  const localNum = '0' + standard12Digits.slice(3);
  const nationalDisplay = `${localNum.slice(0, 3)} ${localNum.slice(3, 6)} ${localNum.slice(6)}`;
  const internationalDisplay = `+243 ${standard12Digits.slice(3, 6)} ${standard12Digits.slice(6, 9)} ${standard12Digits.slice(9)}`;

  return {
    isValid: true,
    rawInput: raw,
    formattedInternational: standard12Digits, // exact 243XXXXXXXXX
    nationalDisplay,
    internationalDisplay,
    carrier
  };
}
