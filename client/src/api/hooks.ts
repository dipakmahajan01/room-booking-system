import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Booking, CreateBookingInput, RoomWithBookings } from '@rbs/shared';
import { apiFetch } from './client';

export const queryKeys = {
  rooms: (date: string) => ['rooms', date] as const,
  myBookings: ['myBookings'] as const,
};

export function useRooms(date: string) {
  return useQuery({
    queryKey: queryKeys.rooms(date),
    queryFn: () => apiFetch<RoomWithBookings[]>(`/rooms?date=${date}`),
  });
}

export function useMyBookings() {
  return useQuery({
    queryKey: queryKeys.myBookings,
    queryFn: () => apiFetch<Booking[]>('/bookings/mine'),
  });
}

/** After creating or cancelling, refetch everything that shows bookings. */
function useInvalidateBookings() {
  const qc = useQueryClient();
  return () => Promise.all([
    qc.invalidateQueries({ queryKey: ['rooms'] }),
    qc.invalidateQueries({ queryKey: queryKeys.myBookings }),
  ]);
}

export function useCreateBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (input: CreateBookingInput) => apiFetch<Booking>('/bookings', { method: 'POST', body: input }),
    onSuccess: invalidate,
  });
}

export function useCancelBooking() {
  const invalidate = useInvalidateBookings();
  return useMutation({
    mutationFn: (id: number) => apiFetch<void>(`/bookings/${id}`, { method: 'DELETE' }),
    onSuccess: invalidate,
  });
}
