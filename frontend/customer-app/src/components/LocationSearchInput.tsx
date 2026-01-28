'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Search, X, Loader2 } from 'lucide-react';
import { searchLocations, getPopularPlaces, type LocationSuggestion } from '@/lib/geocoding';

interface LocationSearchInputProps {
  type: 'pickup' | 'dropoff';
  value: string;
  onChange: (value: string) => void;
  onLocationSelect: (location: LocationSuggestion) => void;
  placeholder?: string;
  selectedLocation?: LocationSuggestion | null;
}

export default function LocationSearchInput({
  type,
  value,
  onChange,
  onLocationSelect,
  placeholder,
  selectedLocation,
}: LocationSearchInputProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [popularPlaces] = useState(getPopularPlaces());
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  const icon = type === 'pickup' ? MapPin : Navigation;
  const Icon = icon;
  const iconColor = type === 'pickup' ? 'text-green-500' : 'text-red-500';

  useEffect(() => {
    // Handle click outside to close suggestions
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // If input is empty, show popular places
    if (!value.trim()) {
      setSuggestions(popularPlaces);
      setIsSearching(false);
      return;
    }

    // If input is too short, don't search
    if (value.trim().length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      return;
    }

    // Debounce search
    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchLocations(value, 8);
        setSuggestions(results);
      } catch (error) {
        console.error('Search error:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [value, popularPlaces]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: LocationSuggestion) => {
    onLocationSelect(suggestion);
    onChange(suggestion.address);
    setShowSuggestions(false);
  };

  const handleClear = () => {
    onChange('');
    onLocationSelect({} as LocationSuggestion);
    inputRef.current?.focus();
    setShowSuggestions(true);
  };

  const handleFocus = () => {
    setShowSuggestions(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder || `Nhập ${type === 'pickup' ? 'điểm đón' : 'điểm đến'}...`}
          className="w-full pl-11 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all text-sm"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isSearching && (
            <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
          )}
          {value && !isSearching && (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              type="button"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-lg border border-gray-200 max-h-80 overflow-y-auto">
          {!value.trim() && (
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b">
              Địa điểm phổ biến
            </div>
          )}
          
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id || index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0 flex items-start gap-3"
              type="button"
            >
              <div className={`mt-0.5 ${iconColor}`}>
                <MapPin className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">
                  {suggestion.name}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {suggestion.address}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Location Display */}
      {selectedLocation?.address && !showSuggestions && (
        <div className="mt-2 px-3 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 flex items-start gap-2">
          <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${iconColor}`} />
          <span className="flex-1">{selectedLocation.address}</span>
        </div>
      )}
    </div>
  );
}
