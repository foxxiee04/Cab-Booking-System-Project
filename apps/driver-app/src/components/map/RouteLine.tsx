import React, { useEffect, useState } from 'react';
import { Polyline } from 'react-leaflet';
import { Location, RouteData } from '../../types';
import { getRoute } from '../../utils/map.utils';

interface RouteLineProps {
  start: Location;
  end: Location;
  color?: string;
  weight?: number;
  opacity?: number;
}

const RouteLine: React.FC<RouteLineProps> = ({
  start,
  end,
  color = '#2196F3',
  weight = 4,
  opacity = 0.7,
}) => {
  const [route, setRoute] = useState<RouteData | null>(null);

  useEffect(() => {
    const fetchRoute = async () => {
      try {
        const routeData = await getRoute(start, end);
        setRoute(routeData);
      } catch (error) {
        console.error('Failed to fetch route:', error);
      }
    };

    if (start && end) {
      fetchRoute();
    }
  }, [start, end]);

  if (!route || !route.coordinates) {
    return null;
  }

  // Convert [lng, lat] to [lat, lng] for Leaflet
  const positions: [number, number][] = route.coordinates.map(
    ([lng, lat]) => [lat, lng]
  );

  return (
    <Polyline
      positions={positions}
      pathOptions={{ color, weight, opacity }}
    />
  );
};

export default RouteLine;
