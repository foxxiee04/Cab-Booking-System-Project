import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';
import { Location } from '../../types';
import { getRoute } from '../../utils/map.utils';

interface RouteLineProps {
  from: Location;
  to: Location;
  color?: string;
}

export const RouteLine: React.FC<RouteLineProps> = ({
  from,
  to,
  color = '#2196F3',
}) => {
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);

  useEffect(() => {
    const fetchRoute = async () => {
      const route = await getRoute(from, to);
      if (route && route.geometry) {
        // Convert [lng, lat] to [lat, lng]
        const coords = route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]] as [number, number]
        );
        setRouteCoordinates(coords);
      }
    };

    if (from && to) {
      fetchRoute();
    }
  }, [from, to]);

  if (routeCoordinates.length === 0) {
    return null;
  }

  return (
    <Polyline
      positions={routeCoordinates}
      pathOptions={{
        color,
        weight: 5,
        opacity: 0.7,
        lineCap: 'round',
        lineJoin: 'round',
      }}
    />
  );
};

export default RouteLine;
