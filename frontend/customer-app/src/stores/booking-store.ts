import { create } from 'zustand';

interface Booking {
  id?: string;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
  destinationLat?: number;
  destinationLng?: number;
  destinationAddress?: string;
  rideType?: string;
  price?: number;
}

interface BookingStore {
  booking: Booking;
  setPickup: (lat: number, lng: number, address: string) => void;
  setDestination: (lat: number, lng: number, address: string) => void;
  setRideType: (type: string) => void;
  setPrice: (price: number) => void;
  reset: () => void;
}

export const useBookingStore = create<BookingStore>((set) => ({
  booking: {},
  setPickup: (lat, lng, address) =>
    set((state) => ({
      booking: { ...state.booking, pickupLat: lat, pickupLng: lng, pickupAddress: address },
    })),
  setDestination: (lat, lng, address) =>
    set((state) => ({
      booking: { ...state.booking, destinationLat: lat, destinationLng: lng, destinationAddress: address },
    })),
  setRideType: (type) =>
    set((state) => ({
      booking: { ...state.booking, rideType: type },
    })),
  setPrice: (price) =>
    set((state) => ({
      booking: { ...state.booking, price },
    })),
  reset: () => set({ booking: {} }),
}));
