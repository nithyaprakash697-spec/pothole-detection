/**
 * RoadGuard AI - Practical Real-World Road Repair Recommendations & Lifecycle Engine
 * 
 * Provides actionable, evidence-grounded repair recommendations based strictly on:
 * - Actual AI model detections (e.g. D40 Pothole, D20 Alligator, D00/D10 cracks)
 * - Observable visual evidence without hallucinating subsurface compaction, depth, or IRI
 * - Confirmed GPS / map location
 * - Physical inspection & human verification status
 */
import {
  DamageReport,
  IndividualModelResult,
  InspectionUrgency,
  PracticalRepairRecommendation,
  PreliminarySeverity,
  ReportLifecycleStatus,
  ReportStatus,
} from '../types';

/**
 * Normalizes any legacy or modern report status into the 7-stage lifecycle.
 */
export function normalizeReportStatus(status: ReportStatus): ReportLifecycleStatus {
  switch (status) {
    case 'New':
      return 'Reported';
    case 'Under Review':
      return 'Awaiting Inspection';
    case 'Resolved':
      return 'Repaired and Verified';
    case 'Reported':
    case 'Awaiting Inspection':
    case 'Inspection Completed':
    case 'Repair Recommended':
    case 'Repair in Progress':
    case 'Repair Completed — Awaiting Verification':
    case 'Repaired and Verified':
      return status;
    default:
      return 'Reported';
  }
}

/**
 * Checks if a report represents an active, unresolved problem requiring a red dot on the map.
 * Repaired and verified potholes are considered resolved and removed from the active map.
 */
export function isReportUnresolved(status: ReportStatus): boolean {
  const norm = normalizeReportStatus(status);
  return norm !== 'Repaired and Verified';
}

/**
 * Determines marker category convention for map visualization:
 * - 'red': Confirmed location of an unresolved reported pothole
 * - 'amber': Awaiting confirmation (e.g. unconfirmed location or Repair Completed — Awaiting Verification)
 * - 'green': Repair completed and verified
 */
export function getReportMarkerVisual(report: {
  status: ReportStatus;
  isLocationConfirmed?: boolean;
  latitude: number | null;
  longitude: number | null;
}): 'red' | 'amber' | 'green' {
  const norm = normalizeReportStatus(report.status);

  if (norm === 'Repaired and Verified') {
    return 'green';
  }

  if (norm === 'Repair Completed — Awaiting Verification') {
    return 'amber';
  }

  if (report.isLocationConfirmed === false) {
    return 'amber';
  }

  return 'red';
}

/**
 * Generates transparent, practical repair recommendations grounded in actual model detections
 * and field observation.
 */
export function generatePracticalRepairRecommendation(params: {
  preliminarySeverity: PreliminarySeverity;
  model1Result?: IndividualModelResult;
  model2Result?: IndividualModelResult;
  activeReferenceResult?: IndividualModelResult;
  hasConfirmedLocation: boolean;
  isPhysicallyInspected?: boolean;
  duplicateCount?: number;
  reportAgeDays?: number;
}): PracticalRepairRecommendation {
  const {
    preliminarySeverity,
    model1Result,
    model2Result,
    activeReferenceResult,
    hasConfirmedLocation,
    isPhysicallyInspected = false,
    duplicateCount = 0,
    reportAgeDays = 0,
  } = params;

  // 1. Gather all genuine detected damage categories
  const categorySet = new Set<string>();

  if (activeReferenceResult?.status === 'success') {
    categorySet.add('Pothole Cavity (D40)');
  }
  model1Result?.classesDetected?.forEach((c) => {
    categorySet.add(c.toLowerCase().includes('pothole') ? 'Pothole Cavity (D40)' : c);
  });
  model2Result?.classesDetected?.forEach((c) => {
    categorySet.add(c);
  });

  const detectedDamageCategories = Array.from(categorySet);
  if (detectedDamageCategories.length === 0) {
    if (preliminarySeverity === 'Needs Review' || preliminarySeverity === 'Low') {
      detectedDamageCategories.push('Unclassified Surface Discontinuity');
    } else {
      detectedDamageCategories.push('Pothole Defect (User Reported)');
    }
  }

  const hasPothole = detectedDamageCategories.some(
    (c) => c.includes('Pothole') || c.includes('D40')
  );
  const hasAlligator = detectedDamageCategories.some(
    (c) => c.includes('Alligator') || c.includes('D20')
  );
  const hasLinearCrack = detectedDamageCategories.some(
    (c) => c.includes('Longitudinal') || c.includes('Transverse') || c.includes('D00') || c.includes('D10')
  );

  // 2. Inspection Urgency & Reasons
  let inspectionUrgency: InspectionUrgency = 'Within 7 Days';
  const urgencyReasons: string[] = [];

  if (preliminarySeverity === 'Critical') {
    inspectionUrgency = 'Immediate (<24h)';
    urgencyReasons.push('Critical surface breach poses acute vehicle tire blowout, rim damage, or cyclist hazard.');
    if (hasConfirmedLocation) {
      urgencyReasons.push('High-precision location confirmed, enabling direct emergency maintenance routing.');
    }
  } else if (preliminarySeverity === 'High') {
    inspectionUrgency = 'Urgent (<48h)';
    urgencyReasons.push('Severe roadway depression identified in active carriageway wheel path.');
    if (duplicateCount > 0) {
      urgencyReasons.push(`Multiple independent citizen notices (${duplicateCount + 1} reports) logged for this road section.`);
    }
  } else if (preliminarySeverity === 'Medium' || preliminarySeverity === 'Moderate') {
    inspectionUrgency = reportAgeDays > 14 ? 'Within 7 Days' : 'Within 7 Days';
    urgencyReasons.push('Moderate pavement defect detected; ongoing traffic impact may accelerate sub-base erosion.');
  } else if (preliminarySeverity === 'Needs Review') {
    inspectionUrgency = 'Needs Review';
    urgencyReasons.push('AI model outputs are inconclusive or zero automated detections returned.');
    urgencyReasons.push('Human visual triage required to inspect photographic evidence.');
  } else {
    inspectionUrgency = 'Routine Monitoring';
    urgencyReasons.push('Minor surface flaw; no acute structural cratering detected.');
  }

  if (reportAgeDays > 7 && inspectionUrgency !== 'Immediate (<24h)') {
    urgencyReasons.push(`Open notice unaddressed for ${Math.round(reportAgeDays)} days.`);
  }

  // 3. Suggested Repair Approach for Assessment by Qualified Personnel
  let suggestedRepairApproach = 'Routine monitoring and seasonal inspection.';
  let recommendedAction = 'Log for routine municipal inspection cycle.';

  if (preliminarySeverity === 'Critical') {
    suggestedRepairApproach =
      'Immediate temporary safety barricading/traffic cones, followed by localized full-depth asphalt saw-cut, compaction of aggregate base, and hot-mix asphalt infill.';
    recommendedAction =
      'Deploy emergency safety cones and dispatch local authority highway maintenance crew within 24 hours.';
  } else if (preliminarySeverity === 'High') {
    if (hasAlligator) {
      suggestedRepairApproach =
        'Localized pavement patching assessment: alligator cracking indicates sub-base fatigue; inspect base drainage before edge-sealing or surface infill.';
    } else {
      suggestedRepairApproach =
        'Localized asphalt cold-patch or hot-mix compaction assessment by district road crew to prevent crater expansion.';
    }
    recommendedAction =
      'Schedule field inspection triage and dispatch asphalt patching team within 48 hours.';
  } else if (preliminarySeverity === 'Medium' || preliminarySeverity === 'Moderate') {
    if (hasLinearCrack) {
      suggestedRepairApproach =
        'Preventive bituminous crack sealing and edge-joint waterproofing to prevent rainwater ingress.';
    } else {
      suggestedRepairApproach =
        'Localized shallow asphalt surface patching and shoulder alignment verification.';
    }
    recommendedAction =
      'Schedule maintenance within regular bi-weekly district road repair schedule.';
  } else if (preliminarySeverity === 'Needs Review') {
    suggestedRepairApproach =
      'Needs on-site field verification first: insufficient optical evidence to prescribe specific asphalt repair method.';
    recommendedAction =
      'Assign road inspector for manual physical visual review.';
  } else {
    suggestedRepairApproach =
      'Preventive road surface monitoring; no immediate structural intervention required.';
    recommendedAction =
      'Log into district asset database for scheduled annual road condition evaluation.';
  }

  return {
    detectedDamageCategories,
    preliminarySeverity,
    recommendedAction,
    inspectionUrgency,
    urgencyReasons,
    suggestedRepairApproach,
    onSiteInspectionRequired: true,
    humanVerificationStatus: isPhysicallyInspected
      ? 'Field Inspected by Personnel'
      : 'Pending Field Inspection',
    disclaimer:
      'AI models evaluate 2D photographic features only and cannot measure cavity depth, sub-base void compaction, or international roughness index (IRI). Suggested repair approaches must be verified on-site by certified road engineers prior to civil works.',
  };
}
