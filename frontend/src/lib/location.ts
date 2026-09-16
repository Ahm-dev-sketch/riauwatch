/**
 * Modul Geolocation Lintas Perangkat (iOS/Apple Safari, Android, Windows, macOS)
 *
 * Mengatasi kendala pada Apple WebKit (iOS/Safari):
 * 1. Mode bertingkat: GPS Akurasi Tinggi -> Jaringan Seluler/WiFi -> IP Geolocation Fallback
 * 2. Menangani batasan HTTPS/insecure origin pada perangkat seluler
 * 3. Cache koordinat untuk performa cepat tanpa popup izin berulang
 */

export interface GeoLocationResult {
  latitude: number;
  longitude: number;
  source: "gps" | "network" | "ip_fallback";
}

/**
 * Fallback estimasi lokasi via IP publik jika GPS perangkat dinonaktifkan/ditolak
 */
export async function getIpGeolocation(): Promise<GeoLocationResult | null> {
  const endpoints = [
    "https://ipapi.co/json/",
    "https://freeipapi.com/api/json",
    "https://ipwhois.app/json/",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(4000) });
      if (res.ok) {
        const data = await res.json();
        const lat = Number(data.latitude ?? data.lat);
        const lon = Number(data.longitude ?? data.lon);
        if (!isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
          return {
            latitude: lat,
            longitude: lon,
            source: "ip_fallback",
          };
        }
      }
    } catch {
      // Coba endpoint alternatif berikutnya
    }
  }

  // Default titik tengah Riau jika seluruh IP lookup gagal
  return {
    latitude: 0.5333,
    longitude: 101.45,
    source: "ip_fallback",
  };
}

/**
 * Dapatkan lokasi pengguna dengan fallback berlapis yang kompatibel dengan iOS/Apple Safari
 */
export async function getCrossPlatformLocation(): Promise<GeoLocationResult> {
  if (typeof window === "undefined" || !navigator.geolocation) {
    const ipRes = await getIpGeolocation();
    return ipRes ?? { latitude: 0.5333, longitude: 101.45, source: "ip_fallback" };
  }

  // 1. Coba GPS perangkat dengan timeout wajar & caching 60 detik (sangat cocok untuk iOS Safari)
  const tryGps = (highAccuracy: boolean, timeoutMs: number): Promise<GeoLocationResult> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            source: highAccuracy ? "gps" : "network",
          });
        },
        (err) => reject(err),
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: 60000,
        },
      );
    });
  };

  try {
    // Percobaan 1: Akurasi normal (cepat, ramah baterai & langsung lolos di iOS)
    return await tryGps(false, 8000);
  } catch {
    try {
      // Percobaan 2: Coba dengan GPS satellite lock
      return await tryGps(true, 10000);
    } catch {
      // Percobaan 3: Fallback ke estimasi IP jika izin ditolak atau waktu habis di iOS
      const ipResult = await getIpGeolocation();
      return (
        ipResult ?? {
          latitude: 0.5333,
          longitude: 101.45,
          source: "ip_fallback",
        }
      );
    }
  }
}
