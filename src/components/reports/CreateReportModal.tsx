import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  Cpu,
  FileCheck,
} from 'lucide-react';
import {
  AddressDetails,
  DamagePriority,
  DamageReport,
  DetectionResult,
  LocationSource,
  MediaType,
  PreliminarySeverity,
  SeveritySource,
  UserSeverity,
} from '../../types';
import { RoadLocationPicker } from '../location/RoadLocationPicker';
import { calculateInspectionPriority } from '../../services/priorityHeuristic';
import { getStoredReports } from '../../services/reportStorage';
import { generatePracticalRepairRecommendation } from '../../services/repairRecommendations';

interface CreateReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveReport: (report: DamageReport) => void;
  detectionResult?: DetectionResult | null;
  originalImagePreview?: string;
  mediaType?: MediaType;
  confidenceThreshold?: number;
}

export const CreateReportModal: React.FC<CreateReportModalProps> = ({
  isOpen,
  onClose,
  onSaveReport,
  detectionResult,
  originalImagePreview,
  mediaType = 'image',
  confidenceThreshold = 0.25,
}) => {
  // Location states
  const [roadName, setRoadName] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>('manual');
  const [addressDetails, setAddressDetails] = useState<AddressDetails | undefined>();

  // Notes and severity
  const [userNotes, setUserNotes] = useState('');
  const [userSeverity, setUserSeverity] = useState<UserSeverity>('Severe');
  const [preliminarySeverity, setPreliminarySeverity] = useState<PreliminarySeverity>(
    detectionResult?.preliminarySeverity || 'High'
  );
  const [severitySource, setSeveritySource] = useState<SeveritySource>(
    detectionResult?.preliminarySeverity ? 'ai_assisted' : 'user_selected'
  );
  const [humanVerified, setHumanVerified] = useState(false);

  // Existing reports for duplicate check
  const [nearbyDuplicate, setNearbyDuplicate] = useState<DamageReport | null>(null);

  useEffect(() => {
    if (detectionResult?.preliminarySeverity) {
      setPreliminarySeverity(detectionResult.preliminarySeverity);
      setSeveritySource('ai_assisted');
    }
    if (detectionResult?.roadConditionReport?.gpsLocation) {
      const loc = detectionResult.roadConditionReport.gpsLocation;
      setLatitude(loc.latitude);
      setLongitude(loc.longitude);
      if (loc.roadName) setRoadName(loc.roadName);
      setLocationSource('device_gps');
    }
  }, [detectionResult]);

  // Check for nearby reports (within 80m)
  useEffect(() => {
    if (latitude === null || longitude === null) {
      setNearbyDuplicate(null);
      return;
    }

    const all = getStoredReports();
    const R = 6371e3; // meters
    let closestReport: DamageReport | null = null;
    let closestDist = Infinity;

    for (const rep of all) {
      if (typeof rep.latitude === 'number' && typeof rep.longitude === 'number') {
        const phi1 = (latitude * Math.PI) / 180;
        const phi2 = (rep.latitude * Math.PI) / 180;
        const deltaPhi = ((rep.latitude - latitude) * Math.PI) / 180;
        const deltaLambda = ((rep.longitude - longitude) * Math.PI) / 180;

        const a =
          Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
        const dist = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));

        if (dist <= 80 && dist < closestDist) {
          closestReport = rep;
          closestDist = dist;
        }
      }
    }

    setNearbyDuplicate(closestReport);
  }, [latitude, longitude]);

  if (!isOpen) return null;

  // Preliminary heuristic calculation
  const heuristic = calculateInspectionPriority({
    severity: userSeverity,
    hasCoordinates: latitude !== null && longitude !== null,
    hasRoadName: roadName.trim().length > 0,
    createdAt: new Date().toISOString(),
  });

  const handleLocationUpdate = (data: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    source: LocationSource;
    roadName?: string;
    addressDetails?: AddressDetails;
  }) => {
    setLatitude(data.latitude);
    setLongitude(data.longitude);
    setLocationAccuracy(data.accuracy ?? null);
    setLocationSource(data.source);
    if (data.roadName) setRoadName(data.roadName);
    if (data.addressDetails) setAddressDetails(data.addressDetails);
  };

  const handleSeverityChange = (newSev: PreliminarySeverity) => {
    setPreliminarySeverity(newSev);
    setSeveritySource('user_selected');
    if (newSev === 'Critical') setUserSeverity('Critical');
    else if (newSev === 'High') setUserSeverity('Severe');
    else if (newSev === 'Medium') setUserSeverity('Moderate');
    else if (newSev === 'Low') setUserSeverity('Minor');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const uniqueId = `RPT-${Date.now().toString(36).toUpperCase()}-${Math.floor(
      100 + Math.random() * 900
    )}`;

    const repairRec = generatePracticalRepairRecommendation({
      preliminarySeverity,
      model1Result: detectionResult?.model1Result,
      model2Result: detectionResult?.model2Result,
      hasConfirmedLocation: latitude !== null && longitude !== null,
      isPhysicallyInspected: humanVerified,
      duplicateCount: nearbyDuplicate ? 1 : 0,
    });

    const newReport: DamageReport = {
      id: uniqueId,
      createdAt: new Date().toISOString(),
      roadName: roadName.trim() || undefined,
      addressDetails,
      latitude,
      longitude,
      locationAccuracy,
      locationSource,
      isLocationConfirmed: latitude !== null && longitude !== null,
      userNotes: userNotes.trim(),
      mediaType,
      originalImagePreview,
      annotatedImageUrl:
        mediaType === 'image' ? detectionResult?.annotatedMediaUrl : undefined,
      annotatedVideoUrl:
        mediaType === 'video' ? detectionResult?.annotatedMediaUrl : undefined,
      confidenceThreshold: detectionResult?.confidenceUsed ?? confidenceThreshold,
      status: 'Reported',
      priority: heuristic.priority,
      userSeverity,
      preliminarySeverity,
      severitySource,
      severityReasons: detectionResult?.severityReasons || [
        'User visual inspection assessment',
        `Physical priority score: ${heuristic.score}/100`,
      ],
      recommendedAction:
        repairRec.recommendedAction ||
        detectionResult?.recommendedAction ||
        'Schedule preliminary physical road inspection by local district dispatch team.',
      humanVerified,
      activeReferenceResult: detectionResult?.activeReferenceResult,
      model1Result: detectionResult?.model1Result,
      model2Result: detectionResult?.model2Result,
      potholeCount: detectionResult?.potholeCount,
      isCountUnavailable: detectionResult?.isCountUnavailable,
      countUnavailableReason: detectionResult?.countUnavailableReason,
      modelDisagreement: detectionResult?.modelDisagreement,
      modelDisagreementNote: detectionResult?.modelDisagreementNote,
      source: detectionResult ? 'ai_detection' : 'manual_inspection',
      priorityRationale: heuristic.factors,
      isSample: false,
      damageCategories: repairRec.detectedDamageCategories,
      inspectionUrgency: repairRec.inspectionUrgency,
      urgencyReasons: repairRec.urgencyReasons,
      suggestedRepairApproach: repairRec.suggestedRepairApproach,
      onSiteInspectionRequired: true,
      overallCondition: detectionResult?.roadConditionReport?.overallCondition,
      roadConditionReport: detectionResult?.roadConditionReport
        ? {
            ...detectionResult.roadConditionReport,
            originalImageUrl: originalImagePreview || detectionResult.roadConditionReport.originalImageUrl,
            gpsLocation:
              latitude !== null && longitude !== null
                ? {
                    latitude,
                    longitude,
                    roadName: roadName.trim() || undefined,
                    isConfirmed: true,
                  }
                : undefined,
          }
        : undefined,
    };

    onSaveReport(newReport);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 my-8 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Create Combined Road Damage Report
              </h2>
              <p className="text-xs text-slate-400">
                Automatic GPS, multi-model evidence, and transparent severity triage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Automatic Location Picker with Google Maps & OSM */}
          <RoadLocationPicker
            latitude={latitude}
            longitude={longitude}
            locationAccuracy={locationAccuracy}
            locationSource={locationSource}
            roadName={roadName}
            addressDetails={addressDetails}
            onLocationChange={handleLocationUpdate}
          />

          {/* Road Name Field (User can edit or leave auto-populated) */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Confirmed Road Segment / Landmark Name
            </label>
            <input
              type="text"
              value={roadName}
              onChange={(e) => setRoadName(e.target.value)}
              placeholder="Will auto-fill from map reverse geocoding or type here..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Duplicate Report Alert Notice */}
          {nearbyDuplicate && (
            <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-xs text-amber-300 space-y-1">
              <div className="font-semibold flex items-center gap-1.5 text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Nearby Existing Report Detected</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Report <strong className="font-mono text-white">{nearbyDuplicate.id}</strong> ({nearbyDuplicate.roadName || 'Nearby'}) is recorded within ~80 meters. Both reports will be preserved in the registry so engineers can evaluate repeat occurrences without accidental deletion.
              </p>
            </div>
          )}

          {/* Section 2: Dual AI Model Evidence Summary */}
          {detectionResult && (
            <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
                <span className="font-semibold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  <span>Dual AI Model Inference Evidence</span>
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Confidence: {Math.round(confidenceThreshold * 100)}%
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Model 1 Status */}
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Model 1: Pothole Candidate</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        detectionResult.model1Result?.status === 'success'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {detectionResult.model1Result?.status || 'Unavailable'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Host: http://13.220.63.113:8000 &middot;{' '}
                    {detectionResult.model1Result?.errorMessage ||
                      `Detections: ${detectionResult.model1Result?.detectionCount || 0}`}
                  </p>
                </div>

                {/* Model 2 Status */}
                <div className="p-2.5 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">Model 2: Multi-Class RDD</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                        detectionResult.model2Result?.status === 'success'
                          ? 'bg-emerald-950 text-emerald-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {detectionResult.model2Result?.status || 'Not configured'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">
                    Hugging Face Space: ProjectRoadDamageDetection/Automated-Road-Damage-Detection (RDD2022)
                  </p>
                </div>
              </div>

              {/* Model Disagreement Flag */}
              {detectionResult.modelDisagreement && (
                <div className="p-2 bg-amber-950/40 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{detectionResult.modelDisagreementNote}</span>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Transparent Preliminary Severity */}
          <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Preliminary Damage Severity:</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Source:{' '}
                <strong className="text-cyan-300 capitalize">{severitySource.replace('_', ' ')}</strong>
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(['Low', 'Medium', 'High', 'Critical', 'Needs Review'] as PreliminarySeverity[]).map(
                (sev) => (
                  <button
                    key={sev}
                    type="button"
                    onClick={() => handleSeverityChange(sev)}
                    className={`py-2 px-1 text-center rounded-lg text-xs font-semibold border transition-all ${
                      preliminarySeverity === sev
                        ? sev === 'Critical'
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500'
                          : sev === 'High'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                          : sev === 'Medium'
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500'
                          : sev === 'Needs Review'
                          ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    {sev}
                  </button>
                )
              )}
            </div>

            {/* Reasons breakdown */}
            {detectionResult?.severityReasons && detectionResult.severityReasons.length > 0 && (
              <div className="space-y-1 pt-1 text-[11px] text-slate-300">
                <span className="font-semibold text-slate-400">Evidence Basis:</span>
                <ul className="list-disc pl-4 space-y-0.5 text-slate-400">
                  {detectionResult.severityReasons.map((r, idx) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommended Next Action */}
            {detectionResult?.recommendedAction && (
              <div className="p-2.5 bg-slate-950/60 border border-slate-800/80 rounded-lg text-xs space-y-0.5">
                <span className="text-cyan-400 font-semibold text-[11px] uppercase tracking-wider">
                  Recommended Action:
                </span>
                <p className="text-slate-300 leading-relaxed">
                  {detectionResult.recommendedAction}
                </p>
              </div>
            )}

            {/* Human Verification Toggle */}
            <div className="pt-2 flex items-center gap-2">
              <input
                id="human-verify"
                type="checkbox"
                checked={humanVerified}
                onChange={(e) => {
                  setHumanVerified(e.target.checked);
                  if (e.target.checked) setSeveritySource('human_verified');
                }}
                className="w-4 h-4 accent-cyan-400 rounded cursor-pointer"
              />
              <label
                htmlFor="human-verify"
                className="text-xs text-slate-300 cursor-pointer select-none"
              >
                I have visually reviewed this photographic evidence and confirm the severity classification.
              </label>
            </div>
          </div>

          {/* Section 4: User Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Field Observations & Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Provide traffic lane, estimated cavity depth, water presence, or intersection landmarks..."
              className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Modal Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-md shadow-cyan-950 font-semibold"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Damage Report</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
