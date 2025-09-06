import { LatLngExpression } from 'leaflet';
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

function ChangeView({
  center,
  zoom,
  autoCenter,
}: {
  center: LatLngExpression;
  zoom: number;
  autoCenter: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (autoCenter) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map, autoCenter]);

  return null;
}

export default ChangeView;
