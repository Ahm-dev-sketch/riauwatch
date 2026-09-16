/**
 * Modul Utilitas Geospasial Riau
 * Resolusi otomatis koordinat (latitude, longitude) ke 12 Kabupaten/Kota di Provinsi Riau
 * serta deskripsi sektor geografis spesifik untuk memastikan tidak ada lagi "Lokasi tidak diketahui".
 */

export interface ResolvedLocation {
  kabupatenId: number;
  kabupatenName: string;
  fullDescription: string;
  isBorderSector?: boolean;
}

interface KabupatenGeometry {
  id: number;
  name: string;
  centroid: [number, number]; // [lat, lon]
  bbox: [[number, number], [number, number]]; // [[west, south], [east, north]]
}

export const RIAU_KABUPATEN_GEOMETRY: KabupatenGeometry[] = [
  {
    id: 11,
    name: "Kota Pekanbaru",
    centroid: [0.53, 101.44],
    bbox: [[101.35, 0.40], [101.58, 0.65]],
  },
  {
    id: 2,
    name: "Kota Dumai",
    centroid: [1.68, 101.45],
    bbox: [[101.10, 1.45], [101.75, 1.85]],
  },
  {
    id: 1,
    name: "Kab. Rokan Hilir",
    centroid: [2.05, 100.85],
    bbox: [[100.15, 1.35], [101.40, 2.75]],
  },
  {
    id: 8,
    name: "Kab. Rokan Hulu",
    centroid: [0.85, 100.35],
    bbox: [[99.80, 0.25], [101.05, 1.65]],
  },
  {
    id: 9,
    name: "Kab. Bengkalis",
    centroid: [1.48, 101.80],
    bbox: [[101.00, 0.95], [102.55, 2.10]],
  },
  {
    id: 5,
    name: "Kab. Siak",
    centroid: [0.82, 101.88],
    bbox: [[101.20, 0.45], [102.60, 1.45]],
  },
  {
    id: 3,
    name: "Kab. Kampar",
    centroid: [0.35, 101.02],
    bbox: [[100.35, -0.35], [101.65, 0.95]],
  },
  {
    id: 4,
    name: "Kab. Pelalawan",
    centroid: [0.15, 102.05],
    bbox: [[101.45, -0.55], [103.15, 0.75]],
  },
  {
    id: 12,
    name: "Kab. Kepulauan Meranti",
    centroid: [0.98, 102.72],
    bbox: [[102.35, 0.55], [103.55, 1.55]],
  },
  {
    id: 6,
    name: "Kab. Kuantan Singingi",
    centroid: [-0.55, 101.45],
    bbox: [[100.80, -1.75], [101.95, -0.05]],
  },
  {
    id: 7,
    name: "Kab. Indragiri Hulu",
    centroid: [-0.45, 102.35],
    bbox: [[101.70, -1.25], [102.95, 0.05]],
  },
  {
    id: 10,
    name: "Kab. Indragiri Hilir",
    centroid: [-0.42, 103.15],
    bbox: [[102.30, -1.75], [103.95, 0.35]],
  },
];

function calcDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  return dLat * dLat + dLon * dLon;
}

/**
 * Resolusi nama Kabupaten/Kota dan sektor geografis berdasarkan koordinat lat/lon
 */
export function resolveRiauLocation(
  lat: number,
  lon: number,
  providedAreaName?: string | null,
): ResolvedLocation {
  const hasValidName =
    providedAreaName &&
    providedAreaName.trim().length > 0 &&
    !providedAreaName.toLowerCase().includes("tidak diketahui");

  let matchedKabupaten = hasValidName
    ? RIAU_KABUPATEN_GEOMETRY.find((k) =>
        providedAreaName!.includes(k.name) || k.name.includes(providedAreaName!),
      )
    : undefined;

  let isBorder = false;

  if (!matchedKabupaten) {
    // 1. Cek containment bounding box
    const insideList = RIAU_KABUPATEN_GEOMETRY.filter((k) => {
      const [[w, s], [e, n]] = k.bbox;
      return lon >= w && lon <= e && lat >= s && lat <= n;
    });

    if (insideList.length === 1) {
      matchedKabupaten = insideList[0];
    } else if (insideList.length > 1) {
      // Pilih yang jarak centroidnya terdekat
      matchedKabupaten = insideList.reduce((closest, curr) => {
        const dCurr = calcDistance(lat, lon, curr.centroid[0], curr.centroid[1]);
        const dClosest = calcDistance(lat, lon, closest.centroid[0], closest.centroid[1]);
        return dCurr < dClosest ? curr : closest;
      });
    } else {
      // Di luar semua bounding box (area perbatasan / buffer) -> cari centroid terdekat
      matchedKabupaten = RIAU_KABUPATEN_GEOMETRY.reduce((closest, curr) => {
        const dCurr = calcDistance(lat, lon, curr.centroid[0], curr.centroid[1]);
        const dClosest = calcDistance(lat, lon, closest.centroid[0], closest.centroid[1]);
        return dCurr < dClosest ? curr : closest;
      });
      isBorder = true;
    }
  }

  const baseName = matchedKabupaten ? matchedKabupaten.name : "Provinsi Riau";
  const detail = getSectorDetail(lat, lon, baseName, isBorder);

  return {
    kabupatenId: matchedKabupaten ? matchedKabupaten.id : 0,
    kabupatenName: baseName,
    fullDescription: detail,
    isBorderSector: isBorder,
  };
}

function getSectorDetail(lat: number, lon: number, baseName: string, isBorder: boolean): string {
  if (baseName.includes("Pekanbaru")) {
    if (lat < 0.50) return `${baseName} (Sektor Selatan / Tampan - Marpoyan)`;
    if (lat > 0.54) return `${baseName} (Sektor Utara / Rumbai)`;
    return `${baseName} (Sektor Pusat Kota / Sukajadi)`;
  }
  if (baseName.includes("Dumai")) {
    if (lon > 101.50) return `${baseName} (Kawasan Industri Pelintung - Medang Kampai)`;
    if (lon < 101.35) return `${baseName} (Sektor Sungai Sembilan)`;
    return `${baseName} (Sektor Dumai Timur / Pesisir)`;
  }
  if (baseName.includes("Bengkalis")) {
    if (lon < 101.40) return `${baseName} (Daratan Duri / Mandau - Pinggir)`;
    if (lon > 102.10) return `${baseName} (Pulau Bengkalis / Bantan)`;
    return `${baseName} (Sektor Bukit Batu / Siak Kecil)`;
  }
  if (baseName.includes("Rokan Hilir")) {
    if (lat > 2.0) return `${baseName} (Pesisir Bagan Siapi-api / Sinaboi)`;
    if (lon < 100.6) return `${baseName} (Sektor Bagan Sinembah / Simpang Kanan)`;
    return `${baseName} (Sektor Tanah Putih / Kubu)`;
  }
  if (baseName.includes("Rokan Hulu")) {
    if (lat > 1.0) return `${baseName} (Sektor Tambusai / Rambah Hilir)`;
    return `${baseName} (Sektor Pasir Pengaraian / Rambah)`;
  }
  if (baseName.includes("Pelalawan")) {
    if (lon > 102.4) return `${baseName} (Sektor Teluk Meranti / Kuala Kampar)`;
    if (lon < 101.8) return `${baseName} (Sektor Langgam / Pangkalan Kerinci)`;
    return `${baseName} (Sektor Pangkalan Kuras / Bunut)`;
  }
  if (baseName.includes("Siak")) {
    if (lon < 101.5) return `${baseName} (Sektor Kandis / Minas)`;
    if (lon > 102.1) return `${baseName} (Sektor Sungai Apit / Sabak Auh)`;
    return `${baseName} (Sektor Siak Sri Indrapura / Mempura)`;
  }
  if (baseName.includes("Kampar")) {
    if (lat > 0.5) return `${baseName} (Sektor Tapung / Tapung Hilir)`;
    if (lat < 0.1) return `${baseName} (Sektor Kampar Kiri / Gunung Sahilan)`;
    return `${baseName} (Sektor Bangkinang / Salo)`;
  }
  if (baseName.includes("Indragiri Hulu")) {
    if (lat > 0.0) return `${baseName} (Sektor Rengat / Kuala Cenaku)`;
    if (lat < -0.8) return `${baseName} (Sektor Batang Cenaku / Perbatasan Selatan)`;
    return `${baseName} (Sektor Seberida / Batang Cenaku)`;
  }
  if (baseName.includes("Indragiri Hilir")) {
    if (lat < -0.8) return `${baseName} (Sektor Keritang - Kemuning / Perbatasan Selatan)`;
    if (lat < -0.5) return `${baseName} (Sektor Reteh / Enok)`;
    if (lon > 103.2) return `${baseName} (Pesisir Kuala Indragiri / Mandah)`;
    return `${baseName} (Sektor Tembilahan / Batang Tuaka)`;
  }
  if (baseName.includes("Kuantan Singingi")) {
    if (lat < -0.8) return `${baseName} (Sektor Singingi / Perbatasan Selatan)`;
    if (lat > -0.4) return `${baseName} (Sektor Singingi / Singingi Hilir)`;
    return `${baseName} (Sektor Teluk Kuantan / Kuantan Tengah)`;
  }
  if (baseName.includes("Kepulauan Meranti")) {
    return `${baseName} (Kepulauan Tebing Tinggi / Rangsang)`;
  }

  return isBorder
    ? `${baseName} (Perbatasan: ${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`
    : `${baseName} (Koordinat: ${lat.toFixed(3)}°, ${lon.toFixed(3)}°)`;
}
