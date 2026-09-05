import type {
  NormalizedProduct,
  NormalizedBusResult,
  NormalizedHotelResult,
  NormalizedFlightResult,
} from '../types/provider';
import type {
  ExecutionPreparationResult,
  CheckoutPreparation,
  BookingPreparation,
  ContactInformation,
  DeliveryInformation,
  PassengerInformation,
  GuestInformation,
  SelectedItem,
} from './types';
import { CostCalculator } from './costCalculator';
import { InputValidator } from './inputValidator';
import { logger } from '../utils/logger';

export interface PreparationOptions {
  customTaxes?: number;
  customDeliveryFee?: number;
  customConvenienceFee?: number;
  expiryMinutes?: number;
  skipDeliveryCheck?: boolean; // For initial selection preview
}

export class ExecutionPreparer {
  private static generateExecutionId(prefix: string): string {
    return `exec_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Validate verification readiness and freshness before allowing execution preparation
   */
  private static validateVerificationReadiness(target: any): { isReady: boolean; errorCode?: string; error?: string } {
    const item = target?.item || target;
    const ver = target?.verification || item?.verification;

    if (!ver || ver.status === 'UNVERIFIED' || ver.status === 'UNSUPPORTED' || ver.priceVerified === false) {
      return {
        isReady: false,
        errorCode: 'ITEM_NOT_VERIFIED',
        error: `Cannot prepare order for item ${item?.id || 'unknown'}: Item must be verified before transaction preparation. Live verification is strictly required.`,
      };
    }

    if (ver.status === 'FAILED') {
      return {
        isReady: false,
        errorCode: 'VERIFICATION_FAILED',
        error: `Cannot prepare order for item ${item?.id || 'unknown'}: Provider verification failed.`,
      };
    }

    if (
      ver.status === 'UNAVAILABLE' ||
      ver.availabilityStatus === 'UNAVAILABLE' ||
      item?.availability?.toUpperCase() === 'UNAVAILABLE' ||
      item?.isAvailable === false
    ) {
      return {
        isReady: false,
        errorCode: 'ITEM_UNAVAILABLE',
        error: `Cannot prepare order for item ${item?.id || 'unknown'}: Item is currently unavailable from the provider.`,
      };
    }

    if (
      ver.freshness === 'STALE' ||
      (typeof ver.freshness === 'object' && ver.freshness?.status === 'STALE')
    ) {
      return {
        isReady: false,
        errorCode: 'FRESH_VERIFICATION_REQUIRED',
        error: `Cannot prepare order for item ${item?.id || 'unknown'}: Fresh verification is required before preparation.`,
      };
    }

    return { isReady: true };
  }

  /**
   * Prepare a Commerce Product Order
   */
  static prepareProductOrder(
    product: any,
    contact?: ContactInformation,
    delivery?: DeliveryInformation,
    options?: PreparationOptions
  ): ExecutionPreparationResult {
    const rawItem = product?.item || product;
    const verification = product?.verification || rawItem?.verification;
    logger.info('ExecutionPreparer preparing product order', { productId: rawItem?.id });

    // 1. Verification Integrity Gate
    const verCheck = this.validateVerificationReadiness(product);
    if (!verCheck.isReady) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: verCheck.errorCode,
        error: verCheck.error,
        issues: [verCheck.error!],
      };
    }

    // 2. Prohibited Financial Information Check
    const secContact = InputValidator.inspectForForbiddenFinancialCredentials(contact);
    if (!secContact.isClean) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'SECURITY_VIOLATION_CREDENTIALS_REJECTED',
        error: secContact.violation,
        issues: [secContact.violation!],
      };
    }

    const secDelivery = InputValidator.inspectForForbiddenFinancialCredentials(delivery);
    if (!secDelivery.isClean) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'SECURITY_VIOLATION_CREDENTIALS_REJECTED',
        error: secDelivery.violation,
        issues: [secDelivery.violation!],
      };
    }

    // 3. Contact & Address Validation
    if (contact) {
      const contactVal = InputValidator.validateContact(contact);
      if (!contactVal.isValid) {
        return {
          success: false,
          status: 'FAILED',
          errorCode: contactVal.status === 'INVALID' ? 'INVALID_CONTACT_INFORMATION' : 'MISSING_CONTACT_INFORMATION',
          error: contactVal.errors.join('; '),
          issues: contactVal.errors,
        };
      }
    }

    if (!delivery && !options?.skipDeliveryCheck) {
      return {
        success: false,
        status: 'FAILED',
        errorCode: 'MISSING_DELIVERY_INFORMATION',
        error: 'Delivery address is required for product order preparation.',
      };
    }

    if (delivery && !options?.skipDeliveryCheck) {
      const deliveryValidation = InputValidator.validateDelivery(delivery);
      if (!deliveryValidation.isValid) {
        return {
          success: false,
          status: 'FAILED',
          errorCode: deliveryValidation.status === 'MISSING_REQUIRED_INFORMATION' ? 'MISSING_DELIVERY_INFORMATION' : 'INVALID_DELIVERY_INFORMATION',
          error: deliveryValidation.errors.join('; '),
          issues: deliveryValidation.errors,
        };
      }
    }

    // 4. Calculate Deterministic Cost Breakdown
    const effectivePrice = verification?.verifiedPrice ?? (typeof rawItem.price === 'number' ? rawItem.price : rawItem.price?.amount);
    const costBreakdown = CostCalculator.calculateProductCost({
      price: effectivePrice,
      currency: rawItem.currency || rawItem.price?.currency || 'INR',
      delivery: rawItem.delivery,
    }, {
      taxes: options?.customTaxes,
      deliveryFee: options?.customDeliveryFee,
      convenienceFee: options?.customConvenienceFee,
    });

    const executionId = this.generateExecutionId('prod');
    const createdAt = new Date().toISOString();
    const expiryMins = options?.expiryMinutes ?? 15;
    const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000).toISOString();

    const providerId = rawItem.provider?.id || rawItem.providerId || 'mock_omnistore';
    let providerName = rawItem.provider?.name || rawItem.provider || 'DEVELOPMENT MOCK - OmniStore';
    if (providerName === 'mock_omnistore' || providerId === 'mock_omnistore') {
      providerName = 'DEVELOPMENT MOCK - OmniStore';
    } else if (providerName === 'mock_apexretail' || providerId === 'mock_apexretail') {
      providerName = 'DEVELOPMENT MOCK - ApexRetail';
    }
    const productUrl = rawItem.productUrl || rawItem.url || 'https://omnistore.internal.local/p/asus-rog-g16';
    const searchPrice = typeof rawItem.price === 'number' ? rawItem.price : (rawItem.price?.amount ?? effectivePrice);

    const selectedItem: SelectedItem = {
      id: rawItem.id,
      title: rawItem.title,
      category: rawItem.category || 'product',
      searchPrice,
      verifiedPrice: effectivePrice,
      price: {
        amount: effectivePrice,
        currency: costBreakdown.currency,
      },
      provider: {
        id: providerId,
        name: providerName,
      },
      url: productUrl,
      availability: rawItem.availability || (verification?.availabilityStatus === 'AVAILABLE' ? 'In Stock' : 'Unknown'),
      specifications: rawItem.specifications || rawItem.attributes,
      verification,
      deliveryEstimate: rawItem.delivery?.estimatedDate,
    };

    const confirmationGateMessage = [
      `Selected: ${rawItem.title}`,
      `Price: ${costBreakdown.currency} ${costBreakdown.basePrice.toLocaleString('en-IN')}`,
      `Delivery: ${costBreakdown.deliveryFee !== undefined ? `${costBreakdown.currency} ${costBreakdown.deliveryFee}` : 'Free'}`,
      `Taxes: ${costBreakdown.taxes !== undefined ? `${costBreakdown.currency} ${costBreakdown.taxes}` : 'Inclusive of GST'}`,
      `Total: ${costBreakdown.currency} ${costBreakdown.total.toLocaleString('en-IN')}`,
      `Seller: ${rawItem.seller || providerName}`,
      `Source: ${providerName}`,
      `Availability: Verified In Stock`,
      `Do you want to authorize this order? (Explicit confirmation required)`,
    ].join('\n');

    const safetyInvariant: SafetyInvariant = {
      noRealOrdersPlaced: true,
      noRealPaymentCharged: true,
      noFinancialCredentialsStored: true,
    };

    const preparation: CheckoutPreparation = {
      executionId,
      type: 'PRODUCT_ORDER',
      status: 'AWAITING_CONFIRMATION',
      item: selectedItem,
      costBreakdown,
      provider: {
        id: providerId,
        name: providerName,
        productUrl,
        url: productUrl,
      },
      contact,
      delivery,
      verification: verification!,
      confirmationRequired: true,
      confirmationGateMessage,
      safetyInvariant,
      createdAt,
      expiresAt,
    };

    return {
      success: true,
      preparation,
      status: 'AWAITING_CONFIRMATION',
    };
  }

  /**
   * Prepare a Bus Transit Booking
   */
  static prepareBusBooking(
    bus: any,
    contact?: ContactInformation,
    passengers?: PassengerInformation[],
    options?: PreparationOptions
  ): ExecutionPreparationResult {
    const rawItem = bus?.item || bus;
    const verification = bus?.verification || rawItem?.verification;
    logger.info('ExecutionPreparer preparing bus booking', { busId: rawItem?.id });

    // 1. Verification Integrity Gate
    const verCheck = this.validateVerificationReadiness(bus);
    if (!verCheck.isReady) {
      return { success: false, status: 'FAILED', errorCode: verCheck.errorCode, error: verCheck.error, issues: [verCheck.error!] };
    }

    // 2. Prohibited Credentials Check
    const secContact = InputValidator.inspectForForbiddenFinancialCredentials(contact);
    if (!secContact.isClean) {
      return { success: false, status: 'FAILED', errorCode: 'SECURITY_VIOLATION_CREDENTIALS_REJECTED', error: secContact.violation, issues: [secContact.violation!] };
    }

    const secPassengers = InputValidator.inspectForForbiddenFinancialCredentials(passengers);
    if (!secPassengers.isClean) {
      return { success: false, status: 'FAILED', errorCode: 'SECURITY_VIOLATION_CREDENTIALS_REJECTED', error: secPassengers.violation, issues: [secPassengers.violation!] };
    }

    // 3. Cost Breakdown
    const effectivePrice = verification?.verifiedPrice ?? (typeof rawItem.price === 'number' ? rawItem.price : rawItem.price?.amount);
    const costBreakdown = CostCalculator.calculateBookingCost({
      price: effectivePrice,
      currency: rawItem.currency || rawItem.price?.currency || 'INR',
    }, {
      taxes: options?.customTaxes,
      convenienceFee: options?.customConvenienceFee,
    });

    const executionId = this.generateExecutionId('bus');
    const createdAt = new Date().toISOString();
    const expiryMins = options?.expiryMinutes ?? 15;
    const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000).toISOString();

    const providerId = rawItem.provider?.id || rawItem.providerId || 'mock_smarttransit';
    let providerName = rawItem.provider?.name || rawItem.provider || 'DEVELOPMENT MOCK - SmartTransit';
    if (providerName === 'mock_smarttransit' || providerId === 'mock_smarttransit') {
      providerName = 'DEVELOPMENT MOCK - SmartTransit';
    }
    const bookingUrl = rawItem.bookingUrl || rawItem.url || '';

    const operator = rawItem.operator || rawItem.attributes?.operator || 'Transit Operator';
    const source = rawItem.source || rawItem.attributes?.source || 'Source';
    const destination = rawItem.destination || rawItem.attributes?.destination || 'Destination';
    const departureTime = rawItem.departureTime || rawItem.attributes?.departureTime || '00:00';
    const arrivalTime = rawItem.arrivalTime || rawItem.attributes?.arrivalTime || '';
    const seatType = rawItem.busType || rawItem.seatType || rawItem.attributes?.seatType || 'AC Sleeper';
    const cancellationPolicy = rawItem.cancellationPolicy || rawItem.attributes?.cancellationPolicy || 'Standard operator policy applies';

    const selectedItem: SelectedItem = {
      id: rawItem.id,
      title: `${operator} (${source} → ${destination})`,
      category: 'bus',
      price: {
        amount: effectivePrice,
        currency: costBreakdown.currency,
      },
      provider: {
        id: providerId,
        name: providerName,
      },
      url: bookingUrl,
      specifications: {
        operator,
        departureTime,
        arrivalTime,
        busType: seatType,
      },
      verification: bus.verification,
    };

    const confirmationGateMessage = [
      `Operator: ${operator}`,
      `Route: ${source} → ${destination}`,
      `Departure: ${departureTime}`,
      `Arrival: ${arrivalTime || 'Next Morning'}`,
      `Seat Type: ${seatType}`,
      `Base Fare: ${costBreakdown.currency} ${costBreakdown.basePrice.toLocaleString('en-IN')}`,
      `Taxes & Fees: ${costBreakdown.taxes !== undefined ? `${costBreakdown.currency} ${costBreakdown.taxes}` : '₹0'}`,
      `Total: ${costBreakdown.currency} ${costBreakdown.total.toLocaleString('en-IN')}`,
      `Cancellation: ${cancellationPolicy}`,
      `Booking Provider: ${providerName}`,
      `Do you want to confirm this bus reservation?`,
    ].join('\n');

    const preparation: BookingPreparation = {
      executionId,
      type: 'BUS_BOOKING',
      status: 'AWAITING_CONFIRMATION',
      item: selectedItem,
      costBreakdown,
      provider: {
        id: providerId,
        name: providerName,
        bookingUrl,
      },
      contact,
      passengers,
      itinerary: {
        source,
        destination,
        departureTime,
        arrivalTime,
      },
      bookingDetails: {
        operator,
        route: `${source} -> ${destination}`,
        seatType,
        departureTime,
        arrivalTime,
      },
      verification: bus.verification!,
      cancellationPolicy,
      confirmationRequired: true,
      confirmationGateMessage,
      safetyInvariant: {
        noRealOrdersPlaced: true,
        noRealPaymentCharged: true,
        noFinancialCredentialsStored: true,
      },
      createdAt,
      expiresAt,
    };

    return {
      success: true,
      preparation,
      status: 'AWAITING_CONFIRMATION',
    };
  }

  /**
   * Prepare a Hotel Stay Reservation
   */
  static prepareHotelBooking(
    hotel: any,
    contact?: ContactInformation,
    guests?: GuestInformation,
    options?: PreparationOptions
  ): ExecutionPreparationResult {
    const rawItem = hotel?.item || hotel;
    const verification = hotel?.verification || rawItem?.verification;
    logger.info('ExecutionPreparer preparing hotel booking', { hotelId: rawItem?.id });

    const verCheck = this.validateVerificationReadiness(hotel);
    if (!verCheck.isReady) {
      return { success: false, status: 'FAILED', errorCode: verCheck.errorCode, error: verCheck.error, issues: [verCheck.error!] };
    }

    const secContact = InputValidator.inspectForForbiddenFinancialCredentials(contact);
    if (!secContact.isClean) {
      return { success: false, status: 'FAILED', errorCode: 'SECURITY_VIOLATION_CREDENTIALS_REJECTED', error: secContact.violation, issues: [secContact.violation!] };
    }

    const effectivePrice = verification?.verifiedPrice ?? (typeof rawItem.price === 'number' ? rawItem.price : rawItem.price?.amount);
    const costBreakdown = CostCalculator.calculateBookingCost({
      price: effectivePrice,
      currency: rawItem.currency || rawItem.price?.currency || 'INR',
    }, {
      taxes: options?.customTaxes,
      convenienceFee: options?.customConvenienceFee,
    });

    const executionId = this.generateExecutionId('hotel');
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const providerId = rawItem.provider?.id || rawItem.providerId || 'mock_horizonstays';
    let providerName = rawItem.provider?.name || rawItem.provider || 'DEVELOPMENT MOCK - HorizonStays';
    if (providerName === 'mock_horizonstays' || providerId === 'mock_horizonstays') {
      providerName = 'DEVELOPMENT MOCK - HorizonStays';
    }
    const bookingUrl = rawItem.bookingUrl || rawItem.url || '';

    const hotelName = rawItem.hotelName || rawItem.name || rawItem.attributes?.hotelName || rawItem.title || 'Hotel Stay';
    const roomType = rawItem.roomType || rawItem.attributes?.roomType || 'Deluxe Room';
    const checkIn = rawItem.checkIn || rawItem.attributes?.checkIn;
    const checkOut = rawItem.checkOut || rawItem.attributes?.checkOut;
    const nights = rawItem.nights || rawItem.attributes?.nights || 1;
    const cancellationPolicy = rawItem.cancellationPolicy || rawItem.attributes?.cancellationPolicy || 'Standard hotel cancellation policy applies';

    const selectedItem: SelectedItem = {
      id: rawItem.id,
      title: hotelName,
      category: 'hotel',
      price: {
        amount: effectivePrice,
        currency: costBreakdown.currency,
      },
      provider: {
        id: providerId,
        name: providerName,
      },
      url: bookingUrl,
      verification: verification,
      specifications: {
        location: rawItem.location || '',
        roomType,
      },
    };

    const preparation: BookingPreparation = {
      executionId,
      type: 'HOTEL_BOOKING',
      status: 'AWAITING_CONFIRMATION',
      item: selectedItem,
      costBreakdown,
      provider: {
        id: providerId,
        name: providerName,
        bookingUrl,
      },
      contact,
      guests,
      itinerary: {
        roomType,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      },
      stayDetails: {
        hotelName,
        roomType,
        nights,
        checkIn,
        checkOut,
      },
      verification: hotel.verification!,
      cancellationPolicy,
      confirmationRequired: true,
      confirmationGateMessage: `Hotel: ${hotelName}\nRoom: ${roomType}\nTariff: ${costBreakdown.currency} ${costBreakdown.total.toLocaleString('en-IN')}\nProvider: ${providerName}\nConfirm stay?`,
      safetyInvariant: {
        noRealOrdersPlaced: true,
        noRealPaymentCharged: true,
        noFinancialCredentialsStored: true,
      },
      createdAt,
      expiresAt,
    };

    return {
      success: true,
      preparation,
      status: 'AWAITING_CONFIRMATION',
    };
  }

  /**
   * Prepare an Aviation Flight Reservation
   */
  static prepareFlightBooking(
    flight: any,
    contact?: ContactInformation,
    passengers?: PassengerInformation[],
    options?: PreparationOptions
  ): ExecutionPreparationResult {
    const rawItem = flight?.item || flight;
    const verification = flight?.verification || rawItem?.verification;
    logger.info('ExecutionPreparer preparing flight booking', { flightId: rawItem?.id });

    const verCheck = this.validateVerificationReadiness(flight);
    if (!verCheck.isReady) {
      return { success: false, status: 'FAILED', errorCode: verCheck.errorCode, error: verCheck.error, issues: [verCheck.error!] };
    }

    const secContact = InputValidator.inspectForForbiddenFinancialCredentials(contact);
    if (!secContact.isClean) {
      return { success: false, status: 'FAILED', errorCode: 'SECURITY_VIOLATION_CREDENTIALS_REJECTED', error: secContact.violation, issues: [secContact.violation!] };
    }

    const effectivePrice = verification?.verifiedPrice ?? (typeof rawItem.price === 'number' ? rawItem.price : rawItem.price?.amount);
    const costBreakdown = CostCalculator.calculateBookingCost({
      price: effectivePrice,
      currency: rawItem.currency || rawItem.price?.currency || 'INR',
    }, {
      taxes: options?.customTaxes,
      convenienceFee: options?.customConvenienceFee,
    });

    const executionId = this.generateExecutionId('flight');
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const providerId = rawItem.provider?.id || rawItem.providerId || 'mock_skyroutes';
    let providerName = rawItem.provider?.name || rawItem.provider || 'DEVELOPMENT MOCK - SkyRoutes';
    if (providerName === 'mock_skyroutes' || providerId === 'mock_skyroutes') {
      providerName = 'DEVELOPMENT MOCK - SkyRoutes';
    }
    const bookingUrl = rawItem.bookingUrl || rawItem.url || '';

    const airline = rawItem.airline || rawItem.attributes?.airline || 'Airline';
    const flightNumber = rawItem.flightNumber || rawItem.attributes?.flightNumber || 'FLIGHT';
    const origin = rawItem.origin || rawItem.attributes?.origin || 'Origin';
    const destination = rawItem.destination || rawItem.attributes?.destination || 'Destination';
    const cabinClass = rawItem.cabinClass || rawItem.attributes?.cabinClass || 'Economy';
    const departureTime = rawItem.departureTime || rawItem.attributes?.departureTime || '00:00';
    const arrivalTime = rawItem.arrivalTime || rawItem.attributes?.arrivalTime || '00:00';

    const selectedItem: SelectedItem = {
      id: rawItem.id,
      title: `${airline} (${origin} → ${destination})`,
      category: 'flight',
      price: {
        amount: effectivePrice,
        currency: costBreakdown.currency,
      },
      provider: {
        id: providerId,
        name: providerName,
      },
      url: bookingUrl,
      verification: verification,
      specifications: {
        airline,
        flightNumber,
        cabinClass,
      },
    };

    const preparation: BookingPreparation = {
      executionId,
      type: 'FLIGHT_BOOKING',
      status: 'AWAITING_CONFIRMATION',
      item: selectedItem,
      costBreakdown,
      provider: {
        id: providerId,
        name: providerName,
        bookingUrl,
      },
      contact,
      passengers,
      itinerary: {
        source: origin,
        destination,
        departureTime,
        arrivalTime,
      },
      flightDetails: {
        airline,
        flightNumber,
        origin,
        destination,
        cabinClass,
        departureTime,
        arrivalTime,
      },
      verification: flight.verification!,
      confirmationRequired: true,
      confirmationGateMessage: `Flight: ${airline} (${flightNumber})\nTotal: ${costBreakdown.currency} ${costBreakdown.total.toLocaleString('en-IN')}\nProvider: ${providerName}\nConfirm flight?`,
      safetyInvariant: {
        noRealOrdersPlaced: true,
        noRealPaymentCharged: true,
        noFinancialCredentialsStored: true,
      },
      createdAt,
      expiresAt,
    };

    return {
      success: true,
      preparation,
      status: 'AWAITING_CONFIRMATION',
    };
  }
}
