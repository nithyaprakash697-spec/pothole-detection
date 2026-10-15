import { DamagePriority, UserSeverity } from '../types';

export interface HeuristicBreakdown {
  priority: DamagePriority;
  score: number; // 0 to 100
  factors: string[];
  disclaimer: string;
}

/**
 * Calculates a preliminary inspection priority heuristic based strictly on observable, user-provided,
 * and operational factors.
 * 
 * NOTE: This is a triage dispatch aid to assist workflow organization, NOT an automated structural
 * engineering certification or geotechnical safety assessment.
 */
export function calculateInspectionPriority(params: {
  severity: UserSeverity;
  hasCoordinates: boolean;
  hasRoadName: boolean;
  createdAt: string; // ISO string
  isResolved?: boolean;
}): HeuristicBreakdown {
  const factors: string[] = [];
  let score = 0;

  // Base score from user-assessed visual severity
  switch (params.severity) {
    case 'Critical':
      score += 55;
      factors.push('Visual severity assessed as Critical (+55 pts)');
      break;
    case 'Severe':
      score += 40;
      factors.push('Visual severity assessed as Severe (+40 pts)');
      break;
    case 'Moderate':
      score += 25;
      factors.push('Visual severity assessed as Moderate (+25 pts)');
      break;
    case 'Minor':
      score += 10;
      factors.push('Visual severity assessed as Minor (+10 pts)');
      break;
  }

  // Location actionable factor
  if (params.hasCoordinates) {
    score += 15;
    factors.push('Exact GPS coordinates recorded for immediate physical routing (+15 pts)');
  } else if (params.hasRoadName) {
    score += 8;
    factors.push('Street name/reference landmark provided (+8 pts)');
  } else {
    factors.push('No location coordinates attached (-0 pts, dispatch requires field follow-up)');
  }

  // Age factor: older open reports accumulate urgency
  if (!params.isResolved) {
    const createdDate = new Date(params.createdAt);
    const ageDays = Math.max(0, (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

    if (ageDays > 14) {
      score += 20;
      factors.push(`Pending dispatch for over 14 days (+20 pts)`);
    } else if (ageDays > 7) {
      score += 12;
      factors.push(`Pending dispatch for over 7 days (+12 pts)`);
    } else if (ageDays > 2) {
      score += 6;
      factors.push(`Pending dispatch for over 48 hours (+6 pts)`);
    } else {
      score += 2;
      factors.push('Recently submitted (<48 hrs) (+2 pts)');
    }
  }

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  let priority: DamagePriority = 'Low';
  if (score >= 75) {
    priority = 'Critical';
  } else if (score >= 50) {
    priority = 'High';
  } else if (score >= 30) {
    priority = 'Medium';
  } else {
    priority = 'Low';
  }

  return {
    priority,
    score,
    factors,
    disclaimer:
      'Preliminary heuristic score designed to help prioritize municipal inspection dispatch. Physical on-site assessment by qualified road engineers is required.',
  };
}
