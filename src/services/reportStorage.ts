import { DamageReport, ReportStatus } from '../types';

const STORAGE_KEY = 'roadguard_damage_reports_v1';

// In-memory cache for session blob / data URLs so full quality is preserved in the active tab
const sessionBlobCache = new Map<string, string>();

export function setSessionImage(reportId: string, fullUrl: string) {
  sessionBlobCache.set(reportId, fullUrl);
}

export function getSessionImage(reportId: string): string | undefined {
  return sessionBlobCache.get(reportId);
}

/**
 * Sanitizes report payload for localStorage to strictly prevent QuotaExceededError.
 * Remote URLs (e.g. Hugging Face links) are lightweight strings and kept as-is.
 * Unbounded large base64 strings are truncated or discarded for long-term local storage.
 */
function sanitizeForStorage(report: DamageReport): DamageReport {
  let safeOriginalPreview = report.originalImagePreview;

  if (safeOriginalPreview && safeOriginalPreview.startsWith('data:') && safeOriginalPreview.length > 50000) {
    // If oversized data URL, store reference in session cache and keep lightweight metadata
    setSessionImage(report.id, safeOriginalPreview);
    safeOriginalPreview = undefined; // Don't bloat localStorage
  }

  return {
    ...report,
    originalImagePreview: safeOriginalPreview,
  };
}

export function getStoredReports(): DamageReport[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: DamageReport[] = JSON.parse(raw);
    
    // Re-attach in-memory session previews if available
    return parsed.map((item) => {
      const sessionImg = sessionBlobCache.get(item.id);
      if (sessionImg && !item.originalImagePreview) {
        return { ...item, originalImagePreview: sessionImg };
      }
      return item;
    });
  } catch (error) {
    console.warn('Failed to read reports from localStorage:', error);
    return [];
  }
}

export function saveReportToStorage(report: DamageReport): void {
  try {
    const current = getStoredReports();
    const sanitized = sanitizeForStorage(report);
    const existingIndex = current.findIndex((r) => r.id === report.id);

    let updated: DamageReport[];
    if (existingIndex >= 0) {
      updated = [...current];
      updated[existingIndex] = sanitized;
    } else {
      updated = [sanitized, ...current];
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to save report to localStorage:', error);
    throw new Error('Storage quota exceeded or browser storage unavailable. Report could not be saved locally.');
  }
}

export interface ReportStatusUpdatePayload {
  status: ReportStatus;
  inspectionNotes?: string;
  inspectedDate?: string;
  repairNotes?: string;
  repairDate?: string;
  responsiblePersonnel?: string;
  afterRepairPhoto?: string;
  verificationEvidence?: string;
  verifiedDate?: string;
  humanVerified?: boolean;
}

export function updateStoredReportStatus(
  id: string,
  updateOrStatus: ReportStatus | ReportStatusUpdatePayload
): DamageReport[] {
  const current = getStoredReports();
  const payload: ReportStatusUpdatePayload =
    typeof updateOrStatus === 'string' ? { status: updateOrStatus } : updateOrStatus;

  const targetReport = current.find((r) => r.id === id);
  const isResolving = payload.status === 'Repaired and Verified' || payload.status === 'Resolved';
  const linkedIds = new Set(targetReport?.linkedDuplicateIds || []);

  const updated = current.map((r) => {
    if (r.id === id) {
      return {
        ...r,
        status: payload.status,
        updatedAt: new Date().toISOString(),
        ...(payload.inspectionNotes !== undefined && { inspectionNotes: payload.inspectionNotes }),
        ...(payload.inspectedDate !== undefined && { inspectedDate: payload.inspectedDate }),
        ...(payload.repairNotes !== undefined && { repairNotes: payload.repairNotes }),
        ...(payload.repairDate !== undefined && { repairDate: payload.repairDate }),
        ...(payload.responsiblePersonnel !== undefined && { responsiblePersonnel: payload.responsiblePersonnel }),
        ...(payload.afterRepairPhoto !== undefined && { afterRepairPhoto: payload.afterRepairPhoto }),
        ...(payload.verificationEvidence !== undefined && { verificationEvidence: payload.verificationEvidence }),
        ...(payload.verifiedDate !== undefined && { verifiedDate: payload.verifiedDate }),
        ...(payload.humanVerified !== undefined && { humanVerified: payload.humanVerified }),
        ...(isResolving && !r.verifiedDate && { verifiedDate: new Date().toISOString(), humanVerified: true }),
      };
    }

    // Synchronize linked duplicate reports if this report is verified repaired
    if (isResolving && linkedIds.has(r.id)) {
      return {
        ...r,
        status: payload.status,
        updatedAt: new Date().toISOString(),
        verifiedDate: payload.verifiedDate || new Date().toISOString(),
        humanVerified: true,
        repairNotes: r.repairNotes || `Resolved in conjunction with primary physical duplicate report ${id}.`,
      };
    }

    return r;
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update report status in storage:', error);
  }
  return updated;
}

export function linkDuplicateReports(primaryId: string, duplicateIds: string[]): DamageReport[] {
  const current = getStoredReports();
  const allIds = [primaryId, ...duplicateIds];

  const updated = current.map((r) => {
    if (allIds.includes(r.id)) {
      const otherIds = allIds.filter((oid) => oid !== r.id);
      const combined = Array.from(new Set([...(r.linkedDuplicateIds || []), ...otherIds]));
      return {
        ...r,
        linkedDuplicateIds: combined,
        updatedAt: new Date().toISOString(),
      };
    }
    return r;
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to link duplicate reports in storage:', error);
  }
  return updated;
}

export function deleteStoredReport(id: string): DamageReport[] {
  const current = getStoredReports();
  const updated = current.filter((r) => r.id !== id);
  sessionBlobCache.delete(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to delete report from storage:', error);
  }
  return updated;
}

export function clearAllStoredReports(): void {
  sessionBlobCache.clear();
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Provides 3 explicitly labelled illustrative sample reports with real geographic coordinates
 * so users can test the Map and Repair Priority Queue immediately without needing to upload 3 images first.
 */
export function getIllustrativeSamples(): DamageReport[] {
  return [
    {
      id: 'SAMPLE-RPT-001',
      createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
      roadName: 'Main Blvd & 4th Avenue (Northbound)',
      addressDetails: {
        formattedAddress: 'Main Blvd & 4th Avenue, San Francisco, CA 94103',
        road: 'Main Blvd',
        locality: 'San Francisco',
        district: 'SoMa',
        city: 'San Francisco',
        state: 'CA',
      },
      latitude: 37.7749,
      longitude: -122.4194,
      locationAccuracy: 12,
      locationSource: 'device_gps',
      isLocationConfirmed: true,
      userNotes: 'Large depression near bus stop lane. Causes severe vehicle vibration.',
      mediaType: 'image',
      confidenceThreshold: 0.35,
      status: 'Awaiting Inspection',
      priority: 'Critical',
      userSeverity: 'Critical',
      preliminarySeverity: 'Critical',
      severitySource: 'ai_assisted',
      severityReasons: [
        'Multiple pothole cavity clusters flagged across detection models',
        'Direct vehicle wheel path impact depression',
      ],
      recommendedAction: 'Deploy temporary warning cones and dispatch asphalt hot-mix patch crew within 24 hours.',
      damageCategories: ['Pothole Cavity (D40)', 'Alligator Cracking (D20)'],
      inspectionUrgency: 'Immediate (<24h)',
      urgencyReasons: [
        'Critical surface breach poses acute vehicle tire blowout, rim damage, or cyclist hazard.',
        'High-precision GPS coordinates confirmed, enabling direct emergency maintenance routing.',
      ],
      suggestedRepairApproach:
        'Immediate temporary safety barricading/traffic cones, followed by localized full-depth asphalt saw-cut, compaction of aggregate base, and hot-mix asphalt infill.',
      onSiteInspectionRequired: true,
      humanVerified: false,
      source: 'ai_detection',
      isSample: true,
      priorityRationale: [
        'Visual severity assessed as Critical (+55 pts)',
        'Exact GPS coordinates recorded (+15 pts)',
        'Pending dispatch for over 48 hours (+6 pts)',
      ],
      model1Result: {
        modelId: 'model1',
        modelName: 'Model 1: Candidate Pothole API',
        status: 'Unavailable',
        detectionCount: 0,
        classesDetected: [],
        confidenceScores: [],
      },
      model2Result: {
        modelId: 'model2',
        modelName: 'Model 2: Multi-Class RDD',
        status: 'Unavailable',
        detectionCount: 0,
        classesDetected: [],
        confidenceScores: [],
      },
    },
    {
      id: 'SAMPLE-RPT-002',
      createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
      roadName: 'Industrial Parkway / Gate 2',
      addressDetails: {
        formattedAddress: 'Industrial Parkway, San Francisco, CA 94107',
        road: 'Industrial Parkway',
        locality: 'San Francisco',
        district: 'Potrero Hill',
        city: 'San Francisco',
        state: 'CA',
      },
      latitude: 37.7833,
      longitude: -122.4167,
      locationAccuracy: 18,
      locationSource: 'map_pin',
      isLocationConfirmed: true,
      userNotes: 'Asphalt surface pothole with edge cracking along shoulder.',
      mediaType: 'image',
      confidenceThreshold: 0.25,
      status: 'Repair in Progress',
      priority: 'High',
      userSeverity: 'Severe',
      preliminarySeverity: 'High',
      severitySource: 'ai_assisted',
      severityReasons: [
        'Visible asphalt pothole cavity verified by computer vision model',
        'Shoulder edge degradation flagged',
      ],
      recommendedAction: 'Schedule field inspection triage and compaction fill within 48 hours.',
      damageCategories: ['Pothole Cavity (D40)'],
      inspectionUrgency: 'Urgent (<48h)',
      urgencyReasons: [
        'Severe roadway depression identified in active carriageway wheel path.',
        'Open ticket unaddressed for over 7 days.',
      ],
      suggestedRepairApproach:
        'Localized asphalt cold-patch or hot-mix compaction assessment by district road crew to prevent crater expansion.',
      onSiteInspectionRequired: true,
      humanVerified: true,
      inspectionNotes: 'Field inspection confirmed 6cm cavity. Road crew dispatched for cold compaction patch.',
      responsiblePersonnel: 'District Highway Crew #3',
      source: 'ai_detection',
      isSample: true,
      priorityRationale: [
        'Visual severity assessed as Severe (+40 pts)',
        'Exact GPS coordinates recorded (+15 pts)',
        'Pending dispatch for over 7 days (+12 pts)',
      ],
    },
    {
      id: 'SAMPLE-RPT-003',
      createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
      roadName: 'Oak Ridge Residential Way #12',
      addressDetails: {
        formattedAddress: 'Oak Ridge Way, San Francisco, CA 94114',
        road: 'Oak Ridge Way',
        locality: 'San Francisco',
        district: 'Castro',
        city: 'San Francisco',
        state: 'CA',
      },
      latitude: 37.765,
      longitude: -122.428,
      locationAccuracy: 8,
      locationSource: 'device_gps',
      isLocationConfirmed: true,
      userNotes: 'Shallow cavity near storm drain grate.',
      mediaType: 'image',
      confidenceThreshold: 0.25,
      status: 'Repaired and Verified',
      priority: 'Medium',
      userSeverity: 'Moderate',
      preliminarySeverity: 'Medium',
      severitySource: 'user_selected',
      severityReasons: [
        'Minor localized surface cavity observed near drainage grate',
        'No structural base subsidence detected',
      ],
      recommendedAction: 'Log for scheduled routine municipal crack sealing maintenance cycle.',
      damageCategories: ['Pothole Cavity (D40)', 'Transverse Crack (D10)'],
      inspectionUrgency: 'Within 7 Days',
      urgencyReasons: ['Moderate pavement defect detected; ongoing traffic impact may accelerate sub-base erosion.'],
      suggestedRepairApproach: 'Bituminous crack sealing and shallow localized asphalt patch around drain perimeter.',
      onSiteInspectionRequired: true,
      humanVerified: true,
      repairNotes: 'Completed asphalt infill and compaction around drain perimeter. Roadway level confirmed.',
      responsiblePersonnel: 'Municipal Asphalt Team A',
      repairDate: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      verifiedDate: new Date(Date.now() - 2 * 86400000).toISOString(),
      verificationEvidence: 'Inspector physical audit confirmed zero surface depression and smooth compaction.',
      source: 'ai_detection',
      isSample: true,
      priorityRationale: [
        'Visual severity assessed as Moderate (+25 pts)',
        'Exact GPS coordinates recorded (+15 pts)',
        'Verified completed in municipal log',
      ],
    },
  ];
}
