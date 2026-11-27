export interface User {
  id: number;
  name: string;
  email: string;
}

export interface Room {
  id: number;
  name: string;
  capacity: number;
  equipment: string[];
}

export interface Booking {
  id: number;
  roomId: number;
  roomName: string;
  title: string;
  organiser: { id: number; name: string };
  /** ISO-8601 timestamps (UTC). */
  startTime: string;
  endTime: string;
}

export interface RoomWithBookings extends Room {
  bookings: Booking[];
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'INVALID_CREDENTIALS'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BOOKING_CONFLICT'
  | 'INTERNAL';

export interface FieldError {
  field: string;
  message: string;
}

/** Every error response from the API has this shape. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[];
  };
}
