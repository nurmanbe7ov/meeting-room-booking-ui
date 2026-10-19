import { useRef, useState } from 'react';
import { getErrorMessage, isApiError } from '../api/apiError';
import { deleteBooking } from '../api/bookings';
import type { Booking } from '../domain/booking';

type Options = {
  refresh: () => Promise<void>;
  onDeleted: (message: string, booking: Booking) => void;
};

const DELETE_ERROR_MESSAGE = 'Не удалось удалить бронь. Попробуйте ещё раз';

export const useDeleteBooking = ({ refresh, onDeleted }: Options) => {
  const [target, setTarget] = useState<Booking | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDeletingRef = useRef(false);

  const request = (booking: Booking) => {
    setTarget(booking);
    setError(null);
  };

  const cancel = () => {
    if (!isDeletingRef.current) setTarget(null);
  };

  const confirm = async () => {
    if (!target || isDeletingRef.current) return;
    isDeletingRef.current = true;
    setIsDeleting(true);
    setError(null);

    try {
      await deleteBooking(target.id);
      onDeleted('Бронь удалена', target);
      setTarget(null);
      void refresh();
    } catch (deleteError) {
      if (isApiError(deleteError) && deleteError.status === 404) {
        onDeleted('Бронь уже была удалена', target);
        setTarget(null);
        void refresh();
      } else {
        setError(getErrorMessage(deleteError, DELETE_ERROR_MESSAGE));
      }
    } finally {
      isDeletingRef.current = false;
      setIsDeleting(false);
    }
  };

  return { target, isDeleting, error, request, cancel, confirm };
};
