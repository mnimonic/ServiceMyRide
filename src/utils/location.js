// Distance tracking for an open drive session, sourced from GPS since BLE
// connect/disconnect only tells us a drive happened, not how far it went.

let Location = null;

function getLocation() {
  if (Location) return Location;
  try {
    Location = require('expo-location');
  } catch (e) {
    Location = null;
  }
  return Location;
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// Starts watching position and accumulating distance. Returns a handle whose
// stop() ends the watch and resolves to the distance travelled, in km.
// Resolves to a no-op tracker (0 km) if location is unavailable or the
// permission was denied - the drive session still gets logged either way,
// just without a distance.
export async function startDistanceTracking() {
  const loc = getLocation();
  if (!loc) return { stop: async () => 0 };

  let granted = false;
  try {
    const { status } = await loc.requestForegroundPermissionsAsync();
    granted = status === 'granted';
  } catch (e) {}
  if (!granted) return { stop: async () => 0 };

  let totalKm = 0;
  let last = null;
  let sub = null;
  try {
    sub = await loc.watchPositionAsync(
      { accuracy: loc.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 25 },
      (pos) => {
        const point = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        if (last) totalKm += haversineKm(last, point);
        last = point;
      }
    );
  } catch (e) {}

  return {
    stop: async () => {
      try { sub && sub.remove(); } catch (e) {}
      return Math.round(totalKm * 10) / 10;
    },
  };
}
