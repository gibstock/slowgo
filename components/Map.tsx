'use client';

import { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
  Circle,
} from 'react-leaflet';
import { Icon, LatLngExpression } from 'leaflet';
import React from 'react';

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

// Calculates the bearing from point 1 to point 2 in degrees
function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const y =
    Math.sin((lon2 - lon1) * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.cos((lon2 - lon1) * (Math.PI / 180));
  const brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360; // Normalize to 0-360
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

const alertCameraIcon = new Icon({
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/10451/10451638.png',
  iconSize: [45, 45], // Make it slightly larger
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
  const [userHeading, setUserHeading] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockSentinelRef = useRef<any | null>(null);

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
        const { latitude, longitude, heading } = position.coords;
        setUserPosition([latitude, longitude]);
        setUserHeading(heading);
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
        if (userHeading !== null) {
          const cameraBearing = calculateBearing(
            userLat,
            userLng,
            camera.latitude,
            camera.longitude
          );
          const angleDiff = Math.abs(
            ((userHeading - cameraBearing + 180) % 360) - 180
          );
          const angleTolerance = 45; // Allow a 45-degree variance

          // Only alert if the user's heading is towards the camera
          if (angleDiff <= angleTolerance) {
            setActiveAlert(camera);
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play();
            }
            if (navigator.vibrate) {
              navigator.vibrate([200, 100, 200]); // Vibrate 200ms, pause 100ms, vibrate 200ms
            }
            break;
          }
        } else {
          // Fallback for devices that don't provide a heading: alert based on distance alone
          setActiveAlert(camera);
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          }
          break;
        }
      }
    }
  }, [userPosition, cameras, activeAlert]);

  // useEffect to handle re-acquiring the wake lock when the tab becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        wakeLockSentinelRef.current !== null &&
        document.visibilityState === 'visible'
      ) {
        try {
          wakeLockSentinelRef.current = await navigator.wakeLock.request(
            'screen'
          );
          console.log('Screen Wake Lock re-acquired.');
        } catch (err: any) {
          console.error(`${err.name}, ${err.message}`);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const handleStartTracking = async () => {
    setIsTracking(true);
    if (audioRef.current) {
      audioRef.current.play().catch(() => {}); // Play and ignore errors
      audioRef.current.pause(); // Immediately pause it so it's ready for later
      audioRef.current.currentTime = 0;
    }
    try {
      if ('wakeLock' in navigator) {
        wakeLockSentinelRef.current = await navigator.wakeLock.request(
          'screen'
        );
        console.log('Screen Wake Lock is active.');
      }
    } catch (err: any) {
      console.error(`${err.name}, ${err.message}`);
    }
  };

  const handleStopTracking = () => {
    setIsTracking(false);

    if (wakeLockSentinelRef.current) {
      wakeLockSentinelRef.current.release();
      wakeLockSentinelRef.current = null;
      console.log('Screen Wake Lock has been released.');
    }
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
        {userPosition && <ChangeView center={userPosition} zoom={15} />}

        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {/* Marker for each speed camera */}
        {cameras.map((camera) => {
          const isAlerting = activeAlert?.id === camera.id;
          return (
            <React.Fragment key={camera.id}>
              <Marker
                position={[camera.latitude, camera.longitude]}
                // Use the new alert icon if this camera is the one causing the alert
                icon={isAlerting ? alertCameraIcon : cameraIcon}
              >
                <Popup>
                  <b>{camera.name}</b>
                  <br />
                  Speed Limit: {camera.speed_limit} mph
                </Popup>
              </Marker>

              {/* NEW: Add a Circle to show the alert radius */}
              <Circle
                center={[camera.latitude, camera.longitude]}
                radius={500} // Radius in meters for the 0.5km threshold
                pathOptions={{
                  color: isAlerting ? 'red' : 'blue', // Change color on alert
                  fillColor: isAlerting ? 'red' : 'blue',
                  fillOpacity: 0.1,
                }}
              />
            </React.Fragment>
          );
        })}

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
