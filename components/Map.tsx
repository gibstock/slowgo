'use client';

import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import { type Map, Icon, LatLngExpression } from 'leaflet';
import React from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import ChangeView from './ChangeView';

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
  iconUrl: 'https://cdn-icons-png.flaticon.com/512/484/484168.png',
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

export default function SlowGoMap() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [userPosition, setUserPosition] = useState<LatLngExpression | null>(
    null
  );

  const [activeAlert, setActiveAlert] = useState<Camera | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [autoCenter, setAutoCenter] = useState(true);
  const [map, setMap] = useState<Map | null>(null);
  const [copied, setCopied] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockSentinelRef = useRef<WakeLockSentinel | null>(null);

  const { canInstall, handleInstall } = useInstallPrompt();

  console.log('can: ', canInstall);

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
      const alertThreshold = 0.204; // 669.3 feet

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
  }, [userPosition, cameras, activeAlert, userHeading]);

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
        } catch (err: unknown) {
          if (err instanceof Error) {
            console.error(`${err.name}, ${err.message}`);
          } else {
            console.error('An unknown error occurred:', err);
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    // The ref will be populated once the map is ready
    if (map) {
      map.on('movestart', () => {
        setAutoCenter(false);
      });
    }
  }, [map]);

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
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error(`${err.name}, ${err.message}`);
      } else {
        console.error('An unknown error occured: ', err);
      }
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

  const handleRecenter = () => {
    if (map && userPosition) {
      map.flyTo(userPosition, 15);
      setAutoCenter(true);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: 'slowgo.app',
      text: 'Check out slowgo.app! It gives you a heads-up for speed cameras in SF.',
      url: 'https://slowgo.app', // Or use window.location.href
    };

    // Check if the Web Share API is supported
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        console.log('App shared successfully');
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareData.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  return (
    <div className="relative h-screen w-screen">
      {activeAlert && (
        <AlertBanner
          camera={activeAlert}
          onDismiss={() => setActiveAlert(null)}
        />
      )}
      {!isTracking && (
        <div className="fixed inset-0 z-[2000] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center flex flex-col items-center">
            <h1 className="text-5xl font-bold text-gray-800">SlowGo.app</h1>
            <p className="text-lg text-gray-600 mt-2">
              Drive smarter in San Francisco.
            </p>

            <div className="text-left my-6 space-y-4">
              <p className="flex items-start text-gray-800">
                <span className="text-2xl mr-3">📍</span>
                <span>
                  This app alerts you to fixed speed cameras. For it to work,
                  you must{' '}
                  <span className="font-bold">allow location permissions</span>{' '}
                  when prompted.
                </span>
              </p>
              <p className="flex items-start text-gray-800">
                <span className="text-2xl mr-3">📱</span>
                <span>
                  For the best experience,{' '}
                  <span className="font-bold">
                    install this app to your home screen
                  </span>{' '}
                  using your browser&apos;s &quot;Add to Home Screen&quot; or
                  &quot;Install App&quot; option.
                </span>
              </p>
            </div>
            {canInstall && (
              <button
                onClick={handleInstall}
                className="bg-green-600 hover:bg-green-700 text-white font-bold text-xl py-3 px-6 rounded-lg shadow-lg w-full mb-4"
              >
                Install App to Home Screen
              </button>
            )}
            <button
              onClick={handleStartTracking}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-2xl py-4 px-8 rounded-lg shadow-lg w-full"
            >
              Start Tracking
            </button>

            <div className="mt-6 text-sm text-gray-500">
              <p>
                Questions or issues?{' '}
                <a
                  href="mailto:slowgodev@gmail.com"
                  className="underline text-blue-600"
                >
                  Email me
                </a>
                .
              </p>
              <p className="mt-2">
                Love the app?{' '}
                <a
                  href="https://buymeacoffee.com/slowgodev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-blue-600"
                >
                  Support the project!
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
      {isTracking && (
        <div className="fixed top-20 right-6 z-[1000]">
          <button
            onClick={handleStopTracking}
            className="bg-white hover:bg-red-700 text-gray-800 font-semibold p-3 rounded-full shadow-lg"
          >
            Stop Tracking
          </button>
        </div>
      )}
      {isTracking && !autoCenter && (
        <div className="fixed bottom-24 right-6 z-[1000]">
          <button
            onClick={handleRecenter}
            className="bg-white hover:bg-gray-100 text-gray-800 p-3 rounded-full shadow-lg"
          >
            {/* Using an inline SVG for the recenter icon */}
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
            </svg>
          </button>
        </div>
      )}
      <MapContainer
        ref={setMap}
        center={[37.7749, -122.4194]} // Initial center
        zoom={13}
        zoomControl={false}
        style={{ height: '100vh', width: '100%' }}
      >
        {userPosition && (
          <ChangeView autoCenter={autoCenter} center={userPosition} zoom={15} />
        )}

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

              {/* Add a Circle to show the alert radius */}
              <Circle
                center={[camera.latitude, camera.longitude]}
                radius={204} // Radius in meters for the 669 ft threshold
                pathOptions={{
                  color: isAlerting ? 'red' : 'blue', // Change color on alert
                  fillColor: isAlerting ? 'red' : 'blue',
                  fillOpacity: 0.2,
                  stroke: false,
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
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-md">
        <div className="bg-white rounded-full shadow-lg p-3 flex items-center">
          <span className="text-gray-400 mr-2">📍</span>
          <span className="font-semibold text-gray-800">San Francisco</span>
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-[1000]">
        <div className="bg-white shadow-[0_-2px_5px_rgba(0,0,0,0.1)] p-2 flex justify-around">
          <a
            href="https://buymeacoffee.com/slowgodev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600"
          >
            Donate
          </a>
          <a href="mailto:slowgodev@gmail.com" className="text-blue-600">
            Email
          </a>
          <button
            onClick={handleShare}
            className="text-blue-600 font-semibold"
            disabled={copied}
          >
            {copied ? 'Link Copied!' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  );
}
