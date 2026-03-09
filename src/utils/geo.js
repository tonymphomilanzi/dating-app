// src/utils/geo.js

/**
 * Calculate distance between two points using Haversine formula
 * @returns {number} Distance in kilometers (always positive)
 */
export function kmBetween(lat1, lng1, lat2, lng2) {
  // Validate inputs
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) {
    return Infinity;
  }

  const latA = parseFloat(lat1);
  const lngA = parseFloat(lng1);
  const latB = parseFloat(lat2);
  const lngB = parseFloat(lng2);

  if (Number.isNaN(latA) || Number.isNaN(lngA) || Number.isNaN(latB) || Number.isNaN(lngB)) {
    return Infinity;
  }

  const EARTH_RADIUS_KM = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;

  const deltaLat = toRadians(latB - latA);
  const deltaLng = toRadians(lngB - lngA);
  const lat1Rad = toRadians(latA);
  const lat2Rad = toRadians(latB);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) ** 2;

  const distance = EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  // Always return positive value
  return Math.abs(distance);
}

/**
 * Format distance for display
 * @returns {string|null} Formatted distance string
 */
export function formatDistance(distanceKm) {
  if (distanceKm == null || !Number.isFinite(distanceKm) || distanceKm === Infinity) {
    return null;
  }

  const distance = Math.abs(distanceKm);

  if (distance < 1) {
    return `${Math.round(distance * 1000)}m`;
  }
  if (distance < 10) {
    return `${distance.toFixed(1)}km`;
  }
  return `${Math.round(distance)}km`;
}

/**
 * Check if coordinates are valid
 */
export function isValidCoordinate(lat, lng) {
  return (
    lat != null &&
    lng != null &&
    Number.isFinite(parseFloat(lat)) &&
    Number.isFinite(parseFloat(lng)) &&
    parseFloat(lat) >= -90 &&
    parseFloat(lat) <= 90 &&
    parseFloat(lng) >= -180 &&
    parseFloat(lng) <= 180
  );
}