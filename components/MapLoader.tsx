'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

export default function MapLoader() {
  const Map = useMemo(
    () =>
      dynamic(() => import('@/components/Map'), {
        loading: () => <p>SF map is loading...</p>,
        ssr: false,
      }),
    []
  );

  return <Map />;
}
