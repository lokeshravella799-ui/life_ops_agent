import { useState, useEffect, useCallback } from 'react';

export interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  displayName: string;
  timestamp: number;
}

export type LocationPermissionStatus = 'prompt' | 'granted' | 'denied' | 'unsupported' | 'dismissed';

const STORAGE_KEY_LOCATION = 'lifeops_user_location';
const STORAGE_KEY_PERMISSION = 'lifeops_location_permission';

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_LOCATION);
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });

  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PERMISSION);
      if (saved) return saved as LocationPermissionStatus;
    } catch {}
    return 'prompt';
  });

  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState<boolean>(false);

  // Check if browser supports geolocation & check permission query if available
  useEffect(() => {
    if (!navigator.geolocation) {
      setPermissionStatus('unsupported');
      return;
    }

    // If permission has never been decided, prompt on first load
    const savedPerm = localStorage.getItem(STORAGE_KEY_PERMISSION);
    if (!savedPerm) {
      // Show the explicit modal on first visit/login
      setShowPermissionModal(true);
    } else if (savedPerm === 'granted' && !location) {
      // Re-fetch current position silently if already granted
      fetchBrowserLocation(false);
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: 'geolocation' as PermissionName })
        .then((result) => {
          if (result.state === 'denied') {
            setPermissionStatus('denied');
            localStorage.setItem(STORAGE_KEY_PERMISSION, 'denied');
          } else if (result.state === 'granted') {
            setPermissionStatus('granted');
            localStorage.setItem(STORAGE_KEY_PERMISSION, 'granted');
          }
        })
        .catch(() => {});
    }
  }, []);

  const reverseGeocode = async (lat: number, lon: number): Promise<{ city: string; state?: string; displayName: string }> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`,
        {
          signal: controller.signal,
          headers: { 'Accept-Language': 'en' },
        }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const address = data.address || {};
        const city = address.city || address.town || address.village || address.county || address.state_district || 'Hyderabad';
        const state = address.state || 'Telangana';
        const displayName = `${city}, ${state}`;
        return { city, state, displayName };
      }
    } catch (err) {
      console.warn('Reverse geocoding error or timeout, using default readable location:', err);
    }
    // Fallback default city/state
    return { city: 'Hyderabad', state: 'Telangana', displayName: 'Hyderabad, Telangana' };
  };

  const fetchBrowserLocation = useCallback((showError = true): Promise<UserLocation | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setPermissionStatus('unsupported');
        if (showError) setLocationError('Geolocation is not supported by your browser.');
        resolve(null);
        return;
      }

      setIsLocating(true);
      setLocationError(null);

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      };

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const { city, state, displayName } = await reverseGeocode(lat, lon);

          const locData: UserLocation = {
            latitude: lat,
            longitude: lon,
            city,
            state,
            displayName,
            timestamp: Date.now(),
          };

          setLocation(locData);
          setPermissionStatus('granted');
          localStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(locData));
          localStorage.setItem(STORAGE_KEY_PERMISSION, 'granted');
          setIsLocating(false);
          setShowPermissionModal(false);
          resolve(locData);
        },
        (error) => {
          setIsLocating(false);
          let errString = 'Unable to retrieve location.';
          if (error.code === error.PERMISSION_DENIED) {
            setPermissionStatus('denied');
            localStorage.setItem(STORAGE_KEY_PERMISSION, 'denied');
            errString = 'Location permission was denied. You can enable it in settings.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errString = 'Location information is currently unavailable.';
          } else if (error.code === error.TIMEOUT) {
            errString = 'Request to get user location timed out.';
          }
          if (showError) setLocationError(errString);
          setShowPermissionModal(false);
          resolve(null);
        },
        options
      );
    });
  }, []);

  const handleAllowLocation = useCallback(() => {
    fetchBrowserLocation(true);
  }, [fetchBrowserLocation]);

  const handleDismissLocation = useCallback(() => {
    setShowPermissionModal(false);
    setPermissionStatus('dismissed');
    localStorage.setItem(STORAGE_KEY_PERMISSION, 'dismissed');
  }, []);

  const resetPermission = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_PERMISSION);
    localStorage.removeItem(STORAGE_KEY_LOCATION);
    setLocation(null);
    setPermissionStatus('prompt');
    setShowPermissionModal(true);
  }, []);

  return {
    location,
    permissionStatus,
    isLocating,
    locationError,
    showPermissionModal,
    setShowPermissionModal,
    handleAllowLocation,
    handleDismissLocation,
    fetchBrowserLocation,
    resetPermission,
  };
}
