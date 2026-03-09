// src/utils/geocoding.js

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";

/**
 * Reverse geocode coordinates to get address details
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<object>} Address details
 */
export async function reverseGeocode(lat, lng) {
  const url = `${NOMINATIM_BASE_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  
  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "YourAppName/1.0", // Replace with your app name
    },
  });

  if (!response.ok) {
    throw new Error("Failed to reverse geocode location");
  }

  const data = await response.json();
  
  if (!data || data.error) {
    throw new Error(data?.error || "Location not found");
  }

  const address = data.address || {};
  
  // Extract location details with multiple fallbacks
  const city = 
    address.city || 
    address.town || 
    address.village || 
    address.municipality ||
    address.county ||
    address.state_district ||
    null;

  const state = address.state || address.region || null;
  const country = address.country || null;
  const countryCode = address.country_code?.toUpperCase() || null;
  const suburb = address.suburb || address.neighbourhood || null;
  const road = address.road || address.street || null;
  const postcode = address.postcode || null;

  // Build display name
  let displayName = "";
  if (city) displayName = city;
  if (state && state !== city) displayName += displayName ? `, ${state}` : state;
  if (country) displayName += displayName ? `, ${country}` : country;

  return {
    city,
    state,
    country,
    countryCode,
    suburb,
    road,
    postcode,
    displayName: displayName || data.display_name || "Unknown location",
    fullAddress: data.display_name || "",
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lon),
    raw: data,
  };
}

/**
 * Get current position and reverse geocode it
 * @returns {Promise<object>} Location with coordinates and address
 */
export async function getCurrentLocationWithAddress() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      return reject(new Error("Geolocation not supported"));
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          const addressData = await reverseGeocode(lat, lng);
          
          resolve({
            lat,
            lng,
            accuracy: position.coords.accuracy,
            ...addressData,
          });
        } catch (error) {
          // Return coordinates even if geocoding fails
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            city: null,
            displayName: "Location found",
            error: error.message,
          });
        }
      },
      (error) => {
        let message;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Location permission denied";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Location unavailable";
            break;
          case error.TIMEOUT:
            message = "Location request timed out";
            break;
          default:
            message = error.message || "Could not get location";
        }
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 30000,
      }
    );
  });
}

/**
 * Search for a location by name (forward geocoding)
 * @param {string} query - Search query
 * @param {number} limit - Max results
 * @returns {Promise<array>} List of matching locations
 */
export async function searchLocation(query, limit = 5) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const url = `${NOMINATIM_BASE_URL}/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=${limit}&addressdetails=1`;

  const response = await fetch(url, {
    headers: {
      "Accept-Language": "en",
      "User-Agent": "YourAppName/1.0",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to search location");
  }

  const data = await response.json();

  return data.map((item) => {
    const address = item.address || {};
    const city =
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      null;

    return {
      placeId: item.place_id,
      displayName: item.display_name,
      city,
      state: address.state,
      country: address.country,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type,
      importance: item.importance,
    };
  });
}