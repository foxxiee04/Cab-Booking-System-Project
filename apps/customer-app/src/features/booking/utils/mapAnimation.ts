export function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

export function interpolatePosition(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
  progress: number,
): google.maps.LatLngLiteral {
  return {
    lat: from.lat + (to.lat - from.lat) * progress,
    lng: from.lng + (to.lng - from.lng) * progress,
  };
}

export function calculateHeading(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

export function interpolateHeading(from: number, to: number, progress: number): number {
  const delta = ((((to - from) % 360) + 540) % 360) - 180;
  return (from + delta * progress + 360) % 360;
}

export function estimateAnimationDurationMs(
  from: google.maps.LatLngLiteral,
  to: google.maps.LatLngLiteral,
): number {
  const latDelta = to.lat - from.lat;
  const lngDelta = to.lng - from.lng;
  const approxMeters = Math.sqrt(latDelta * latDelta + lngDelta * lngDelta) * 111_320;

  return Math.min(1400, Math.max(450, approxMeters * 20));
}