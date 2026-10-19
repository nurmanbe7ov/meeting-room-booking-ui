import type { Booking, BookingInput } from '../domain/booking';
import { bookingsServer, type ServerResponse } from '../mocks/bookingsServer';
import { ApiError } from './apiError';

const unwrap = <T>(response: ServerResponse<T>): T => {
  if (!response.ok) throw new ApiError(response.status, response.error);
  return response.data;
};

export const getBookings = async (date: string): Promise<Booking[]> =>
  unwrap(await bookingsServer.list(date));

export const createBooking = async (input: BookingInput): Promise<Booking> =>
  unwrap(await bookingsServer.create(input));

export const updateBooking = async (id: string, patch: Partial<BookingInput>): Promise<Booking> =>
  unwrap(await bookingsServer.update(id, patch));

export const deleteBooking = async (id: string): Promise<void> => {
  unwrap(await bookingsServer.remove(id));
};
