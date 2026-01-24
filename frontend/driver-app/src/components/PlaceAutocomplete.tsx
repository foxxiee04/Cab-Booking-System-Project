"use client";
import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';

interface PlaceAutocompleteProps {
  label: string;
  onSelect: (place: { name: string; lat: number; lng: number; address?: string }) => void;
  proximity?: { lat: number; lng: number };
}

export default function PlaceAutocomplete({ label, onSelect, proximity }: PlaceAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Array<{ place_id: string; name: string; lat: number; lng: number; address?: string }>>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (!query || query.length < 2) {
        setResults([]);
        setOpen(false);
        return;
      }
      try {
        setLoading(true);
        const { data } = await apiClient.geoAutocomplete(query, proximity?.lat, proximity?.lng, 5);
        const items = data?.data?.results ?? [];
        setResults(items);
        setOpen(items.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handler);
  }, [query, proximity?.lat, proximity?.lng]);

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        className="w-full border rounded px-3 py-2 focus:outline-none focus:ring focus:border-blue-500"
        placeholder="Nhập địa chỉ hoặc địa danh..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(results.length > 0)}
      />
      {open && (
        <div className="mt-1 max-h-48 overflow-auto border rounded bg-white shadow">
          {loading && <div className="px-3 py-2 text-sm text-gray-500">Đang tải...</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">Không có gợi ý</div>
          )}
          {!loading && results.map((r) => (
            <button
              key={r.place_id}
              className="w-full text-left px-3 py-2 hover:bg-gray-50"
              onClick={() => {
                onSelect({ name: r.name, lat: r.lat, lng: r.lng, address: r.address });
                setQuery(r.address || r.name);
                setOpen(false);
              }}
            >
              <div className="text-sm font-medium">{r.name}</div>
              <div className="text-xs text-gray-500">{r.address}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
