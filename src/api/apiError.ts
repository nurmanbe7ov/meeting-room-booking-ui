import type { Booking, BookingField } from '../domain/booking';

export type ApiErrorCode = 'VALIDATION_ERROR' | 'CONFLICT' | 'NOT_FOUND' | 'SERVER_ERROR';

export type ApiErrorBody = {
  code: ApiErrorCode;
  message: string;
  field?: BookingField;
  conflictWith?: Booking;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly field?: BookingField;
  readonly conflictWith?: Booking;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.field = body.field;
    this.conflictWith = body.conflictWith;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

export const getErrorMessage = (error: unknown, fallback: string): string =>
  isApiError(error) ? error.message : fallback;
