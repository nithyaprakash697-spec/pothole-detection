export type DamagePriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type ReportLifecycleStatus =
  | 'Reported'
  | 'Awaiting Inspection'
  | 'Inspection Completed'
  | 'Repair Recommended'
  | 'Repair in Progress'
  | 'Repair Completed — Awaiting Verification'
  | 'Repaired and Verified';

// Backward compatible with existing stored records ('New', 'Under Review', 'Resolved')
export type ReportStatus =
  | ReportLifecycleStatus
  | 'New'
  | 'Under Review'
  | 'Resolved';

export type UserSeverity = 'Minor' | 'Moderate' | 'Severe' | 'Critical';
export type PreliminarySeverity = 'Low' | 'Moderate' | 'Medium' | 'High' | 'Critical' | 'Needs Review';
export type SeveritySource = 'ai_assisted' | 'user_selected' | 'human_verified';
export type LocationSource = 'device_gps' | 'map_pin' | 'manual';
export type MediaType = 'image' | 'video';

export type InspectionUrgency =
  | 'Immediate (<24h)'
  | 'Urgent (<48h)'
  | 'Within 7 Days'
  | 'Routine Monitoring'
  | 'Needs Review';

export interface AddressDetails {
  formattedAddress?: string;
  road?: string;
  locality?: string;
  district?: string;
  city?: string;
  state?: string;
  postalCode?: string;
}

export interface ModelDetection {
  className: string;
  confidence: number;
  bbox?: [number, number, number, number]; // [ymin, xmin, ymax, xmax] or [x, y, w, h]
}

export interface IndividualModelResult {
  modelId: string;
  modelName: string;
  status: 'Available' | 'Unavailable' | 'Not configured' | 'Checking' | 'success' | 'failed' | 'zero_detections';
  annotatedImageUrl?: string;
  detections?: ModelDetection[];
  detectionCount: number;
  potholeCount?: number | null;
  isCountUnavailable?: boolean;
  countUnavailableReason?: string;
  classesDetected: string[];
  confidenceScores: number[];
  timingMs?: number;
  rawResponse?: unknown;
  errorMessage?: string;
}

export interface PracticalRepairRecommendation {
  detectedDamageCategories: string[];
  preliminarySeverity: PreliminarySeverity;
  recommendedAction: string;
  inspectionUrgency: InspectionUrgency;
  urgencyReasons: string[];
  suggestedRepairApproach: string;
  onSiteInspectionRequired: boolean;
  humanVerificationStatus: string;
  disclaimer: string;
}

export interface DetectedDamageCategoryItem {
  category: string;
  count: number | null;
  countUnavailable?: boolean;
  note?: string;
}

export interface RoadConditionReport {
  overallCondition: string;
  detectedDamageTypes: DetectedDamageCategoryItem[];
  detectionConfidence: number;
  severityLevel: PreliminarySeverity;
  severityReasoning: string[];
  recommendedAction: string;
  repairPriority: DamagePriority;
  priorityExplanation: string;
  originalImageUrl?: string;
  annotatedImageUrl?: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    roadName?: string;
    isConfirmed: boolean;
  };
  analysisTimestamp: string;
  limitations: string;
  physicalInspectionRecommended: boolean;
}

export interface DamageReport {
  id: string;
  createdAt: string; // ISO string
  updatedAt?: string;
  roadName?: string;
  addressDetails?: AddressDetails;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy?: number | null; // meters
  locationSource: LocationSource;
  isLocationConfirmed?: boolean;
  userNotes: string;
  mediaType: MediaType;
  originalImagePreview?: string;
  annotatedImageUrl?: string;
  annotatedVideoUrl?: string;
  confidenceThreshold: number;
  status: ReportStatus;
  priority: DamagePriority;
  userSeverity: UserSeverity;
  preliminarySeverity: PreliminarySeverity;
  severitySource: SeveritySource;
  severityReasons: string[];
  recommendedAction: string;
  humanVerified: boolean;
  source: 'ai_detection' | 'manual_inspection';
  priorityRationale?: string[];
  model1Result?: IndividualModelResult;
  model2Result?: IndividualModelResult;
  activeReferenceResult?: IndividualModelResult;
  potholeCount?: number | null;
  isCountUnavailable?: boolean;
  countUnavailableReason?: string;
  modelDisagreement?: boolean;
  modelDisagreementNote?: string;
  isSample?: boolean;

  // Practical Road Repair Recommendations & Lifecycle Tracking
  damageCategories?: string[];
  inspectionUrgency?: InspectionUrgency;
  urgencyReasons?: string[];
  suggestedRepairApproach?: string;
  onSiteInspectionRequired?: boolean;
  
  // Detailed road-condition report & overall assessment
  overallCondition?: string;
  roadConditionReport?: RoadConditionReport;

  // Real-world Lifecycle & Verification Documentation
  inspectionNotes?: string;
  inspectedDate?: string;
  repairNotes?: string;
  repairDate?: string;
  responsiblePersonnel?: string;
  beforeRepairPhoto?: string;
  afterRepairPhoto?: string;
  verificationEvidence?: string;
  verifiedDate?: string;
  linkedDuplicateIds?: string[];
}

export interface VideoKeyframeDetection {
  timestampSec: number;
  timestampFormatted: string;
  originalFrameUrl: string;
  annotatedFrameUrl: string;
  hasPothole: boolean;
  confidence: number;
  potholeCount?: number | null;
  boundingBox?: [number, number, number, number];
  defectAreaRatio?: number;
}

export interface DetectionResult {
  annotatedMediaUrl: string;
  rawResponse: unknown;
  confidenceUsed: number;
  analyzedAt: string;
  mediaType: MediaType;
  hasDetectedObjects?: boolean;
  metadataNote?: string;
  potholeCount?: number | null;
  isCountUnavailable?: boolean;
  countUnavailableReason?: string;
  // AI Results
  model1Result?: IndividualModelResult;
  model2Result?: IndividualModelResult;
  activeReferenceResult?: IndividualModelResult;
  modelDisagreement?: boolean;
  modelDisagreementNote?: string;
  preliminarySeverity?: PreliminarySeverity;
  severityReasons?: string[];
  recommendedAction?: string;
  roadConditionReport?: RoadConditionReport;
  // Video Analysis Enhancements
  keyframes?: VideoKeyframeDetection[];
  videoDurationSec?: number;
  analysisMode?: 'direct_remote_stream' | 'keyframe_sampler_fallback';
}

export interface ServiceHealthStatus {
  checked: boolean;
  isOnline: boolean;
  stage?: string;
  latencyMs?: number;
  lastCheckedAt?: string;
  errorMessage?: string;
  model1Status?: {
    status: 'Available' | 'Unavailable' | 'Checking';
    endpoint: string;
    message?: string;
  };
  model2Status?: {
    status: 'Available' | 'Unavailable' | 'Not configured' | 'Checking';
    endpoint?: string;
    message?: string;
  };
}

export type ActivePage =
  | 'overview'
  | 'detection'
  | 'live'
  | 'video'
  | 'map'
  | 'reports'
  | 'priorities'
  | 'about';

export interface LiveMonitoringSnapshot {
  id: string;
  sessionId: string;
  timestamp: string;
  originalSnapshotUrl: string;
  annotatedSnapshotUrl?: string;
  hasStructuredDetection: boolean;
  potholesDetected: number;
  confidence?: number;
  className?: string;
  boundingBoxes?: Array<[number, number, number, number]>; // [ymin, xmin, ymax, xmax] normalized 0..1
  detectionEvidenceNote: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    roadName?: string;
    label: string; // explicitly 'Device GPS (Approximate observation location)'
  };
  isDeviceGpsOnly: boolean;
  cooldownElapsedMs?: number;
}

export interface LiveRoadConditionAssessment {
  overallCondition: string;
  severity: PreliminarySeverity;
  evidence: string[];
  observedDamageSummary: string;
  recommendedActions: string[];
  limitations: string[];
}

export interface LiveMonitoringSession {
  sessionId: string;
  startTime: string;
  endTime?: string;
  durationSeconds: number;
  status: 'active' | 'completed' | 'interrupted' | 'error';
  cameraSource: 'webcam' | 'dashcam_feed' | 'custom_file';
  confidenceThreshold: number;
  cooldownPeriodSeconds: number;
  verificationEngine: 'hf_space_only' | 'dual_engine';
  totalFramesAnalyzed: number;
  totalSuccessfulInferences: number;
  totalFailedInferences: number;
  totalValidDetectionEvents: number;
  totalSnapshotsCaptured: number;
  snapshots: LiveMonitoringSnapshot[];
  errorsEncountered: Array<{ timestamp: string; message: string }>;
  roadConditionAssessment?: LiveRoadConditionAssessment;
  isStructuredDataAvailable: boolean;
  structuredDataNote: string;
  completionReason?: 'user_stopped' | 'camera_disconnected' | 'stream_ended' | 'error';
}
