"use client";
import { useState } from 'react';
import PlaceAutocomplete from '@/components/PlaceAutocomplete';
import { apiClient } from '@/lib/api-client';

export default function AddressPicker() {
  const [pickup, setPickup] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [dropoff, setDropoff] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const requestRide = async () => {
    if (!pickup || !dropoff) return;
    // Example: forward to a customer-side flow; for driver we only preview distances
    const { data: rev } = await apiClient.geoReverse(pickup.lat, pickup.lng);
    console.log('reverse pickup', rev);
  };

  return (
    <div className="space-y-4 p-4">
      <PlaceAutocomplete label="Điểm đón" onSelect={(p) => setPickup(p)} />
      <PlaceAutocomplete label="Điểm đến" onSelect={(p) => setDropoff(p)} proximity={pickup ? { lat: pickup.lat, lng: pickup.lng } : undefined} />
      <div className="flex gap-2">
        <button onClick={requestRide} disabled={!pickup || !dropoff} className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50">Xem thử</button>
      </div>
      {pickup && dropoff && (
        <div className="text-sm text-gray-600">
          <div>Đón: {pickup.name}</div>
          <div>Đến: {dropoff.name}</div>
        </div>
      )}
    </div>
  );
}
