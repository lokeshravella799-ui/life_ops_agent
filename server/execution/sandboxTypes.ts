import type {
  CostBreakdown,
  SelectedItem,
  DeliveryInformation,
  PassengerInformation,
  GuestInformation,
} from './types';

export type SandboxExecutionType =
  | 'PRODUCT_ORDER'
  | 'BUS_BOOKING'
  | 'HOTEL_BOOKING'
  | 'FLIGHT_BOOKING';

export type SandboxExecutionStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'DUPLICATE'
  | 'NOT_EXECUTED';

export interface SandboxOrder {
  sandbox: true;
  type: 'PRODUCT_ORDER';
  executionId: string;
  sandboxOrderId: string;
  status: SandboxExecutionStatus;
  item: {
    id?: string;
    title: string;
    price: {
      amount: number;
      currency: string;
    };
    specifications?: Record<string, string>;
  };
  provider: {
    id: string;
    name: string;
    url?: string;
  };
  delivery?: DeliveryInformation;
  costBreakdown: CostBreakdown;
  simulatedAt: string;
  message: string;
}

export interface SandboxBusBooking {
  sandbox: true;
  type: 'BUS_BOOKING';
  executionId: string;
  bookingId: string;
  status: SandboxExecutionStatus;
  operator: string;
  source?: string;
  destination?: string;
  departure?: string;
  arrival?: string;
  busType?: string;
  seatInformation?: string | string[];
  passengerInformation?: PassengerInformation[];
  costBreakdown: CostBreakdown;
  provider: {
    id: string;
    name: string;
    url?: string;
  };
  simulatedAt: string;
  message: string;
}

export interface SandboxHotelBooking {
  sandbox: true;
  type: 'HOTEL_BOOKING';
  executionId: string;
  bookingId: string;
  status: SandboxExecutionStatus;
  hotel: string;
  room?: string;
  checkIn?: string;
  checkOut?: string;
  guests?: GuestInformation;
  costBreakdown: CostBreakdown;
  cancellationInformation?: string;
  provider: {
    id: string;
    name: string;
    url?: string;
  };
  simulatedAt: string;
  message: string;
}

export interface SandboxFlightBooking {
  sandbox: true;
  type: 'FLIGHT_BOOKING';
  executionId: string;
  bookingId: string;
  status: SandboxExecutionStatus;
  airline: string;
  flightNumber?: string;
  origin?: string;
  destination?: string;
  departure?: string;
  arrival?: string;
  cabin?: string;
  passengerInformation?: PassengerInformation[];
  costBreakdown: CostBreakdown;
  provider: {
    id: string;
    name: string;
    url?: string;
  };
  simulatedAt: string;
  message: string;
}

export type SandboxBooking =
  | SandboxBusBooking
  | SandboxHotelBooking
  | SandboxFlightBooking;

export interface SandboxReceipt {
  receiptId: string;
  executionId: string;
  sandboxOrderId?: string;
  sandboxBookingId?: string;
  sandboxExecutionId: string;
  executionType: SandboxExecutionType;
  timestamp: string;
  provider: {
    id: string;
    name: string;
    url?: string;
  };
  selectedItem: {
    id: string;
    title: string;
    price: {
      amount: number;
      currency: string;
    };
  };
  costBreakdown: CostBreakdown;
  total: number;
  currency: string;
  executionStatus: SandboxExecutionStatus;
  sandbox: true;
  confirmationTimestamp: string;
  completionTimestamp: string;
  safetyStatement: string;
  message: string;
}

export type ExecutionAuditEventType =
  | 'PREPARATION_CREATED'
  | 'CONFIRMATION_REQUESTED'
  | 'CONFIRMED'
  | 'EXECUTION_STARTED'
  | 'EXECUTION_COMPLETED'
  | 'EXECUTION_FAILED'
  | 'EXECUTION_CANCELLED'
  | 'DUPLICATE_EXECUTION_BLOCKED';

export interface ExecutionAuditEvent {
  eventType: ExecutionAuditEventType;
  executionId: string;
  type: SandboxExecutionType;
  status: SandboxExecutionStatus;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface SandboxExecutionResult {
  success: boolean;
  status: SandboxExecutionStatus;
  executionId: string;
  sandboxExecutionId?: string;
  type?: SandboxExecutionType;
  order?: SandboxOrder;
  booking?: SandboxBooking;
  receipt?: SandboxReceipt;
  isDuplicate?: boolean;
  error?: string;
  message: string;
}
