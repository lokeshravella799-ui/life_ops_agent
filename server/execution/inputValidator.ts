import type { ContactInformation, DeliveryInformation, PassengerInformation, GuestInformation } from './types';

export type ValidationStatus = 'VALID' | 'INVALID' | 'MISSING_REQUIRED_INFORMATION';

export interface ValidationOutcome {
  status: ValidationStatus;
  isValid: boolean;
  errors: string[];
}

export class InputValidator {
  /**
   * Prohibited financial patterns: card numbers, CVVs, UPI PINs, passwords, OTPs
   */
  private static readonly CARD_NUMBER_REGEX = /\b(?:\d[ -]*?){13,19}\b/;
  private static readonly FINANCIAL_KEYWORDS = [
    'cvv',
    'cvc',
    'upi_pin',
    'upipin',
    'card_number',
    'cardnumber',
    'card_num',
    'atm_pin',
    'atmpin',
    'banking_password',
    'bankpassword',
    'netbanking',
    'otp',
    'one_time_password',
  ];

  /**
   * Strict Safety Check: Ensures NO financial credentials or secrets are present in user data
   */
  static inspectForForbiddenFinancialCredentials(data: any): {
    isClean: boolean;
    containsFinancialSecrets: boolean;
    flaggedKeys: string[];
    violation?: string;
  } {
    const flaggedKeys: string[] = [];
    if (!data) {
      return { isClean: true, containsFinancialSecrets: false, flaggedKeys };
    }

    if (typeof data === 'string') {
      const lower = data.toLowerCase();
      for (const kw of this.FINANCIAL_KEYWORDS) {
        if (lower.includes(kw)) {
          flaggedKeys.push(kw);
        }
      }
      const digitsOnly = data.replace(/[^0-9]/g, '');
      if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && this.CARD_NUMBER_REGEX.test(data)) {
        flaggedKeys.push('cardNumber');
      }
    } else if (typeof data === 'object') {
      for (const [k, v] of Object.entries(data)) {
        const kLower = k.toLowerCase();
        let keyFlagged = false;
        for (const kw of this.FINANCIAL_KEYWORDS) {
          if (kLower.includes(kw)) {
            flaggedKeys.push(k);
            keyFlagged = true;
            break;
          }
        }
        if (!keyFlagged && typeof v === 'string') {
          const digitsOnly = v.replace(/[^0-9]/g, '');
          if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && this.CARD_NUMBER_REGEX.test(v)) {
            flaggedKeys.push(k);
          }
        }
        if (typeof v === 'object' && v !== null) {
          const sub = this.inspectForForbiddenFinancialCredentials(v);
          if (sub.flaggedKeys.length > 0) {
            flaggedKeys.push(...sub.flaggedKeys);
          }
        }
      }
    }

    const uniqueKeys = Array.from(new Set(flaggedKeys));
    if (uniqueKeys.length > 0) {
      return {
        isClean: false,
        containsFinancialSecrets: true,
        flaggedKeys: uniqueKeys,
        violation: `SECURITY VIOLATION: Prohibited financial credentials/parameters [${uniqueKeys.join(', ')}] detected. Financial credentials must NEVER be collected, logged, stored, or processed.`,
      };
    }

    return { isClean: true, containsFinancialSecrets: false, flaggedKeys: [] };
  }

  /**
   * Helper that returns true if payload is clean of financial secrets, false otherwise
   */
  static validateNonFinancialPayload(data: any): boolean {
    const sec = this.inspectForForbiddenFinancialCredentials(data);
    return sec.isClean;
  }

  /**
   * Validate non-sensitive customer contact information
   */

  static validateContact(contact?: ContactInformation): ValidationOutcome {
    const errors: string[] = [];

    // Financial security check first
    const sec = this.inspectForForbiddenFinancialCredentials(contact);
    if (!sec.isClean) {
      return {
        status: 'INVALID',
        isValid: false,
        errors: [sec.violation!],
      };
    }

    if (!contact) {
      return {
        status: 'MISSING_REQUIRED_INFORMATION',
        isValid: false,
        errors: ['Contact information was not provided.'],
      };
    }

    if (contact.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact.email)) {
        errors.push(`Invalid email address format: "${contact.email}"`);
      }
    }

    if (contact.phone) {
      const cleanPhone = contact.phone.replace(/[^0-9+]/g, '');
      if (cleanPhone.length < 10 || cleanPhone.length > 15) {
        errors.push(`Invalid telephone number format: "${contact.phone}"`);
      }
    }

    if (errors.length > 0) {
      return { status: 'INVALID', isValid: false, errors };
    }

    return { status: 'VALID', isValid: true, errors: [] };
  }

  /**
   * Validate physical delivery address for commerce orders
   */
  static validateDelivery(delivery?: DeliveryInformation): ValidationOutcome {
    const errors: string[] = [];

    // Financial security check
    const sec = this.inspectForForbiddenFinancialCredentials(delivery);
    if (!sec.isClean) {
      return {
        status: 'INVALID',
        isValid: false,
        errors: [sec.violation!],
      };
    }

    if (!delivery) {
      return {
        status: 'MISSING_REQUIRED_INFORMATION',
        isValid: false,
        errors: ['Delivery address information is required for product preparation.'],
      };
    }

    if (!delivery.addressLine1 || delivery.addressLine1.trim().length === 0) {
      errors.push('Delivery address line 1 is required.');
    }

    if (!delivery.city || delivery.city.trim().length === 0) {
      errors.push('City is required.');
    }

    if (!delivery.postalCode || delivery.postalCode.trim().length === 0) {
      errors.push('Postal / PIN code is required.');
    } else {
      const cleanPostal = delivery.postalCode.trim();
      if (!/^\d{5,7}$/.test(cleanPostal) && !/^[A-Za-z0-9\s-]{3,10}$/.test(cleanPostal)) {
        errors.push(`Invalid postal code format: "${delivery.postalCode}"`);
      }
    }

    if (errors.length > 0) {
      const isMissing = errors.some((e) => e.includes('required'));
      return {
        status: isMissing ? 'MISSING_REQUIRED_INFORMATION' : 'INVALID',
        isValid: false,
        errors,
      };
    }

    return { status: 'VALID', isValid: true, errors: [] };
  }

  /**
   * Validate passenger details for bus or flight bookings
   */
  static validatePassenger(passenger?: PassengerInformation): ValidationOutcome {
    if (!passenger) {
      return {
        status: 'MISSING_REQUIRED_INFORMATION',
        isValid: false,
        errors: ['Passenger information is required.'],
      };
    }

    const sec = this.inspectForForbiddenFinancialCredentials(passenger);
    if (!sec.isClean) {
      return { status: 'INVALID', isValid: false, errors: [sec.violation!] };
    }

    const errors: string[] = [];
    if (!passenger.name || passenger.name.trim().length === 0) {
      errors.push('Passenger full name is required.');
    }

    if (passenger.age !== undefined && (passenger.age < 0 || passenger.age > 120)) {
      errors.push('Passenger age must be between 0 and 120.');
    }

    if (errors.length > 0) {
      return { status: 'INVALID', isValid: false, errors };
    }

    return { status: 'VALID', isValid: true, errors: [] };
  }
}
