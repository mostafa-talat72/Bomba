// Error codes for consistent error handling across the application
// Backend should return these codes instead of hardcoded messages

export const AUTH_ERROR_CODES = {
  // Authentication errors
  NOT_VERIFIED: 'NOT_VERIFIED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  EMAIL_SEND_FAILED: 'EMAIL_SEND_FAILED',
  ALREADY_VERIFIED: 'ALREADY_VERIFIED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
} as const;

export const DEVICE_ERROR_CODES = {
  // Device errors
  DEVICE_IN_USE: 'DEVICE_IN_USE',
  DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
  DEVICE_UNAVAILABLE: 'DEVICE_UNAVAILABLE',
} as const;

export const INVENTORY_ERROR_CODES = {
  // Inventory errors
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  ITEM_EXISTS: 'ITEM_EXISTS',
  INVALID_QUANTITY: 'INVALID_QUANTITY',
} as const;

export const BILL_ERROR_CODES = {
  // Bill errors
  BILL_NOT_FOUND: 'BILL_NOT_FOUND',
  BILL_ALREADY_PAID: 'BILL_ALREADY_PAID',
  INVALID_PAYMENT: 'INVALID_PAYMENT',
  PAYMENT_EXCEEDS_TOTAL: 'PAYMENT_EXCEEDS_TOTAL',
} as const;

export const SESSION_ERROR_CODES = {
  // Session errors
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_INACTIVE: 'SESSION_INACTIVE',
  INVALID_CONTROLLER_COUNT: 'INVALID_CONTROLLER_COUNT',
  CANNOT_MODIFY_INACTIVE_SESSION: 'CANNOT_MODIFY_INACTIVE_SESSION',
} as const;

export const ORDER_ERROR_CODES = {
  // Order errors
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATUS: 'INVALID_ORDER_STATUS',
  ORDER_ALREADY_DELIVERED: 'ORDER_ALREADY_DELIVERED',
} as const;

// All error codes combined
export const ERROR_CODES = {
  ...AUTH_ERROR_CODES,
  ...DEVICE_ERROR_CODES,
  ...INVENTORY_ERROR_CODES,
  ...BILL_ERROR_CODES,
  ...SESSION_ERROR_CODES,
  ...ORDER_ERROR_CODES,
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Helper function to check if a string is a valid error code
export const isValidErrorCode = (code: string): code is ErrorCode => {
  return Object.values(ERROR_CODES).includes(code as ErrorCode);
};

// Helper function to get error message key for translation
export const getErrorMessageKey = (code: ErrorCode): string => {
  return `errors.${code}`;
};
