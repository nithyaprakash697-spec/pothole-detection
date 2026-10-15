import { AddressDetails } from '../types';

export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Reverse geocodes coordinates to obtain nearest road name, locality, district, and address.
 * Prioritizes Google Maps Geocoding API when configured, with seamless OpenStreetMap Nominatim fallback.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<{
  roadName?: string;
  addressDetails: AddressDetails;
  serviceUsed: 'google_maps' | 'openstreetmap_nominatim';
}> {
  // 1. Try Google Maps Geocoding if API key is provided and window.google is loaded
  if (GOOGLE_MAPS_API_KEY && typeof window !== 'undefined' && (window as any).google?.maps?.Geocoder) {
    try {
      const geocoder = new (window as any).google.maps.Geocoder();
      const response = await new Promise<any>((resolve, reject) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any[], status: string) => {
          if (status === 'OK' && results && results.length > 0) {
            resolve(results);
          } else {
            reject(new Error(`Google Geocoder status: ${status}`));
          }
        });
      });

      if (response && response.length > 0) {
        const topResult = response[0];
        let roadName = '';
        let locality = '';
        let district = '';
        let city = '';
        let state = '';
        let postalCode = '';

        topResult.address_components?.forEach((comp: any) => {
          const types: string[] = comp.types || [];
          if (types.includes('route')) {
            roadName = comp.long_name;
          } else if (types.includes('locality')) {
            city = comp.long_name;
            locality = comp.long_name;
          } else if (types.includes('sublocality') || types.includes('neighborhood')) {
            district = comp.long_name;
          } else if (types.includes('administrative_area_level_2')) {
            if (!district) district = comp.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            state = comp.short_name;
          } else if (types.includes('postal_code')) {
            postalCode = comp.long_name;
          }
        });

        return {
          roadName: roadName || topResult.formatted_address?.split(',')[0] || undefined,
          addressDetails: {
            formattedAddress: topResult.formatted_address,
            road: roadName,
            locality: locality || city,
            district,
            city,
            state,
            postalCode,
          },
          serviceUsed: 'google_maps',
        };
      }
    } catch (gErr) {
      console.warn('Google Maps reverse geocode failed, falling back to OSM Nominatim:', gErr);
    }
  }

  // 2. OpenStreetMap Nominatim Fallback (Compliant, free, zero API key required)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'RoadGuardAI-SmartRoadMonitor/2.0',
      },
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const roadName =
        addr.road ||
        addr.street ||
        addr.pedestrian ||
        addr.highway ||
        addr.suburb ||
        undefined;

      return {
        roadName,
        addressDetails: {
          formattedAddress: data.display_name,
          road: roadName,
          locality: addr.city || addr.town || addr.village || addr.municipality,
          district: addr.suburb || addr.neighbourhood || addr.county,
          city: addr.city || addr.town || addr.village,
          state: addr.state,
          postalCode: addr.postcode,
        },
        serviceUsed: 'openstreetmap_nominatim',
      };
    }
  } catch (osmErr) {
    console.warn('OSM Nominatim reverse geocoding also failed:', osmErr);
  }

  // If geocoding fails, return clean empty object without inventing data
  return {
    roadName: undefined,
    addressDetails: {},
    serviceUsed: 'openstreetmap_nominatim',
  };
}
