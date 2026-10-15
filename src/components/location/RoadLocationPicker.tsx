import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
} from '@vis.gl/react-google-maps';
import L from 'leaflet';
import {
  Compass,
  MapPin,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Navigation,
} from 'lucide-react';
import { AddressDetails, LocationSource } from '../../types';
import {
  reverseGeocodeCoordinates,
  GOOGLE_MAPS_API_KEY,
} from '../../services/geocodingService';

interface RoadLocationPickerProps {
  latitude: number | null;
  longitude: number | null;
  locationAccuracy?: number | null;
  locationSource: LocationSource;
  roadName: string;
  addressDetails?: AddressDetails;
  onLocationChange: (data: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    source: LocationSource;
    roadName?: string;
    addressDetails?: AddressDetails;
  }) => void;
}

export const RoadLocationPicker: React.FC<RoadLocationPickerProps> = ({
  latitude,
  longitude,
  locationAccuracy,
  locationSource,
  roadName,
  addressDetails,
  onLocationChange,
}) => {
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGoogleMapsReady, setIsGoogleMapsReady] = useState<boolean>(Boolean(GOOGLE_MAPS_API_KEY));
  const [mapProvider, setMapProvider] = useState<'google' | 'osm'>(
    GOOGLE_MAPS_API_KEY ? 'google' : 'osm'
  );

  // Leaflet fallback map ref
  const osmContainerRef = useRef<HTMLDivElement>(null);
  const osmMapRef = useRef<L.Map | null>(null);
  const osmMarkerRef = useRef<L.Marker | null>(null);

  // Default coordinate (if not yet detected, default to San Francisco or user region)
  const defaultCenter = { lat: 37.7749, lng: -122.4194 };
  const currentLat = latitude ?? defaultCenter.lat;
  const currentLng = longitude ?? defaultCenter.lng;

  // Handle Detect My Location
  const handleDetectLocation = () => {
    setErrorMessage(null);
    if (!navigator.geolocation) {
      setErrorMessage('Browser does not support geolocation.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy);

        setIsLocating(false);
        setIsGeocoding(true);

        const geo = await reverseGeocodeCoordinates(lat, lng);
        setIsGeocoding(false);

        onLocationChange({
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          source: 'device_gps',
          roadName: geo.roadName || undefined,
          addressDetails: geo.addressDetails,
        });
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setErrorMessage(
            'GPS permission was denied. You can click anywhere on the map below to position the pin directly over the damaged road.'
          );
        } else {
          setErrorMessage(`Location acquisition error: ${err.message}. You can manually place the map pin.`);
        }
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  };

  // Trigger geocode when user clicks or drags pin on map
  const handleMapPositionPick = useCallback(
    async (lat: number, lng: number) => {
      const fixedLat = parseFloat(lat.toFixed(6));
      const fixedLng = parseFloat(lng.toFixed(6));

      setIsGeocoding(true);
      const geo = await reverseGeocodeCoordinates(fixedLat, fixedLng);
      setIsGeocoding(false);

      onLocationChange({
        latitude: fixedLat,
        longitude: fixedLng,
        accuracy: null,
        source: 'map_pin',
        roadName: geo.roadName || undefined,
        addressDetails: geo.addressDetails,
      });
    },
    [onLocationChange]
  );

  // OSM Leaflet Fallback implementation
  useEffect(() => {
    if (mapProvider !== 'osm' || !osmContainerRef.current) return;

    if (!osmMapRef.current) {
      const map = L.map(osmContainerRef.current, {
        center: [currentLat, currentLng],
        zoom: latitude ? 15 : 13,
      });
      osmMapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      // Handle Map Click to place pin
      map.on('click', (e) => {
        handleMapPositionPick(e.latlng.lat, e.latlng.lng);
      });

      setTimeout(() => map.invalidateSize(), 150);
    }

    // Update or create marker
    if (osmMapRef.current && latitude !== null && longitude !== null) {
      if (osmMarkerRef.current) {
        osmMarkerRef.current.setLatLng([latitude, longitude]);
      } else {
        const customIcon = L.divIcon({
          className: 'custom-pin',
          html: `
            <div style="width:24px; height:24px; background:#22d3ee; border:2px solid #080d18; border-radius:50%; box-shadow:0 0 12px rgba(34,211,238,0.6); display:flex; align-items:center; justify-content:center;">
              <div style="width:8px; height:8px; background:#080d18; border-radius:50%;"></div>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const marker = L.marker([latitude, longitude], {
          icon: customIcon,
          draggable: true,
        }).addTo(osmMapRef.current);

        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          handleMapPositionPick(pos.lat, pos.lng);
        });

        osmMarkerRef.current = marker;
      }
      osmMapRef.current.setView([latitude, longitude], 15);
    }
  }, [mapProvider, latitude, longitude, handleMapPositionPick, currentLat, currentLng]);

  return (
    <div className="space-y-4 bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5">
      {/* Location Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-white flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-cyan-400" />
            <span>Automatic Road Location & Reverse Geocoding</span>
          </div>
          <p className="text-[11px] text-slate-400">
            Detects coordinates and resolves road name automatically. Confirm or drag the pin over the road.
          </p>
        </div>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={isLocating}
          className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-cyan-950 disabled:opacity-50"
        >
          <Compass className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
          <span>{isLocating ? 'Acquiring GPS...' : 'Detect My Location'}</span>
        </button>
      </div>

      {/* Accuracy & Source Banner */}
      {latitude !== null && longitude !== null && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-cyan-300 font-semibold">
              {latitude.toFixed(5)}, {longitude.toFixed(5)}
            </span>
            <span className="text-slate-500">|</span>
            <span className="text-slate-400 capitalize">
              Source: <strong className="text-slate-200">{locationSource.replace('_', ' ')}</strong>
            </span>
            {locationAccuracy && (
              <>
                <span className="text-slate-500">|</span>
                <span className="text-slate-400">
                  Accuracy: <strong className="text-slate-200 font-mono">±{locationAccuracy}m</strong>
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px]">
            {isGeocoding ? (
              <span className="text-cyan-400 flex items-center gap-1">
                <RotateCcw className="w-3 h-3 animate-spin" />
                <span>Resolving road address...</span>
              </span>
            ) : roadName ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Road Identified</span>
              </span>
            ) : null}
          </div>
        </div>
      )}

      {/* Auto-resolved Road Name Display */}
      {roadName && (
        <div className="bg-cyan-950/20 border border-cyan-800/40 rounded-lg p-2.5 text-xs text-slate-300 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-cyan-400 font-semibold uppercase tracking-wider">
              Auto-Resolved Roadway:
            </span>
            <span className="text-[10px] text-slate-400">
              {addressDetails?.locality ? `${addressDetails.locality}` : ''}
              {addressDetails?.district ? ` &middot; ${addressDetails.district}` : ''}
            </span>
          </div>
          <div className="text-sm font-bold text-white tracking-tight">{roadName}</div>
          {addressDetails?.formattedAddress && (
            <div className="text-[11px] text-slate-400 truncate">
              {addressDetails.formattedAddress}
            </div>
          )}
        </div>
      )}

      {/* GPS Notice / Warning */}
      <div className="bg-amber-950/20 border border-amber-500/30 rounded-lg p-2.5 text-[11px] text-amber-300/90 flex items-start gap-2">
        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-amber-200">Device GPS Note:</strong> Your device GPS indicates where you are standing now, which may differ from the damaged asphalt shown in the photograph. You can drag the pin or click on the map to position it directly on the affected road segment.
        </p>
      </div>

      {errorMessage && (
        <div className="bg-rose-950/30 border border-rose-500/40 rounded-lg p-2.5 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Interactive Map Viewport (Google Map with OpenStreetMap Fallback) */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#0B1120] h-64 sm:h-72">
        {/* Map provider indicator & switcher */}
        <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 bg-slate-900/90 border border-slate-800 backdrop-blur-md p-1 rounded-lg text-[10px]">
          <button
            type="button"
            onClick={() => setMapProvider('google')}
            disabled={!GOOGLE_MAPS_API_KEY}
            className={`px-2 py-0.5 rounded transition-colors ${
              mapProvider === 'google'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-white disabled:opacity-40'
            }`}
            title={!GOOGLE_MAPS_API_KEY ? 'Google Maps key not configured' : 'Use Google Maps'}
          >
            Google Maps
          </button>
          <button
            type="button"
            onClick={() => setMapProvider('osm')}
            className={`px-2 py-0.5 rounded transition-colors ${
              mapProvider === 'osm'
                ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            OpenStreetMap
          </button>
        </div>

        {mapProvider === 'google' && GOOGLE_MAPS_API_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <Map
              id="roadguard-picker-map"
              mapId="DEMO_MAP_ID"
              defaultCenter={defaultCenter}
              center={{ lat: currentLat, lng: currentLng }}
              defaultZoom={latitude ? 16 : 13}
              gestureHandling="greedy"
              disableDefaultUI={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              onClick={(e) => {
                if (e.detail.latLng) {
                  handleMapPositionPick(e.detail.latLng.lat, e.detail.latLng.lng);
                }
              }}
              style={{ width: '100%', height: '100%' }}
            >
              {latitude !== null && longitude !== null && (
                <AdvancedMarker
                  position={{ lat: latitude, lng: longitude }}
                  draggable
                  onDragEnd={(e) => {
                    if (e.latLng) {
                      handleMapPositionPick(e.latLng.lat(), e.latLng.lng());
                    }
                  }}
                >
                  <Pin
                    background="#22D3EE"
                    borderColor="#080D18"
                    glyphColor="#080D18"
                  />
                </AdvancedMarker>
              )}
            </Map>
          </APIProvider>
        ) : (
          <div ref={osmContainerRef} className="w-full h-full z-10" />
        )}

        {/* Instruction overlay if no coordinates placed yet */}
        {latitude === null && (
          <div className="absolute inset-0 z-20 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center pointer-events-none">
            <Navigation className="w-6 h-6 text-cyan-400 mb-1.5 animate-pulse" />
            <div className="text-xs font-semibold text-white">Click Map to Set Road Location</div>
            <p className="text-[11px] text-slate-400 max-w-xs mt-0.5">
              Click anywhere on the map or press "Detect My Location" above. The nearest road address will be resolved automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
