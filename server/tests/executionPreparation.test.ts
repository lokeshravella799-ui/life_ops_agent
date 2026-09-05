import test from 'node:test';
import assert from 'node:assert/strict';
import { ExecutionPreparer } from '../execution/executionPreparer.js';
import { CostCalculator } from '../execution/costCalculator.js';
import { InputValidator } from '../execution/inputValidator.js';
import { confirmationGate } from '../execution/confirmationGate.js';
import { orchestrator } from '../agent/orchestrator.js';
import type { Recommendation } from '../recommendation/types.js';
import type { ContactInformation, DeliveryInformation, PassengerInformation, GuestInformation } from '../execution/types.js';

test('LifeOps Phase 2 Step 5: Execution Preparation & Checkout Architecture', async (t) => {
  // Test Data Fixtures
  const validContact: ContactInformation = {
    name: 'Lokesh Sharma',
    email: 'lokesh.sharma@example.com',
    phone: '+919876543210',
  };

  const validDelivery: DeliveryInformation = {
    fullName: 'Lokesh Sharma',
    addressLine1: '402, Skyline Residency, Hitec City',
    city: 'Hyderabad',
    state: 'Telangana',
    postalCode: '500081',
    country: 'India',
    phone: '+919876543210',
  };

  const validPassenger: PassengerInformation = {
    fullName: 'Lokesh Sharma',
    age: 28,
    gender: 'MALE',
    contact: validContact,
  };

  const validGuest: GuestInformation = {
    primaryGuestName: 'Lokesh Sharma',
    contact: validContact,
    numberOfGuests: 2,
    numberOfRooms: 1,
  };

  const mockVerifiedProduct: Recommendation = {
    item: {
      id: 'prod_101',
      providerId: 'mock_omnistore',
      title: 'ASUS ROG Strix G16 Gaming Laptop',
      price: 64499,
      currency: 'INR',
      category: 'product',
      url: 'https://omnistore.internal.local/p/asus-rog-g16',
      attributes: { brand: 'ASUS', ram: '16GB', storage: '512GB SSD' },
      isAvailable: true,
    },
    rank: 1,
    score: 95,
    isExactMatch: true,
    pros: ['High performance GPU', 'Under budget'],
    cons: ['Heavier charger'],
    verification: {
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      verifiedPrice: 64499,
      priceDifference: 0,
      priceStatus: 'UNCHANGED',
      availabilityStatus: 'AVAILABLE',
      urlValidated: true,
      freshness: 'FRESH',
      verifiedAt: new Date().toISOString(),
      status: 'VERIFIED',
      summary: 'Verified price and availability confirmed with provider',
    },
  };

  const mockVerifiedBus: Recommendation = {
    item: {
      id: 'bus_201',
      providerId: 'mock_smarttransit',
      title: 'Orange Travels AC Sleeper',
      price: 1250,
      currency: 'INR',
      category: 'bus',
      url: 'https://smarttransit.internal.local/b/orange-101',
      attributes: {
        operator: 'Orange Travels',
        source: 'Hyderabad',
        destination: 'Bangalore',
        departureTime: '21:30',
        arrivalTime: '06:00',
        seatType: 'AC Sleeper',
        cancellationPolicy: 'Refundable up to 6 hours before departure',
      },
      isAvailable: true,
    },
    rank: 1,
    score: 92,
    isExactMatch: true,
    pros: ['On-time departure rate 98%'],
    cons: [],
    verification: {
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      verifiedPrice: 1250,
      priceDifference: 0,
      priceStatus: 'UNCHANGED',
      availabilityStatus: 'AVAILABLE',
      urlValidated: true,
      freshness: 'FRESH',
      verifiedAt: new Date().toISOString(),
      status: 'VERIFIED',
      summary: 'Bus route and seats verified',
    },
  };

  const mockVerifiedHotel: Recommendation = {
    item: {
      id: 'hotel_301',
      providerId: 'mock_horizonstays',
      title: 'The Grand Palace Hotel',
      price: 4500,
      currency: 'INR',
      category: 'hotel',
      url: 'https://horizonstays.internal.local/h/grand-palace',
      attributes: {
        hotelName: 'The Grand Palace',
        roomType: 'Deluxe King Suite',
        checkIn: '2026-09-10',
        checkOut: '2026-09-12',
        nights: 2,
        guests: 2,
        cancellationPolicy: 'Free cancellation until 24 hours before check-in',
      },
      isAvailable: true,
    },
    rank: 1,
    score: 90,
    isExactMatch: true,
    pros: ['Complimentary breakfast buffet included'],
    cons: [],
    verification: {
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      verifiedPrice: 4500,
      priceDifference: 0,
      priceStatus: 'UNCHANGED',
      availabilityStatus: 'AVAILABLE',
      urlValidated: true,
      freshness: 'FRESH',
      verifiedAt: new Date().toISOString(),
      status: 'VERIFIED',
      summary: 'Hotel room availability confirmed',
    },
  };

  const mockVerifiedFlight: Recommendation = {
    item: {
      id: 'flight_401',
      providerId: 'mock_skyroutes',
      title: 'IndiGo 6E-204 HYD -> BLR',
      price: 3200,
      currency: 'INR',
      category: 'flight',
      url: 'https://skyroutes.internal.local/f/6e-204',
      attributes: {
        airline: 'IndiGo',
        flightNumber: '6E-204',
        origin: 'HYD',
        destination: 'BLR',
        departureTime: '14:00',
        arrivalTime: '15:15',
        cabinClass: 'Economy',
      },
      isAvailable: true,
    },
    rank: 1,
    score: 94,
    isExactMatch: true,
    pros: ['Non-stop direct flight'],
    cons: [],
    verification: {
      priceVerified: true,
      availabilityVerified: true,
      providerVerified: true,
      verifiedPrice: 3200,
      priceDifference: 0,
      priceStatus: 'UNCHANGED',
      availabilityStatus: 'AVAILABLE',
      urlValidated: true,
      freshness: 'FRESH',
      verifiedAt: new Date().toISOString(),
      status: 'VERIFIED',
      summary: 'Flight inventory verified',
    },
  };

  // 1. Product preparation succeeds with valid verified data
  await t.test('TEST 1: Product preparation succeeds with valid verified data', async () => {
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    assert.ok(result.preparation);
    assert.equal(result.preparation.type, 'PRODUCT_ORDER');
    assert.equal(result.preparation.status, 'AWAITING_CONFIRMATION');
    assert.equal(result.preparation.item.id, 'prod_101');
    assert.equal(result.preparation.costBreakdown.basePrice, 64499);
    assert.equal(result.preparation.costBreakdown.total, 64499);
    assert.equal(result.preparation.costBreakdown.currency, 'INR');
    assert.ok(result.preparation.executionId.startsWith('exec_prod_'));
    assert.equal(result.preparation.safetyInvariant.noRealOrdersPlaced, true);
    assert.equal(result.preparation.safetyInvariant.noRealPaymentCharged, true);
  });

  // 2. Bus preparation succeeds
  await t.test('TEST 2: Bus preparation succeeds with valid passenger and schedule', async () => {
    const result = ExecutionPreparer.prepareBusBooking(
      mockVerifiedBus,
      validContact,
      [validPassenger]
    );

    assert.equal(result.success, true);
    assert.ok(result.preparation);
    assert.equal(result.preparation.type, 'BUS_BOOKING');
    assert.equal(result.preparation.status, 'AWAITING_CONFIRMATION');
    assert.equal(result.preparation.bookingDetails?.operator, 'Orange Travels');
    assert.equal(result.preparation.bookingDetails?.route, 'Hyderabad -> Bangalore');
    assert.equal(result.preparation.bookingDetails?.seatType, 'AC Sleeper');
    assert.equal(result.preparation.costBreakdown.total, 1250);
  });

  // 3. Hotel preparation succeeds
  await t.test('TEST 3: Hotel preparation succeeds with valid stay details', async () => {
    const result = ExecutionPreparer.prepareHotelBooking(
      mockVerifiedHotel,
      validContact,
      validGuest
    );

    assert.equal(result.success, true);
    assert.ok(result.preparation);
    assert.equal(result.preparation.type, 'HOTEL_BOOKING');
    assert.equal(result.preparation.status, 'AWAITING_CONFIRMATION');
    assert.equal(result.preparation.stayDetails?.hotelName, 'The Grand Palace');
    assert.equal(result.preparation.stayDetails?.roomType, 'Deluxe King Suite');
    assert.equal(result.preparation.costBreakdown.total, 4500);
  });

  // 4. Flight preparation succeeds
  await t.test('TEST 4: Flight preparation succeeds with itinerary and passenger', async () => {
    const result = ExecutionPreparer.prepareFlightBooking(
      mockVerifiedFlight,
      validContact,
      [validPassenger]
    );

    assert.equal(result.success, true);
    assert.ok(result.preparation);
    assert.equal(result.preparation.type, 'FLIGHT_BOOKING');
    assert.equal(result.preparation.status, 'AWAITING_CONFIRMATION');
    assert.equal(result.preparation.flightDetails?.airline, 'IndiGo');
    assert.equal(result.preparation.flightDetails?.flightNumber, '6E-204');
    assert.equal(result.preparation.flightDetails?.origin, 'HYD');
    assert.equal(result.preparation.flightDetails?.destination, 'BLR');
    assert.equal(result.preparation.costBreakdown.total, 3200);
  });

  // 5. Cost calculation is deterministic
  await t.test('TEST 5: Cost calculation is mathematically deterministic and preserves components', async () => {
    const breakdown1 = CostCalculator.calculate({
      basePrice: 50000,
      taxes: 9000,
      deliveryFee: 150,
      convenienceFee: 50,
      otherFees: 0,
      currency: 'INR',
    });

    const breakdown2 = CostCalculator.calculate({
      basePrice: 50000,
      taxes: 9000,
      deliveryFee: 150,
      convenienceFee: 50,
      otherFees: 0,
      currency: 'INR',
    });

    assert.equal(breakdown1.total, 59200);
    assert.equal(breakdown1.total, breakdown2.total);
    assert.deepEqual(breakdown1, breakdown2);

    // Never invents taxes when undefined
    const noTaxes = CostCalculator.calculate({
      basePrice: 1000,
      currency: 'INR',
    });
    assert.equal(noTaxes.taxes, undefined);
    assert.equal(noTaxes.total, 1000);
  });

  // 6. Missing required information is detected
  await t.test('TEST 6: Missing required information is detected and returns structured error', async () => {
    // Missing delivery address for physical product
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      undefined as any
    );

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'MISSING_DELIVERY_INFORMATION');
    assert.match(result.error!, /Delivery address is required/i);
  });

  // 7. Invalid contact information is rejected
  await t.test('TEST 7: Invalid contact information is rejected', async () => {
    const badContact: ContactInformation = {
      name: 'L',
      email: 'not-an-email',
      phone: '123',
    };

    const validation = InputValidator.validateContact(badContact);
    assert.equal(validation.status, 'INVALID');
    assert.ok(validation.errors.length >= 2);

    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      badContact,
      validDelivery
    );
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'INVALID_CONTACT_INFORMATION');
  });

  // 8. Financial credentials are never accepted or stored
  await t.test('TEST 8: Financial credentials (card, CVV, UPI PIN, passwords) are rejected instantly', async () => {
    // Attempt to inject sensitive financial credentials
    const maliciousContact: any = {
      name: 'Alice',
      email: 'alice@example.com',
      phone: '+919876543210',
      cardNumber: '4111 2222 3333 4444',
      cvv: '123',
      upiPin: '998877',
    };

    const scan = InputValidator.inspectForForbiddenFinancialCredentials(maliciousContact);
    assert.equal(scan.containsFinancialSecrets, true);
    assert.ok(scan.flaggedKeys.includes('cardNumber'));
    assert.ok(scan.flaggedKeys.includes('cvv'));
    assert.ok(scan.flaggedKeys.includes('upiPin'));

    const validation = InputValidator.validateContact(maliciousContact);
    assert.equal(validation.status, 'INVALID');
    assert.match(validation.errors[0], /Financial credentials must NEVER be collected/i);

    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      maliciousContact,
      validDelivery
    );
    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'SECURITY_VIOLATION_CREDENTIALS_REJECTED');
  });

  // 9. Unverified product cannot proceed to preparation
  await t.test('TEST 9: Unverified product cannot proceed to preparation', async () => {
    const unverifiedProduct: Recommendation = {
      ...mockVerifiedProduct,
      verification: {
        ...mockVerifiedProduct.verification!,
        status: 'UNVERIFIED',
        priceVerified: false,
      },
    };

    const result = ExecutionPreparer.prepareProductOrder(
      unverifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ITEM_NOT_VERIFIED');
    assert.match(result.error!, /must be verified before transaction preparation/i);
  });

  // 10. Unavailable product cannot proceed
  await t.test('TEST 10: Unavailable product cannot proceed to preparation', async () => {
    const unavailableProduct: Recommendation = {
      ...mockVerifiedProduct,
      verification: {
        ...mockVerifiedProduct.verification!,
        availabilityStatus: 'UNAVAILABLE',
        availabilityVerified: true,
      },
    };

    const result = ExecutionPreparer.prepareProductOrder(
      unavailableProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'ITEM_UNAVAILABLE');
    assert.match(result.error!, /currently unavailable/i);
  });

  // 11. Stale verification triggers re-verification requirement
  await t.test('TEST 11: Stale verification triggers fresh verification requirement', async () => {
    const staleProduct: Recommendation = {
      ...mockVerifiedProduct,
      verification: {
        ...mockVerifiedProduct.verification!,
        freshness: 'STALE',
      },
    };

    const result = ExecutionPreparer.prepareProductOrder(
      staleProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, false);
    assert.equal(result.errorCode, 'FRESH_VERIFICATION_REQUIRED');
    assert.match(result.error!, /Fresh verification is required before preparation/i);
  });

  // 12. Price changes are preserved correctly
  await t.test('TEST 12: Price changes from verification are preserved correctly in preparation', async () => {
    const changedPriceProduct: Recommendation = {
      ...mockVerifiedProduct,
      item: {
        ...mockVerifiedProduct.item,
        price: 60000, // Search price
      },
      verification: {
        ...mockVerifiedProduct.verification!,
        verifiedPrice: 62500, // Real verified price
        priceDifference: 2500,
        priceStatus: 'CHANGED',
      },
    };

    const result = ExecutionPreparer.prepareProductOrder(
      changedPriceProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    assert.equal(result.preparation?.costBreakdown.basePrice, 62500);
    assert.equal(result.preparation?.costBreakdown.total, 62500);
    assert.equal(result.preparation?.item.searchPrice, 60000);
    assert.equal(result.preparation?.item.verifiedPrice, 62500);
  });

  // 13. Provider identity is preserved
  await t.test('TEST 13: Provider identity is strictly preserved in preparation', async () => {
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    assert.equal(result.preparation?.provider.id, 'mock_omnistore');
    assert.equal(result.preparation?.provider.name, 'DEVELOPMENT MOCK - OmniStore');
  });

  // 14. Booking URL is preserved
  await t.test('TEST 14: Booking URL and item URL are strictly preserved', async () => {
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    assert.equal(result.preparation?.provider.url, 'https://omnistore.internal.local/p/asus-rog-g16');
  });

  // 15. Confirmation state starts as AWAITING_CONFIRMATION
  await t.test('TEST 15: Confirmation state starts as AWAITING_CONFIRMATION', async () => {
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    const reg = confirmationGate.registerPreparation(result.preparation!);
    assert.equal(reg.status, 'AWAITING_CONFIRMATION');
    assert.equal(reg.isExecuted, false);
  });

  // 16. Preparation does not execute payment
  await t.test('TEST 16: Preparation does not execute financial payment', async () => {
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    const reg = confirmationGate.registerPreparation(result.preparation!);
    assert.equal(reg.isExecuted, false);
    assert.equal(reg.financialTransactionInitiated, false);
  });

  // 17. Preparation does not create a booking
  await t.test('TEST 17: Preparation does not create real booking or call booking APIs', async () => {
    const result = ExecutionPreparer.prepareBusBooking(
      mockVerifiedBus,
      validContact,
      [validPassenger]
    );

    assert.equal(result.success, true);
    assert.equal(result.preparation?.safetyInvariant?.noRealOrdersPlaced, true);
    assert.equal(result.preparation?.safetyInvariant?.noFinancialCredentialsStored, true);
  });

  // 18. Cancelled preparation cannot be confirmed
  await t.test('TEST 18: Cancelled preparation cannot be confirmed', async () => {
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    confirmationGate.registerPreparation(result.preparation!);

    const cancelRes = confirmationGate.cancelPreparation(
      result.preparation!.executionId,
      'User decided not to proceed'
    );
    assert.equal(cancelRes.success, true);
    assert.equal(cancelRes.state?.status, 'CANCELLED');

    // Attempt to confirm after cancellation
    const confirmRes = confirmationGate.confirmPreparation(result.preparation!.executionId);
    assert.equal(confirmRes.success, false);
    assert.match(confirmRes.error!, /Cannot confirm preparation in status "CANCELLED"/i);
  });

  // 19. Duplicate confirmation is prevented
  await t.test('TEST 19: Duplicate confirmation is prevented (double-execution guard)', async () => {
    const result = ExecutionPreparer.prepareProductOrder(
      mockVerifiedProduct,
      validContact,
      validDelivery
    );

    assert.equal(result.success, true);
    confirmationGate.registerPreparation(result.preparation!);

    // First confirmation
    const firstConfirm = confirmationGate.confirmPreparation(result.preparation!.executionId);
    assert.equal(firstConfirm.success, true);
    assert.equal(firstConfirm.state?.status, 'CONFIRMED');

    // Second confirmation attempt
    const secondConfirm = confirmationGate.confirmPreparation(result.preparation!.executionId);
    assert.equal(secondConfirm.success, false);
    assert.match(secondConfirm.error!, /Cannot confirm preparation in status "CONFIRMED"/i);
  });

  // 20. Existing Phase 2 tests continue to pass and orchestrator integration works
  await t.test('TEST 20: Orchestrator prepares execution when user selects an item from previous search', async () => {
    const conversationId = `e2e_select_${Date.now()}`;

    // Step A: Search for laptops
    const searchRes = await orchestrator.processMessage({
      conversationId,
      message: 'Find me a gaming laptop under 90000',
    });

    assert.ok(searchRes.agentState.phase === 'VERIFIED' || searchRes.agentState.phase === 'RESULTS_PRESENTED');
    assert.ok(searchRes.recommendations && searchRes.recommendations.length > 0);

    // Step B: User says "I want the second one"
    const selectRes = await orchestrator.processMessage({
      conversationId,
      message: 'I want the second one',
    });

    assert.equal(selectRes.agentState.intent, 'TRANSACTION_REQUEST');
    assert.equal(selectRes.agentState.phase, 'WAITING_FOR_CONFIRMATION');
    assert.equal(selectRes.confirmationRequired, true);
    assert.equal(selectRes.executionStatus, 'AWAITING_CONFIRMATION');
    assert.ok(selectRes.executionId);
    assert.ok(selectRes.executionPreparation);
    assert.equal(selectRes.executionPreparation.type, 'PRODUCT_ORDER');
    assert.ok(selectRes.safetyNotice);
    assert.match(selectRes.safetyNotice, /SAFETY GUARANTEE/i);

    // Step C: Confirm order
    const confirmRes = await orchestrator.processMessage({
      conversationId,
      message: 'Confirm',
    });

    assert.equal(confirmRes.agentState.intent, 'TRANSACTION_REQUEST');
    assert.equal(confirmRes.executionStatus, 'CONFIRMED');
    assert.match(confirmRes.message, /authorized for execution/i);
  });
});
