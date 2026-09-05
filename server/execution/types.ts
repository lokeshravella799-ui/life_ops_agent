import type { VerificationMetadata } from '../types/provider';

export type ExecutionType =
  | 'PRODUCT_ORDER'
  | 'BUS_BOOKING'
  | 'HOTEL_BOOKING'
  | 'FLIGHT_BOOKING';

export type ExecutionStatus =
  | 'PREPARING'
  | 'READY_FOR_CONFIRMATION'
  | 'AWAITING_CONFIRMATION'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'FAILED'
  | 'NOT_EXECUTED';

export interface CostBreakdown {
  basePrice: number;
  taxes?: number;
  deliveryFee?: number;
  convenienceFee?: number;
  otherFees?: number;
  total: number;
  currency: string;
  isTaxEstimated?: boolean;
  isDeliveryEstimated?: boolean;
  feeDetails?: Record<string, number>;
}

export interface SelectedItem {
  id: string;
  title: string;
  category: string;
  price: {
    amount: number;
    currency: string;
  };
  searchPrice?: number;
  verifiedPrice?: number;
  provider: {
    id: string;
    name: string;
  };
  url?: string;
  availability?: string;
  specifications?: Record<string, string>;
  verification?: VerificationMetadata;
  deliveryEstimate?: string;
}

export interface ContactInformation {
  name?: string;
  email?: string;
  phone?: string;
}

export interface DeliveryInformation {
  fullName?: string;
  recipientName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  phone?: string;
  instructions?: string;
}

export interface PassengerInformation {
  name?: string;
  fullName?: string;
  age?: number;
  gender?: string;
  seatNumber?: string;
  contact?: ContactInformation;
}

export interface GuestInformation {
  primaryGuestName: string;
  numberOfGuests: number;
  numberOfRooms?: number;
  contact?: ContactInformation;
  specialRequests?: string;
}

export interface SafetyInvariant {
  noRealOrdersPlaced: boolean;
  noRealPaymentCharged: boolean;
  noFinancialCredentialsStored: boolean;
}

export interface CheckoutPreparation {
  executionId: string;
  type: 'PRODUCT_ORDER';
  status: ExecutionStatus;
  item: SelectedItem;
  costBreakdown: CostBreakdown;
  provider: {
    id: string;
    name: string;
    productUrl?: string;
    url?: string;
  };
  contact?: ContactInformation;
  delivery?: DeliveryInformation;
  verification: VerificationMetadata;
  confirmationRequired: true;
  confirmationGateMessage: string;
  safetyInvariant?: SafetyInvariant;
  createdAt: string;
  expiresAt: string;
}

export interface BookingPreparation {
  executionId: string;
  type: 'BUS_BOOKING' | 'HOTEL_BOOKING' | 'FLIGHT_BOOKING';
  status: ExecutionStatus;
  item: SelectedItem;
  costBreakdown: CostBreakdown;
  provider: {
    id: string;
    name: string;
    bookingUrl?: string;
    url?: string;
  };
  contact?: ContactInformation;
  passengers?: PassengerInformation[];
  guests?: GuestInformation;
  itinerary?: {
    source?: string;
    destination?: string;
    departureTime?: string;
    arrivalTime?: string;
    checkInDate?: string;
    checkOutDate?: string;
    roomType?: string;
  };
  bookingDetails?: {
    operator?: string;
    route?: string;
    seatType?: string;
    departureTime?: string;
    arrivalTime?: string;
  };
  stayDetails?: {
    hotelName?: string;
    roomType?: string;
    nights?: number;
    checkIn?: string;
    checkOut?: string;
  };
  flightDetails?: {
    airline?: string;
    flightNumber?: string;
    origin?: string;
    destination?: string;
    cabinClass?: string;
    departureTime?: string;
    arrivalTime?: string;
  };
  verification: VerificationMetadata;
  cancellationPolicy?: string;
  confirmationRequired: true;
  confirmationGateMessage: string;
  safetyInvariant?: SafetyInvariant;
  createdAt: string;
  expiresAt: string;
}

export type AnyPreparation = CheckoutPreparation | BookingPreparation;

export interface ConfirmationState {
  executionId: string;
  preparation: AnyPreparation;
  status: ExecutionStatus;
  createdAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  isExecuted: boolean; // Initial false, true when sandbox executed
  financialTransactionInitiated?: boolean;
  actionTaken?: 'AUTHORIZED_FOR_EXECUTION' | 'ABORTED' | 'EXPIRED' | 'EXECUTED_SANDBOX';
}

export interface ExecutionPreparationResult {
  success: boolean;
  preparation?: AnyPreparation;
  status: ExecutionStatus;
  errorCode?: string;
  error?: string;
  issues?: string[];
}

export interface ConfirmationResult {
  success: boolean;
  executionId: string;
  status: ExecutionStatus;
  message: string;
  isExecuted: boolean;
  state?: ConfirmationState;
  error?: string;
}

