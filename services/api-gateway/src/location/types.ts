export interface ResolveLocationInput {
  lat: number;
  lng: number;
  snapToRoad?: boolean;
}

export interface OsmReverseAddress {
  road?: string;
  house_number?: string;
  suburb?: string;
  quarter?: string;
  neighbourhood?: string;
  village?: string;
  city?: string;
  state?: string;
  county?: string;
  town?: string;
  municipality?: string;
  city_district?: string;
}

export interface OSMReverseResponse {
  place_id?: string | number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: OsmReverseAddress;
}

export interface ResolvedLocation {
  lat: number;
  lng: number;
  street: string;
  ward: string;
  province: string;
  ward_id: number | null;
  province_id: number | null;
  display_address: string;
  osm_place_id: string;
  source: 'OSM';
}

export interface ProvinceRecord {
  id: number;
  name: string;
  normalizedKey: string;
}

export interface WardRecord {
  id: number;
  provinceId: number;
  name: string;
  normalizedKey: string;
}
