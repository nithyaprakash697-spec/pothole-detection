import { LiveMonitoringSession, LiveMonitoringSnapshot, LiveRoadConditionAssessment } from '../types';

const COMPLETED_SESSIONS_STORAGE_KEY = 'roadguard_monitoring_sessions_v1';
const ACTIVE_SESSION_STORAGE_KEY = 'roadguard_active_monitoring_session';

// In-memory cache for live snapshot data URLs so full quality is preserved during the active browser session
const liveSnapshotImageCache = new Map<string, string>();

export function cacheLiveSnapshotImage(snapshotId: string, dataUrl: string) {
  liveSnapshotImageCache.set(snapshotId, dataUrl);
}

export function getCachedLiveSnapshotImage(snapshotId: string): string | undefined {
  return liveSnapshotImageCache.get(snapshotId);
}

/**
 * Sanitizes snapshot objects for localStorage to prevent quota exhaustion.
 */
function sanitizeSessionForStorage(session: LiveMonitoringSession): LiveMonitoringSession {
  const sanitizedSnapshots: LiveMonitoringSnapshot[] = session.snapshots.map((snap) => {
    let original = snap.originalSnapshotUrl;
    if (original && original.startsWith('data:') && original.length > 50000) {
      cacheLiveSnapshotImage(snap.id, original);
      // Keep a lightweight thumbnail or placeholder in local storage
      original = original.slice(0, 500) + '...[cached_in_memory]';
    }
    return {
      ...snap,
      originalSnapshotUrl: original,
    };
  });

  return {
    ...session,
    snapshots: sanitizedSnapshots,
  };
}

/**
 * Persists current in-flight monitoring session state to survive reloads or disconnects
 */
export function saveActiveSession(session: LiveMonitoringSession): void {
  try {
    const sanitized = sanitizeSessionForStorage(session);
    localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('Unable to persist active monitoring session:', err);
  }
}

/**
 * Retrieves the last interrupted active session if any
 */
export function getActiveSession(): LiveMonitoringSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Retrieves all finalized monitoring sessions
 */
export function getStoredMonitoringSessions(): LiveMonitoringSession[] {
  try {
    const raw = localStorage.getItem(COMPLETED_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const list: LiveMonitoringSession[] = JSON.parse(raw);
    return list.map((session) => ({
      ...session,
      snapshots: session.snapshots.map((snap) => {
        const cached = getCachedLiveSnapshotImage(snap.id);
        if (cached && snap.originalSnapshotUrl.includes('...[cached_in_memory]')) {
          return { ...snap, originalSnapshotUrl: cached };
        }
        return snap;
      }),
    }));
  } catch (err) {
    console.warn('Failed to load monitoring sessions:', err);
    return [];
  }
}

/**
 * Saves a completed session to history
 */
export function saveCompletedSession(session: LiveMonitoringSession): void {
  try {
    const current = getStoredMonitoringSessions();
    const sanitized = sanitizeSessionForStorage(session);
    const existingIdx = current.findIndex((s) => s.sessionId === session.sessionId);
    let updated: LiveMonitoringSession[];

    if (existingIdx >= 0) {
      updated = [...current];
      updated[existingIdx] = sanitized;
    } else {
      updated = [sanitized, ...current].slice(0, 25); // preserve up to 25 latest sessions
    }

    localStorage.setItem(COMPLETED_SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    clearActiveSession();
  } catch (err) {
    console.error('Failed to save completed monitoring session:', err);
  }
}

export function deleteMonitoringSession(sessionId: string): LiveMonitoringSession[] {
  try {
    const current = getStoredMonitoringSessions();
    const filtered = current.filter((s) => s.sessionId !== sessionId);
    localStorage.setItem(COMPLETED_SESSIONS_STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch {
    return [];
  }
}

/**
 * Generates an evidence-grounded road condition assessment strictly from actual session observations
 */
export function calculateSessionAssessment(session: LiveMonitoringSession): LiveRoadConditionAssessment {
  const { snapshots, totalValidDetectionEvents, isStructuredDataAvailable, totalFramesAnalyzed, totalFailedInferences } = session;
  const evidence: string[] = [];
  const recommendedActions: string[] = [];
  const limitations: string[] = [
    'Assessment is based on 2D visual optical data captured during mobile or static camera monitoring.',
    'Pothole cavity depth, subsurface void formation, and base layer moisture remain unmeasured and require physical sounding.',
    'GPS coordinates reflect mobile monitoring device position at detection trigger, not exact geodetic defect center.',
  ];

  if (!isStructuredDataAvailable) {
    limitations.push(
      'Hugging Face Space (Sahildandotiya/pothole-detector) outputs annotated overlay images without structured bounding-box prediction arrays; exact numerical defect counts could not be verified by API payload.'
    );
  }

  // Case 1: No valid detection events during monitoring session
  if (totalValidDetectionEvents === 0) {
    evidence.push(
      `Zero affirmative pothole breach events recorded across ${totalFramesAnalyzed} analyzed road camera frames.`
    );
    if (totalFailedInferences > 0) {
      evidence.push(
        `${totalFailedInferences} frame inference requests timed out or encountered remote network latency.`
      );
    }
    recommendedActions.push(
      'Continue routine scheduled surveillance. Road segment demonstrated no active crater emergencies during passage.'
    );

    return {
      overallCondition: 'Satisfactory — No Surface Breaches Detected',
      severity: totalFailedInferences > 3 ? 'Needs Review' : 'Low',
      evidence,
      observedDamageSummary: '0 confirmed pothole events observed during the monitoring duration.',
      recommendedActions,
      limitations,
    };
  }

  // Case 2: Potholes detected during monitoring
  evidence.push(
    `${totalValidDetectionEvents} confirmed pothole detection trigger event(s) captured during session across ${totalFramesAnalyzed} frames.`
  );
  evidence.push(
    `${snapshots.length} automated high-resolution snapshot(s) archived with device telemetry.`
  );

  // Check confidence metrics if available
  const confidences = snapshots
    .map((s) => s.confidence)
    .filter((c): c is number => typeof c === 'number' && !isNaN(c));

  if (confidences.length > 0) {
    const avgConf = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    evidence.push(`Average detection confidence score: ${Math.round(avgConf * 100)}%.`);
  }

  // Severity assignment based on verified defect count and clustering
  if (totalValidDetectionEvents >= 4) {
    recommendedActions.push(
      'Urgent: Dispatch municipal road inspection crew within 24 hours to conduct physical cavity depth measurement.'
    );
    recommendedActions.push(
      'Deploy temporary reflective road warning markers or speed reduction signs to protect vehicle wheel assemblies.'
    );
    recommendedActions.push(
      'Prepare emergency cold-patch bituminous infill pending permanent hot-mix asphalt resurfacing.'
    );

    return {
      overallCondition: 'Critical — Clustered Pavement Cavities Identified',
      severity: 'Critical',
      evidence,
      observedDamageSummary: `${totalValidDetectionEvents} confirmed pothole events (${snapshots.length} snapshots). High defect concentration indicates deteriorating roadway course.`,
      recommendedActions,
      limitations,
    };
  }

  if (totalValidDetectionEvents >= 2) {
    recommendedActions.push(
      'Priority: Schedule localized physical pavement inspection and maintenance review within 48 to 72 hours.'
    );
    recommendedActions.push(
      'Evaluate crack sealing and localized hot-pour patching to prevent moisture infiltration during rainfall.'
    );

    return {
      overallCondition: 'Poor — Multiple Surface Defects Detected',
      severity: 'High',
      evidence,
      observedDamageSummary: `${totalValidDetectionEvents} confirmed pothole events (${snapshots.length} snapshots). Multiple roadway hazards present.`,
      recommendedActions,
      limitations,
    };
  }

  // 1 single valid pothole detection
  recommendedActions.push(
    'Schedule routine district maintenance crew for localized asphalt infill within 7 days.'
  );
  recommendedActions.push(
    'Log GPS coordinates in municipal road asset registry for scheduled condition follow-up.'
  );

  return {
    overallCondition: 'Moderate Wear — Isolated Pothole Cavity Detected',
    severity: 'Moderate',
    evidence,
    observedDamageSummary: `1 confirmed pothole defect event (${snapshots.length} snapshot recorded). Isolated defect in active carriageway.`,
    recommendedActions,
    limitations,
  };
}
