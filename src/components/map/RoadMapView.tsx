import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import L from 'leaflet';
import {
  MapPin,
  Layers,
  Calendar,
  AlertTriangle,
  PlusCircle,
  Sparkles,
  Search,
  Filter,
  Copy,
  Info,
  CheckCircle2,
  Clock,
  Hammer,
  Eye,
  ShieldCheck,
  ChevronDown,
  ExternalLink,
  Activity,
  History,
  X,
  Users,
} from 'lucide-react';
import {
  DamagePriority,
  DamageReport,
  PreliminarySeverity,
  ReportLifecycleStatus,
  ReportStatus,
} from '../../types';
import { GOOGLE_MAPS_API_KEY } from '../../services/geocodingService';
import {
  generatePracticalRepairRecommendation,
  getReportMarkerVisual,
  isReportUnresolved,
  normalizeReportStatus,
} from '../../services/repairRecommendations';
import { linkDuplicateReports } from '../../services/reportStorage';

interface RoadMapViewProps {
  reports: DamageReport[];
  onSelectReport: (report: DamageReport) => void;
  onNavigateToDetection: () => void;
  onSeedSamples: () => void;
  onUpdateStatus?: (id: string, status: ReportStatus) => void;
}

type MapDisplayFilter = 'unresolved' | 'all' | 'repaired';

export const RoadMapView: React.FC<RoadMapViewProps> = ({
  reports,
  onSelectReport,
  onNavigateToDetection,
  onSeedSamples,
  onUpdateStatus,
}) => {
  // Map display filter: 'unresolved' (default, red dots only), 'all', or 'repaired'
  const [displayFilter, setDisplayFilter] = useState<MapDisplayFilter>('unresolved');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mapEngine, setMapEngine] = useState<'google' | 'osm'>(
    GOOGLE_MAPS_API_KEY ? 'google' : 'osm'
  );
  const [activeMarkerReport, setActiveMarkerReport] = useState<DamageReport | null>(null);
  const [showDuplicateReviewModal, setShowDuplicateReviewModal] = useState<boolean>(false);
  const [selectedDuplicateCluster, setSelectedDuplicateCluster] = useState<DamageReport[] | null>(null);

  // Fallback Leaflet refs
  const osmContainerRef = useRef<HTMLDivElement>(null);
  const osmMapRef = useRef<L.Map | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  // Valid geocoded reports only
  const geocodedReports = useMemo(() => {
    return reports.filter(
      (r) =>
        typeof r.latitude === 'number' &&
        typeof r.longitude === 'number' &&
        !isNaN(r.latitude) &&
        !isNaN(r.longitude)
    );
  }, [reports]);

  // Extract unique areas / districts from geocoded reports
  const availableAreas = useMemo(() => {
    const areas = new Set<string>();
    geocodedReports.forEach((r) => {
      const dist = r.addressDetails?.district || r.addressDetails?.locality || r.addressDetails?.city;
      if (dist) areas.add(dist);
    });
    return Array.from(areas).sort();
  }, [geocodedReports]);

  // Duplicate detection (&le;80m radius)
  const duplicateClusters = useMemo(() => {
    const clusters: Record<string, DamageReport[]> = {};
    const R = 6371e3; // meters

    for (let i = 0; i < geocodedReports.length; i++) {
      const r1 = geocodedReports[i];
      const nearby: DamageReport[] = [];

      for (let j = 0; j < geocodedReports.length; j++) {
        if (i === j) continue;
        const r2 = geocodedReports[j];
        const phi1 = (r1.latitude! * Math.PI) / 180;
        const phi2 = (r2.latitude! * Math.PI) / 180;
        const deltaPhi = ((r2.latitude! - r1.latitude!) * Math.PI) / 180;
        const deltaLambda = ((r2.longitude! - r1.longitude!) * Math.PI) / 180;

        const a =
          Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

        if (dist <= 80) {
          nearby.push(r2);
        }
      }

      if (nearby.length > 0) {
        clusters[r1.id] = nearby;
      }
    }
    return clusters;
  }, [geocodedReports]);

  // Section 7.A: Area-Wise Statistics Calculation
  const areaStatistics = useMemo(() => {
    // If specific area selected, filter reports to that area; otherwise all geocoded reports
    const targetSet = geocodedReports.filter((r) => {
      if (selectedAreaFilter === 'all') return true;
      const area = r.addressDetails?.district || r.addressDetails?.locality || r.addressDetails?.city;
      return area === selectedAreaFilter;
    });

    let reportedCount = 0;
    let awaitingInspectionCount = 0;
    let repairRecommendedCount = 0;
    let repairInProgressCount = 0;
    let awaitingVerificationCount = 0;
    let repairedAndVerifiedCount = 0;

    targetSet.forEach((r) => {
      const norm = normalizeReportStatus(r.status);
      switch (norm) {
        case 'Reported':
          reportedCount++;
          break;
        case 'Awaiting Inspection':
          awaitingInspectionCount++;
          break;
        case 'Inspection Completed':
        case 'Repair Recommended':
          repairRecommendedCount++;
          break;
        case 'Repair in Progress':
          repairInProgressCount++;
          break;
        case 'Repair Completed — Awaiting Verification':
          awaitingVerificationCount++;
          break;
        case 'Repaired and Verified':
          repairedAndVerifiedCount++;
          break;
      }
    });

    const activeUnresolvedTotal =
      reportedCount +
      awaitingInspectionCount +
      repairRecommendedCount +
      repairInProgressCount +
      awaitingVerificationCount;

    return {
      totalPotholes: targetSet.length,
      activeUnresolvedTotal,
      reportedCount,
      awaitingInspectionCount,
      repairRecommendedCount,
      repairInProgressCount,
      awaitingVerificationCount,
      repairedAndVerifiedCount,
      highPriorityCount: targetSet.filter(
        (r) => (r.priority === 'Critical' || r.priority === 'High') && isReportUnresolved(r.status)
      ).length,
    };
  }, [geocodedReports, selectedAreaFilter]);

  // Filtered reports for map display
  const displayedReports = useMemo(() => {
    return geocodedReports.filter((r) => {
      // 1. Red-Dot display lifecycle filter
      const norm = normalizeReportStatus(r.status);
      const isUnresolved = norm !== 'Repaired and Verified';

      if (displayFilter === 'unresolved' && !isUnresolved) return false;
      if (displayFilter === 'repaired' && isUnresolved) return false;

      // 2. Area Filter
      if (selectedAreaFilter !== 'all') {
        const area = r.addressDetails?.district || r.addressDetails?.locality || r.addressDetails?.city;
        if (area !== selectedAreaFilter) return false;
      }

      // 3. Severity Filter
      if (selectedSeverityFilter !== 'all' && r.preliminarySeverity !== selectedSeverityFilter) return false;

      // 4. Category Filter
      if (selectedCategoryFilter !== 'all') {
        const cats = r.damageCategories || ['Pothole Cavity (D40)'];
        if (!cats.some((c) => c.toLowerCase().includes(selectedCategoryFilter.toLowerCase()))) return false;
      }

      // 5. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.roadName?.toLowerCase().includes(q);
        const matchesNotes = r.userNotes?.toLowerCase().includes(q);
        const matchesId = r.id.toLowerCase().includes(q);
        if (!matchesName && !matchesNotes && !matchesId) return false;
      }

      return true;
    });
  }, [
    geocodedReports,
    displayFilter,
    selectedAreaFilter,
    selectedSeverityFilter,
    selectedCategoryFilter,
    searchQuery,
  ]);

  // Default Map center
  const defaultCenter = useMemo(() => {
    if (displayedReports.length > 0) {
      return { lat: displayedReports[0].latitude!, lng: displayedReports[0].longitude! };
    }
    if (geocodedReports.length > 0) {
      return { lat: geocodedReports[0].latitude!, lng: geocodedReports[0].longitude! };
    }
    return { lat: 37.7749, lng: -122.4194 };
  }, [displayedReports, geocodedReports]);

  // Setup Leaflet map for OpenStreetMap mode
  useEffect(() => {
    if (mapEngine !== 'osm' || !osmContainerRef.current) return;

    if (!osmMapRef.current) {
      const map = L.map(osmContainerRef.current, {
        center: [defaultCenter.lat, defaultCenter.lng],
        zoom: displayedReports.length > 0 ? 14 : 12,
      });
      osmMapRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      }).addTo(map);

      markerGroupRef.current = L.layerGroup().addTo(map);
      setTimeout(() => map.invalidateSize(), 150);
    }

    return () => {
      if (osmMapRef.current) {
        osmMapRef.current.remove();
        osmMapRef.current = null;
      }
    };
  }, [mapEngine, defaultCenter.lat, defaultCenter.lng, displayedReports.length]);

  // Update Leaflet Markers
  useEffect(() => {
    if (mapEngine !== 'osm' || !osmMapRef.current || !markerGroupRef.current) return;

    markerGroupRef.current.clearLayers();
    if (displayedReports.length === 0) return;

    const bounds = L.latLngBounds([]);

    displayedReports.forEach((report) => {
      const lat = report.latitude!;
      const lng = report.longitude!;
      bounds.extend([lat, lng]);

      const markerType = getReportMarkerVisual(report);
      const isDuplicate = Boolean(duplicateClusters[report.id]);
      const normStatus = normalizeReportStatus(report.status);

      const dotColor =
        markerType === 'green'
          ? '#34D399' // Green for repaired and verified
          : markerType === 'amber'
          ? '#FBBF24' // Amber for awaiting verification
          : '#EF4444'; // Crisp Small Red Dot for active pothole

      const icon = L.divIcon({
        className: 'custom-pothole-dot',
        html: `
          <div style="position: relative; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="position: absolute; inset: 0; border-radius: 50%; background: ${dotColor}33;"></div>
            <div style="width: 10px; height: 10px; border-radius: 50%; background: ${dotColor}; border: 1.5px solid #ffffff; box-shadow: 0 0 8px ${dotColor}aa;"></div>
            ${isDuplicate ? '<div style="position:absolute; top:-2px; right:-2px; width:6px; height:6px; background:#fbbf24; border-radius:50%; border:1px solid #080d18;"></div>' : ''}
          </div>
        `,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -10],
      });

      const marker = L.marker([lat, lng], { icon });

      const popupDiv = document.createElement('div');
      popupDiv.className = 'p-2 text-slate-100 max-w-xs';
      popupDiv.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 11px; font-weight: 700; color: #22d3ee; font-family: monospace;">${report.id}</span>
          <span style="font-size: 10px; font-weight: 600; color: ${dotColor};">${normStatus}</span>
        </div>
        <div style="font-size: 12px; font-weight: 700; color: #ffffff; margin-bottom: 4px;">
          ${report.roadName || 'Unnamed Road Segment'}
        </div>
        <div style="font-size: 11px; color: #94a3b8; margin-bottom: 6px;">
          Severity: <strong style="color:#ffffff;">${report.preliminarySeverity}</strong> &middot; Priority: <strong style="color:#ffffff;">${report.priority}</strong>
          ${
            report.isCountUnavailable
              ? ' &middot; <span style="color:#fde047;">Count unavailable</span>'
              : typeof report.potholeCount === 'number'
              ? ` &middot; Potholes: <strong style="color:#ffffff;">${report.potholeCount}</strong>`
              : ''
          }
        </div>
        ${
          report.suggestedRepairApproach
            ? `<div style="font-size: 10px; color: #cbd5e1; background: rgba(15,23,42,0.8); padding: 4px 6px; border-radius: 4px; margin-bottom: 6px; border: 1px solid #334155;">
                <strong style="color: #38bdf8;">Suggested Repair:</strong> ${report.suggestedRepairApproach}
              </div>`
            : ''
        }
        <button id="osm-btn-${report.id}" style="
          width: 100%;
          background: #22d3ee;
          color: #080d18;
          font-weight: 700;
          font-size: 11px;
          padding: 6px 8px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
        ">
          View Complete Report &amp; Work Log
        </button>
      `;

      marker.bindPopup(popupDiv);
      marker.on('popupopen', () => {
        const btn = document.getElementById(`osm-btn-${report.id}`);
        if (btn) btn.onclick = () => onSelectReport(report);
      });

      markerGroupRef.current?.addLayer(marker);
    });

    if (displayedReports.length > 0 && bounds.isValid()) {
      osmMapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [mapEngine, displayedReports, duplicateClusters, onSelectReport]);

  const handleMergeDuplicates = (primaryId: string, dupIds: string[]) => {
    linkDuplicateReports(primaryId, dupIds);
    setShowDuplicateReviewModal(false);
    setSelectedDuplicateCluster(null);
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-12">
      {/* Section 7.A & Section 5: Area-Wise Road Condition Dashboard & Summary KPIs */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Header row with Area Selector and Display Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                Google Maps Road Damage & Pothole Tracking
              </h2>
              <p className="text-xs text-slate-400">
                Small red dots denote active unresolved potholes; automatically removed upon verified repair
              </p>
            </div>
          </div>

          {/* Area / District Dropdown Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Select Area / District:</span>
            <select
              value={selectedAreaFilter}
              onChange={(e) => setSelectedAreaFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white font-medium focus:outline-none focus:border-cyan-400"
            >
              <option value="all">All Recorded Districts ({geocodedReports.length} total)</option>
              {availableAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Section 7.A: Area-Wise Statistics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2 pt-2 border-t border-slate-800 text-center">
          <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Total Reports</div>
            <div className="text-base font-bold text-white font-mono">{areaStatistics.totalPotholes}</div>
            <div className="text-[9px] text-slate-500">In selected area</div>
          </div>

          <div className="p-2.5 bg-rose-950/20 rounded-lg border border-rose-500/30">
            <div className="text-[10px] text-rose-300 uppercase font-mono">Unresolved (Red Dots)</div>
            <div className="text-base font-bold text-rose-400 font-mono">
              {areaStatistics.activeUnresolvedTotal}
            </div>
            <div className="text-[9px] text-rose-300/80">Active on map</div>
          </div>

          <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800">
            <div className="text-[10px] text-slate-400 uppercase font-mono">Newly Reported</div>
            <div className="text-base font-bold text-slate-200 font-mono">
              {areaStatistics.reportedCount}
            </div>
            <div className="text-[9px] text-slate-500">Awaiting triage</div>
          </div>

          <div className="p-2.5 bg-yellow-950/20 rounded-lg border border-yellow-500/30">
            <div className="text-[10px] text-yellow-300 uppercase font-mono">Awaiting Inspection</div>
            <div className="text-base font-bold text-yellow-400 font-mono">
              {areaStatistics.awaitingInspectionCount}
            </div>
            <div className="text-[9px] text-yellow-400/80">Scheduled for audit</div>
          </div>

          <div className="p-2.5 bg-cyan-950/20 rounded-lg border border-cyan-500/30">
            <div className="text-[10px] text-cyan-300 uppercase font-mono">Repair In Progress</div>
            <div className="text-base font-bold text-cyan-400 font-mono">
              {areaStatistics.repairInProgressCount}
            </div>
            <div className="text-[9px] text-cyan-400/80">Crews deployed</div>
          </div>

          <div className="p-2.5 bg-amber-950/20 rounded-lg border border-amber-500/30">
            <div className="text-[10px] text-amber-300 uppercase font-mono">Pending Verification</div>
            <div className="text-base font-bold text-amber-400 font-mono">
              {areaStatistics.awaitingVerificationCount}
            </div>
            <div className="text-[9px] text-amber-400/80">Amber markers</div>
          </div>

          <div className="p-2.5 bg-emerald-950/30 rounded-lg border border-emerald-500/40">
            <div className="text-[10px] text-emerald-300 uppercase font-mono">Repaired & Verified</div>
            <div className="text-base font-bold text-emerald-400 font-mono">
              {areaStatistics.repairedAndVerifiedCount}
            </div>
            <div className="text-[9px] text-emerald-400/80">Dot removed (History)</div>
          </div>
        </div>

        {/* Duplicate Review Alert when nearby duplicates exist */}
        {Object.keys(duplicateClusters).length > 0 && (
          <div className="p-3 bg-amber-950/25 border border-amber-500/30 rounded-xl flex items-center justify-between text-xs text-amber-300 gap-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>Duplicate Review Alert:</strong> {Object.keys(duplicateClusters).length} reports have potential physical duplicates within 80 meters. Review and link duplicate submissions without deleting historical records.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                const firstClusterId = Object.keys(duplicateClusters)[0];
                const cluster = [
                  geocodedReports.find((r) => r.id === firstClusterId)!,
                  ...duplicateClusters[firstClusterId],
                ];
                setSelectedDuplicateCluster(cluster);
                setShowDuplicateReviewModal(true);
              }}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] shrink-0 transition-colors"
            >
              Review Duplicates
            </button>
          </div>
        )}
      </div>

      {/* Map Filter Controls Bar */}
      <div className="bg-[#111827] border border-slate-800 p-3.5 rounded-xl shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Main Lifecycle View Filters: Unresolved (Red Dots) vs All vs Repaired */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setDisplayFilter('unresolved')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                displayFilter === 'unresolved'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-sm shadow-rose-950" />
              <span>Active Potholes ({areaStatistics.activeUnresolvedTotal})</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayFilter('all')}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                displayFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>All Reports ({areaStatistics.totalPotholes})</span>
            </button>

            <button
              type="button"
              onClick={() => setDisplayFilter('repaired')}
              className={`px-3 py-1 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                displayFilter === 'repaired'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              <span>Repaired History ({areaStatistics.repairedAndVerifiedCount})</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search road, street, or report ID..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Engine Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setMapEngine('google')}
              disabled={!GOOGLE_MAPS_API_KEY}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                mapEngine === 'google'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white disabled:opacity-40'
              }`}
            >
              Google Maps
            </button>
            <button
              type="button"
              onClick={() => setMapEngine('osm')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                mapEngine === 'osm'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              OpenStreetMap
            </button>
          </div>
        </div>

        {/* Secondary Filter Row: Severity & Damage Category */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 text-[11px]">Severity:</span>
            {['all', 'Critical', 'High', 'Medium', 'Low'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSelectedSeverityFilter(s)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  selectedSeverityFilter === s
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {s === 'all' ? 'All Severities' : s}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">Category:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-2.5 py-0.5 bg-slate-900 border border-slate-800 rounded text-[11px] text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Categories</option>
              <option value="pothole">Potholes (D40)</option>
              <option value="alligator">Alligator Cracks (D20)</option>
              <option value="longitudinal">Longitudinal Cracks (D00)</option>
              <option value="transverse">Transverse Cracks (D10)</option>
            </select>
            <span className="text-xs font-mono text-cyan-400 font-semibold pl-2">
              {displayedReports.length} Active Marker{displayedReports.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Map Viewport */}
      <div className="relative bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-2xl h-[620px]">
        {mapEngine === 'google' && GOOGLE_MAPS_API_KEY ? (
          <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
            <GoogleMap
              id="roadguard-main-map"
              mapId="DEMO_MAP_ID"
              defaultCenter={defaultCenter}
              defaultZoom={displayedReports.length > 0 ? 14 : 12}
              gestureHandling="greedy"
              disableDefaultUI={false}
              internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
              style={{ width: '100%', height: '100%' }}
            >
              {displayedReports.map((report) => {
                const visual = getReportMarkerVisual(report);
                const isDup = Boolean(duplicateClusters[report.id]);

                return (
                  <AdvancedMarker
                    key={report.id}
                    position={{ lat: report.latitude!, lng: report.longitude! }}
                    onClick={() => setActiveMarkerReport(report)}
                  >
                    {/* Small Circular Dot Marker convention */}
                    <div className="relative group cursor-pointer flex items-center justify-center p-1">
                      {visual === 'green' ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-white shadow-md shadow-emerald-950 transition-transform group-hover:scale-125" />
                      ) : visual === 'amber' ? (
                        <div className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-slate-900 shadow-md shadow-amber-950 transition-transform group-hover:scale-125" />
                      ) : (
                        // Small Red Dot for active unresolved pothole
                        <div className="relative flex items-center justify-center">
                          <span className="absolute -inset-1 rounded-full bg-rose-500/40 animate-ping opacity-75 pointer-events-none" />
                          <div className="w-3 h-3 rounded-full bg-rose-500 border border-white shadow-lg shadow-rose-950 transition-transform group-hover:scale-125" />
                        </div>
                      )}
                      {isDup && (
                        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 border border-slate-900" />
                      )}
                    </div>
                  </AdvancedMarker>
                );
              })}

              {/* Section 4: Interactive Compact Report Card InfoWindow */}
              {activeMarkerReport && (
                <InfoWindow
                  position={{
                    lat: activeMarkerReport.latitude!,
                    lng: activeMarkerReport.longitude!,
                  }}
                  onCloseClick={() => setActiveMarkerReport(null)}
                >
                  <div className="p-2.5 text-slate-900 max-w-sm space-y-2 font-sans">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                      <span className="text-[11px] font-bold text-cyan-700 font-mono">
                        {activeMarkerReport.id}
                      </span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                          normalizeReportStatus(activeMarkerReport.status) === 'Repaired and Verified'
                            ? 'bg-emerald-100 text-emerald-800'
                            : normalizeReportStatus(activeMarkerReport.status) ===
                              'Repair Completed — Awaiting Verification'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {normalizeReportStatus(activeMarkerReport.status)}
                      </span>
                    </div>

                    <div className="text-xs font-bold text-slate-900">
                      {activeMarkerReport.roadName || 'Unnamed Road Segment'}
                    </div>

                    {/* Image Preview Thumbnail if available */}
                    {(activeMarkerReport.originalImagePreview || activeMarkerReport.annotatedImageUrl) && (
                      <div className="grid grid-cols-2 gap-1.5 py-1">
                        {activeMarkerReport.originalImagePreview && (
                          <div className="relative aspect-video rounded overflow-hidden bg-black">
                            <img
                              src={activeMarkerReport.originalImagePreview}
                              alt="Raw pothole"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 left-0 bg-black/70 text-[9px] text-white px-1">
                              Raw
                            </span>
                          </div>
                        )}
                        {activeMarkerReport.annotatedImageUrl && (
                          <div className="relative aspect-video rounded overflow-hidden bg-black">
                            <img
                              src={activeMarkerReport.annotatedImageUrl}
                              alt="Annotated detection"
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 left-0 bg-cyan-900/80 text-[9px] text-cyan-200 px-1">
                              AI Overlay
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="text-[11px] text-slate-600 space-y-0.5">
                      <div>
                        Priority: <strong className="text-slate-900">{activeMarkerReport.priority}</strong> &middot; Severity:{' '}
                        <strong className="text-slate-900">{activeMarkerReport.preliminarySeverity}</strong>
                      </div>
                      <div>
                        Pothole Count:{' '}
                        {activeMarkerReport.isCountUnavailable ? (
                          <span className="text-amber-700 font-medium font-mono text-[10px]">Count unavailable (Visual overlay)</span>
                        ) : typeof activeMarkerReport.potholeCount === 'number' ? (
                          <strong className="text-slate-900 font-mono">{activeMarkerReport.potholeCount}</strong>
                        ) : (
                          <span className="text-slate-500">Unspecified</span>
                        )}
                      </div>
                      <div>
                        Reported: {new Date(activeMarkerReport.createdAt).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Suggested Repair Approach */}
                    {activeMarkerReport.suggestedRepairApproach && (
                      <div className="p-1.5 bg-slate-50 border border-slate-200 rounded text-[10px] text-slate-700 leading-tight">
                        <strong className="text-cyan-800">Suggested Action: </strong>
                        {activeMarkerReport.suggestedRepairApproach}
                      </div>
                    )}

                    {duplicateClusters[activeMarkerReport.id] && (
                      <div className="text-[10px] text-amber-800 bg-amber-50 p-1 rounded border border-amber-200 flex items-center gap-1 font-medium">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Potential physical duplicate report (&le;80m)</span>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        onSelectReport(activeMarkerReport);
                        setActiveMarkerReport(null);
                      }}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-1.5 px-3 rounded cursor-pointer transition-colors shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Open Full Report & Lifecycle</span>
                    </button>
                  </div>
                </InfoWindow>
              )}
            </GoogleMap>
          </APIProvider>
        ) : (
          <div ref={osmContainerRef} className="w-full h-full z-10" />
        )}

        {/* Map Legend Overlay with small red dot conventions */}
        <div className="absolute bottom-4 left-4 z-20 bg-slate-900/95 border border-slate-800 backdrop-blur-md p-3.5 rounded-xl shadow-2xl text-xs space-y-2 pointer-events-auto max-w-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Map Pothole Visual Conventions
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-3 h-3 rounded-full bg-rose-500 border border-white shadow-sm shadow-rose-950 shrink-0" />
              <span className="text-slate-200 font-medium">
                Small Red Dot: Confirmed Unresolved Pothole
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-3 h-3 rounded-full bg-amber-400 border border-slate-900 shrink-0" />
              <span className="text-slate-300">
                Amber Dot: Awaiting Verification / Unconfirmed
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="w-3 h-3 rounded-full bg-emerald-400 border border-white shrink-0" />
              <span className="text-slate-300">
                Green Dot: Repaired &amp; Verified (In History)
              </span>
            </div>
          </div>

          <div className="pt-1 border-t border-slate-800 text-[10px] text-slate-400 leading-tight">
            When a repair is verified, its red dot is automatically removed from the active map.
          </div>
        </div>

        {/* Empty state overlay when zero geocoded reports exist */}
        {geocodedReports.length === 0 && (
          <div className="absolute inset-0 z-20 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-cyan-400">
              <MapPin className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">
              No Geolocated Reports Recorded Yet
            </h3>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              When analyzing road photography, click "Detect My Location" or pick a confirmed location on the map. Every report with confirmed coordinates appears automatically as a small red dot.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={onNavigateToDetection}
                className="px-3.5 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Analyze New Road Photo</span>
              </button>
              <button
                type="button"
                onClick={onSeedSamples}
                className="px-3.5 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Load Illustrative Samples</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Bar */}
      <div className="text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2 px-1">
        <span>
          Map: {mapEngine === 'google' ? 'Google Maps JavaScript API' : 'OpenStreetMap'} &middot; Active filter: <strong className="text-slate-300 uppercase">{displayFilter}</strong> &middot; Real-time automatic updates on status change.
        </span>
        <span className="font-mono text-slate-400">
          Showing {displayedReports.length} of {geocodedReports.length} geocoded records
        </span>
      </div>

      {/* Duplicate Review & Merge Modal */}
      {showDuplicateReviewModal && selectedDuplicateCluster && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl bg-[#0F172A] border border-amber-500/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-300">
                <Users className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Review & Link Nearby Duplicate Reports</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDuplicateReviewModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Multiple citizen reports have been detected within 80 meters on the same road section. Linking duplicates ensures that when the physical pothole is marked as "Repaired and Verified", all associated duplicate submissions are synchronized consistently, removing ghost red dots from the map without deleting records.
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {selectedDuplicateCluster.map((rep, idx) => (
                <div
                  key={rep.id}
                  className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs space-y-1 flex items-start justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-cyan-400">{rep.id}</span>
                      <span className="text-[10px] text-slate-400">
                        ({new Date(rep.createdAt).toLocaleDateString()})
                      </span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-300 border border-cyan-800 text-[10px] rounded">
                          Primary
                        </span>
                      )}
                    </div>
                    <p className="text-slate-200 mt-0.5">{rep.roadName || 'Unnamed segment'}</p>
                    <p className="text-slate-400 text-[11px]">{rep.userNotes || 'No notes provided'}</p>
                  </div>
                  <span className="text-[11px] font-mono text-amber-300 px-2 py-0.5 bg-amber-950/60 rounded border border-amber-800/40">
                    {normalizeReportStatus(rep.status)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDuplicateReviewModal(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleMergeDuplicates(
                    selectedDuplicateCluster[0].id,
                    selectedDuplicateCluster.slice(1).map((r) => r.id)
                  )
                }
                className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-lg transition-colors shadow-sm"
              >
                Link Duplicates &amp; Synchronize Lifecycle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
