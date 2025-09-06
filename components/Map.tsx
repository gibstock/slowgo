'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';

// Helper function to calculate distance between two lat/lng points in kilometers
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

function AlertBanner({
  camera,
  onDismiss,
}: {
  camera: Camera;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-500 text-white rounded-lg shadow-lg p-4 w-11/12 max-w-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold">Approaching Speed Camera!</p>
          <p>
            {camera.name} - Speed Limit: {camera.speed_limit} mph
          </p>
        </div>
        <button
          onClick={onDismiss}
          className="ml-4 bg-red-700 hover:bg-red-800 text-white font-bold py-1 px-3 rounded"
        >
          X
        </button>
      </div>
    </div>
  );
}
// Define the structure of the camera data
interface Camera {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  speed_limit: number;
}

// Icon for the speed cameras
const cameraIcon = new Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/484/484167.png',
  iconSize: [38, 38],
});

// Icon for the user's location
const userIcon = new Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// A component to automatically pan the map to the user's location
function ChangeView({
  center,
  zoom,
}: {
  center: LatLngExpression;
  zoom: number;
}) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}

export default function Map() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [userPosition, setUserPosition] = useState<LatLngExpression | null>(
    null
  );

  const [activeAlert, setActiveAlert] = useState<Camera | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize the Audio object on the client side
  useEffect(() => {
    audioRef.current = new Audio('/sounds/alert.mp3');
  }, []);

  // Fetch camera data
  useEffect(() => {
    fetch('/cameras.json')
      .then((res) => res.json())
      .then((data) => setCameras(data));
  }, []);

  useEffect(() => {
    if (!isTracking) return; // Only run if tracking is enabled

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserPosition([latitude, longitude]);
      },
      (error) => console.error('Error getting user location:', error),
      { enableHighAccuracy: true }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking]);

  useEffect(() => {
    if (!userPosition || cameras.length === 0) return;

    // If an alert is already being shown, don't check for new ones
    if (activeAlert) return;

    const userLat = Array.isArray(userPosition)
      ? userPosition[0]
      : userPosition.lat;
    const userLng = Array.isArray(userPosition)
      ? userPosition[1]
      : userPosition.lng;

    for (const camera of cameras) {
      const distance = haversineDistance(
        userLat,
        userLng,
        camera.latitude,
        camera.longitude
      );
      const alertThreshold = 0.3048; // 1000 feet

      if (distance < alertThreshold) {
        // --- TRIGGER THE BANNER ---
        setActiveAlert(camera);

        // Play sound using the persistent audio object
        if (audioRef.current) {
          audioRef.current.currentTime = 0; // Rewind to the start
          audioRef.current.play();
        }

        break;
      }
    }
  }, [userPosition, cameras, activeAlert]); // Dependency array updated

  const handleStartTracking = () => {
    setIsTracking(true);
    if (audioRef.current) {
      audioRef.current.play().catch(() => {}); // Play and ignore errors
      audioRef.current.pause(); // Immediately pause it so it's ready for later
      audioRef.current.currentTime = 0;
    }
  };

  const handleStopTracking = () => {
    setIsTracking(false);
  };

  return (
    <>
      {activeAlert && (
        <AlertBanner
          camera={activeAlert}
          onDismiss={() => setActiveAlert(null)}
        />
      )}
      {!isTracking && (
        <div className="fixed inset-0 z-[2000] bg-black bg-opacity-50 flex items-center justify-center">
          <button
            onClick={handleStartTracking}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-2xl py-4 px-8 rounded-lg shadow-lg"
          >
            Start Tracking
          </button>
        </div>
      )}
      {isTracking && (
        <div className="fixed bottom-6 right-6 z-[1000]">
          <button
            onClick={handleStopTracking}
            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xl py-4 px-6 rounded-full shadow-lg"
          >
            Stop
          </button>
        </div>
      )}
      <MapContainer
        center={[37.7749, -122.4194]} // Initial center
        zoom={13}
        style={{ height: '100vh', width: '100%' }}
      >
        {/* If we have the user's position, center the map on them */}
        {userPosition && <ChangeView center={userPosition} zoom={15} />}

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Marker for each speed camera */}
        {cameras.map((camera) => (
          <Marker
            key={camera.id}
            position={[camera.latitude, camera.longitude]}
            icon={cameraIcon}
          >
            <Popup>
              <b>{camera.name}</b>
              <br />
              Speed Limit: {camera.speed_limit} mph
            </Popup>
          </Marker>
        ))}

        {/* Marker for the user's location, only shows if position is known */}
        {userPosition && (
          <Marker position={userPosition} icon={userIcon}>
            <Popup>You are here</Popup>
          </Marker>
        )}
      </MapContainer>
    </>
  );
}
