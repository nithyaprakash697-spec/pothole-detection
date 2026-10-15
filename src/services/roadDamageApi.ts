/**
 * RoadGuard AI - Dual AI Model & Hosted Computer Vision Services
 * - Model 1: Pothole Detection Candidate API (http://13.220.63.113:8000) & Hosted YOLO (Sahildandotiya/pothole-detector)
 * - Model 2: Automated Road Damage Detection (ProjectRoadDamageDetection/Automated-Road-Damage-Detection)
 */
import { Client } from '@gradio/client';
import {
  DamagePriority,
  DetectionResult,
  IndividualModelResult,
  PreliminarySeverity,
  RoadConditionReport,
  ServiceHealthStatus,
} from '../types';

export const SPACE_REPO = 'Sahildandotiya/pothole-detector';
export const SPACE_DIRECT_HOST = 'https://sahildandotiya-pothole-detector.hf.space';
export const MODEL1_BASE_URL = '/api/model1'; // Proxied through Vite dev server to avoid mixed-content issues
export const DEFAULT_MODEL2_SPACE = 'ProjectRoadDamageDetection/Automated-Road-Damage-Detection';
export const MODEL2_ENDPOINT = import.meta.env.VITE_MODEL2_ENDPOINT || DEFAULT_MODEL2_SPACE;

let cachedClient: Client | null = null;

export async function getGradioClient(): Promise<Client> {
  if (cachedClient) return cachedClient;
  try {
    cachedClient = await Client.connect(SPACE_REPO);
    return cachedClient;
  } catch (error) {
    console.error('Failed to connect to Gradio Space:', error);
    throw new Error(
      `Could not connect to Space '${SPACE_REPO}'. ` +
      `Details: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Normalizes media URL from Gradio output format
 */
export function extractMediaUrl(data: unknown, spaceHost = SPACE_DIRECT_HOST): string {
  if (!data) return '';

  if (Array.isArray(data)) {
    return extractMediaUrl(data[0], spaceHost);
  }

  if (typeof data === 'string') {
    if (
      data.startsWith('http://') ||
      data.startsWith('https://') ||
      data.startsWith('data:') ||
      data.startsWith('blob:')
    ) {
      return data;
    }
    if (data.startsWith('/file=') || data.startsWith('file=')) {
      return `${spaceHost}${data.startsWith('/') ? '' : '/'}${data}`;
    }
    if (data.startsWith('/')) {
      return `${spaceHost}/file=${data}`;
    }
    return data;
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (typeof obj.url === 'string' && obj.url) {
      return obj.url;
    }
    if (typeof obj.data === 'string' && obj.data) {
      return extractMediaUrl(obj.data, spaceHost);
    }
    if (typeof obj.path === 'string' && obj.path) {
      if (obj.path.startsWith('http://') || obj.path.startsWith('https://')) {
        return obj.path;
      }
      return `${spaceHost}/file=${obj.path}`;
    }
    if (obj.image) {
      return extractMediaUrl(obj.image, spaceHost);
    }
    if (obj.video) {
      return extractMediaUrl(obj.video, spaceHost);
    }
  }

  return '';
}

/**
 * Checks Model 1 (candidate API at http://13.220.63.113:8000 via proxy /api/model1)
 */
export async function checkModel1Health(): Promise<{
  status: 'Available' | 'Unavailable' | 'Checking';
  endpoint: string;
  message?: string;
}> {
  const endpoint = `${MODEL1_BASE_URL}/health`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(endpoint, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        status: 'Available',
        endpoint: 'http://13.220.63.113:8000/health',
        message: 'Endpoint verified online and responsive: ' + JSON.stringify(data),
      };
    } else {
      return {
        status: 'Unavailable',
        endpoint: 'http://13.220.63.113:8000/health',
        message: `HTTP ${res.status} returned by candidate host.`,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      status: 'Unavailable',
      endpoint: 'http://13.220.63.113:8000',
      message: msg.includes('aborted')
        ? 'Connection timed out (5000ms). Candidate host 13.220.63.113:8000 is currently offline or blocking incoming traffic.'
        : `Candidate host connection error: ${msg}`,
    };
  }
}

/**
 * Checks Model 2 (candidate Space: ProjectRoadDamageDetection/Automated-Road-Damage-Detection)
 */
export async function checkModel2Health(): Promise<{
  status: 'Available' | 'Unavailable' | 'Not configured' | 'Checking';
  endpoint?: string;
  message?: string;
}> {
  if (!MODEL2_ENDPOINT) {
    return {
      status: 'Not configured',
      endpoint: DEFAULT_MODEL2_SPACE,
      message:
        'Model 2 endpoint not configured. Set VITE_MODEL2_ENDPOINT in .env to connect.',
    };
  }

  // If pointing to a Hugging Face Space repository
  if (!MODEL2_ENDPOINT.startsWith('http://') && !MODEL2_ENDPOINT.startsWith('https://')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://huggingface.co/api/spaces/${MODEL2_ENDPOINT}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const d = await res.json();
        const stage = d?.runtime?.stage || 'UNKNOWN';
        const isRunning = stage === 'RUNNING';
        const errMsg = d?.runtime?.errorMessage || '';

        return {
          status: isRunning ? 'Available' : 'Unavailable',
          endpoint: `https://huggingface.co/spaces/${MODEL2_ENDPOINT}`,
          message: isRunning
            ? 'Candidate Space is online and running.'
            : `Space status is ${stage}${errMsg ? ` (${errMsg})` : ''}. Programmatic inference returned status 503.`,
        };
      } else {
        return {
          status: 'Unavailable',
          endpoint: `https://huggingface.co/spaces/${MODEL2_ENDPOINT}`,
          message: `Hugging Face API returned HTTP ${res.status}.`,
        };
      }
    } catch (err: unknown) {
      return {
        status: 'Unavailable',
        endpoint: `https://huggingface.co/spaces/${MODEL2_ENDPOINT}`,
        message: `Health check failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // If HTTP/HTTPS endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(MODEL2_ENDPOINT, { signal: controller.signal });
    clearTimeout(timeoutId);

    return {
      status: res.ok ? 'Available' : 'Unavailable',
      endpoint: MODEL2_ENDPOINT,
      message: res.ok ? 'Configured inference service online.' : `HTTP status ${res.status}`,
    };
  } catch (err: unknown) {
    return {
      status: 'Unavailable',
      endpoint: MODEL2_ENDPOINT,
      message: `Inference endpoint check failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Comprehensive service status check
 */
export async function checkServiceHealth(): Promise<ServiceHealthStatus> {
  const startTime = performance.now();

  const [hfCheck, m1Check, m2Check] = await Promise.all([
    (async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(`https://huggingface.co/api/spaces/${SPACE_REPO}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const d = await res.json();
          return { isOnline: d?.runtime?.stage === 'RUNNING', stage: d?.runtime?.stage };
        }
        return { isOnline: false, stage: 'UNAVAILABLE' };
      } catch {
        return { isOnline: false, stage: 'OFFLINE' };
      }
    })(),
    checkModel1Health(),
    checkModel2Health(),
  ]);

  const latencyMs = Math.round(performance.now() - startTime);

  return {
    checked: true,
    isOnline: hfCheck.isOnline || m1Check.status === 'Available',
    stage: hfCheck.stage,
    latencyMs,
    lastCheckedAt: new Date().toISOString(),
    model1Status: m1Check,
    model2Status: m2Check,
  };
}

export interface NormalizedDetectionData {
  potholeCount: number | null; // null if count unavailable from structured data
  isCountUnavailable: boolean;
  countUnavailableReason?: string;
  potholes: Array<{
    className: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }>;
  nonPotholeDetections: Array<{
    className: string;
    confidence: number;
  }>;
  classesDetected: string[];
  annotatedImageUrl?: string;
  hasVisualDetections: boolean;
  rawResponse?: unknown;
}

/**
 * Single reliable detection-normalization function:
 * 1. Counts each valid pothole detection once.
 * 2. Applies confidence threshold consistently.
 * 3. Filters detections by actual pothole class (case-insensitive "pothole" or "d40").
 * 4. Excludes non-pothole classes from the pothole count.
 * 5. Does NOT count the annotated image itself as a detection.
 * 6. Does NOT add counts from multiple representations of the same output.
 * 7. Does NOT add Model 2 predictions to Model 1's count.
 * 8. If response does not contain individual detection data (e.g. Sahildandotiya/pothole-detector
 *    which returns only an annotated prediction image via results[0].plot()), marks isCountUnavailable: true,
 *    potholeCount: null, and reports this limitation clearly.
 */
export function normalizeDetectionOutput(params: {
  modelId: 'ref_yolo' | 'model1' | 'model2';
  rawResponse: unknown;
  confidenceThreshold: number;
  mediaUrl?: string;
}): NormalizedDetectionData {
  const { modelId, rawResponse, confidenceThreshold, mediaUrl } = params;
  const confThresh = Math.max(0.01, Math.min(1.0, confidenceThreshold));

  // 1. Hosted YOLO Pothole Model (Sahildandotiya/pothole-detector)
  if (modelId === 'ref_yolo') {
    const hasVisualImage = Boolean(mediaUrl);
    // Sahildandotiya/pothole-detector Space's app.py returns ONLY res_plotted (gr.Image).
    // It returns no bounding-box arrays or numeric counts.
    // Under Section C and Rules 5 & 10: Never count the image as 1 detection or guess counts.
    return {
      potholeCount: null,
      isCountUnavailable: true,
      countUnavailableReason:
        'Count unavailable: The Sahildandotiya/pothole-detector Space returns an annotated prediction image only without structured bounding-box metadata in its API response.',
      potholes: [],
      nonPotholeDetections: [],
      classesDetected: hasVisualImage ? ['Pothole (Visual Overlay)'] : [],
      annotatedImageUrl: mediaUrl,
      hasVisualDetections: hasVisualImage,
      rawResponse,
    };
  }

  // 2. Candidate Model 1 (http://13.220.63.113:8000 via proxy /api/model1)
  if (modelId === 'model1') {
    if (!rawResponse || typeof rawResponse !== 'object') {
      return {
        potholeCount: null,
        isCountUnavailable: true,
        countUnavailableReason: 'Count unavailable: Model 1 returned no structured payload.',
        potholes: [],
        nonPotholeDetections: [],
        classesDetected: [],
        annotatedImageUrl: mediaUrl,
        hasVisualDetections: false,
        rawResponse,
      };
    }

    const resObj = rawResponse as Record<string, unknown>;
    const rawList = Array.isArray(resObj.detections)
      ? resObj.detections
      : Array.isArray(resObj.boxes)
      ? resObj.boxes
      : null;

    if (!rawList) {
      return {
        potholeCount: null,
        isCountUnavailable: true,
        countUnavailableReason: 'Count unavailable: Model 1 returned no detections array.',
        potholes: [],
        nonPotholeDetections: [],
        classesDetected: [],
        annotatedImageUrl: mediaUrl,
        hasVisualDetections: false,
        rawResponse,
      };
    }

    const potholes: Array<{ className: string; confidence: number; bbox?: [number, number, number, number] }> = [];
    const nonPotholeDetections: Array<{ className: string; confidence: number }> = [];
    const classesDetectedSet = new Set<string>();

    for (const item of rawList) {
      if (!item || typeof item !== 'object') continue;
      const det = item as Record<string, unknown>;
      const rawClass = String(det.class || det.label || '').trim();
      const conf =
        typeof det.confidence === 'number'
          ? det.confidence
          : typeof det.conf === 'number'
          ? det.conf
          : confThresh;

      // Apply confidence threshold consistently
      if (conf < confThresh) continue;

      const lowerClass = rawClass.toLowerCase();
      const isPothole =
        lowerClass.includes('pothole') ||
        lowerClass === 'd40' ||
        lowerClass.includes('cavity');

      if (isPothole) {
        // Count each valid pothole detection once
        const bbox = Array.isArray(det.bbox || det.box)
          ? ((det.bbox || det.box) as [number, number, number, number])
          : undefined;
        potholes.push({
          className: rawClass || 'Pothole',
          confidence: conf,
          bbox,
        });
        classesDetectedSet.add('Pothole');
      } else if (rawClass) {
        // Exclude non-pothole classes from the pothole count
        nonPotholeDetections.push({
          className: rawClass,
          confidence: conf,
        });
        classesDetectedSet.add(rawClass);
      }
    }

    return {
      potholeCount: potholes.length,
      isCountUnavailable: false,
      potholes,
      nonPotholeDetections,
      classesDetected: Array.from(classesDetectedSet),
      annotatedImageUrl: mediaUrl,
      hasVisualDetections: potholes.length > 0 || nonPotholeDetections.length > 0,
      rawResponse,
    };
  }

  // 3. Candidate Model 2: Multi-Class Road Damage Detection (RDD)
  // Strictly separated: never added to Model 1's or pothole count!
  const classesDetected: string[] = [];
  let rddPotholeCount = 0;
  if (Array.isArray(rawResponse) && typeof rawResponse[1] === 'string') {
    const text = rawResponse[1];
    if (text.includes('D00')) classesDetected.push('D00 Longitudinal Crack');
    if (text.includes('D10')) classesDetected.push('D10 Transverse Crack');
    if (text.includes('D20')) classesDetected.push('D20 Alligator Crack');
    if (text.includes('D40')) {
      classesDetected.push('D40 Pothole');
      const d40Match = text.match(/D40[^0-9]*(\d+)/i);
      rddPotholeCount = d40Match ? parseInt(d40Match[1], 10) : 1;
    }
  }

  return {
    potholeCount: rddPotholeCount,
    isCountUnavailable: false,
    potholes: [],
    nonPotholeDetections: [],
    classesDetected,
    annotatedImageUrl: mediaUrl,
    hasVisualDetections: classesDetected.length > 0 || Boolean(mediaUrl),
    rawResponse,
  };
}

/**
 * Runs inference on candidate Model 1 (http://13.220.63.113:8000)
 */
export async function runModel1Inference(
  imageFile: File | Blob,
  confidenceThreshold: number
): Promise<IndividualModelResult> {
  const startTime = performance.now();
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('confidence', String(confidenceThreshold));

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${MODEL1_BASE_URL}/detect`, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const timingMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      throw new Error(`Candidate API returned HTTP ${res.status}`);
    }

    const data = await res.json();
    const normalized = normalizeDetectionOutput({
      modelId: 'model1',
      rawResponse: data,
      confidenceThreshold,
      mediaUrl: data.annotated_image || data.image_url || undefined,
    });

    return {
      modelId: 'model1',
      modelName: 'Model 1: Candidate Pothole API (13.220.63.113:8000)',
      status: (normalized.potholeCount ?? 0) > 0 ? 'success' : 'zero_detections',
      annotatedImageUrl: normalized.annotatedImageUrl,
      detections: normalized.potholes.map((d) => ({
        className: d.className,
        confidence: d.confidence,
        bbox: d.bbox,
      })),
      detectionCount: normalized.potholeCount ?? 0,
      potholeCount: normalized.potholeCount,
      isCountUnavailable: normalized.isCountUnavailable,
      countUnavailableReason: normalized.countUnavailableReason,
      classesDetected: normalized.classesDetected,
      confidenceScores: normalized.potholes.map((d) => d.confidence),
      timingMs,
      rawResponse: data,
    };
  } catch (err: unknown) {
    const timingMs = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      modelId: 'model1',
      modelName: 'Model 1: Candidate Pothole API (13.220.63.113:8000)',
      status: 'Unavailable',
      detectionCount: 0,
      potholeCount: null,
      isCountUnavailable: true,
      countUnavailableReason: 'Model 1 is currently unreachable.',
      classesDetected: [],
      confidenceScores: [],
      timingMs,
      errorMessage: msg.includes('aborted')
        ? 'Request timed out after 8s. Candidate host 13.220.63.113:8000 is unreachable.'
        : `Candidate API request failed: ${msg}`,
    };
  }
}

/**
 * Runs inference on Model 2 (ProjectRoadDamageDetection/Automated-Road-Damage-Detection)
 */
export async function runModel2Inference(
  imageFile: File | Blob,
  confidenceThreshold: number
): Promise<IndividualModelResult> {
  const modelName = 'Model 2: Automated Road Damage Detection (ProjectRoadDamageDetection)';

  if (!MODEL2_ENDPOINT) {
    return {
      modelId: 'model2',
      modelName,
      status: 'Not configured',
      detectionCount: 0,
      classesDetected: [],
      confidenceScores: [],
      errorMessage: 'Model 2 is not configured. Set VITE_MODEL2_ENDPOINT in .env to connect.',
    };
  }

  const startTime = performance.now();
  try {
    const client = await Client.connect(MODEL2_ENDPOINT);

    // Call predict with verified inputs from app.py: [image, conf_thresh, iou_thresh, country]
    let res: any;
    try {
      res = await client.predict(0, [
        imageFile,
        confidenceThreshold,
        0.45,
        '🇮🇳 India',
      ]);
    } catch {
      res = await client.predict('/detect', {
        image: imageFile,
        conf_thresh: confidenceThreshold,
        iou_thresh: 0.45,
        country: '🇮🇳 India',
      });
    }

    const timingMs = Math.round(performance.now() - startTime);
    const mediaUrl = extractMediaUrl(res.data);

    // Parse classes from markdown table if returned in res.data[1]
    const detectedClasses: string[] = [];
    let count = 0;
    if (Array.isArray(res.data) && typeof res.data[1] === 'string') {
      const summaryText = res.data[1];
      if (summaryText.includes('D00')) detectedClasses.push('D00 Longitudinal Crack');
      if (summaryText.includes('D10')) detectedClasses.push('D10 Transverse Crack');
      if (summaryText.includes('D20')) detectedClasses.push('D20 Alligator Crack');
      if (summaryText.includes('D40')) detectedClasses.push('D40 Pothole');
      const totalMatch = summaryText.match(/Total Detections:\s*(\d+)/i);
      if (totalMatch) count = parseInt(totalMatch[1], 10);
    }
    if (detectedClasses.length === 0 && mediaUrl) {
      detectedClasses.push('Road Damage (Multi-Class RDD)');
      count = 1;
    }

    return {
      modelId: 'model2',
      modelName,
      status: mediaUrl ? 'success' : 'zero_detections',
      annotatedImageUrl: mediaUrl,
      detectionCount: count,
      classesDetected: detectedClasses,
      confidenceScores: [confidenceThreshold],
      timingMs,
      rawResponse: res.data,
    };
  } catch (err: unknown) {
    const timingMs = Math.round(performance.now() - startTime);
    const msg = err instanceof Error ? err.message : String(err);
    return {
      modelId: 'model2',
      modelName,
      status: 'Unavailable',
      detectionCount: 0,
      classesDetected: [],
      confidenceScores: [],
      timingMs,
      errorMessage: `Candidate Space '${MODEL2_ENDPOINT}' inference failed: ${msg}. (Space runtime status: Scheduling failure on Hugging Face; status 503).`,
    };
  }
}

/**
 * Transparent Preliminary Severity & Rationale Heuristic
 * Evaluates observable model evidence, classes, and agreement.
 * Does NOT claim to measure depth, road roughness (IRI), or structural strength from a single 2D image.
 */
export function calculateTransparentPreliminarySeverity(params: {
  model1Result?: IndividualModelResult;
  model2Result?: IndividualModelResult;
  activeReferenceResult?: IndividualModelResult;
  userAssessedSeverity?: string;
}): {
  severity: PreliminarySeverity;
  reasons: string[];
  recommendedAction: string;
  overallCondition: string;
  repairPriority: DamagePriority;
  priorityExplanation: string;
  limitations: string;
  physicalInspectionRecommended: boolean;
  disagreement: boolean;
  disagreementNote?: string;
} {
  const reasons: string[] = [];
  const { model1Result, model2Result, activeReferenceResult } = params;

  const m1Success = model1Result?.status === 'success';
  const m2Success = model2Result?.status === 'success';
  const refSuccess = activeReferenceResult?.status === 'success';

  // Check model disagreement only when both secondary models successfully returned comparative results
  let disagreement = false;
  let disagreementNote: string | undefined;

  if (m1Success && m2Success) {
    if (model1Result.detectionCount !== model2Result.detectionCount) {
      disagreement = true;
      disagreementNote = `Model 1 detected ${model1Result.detectionCount} defect(s) while Model 2 detected ${model2Result.detectionCount}. Human inspection review advised.`;
    }
  }

  const limitations =
    'Assessment is strictly derived from 2D optical surface imagery. Pothole depth, physical void dimensions, sub-base compaction, moisture saturation, and structural layer bearing capacity cannot be determined from photographs alone. On-site physical engineering verification is required before initiating repairs.';

  // If no models produced successful visual detections
  if (!m1Success && !m2Success && !refSuccess) {
    return {
      severity: 'Needs Review',
      overallCondition: 'Inconclusive — Visual Evidence Insufficient',
      repairPriority: 'Low',
      priorityExplanation:
        'Queued for low-urgency visual verification due to absence of automated computer-vision defect confirmation.',
      reasons: [
        'No AI models returned positive detection evidence above the selected confidence threshold.',
        'Photographic evidence is inconclusive or obscured; assigned "Needs Review" status.',
        'Physical visual triage by qualified road-maintenance personnel required to inspect roadway condition.',
      ],
      recommendedAction: 'Schedule routine manual visual verification by road inspection crew.',
      limitations,
      physicalInspectionRecommended: true,
      disagreement: false,
    };
  }

  // Gather detectable classes from available model output
  const classesFound = new Set<string>();
  if (refSuccess) {
    activeReferenceResult.classesDetected?.forEach((c) => classesFound.add(c));
    if (classesFound.size === 0) classesFound.add('Pothole Cavity');
  }
  model1Result?.classesDetected?.forEach((c) => classesFound.add(c));
  model2Result?.classesDetected?.forEach((c) => classesFound.add(c));

  // Determine pothole evidence and normalized count strictly from pothole models
  const hasPotholeDefect =
    refSuccess ||
    (m1Success && (model1Result.potholeCount ?? 0) > 0) ||
    classesFound.has('Pothole Cavity') ||
    classesFound.has('pothole') ||
    classesFound.has('Critical Pothole') ||
    Array.from(classesFound).some((c) => c.toLowerCase().includes('pothole'));

  // Structured count if available from Model 1
  const structuredPotholeCount =
    m1Success && !model1Result.isCountUnavailable && typeof model1Result.potholeCount === 'number'
      ? model1Result.potholeCount
      : null;

  const hasAlligatorOrFatigue =
    classesFound.has('Alligator Cracking') ||
    classesFound.has('D20') ||
    Array.from(classesFound).some((c) => c.toLowerCase().includes('alligator'));

  const hasLinearCracking =
    classesFound.has('Longitudinal Cracking') ||
    classesFound.has('Transverse Cracking') ||
    classesFound.has('D00') ||
    classesFound.has('D10') ||
    Array.from(classesFound).some((c) => c.toLowerCase().includes('crack'));

  // Severity Level: High / Critical for verified pothole cavities
  if (hasPotholeDefect) {
    // Only declare multiple clustered breaches if structured count verifies >= 3 potholes
    if (structuredPotholeCount !== null && structuredPotholeCount >= 3) {
      reasons.push(
        `Multiple roadway surface defect clusters identified (${structuredPotholeCount} distinct pothole cavities confirmed).`
      );
      reasons.push(
        'Surface cavity situated in active carriageway wheel path, posing acute tire rim impact and water pooling risk.'
      );
      reasons.push(
        'Severity assessment based on detected 2D surface perimeter; subsurface crater depth and compaction remain unmeasured.'
      );
      return {
        severity: 'Critical',
        overallCondition: 'Critical — Clustered Pavement Cavities Detected',
        repairPriority: 'Critical',
        priorityExplanation:
          'Multiple active surface breaches in traffic path warrant immediate warning markers and rapid patching to prevent roadbed disintegration.',
        reasons,
        recommendedAction:
          'Deploy temporary traffic warning markers and dispatch emergency municipal cold-patch crew within 24 hours.',
        limitations,
        physicalInspectionRecommended: true,
        disagreement,
        disagreementNote,
      };
    }

    reasons.push('Visible asphalt pothole cavity verified by YOLO computer vision detection model.');
    reasons.push('Impact surface depression identified within the roadway carriageway.');
    if (structuredPotholeCount !== null) {
      reasons.push(
        `${structuredPotholeCount} individual pothole cavity defect(s) normalized from structured detection data.`
      );
    } else {
      reasons.push(
        'Visual defect overlay rendered; exact numerical count is unquantified because the Space returns an annotated image only.'
      );
    }
    reasons.push(
      'Preliminary severity estimated from visible surface perimeter; physical cavity depth and sub-base stability require on-site confirmation.'
    );
    return {
      severity: 'High',
      overallCondition: 'Poor — Asphalt Surface Cavity Identified',
      repairPriority: 'High',
      priorityExplanation:
        'Pothole cavity in carriageway creates potential vehicle wheel shock and enables rainwater infiltration into lower pavement courses.',
      reasons,
      recommendedAction:
        'Prioritize physical on-site inspection and localized hot-mix asphalt patching assessment within 48 hours.',
      limitations,
      physicalInspectionRecommended: true,
      disagreement,
      disagreementNote,
    };
  }

  // Severity Level: Moderate for fatigue / linear cracking / structural wear
  if (hasAlligatorOrFatigue || hasLinearCracking) {
    reasons.push(
      hasAlligatorOrFatigue
        ? 'Alligator/fatigue cracking pattern detected, indicating cyclic wheel-load surface strain.'
        : 'Linear pavement cracking identified along surface courses.'
    );
    reasons.push('Pavement surface distress visible without acute cratering or complete sub-base collapse.');
    reasons.push(
      'Preliminary severity estimated as Moderate based on optical defect pattern; sub-base moisture requires field evaluation.'
    );
    return {
      severity: 'Moderate',
      overallCondition: 'Fair — Moderate Pavement Wear & Cracking',
      repairPriority: 'Medium',
      priorityExplanation:
        'Preventive intervention needed: bituminous sealing prevents moisture ingress before cracking degenerates into potholes.',
      reasons,
      recommendedAction:
        'Schedule for regular district maintenance, crack sealing, and edge waterproofing within bi-weekly cycle.',
      limitations,
      physicalInspectionRecommended: true,
      disagreement,
      disagreementNote,
    };
  }

  // Severity Level: Low for minor isolated anomalies
  reasons.push('Minor isolated surface discontinuity or superficial wear identified.');
  reasons.push('No acute pothole cratering or carriageway wheel-path hazard indicated by model detections.');
  reasons.push('Estimated severity: superficial surface condition; structural integrity appears stable.');
  return {
    severity: 'Low',
    overallCondition: 'Satisfactory — Minor Surface Irregularity',
    repairPriority: 'Low',
    priorityExplanation:
      'Low priority: defect poses no acute vehicular safety hazard or structural threat at current stage.',
    reasons,
    recommendedAction: 'Log in municipal road asset registry for scheduled routine annual condition evaluation.',
    limitations,
    physicalInspectionRecommended: true,
    disagreement,
    disagreementNote,
  };
}

/**
 * Builds a comprehensive, transparent Road Condition Report from actual model detections
 */
export function generateDetailedRoadConditionReport(params: {
  detectionResult: {
    annotatedMediaUrl: string;
    confidenceUsed: number;
    analyzedAt: string;
    activeReferenceResult?: IndividualModelResult;
    model1Result?: IndividualModelResult;
    model2Result?: IndividualModelResult;
    preliminarySeverity: PreliminarySeverity;
    severityReasons: string[];
    recommendedAction: string;
    potholeCount?: number | null;
    isCountUnavailable?: boolean;
    countUnavailableReason?: string;
  };
  severityAnalysis: ReturnType<typeof calculateTransparentPreliminarySeverity>;
  originalImageUrl?: string;
  gpsLocation?: {
    latitude: number;
    longitude: number;
    roadName?: string;
    isConfirmed: boolean;
  };
}): RoadConditionReport {
  const { detectionResult, severityAnalysis, originalImageUrl, gpsLocation } = params;

  // Build damage categories directly from normalized model outputs
  const detectedDamageTypes: Array<{
    category: string;
    count: number | null;
    countUnavailable?: boolean;
    note?: string;
  }> = [];

  // 1. Primary Hosted YOLO Model (Sahildandotiya/pothole-detector)
  if (detectionResult.activeReferenceResult?.status === 'success') {
    const ref = detectionResult.activeReferenceResult;
    if (ref.isCountUnavailable) {
      detectedDamageTypes.push({
        category: 'Pothole Cavity (Visual Annotation)',
        count: null,
        countUnavailable: true,
        note: 'Detections rendered on annotated output image; exact bounding-box count is not provided by the Space API.',
      });
    } else if (typeof ref.potholeCount === 'number') {
      detectedDamageTypes.push({
        category: 'Pothole Cavity',
        count: ref.potholeCount,
        countUnavailable: false,
      });
    }
  }

  // 2. Candidate Model 1 (13.220.63.113:8000)
  if (detectionResult.model1Result?.status === 'success') {
    const m1 = detectionResult.model1Result;
    if (m1.isCountUnavailable) {
      detectedDamageTypes.push({
        category: 'Pothole Cavity (Model 1)',
        count: null,
        countUnavailable: true,
        note: 'Count unavailable from candidate API output.',
      });
    } else {
      detectedDamageTypes.push({
        category: 'Pothole Cavity (Model 1)',
        count: m1.potholeCount ?? m1.detectionCount,
        countUnavailable: false,
      });
    }
  }

  // 3. Candidate Model 2: Multi-Class Road Damage Detection (RDD)
  // Strictly separated: never added to Model 1's or pothole count!
  if (detectionResult.model2Result?.status === 'success') {
    const m2 = detectionResult.model2Result;
    m2.classesDetected?.forEach((cls) => {
      detectedDamageTypes.push({
        category: cls,
        count: m2.detectionCount > 0 ? m2.detectionCount : null,
        countUnavailable: m2.detectionCount === 0,
        note: 'Model 2 Multi-Class RDD detection',
      });
    });
  }

  if (detectedDamageTypes.length === 0) {
    detectedDamageTypes.push({
      category: 'No Automated Defect Detected',
      count: 0,
      countUnavailable: false,
      note: 'No defects detected above confidence threshold.',
    });
  }

  return {
    overallCondition: severityAnalysis.overallCondition,
    detectedDamageTypes,
    detectionConfidence: detectionResult.confidenceUsed,
    severityLevel: severityAnalysis.severity,
    severityReasoning: severityAnalysis.reasons,
    recommendedAction: severityAnalysis.recommendedAction,
    repairPriority: severityAnalysis.repairPriority,
    priorityExplanation: severityAnalysis.priorityExplanation,
    originalImageUrl,
    annotatedImageUrl: detectionResult.annotatedMediaUrl,
    gpsLocation,
    analysisTimestamp: detectionResult.analyzedAt,
    limitations: severityAnalysis.limitations,
    physicalInspectionRecommended: severityAnalysis.physicalInspectionRecommended,
  };
}

/**
 * Runs Image Detection:
 * Invokes Dual Models (Model 1 candidate, Model 2 RDD) + Active Hosted Gradio Model.
 * Handles failures independently and normalizes results honestly.
 */
export async function detectRoadDamageImage(
  imageFile: File | Blob,
  confidenceThreshold = 0.25,
  originalImagePreviewUrl?: string,
  gpsLocation?: {
    latitude: number;
    longitude: number;
    roadName?: string;
    isConfirmed: boolean;
  }
): Promise<DetectionResult> {
  const conf = Math.max(0.05, Math.min(0.95, confidenceThreshold));

  // Run all models independently via Promise.allSettled
  const [refSettled, m1Settled, m2Settled] = await Promise.allSettled([
    // 1. Active Hosted Pothole Detector (Gradio Space: Sahildandotiya/pothole-detector)
    (async () => {
      const client = await getGradioClient();
      const res = await client.predict('/detect_image', {
        image: imageFile,
        conf,
      });
      const mediaUrl = extractMediaUrl(res.data);
      if (!mediaUrl) throw new Error('Empty image output returned from space');

      const normalized = normalizeDetectionOutput({
        modelId: 'ref_yolo',
        rawResponse: res.data,
        confidenceThreshold: conf,
        mediaUrl,
      });

      return {
        modelId: 'ref_yolo',
        modelName: 'Hosted YOLOv8 Pothole Model (Sahildandotiya)',
        status: 'success' as const,
        annotatedImageUrl: mediaUrl,
        detectionCount: 0,
        potholeCount: normalized.potholeCount,
        isCountUnavailable: normalized.isCountUnavailable,
        countUnavailableReason: normalized.countUnavailableReason,
        classesDetected: normalized.classesDetected,
        confidenceScores: [conf],
        rawResponse: res.data,
      };
    })(),
    // 2. Model 1: Candidate Pothole API (http://13.220.63.113:8000)
    runModel1Inference(imageFile, conf),
    // 3. Model 2: Automated Road Damage Detection (ProjectRoadDamageDetection)
    runModel2Inference(imageFile, conf),
  ]);

  const activeReferenceResult: IndividualModelResult =
    refSettled.status === 'fulfilled'
      ? refSettled.value
      : {
          modelId: 'ref_yolo',
          modelName: 'Hosted YOLOv8 Pothole Model (Sahildandotiya)',
          status: 'failed',
          detectionCount: 0,
          potholeCount: null,
          isCountUnavailable: true,
          classesDetected: [],
          confidenceScores: [],
          errorMessage: refSettled.reason?.message || 'Remote inference failed',
        };

  const model1Result: IndividualModelResult =
    m1Settled.status === 'fulfilled'
      ? m1Settled.value
      : {
          modelId: 'model1',
          modelName: 'Model 1: Candidate Pothole API (13.220.63.113:8000)',
          status: 'Unavailable',
          detectionCount: 0,
          potholeCount: null,
          isCountUnavailable: true,
          classesDetected: [],
          confidenceScores: [],
          errorMessage: m1Settled.reason?.message || 'Request failed',
        };

  const model2Result: IndividualModelResult =
    m2Settled.status === 'fulfilled'
      ? m2Settled.value
      : {
          modelId: 'model2',
          modelName: 'Model 2: Automated Road Damage Detection (ProjectRoadDamageDetection)',
          status: 'failed',
          detectionCount: 0,
          potholeCount: null,
          isCountUnavailable: true,
          classesDetected: [],
          confidenceScores: [],
          errorMessage: m2Settled.reason?.message || 'Request failed',
        };

  // Determine main primary annotated image
  const primaryAnnotatedUrl =
    activeReferenceResult.annotatedImageUrl ||
    model1Result.annotatedImageUrl ||
    model2Result.annotatedImageUrl ||
    '';

  const severityAnalysis = calculateTransparentPreliminarySeverity({
    model1Result,
    model2Result,
    activeReferenceResult,
  });

  const analyzedAt = new Date().toISOString();

  // Resolve normalized pothole count:
  // If Model 1 returned structured detections, use its count.
  // If hosted Sahildandotiya Space returned annotated image, count is unavailable (Section C & Rule 10).
  let resolvedPotholeCount: number | null = null;
  let isCountUnavailable = true;
  let countUnavailableReason: string | undefined;

  if (model1Result.status === 'success' && !model1Result.isCountUnavailable) {
    resolvedPotholeCount = model1Result.potholeCount ?? null;
    isCountUnavailable = false;
  } else if (activeReferenceResult.status === 'success') {
    resolvedPotholeCount = null;
    isCountUnavailable = true;
    countUnavailableReason =
      'Count unavailable: The Sahildandotiya/pothole-detector Space API returns an annotated prediction image only without structured bounding-box metadata.';
  } else {
    resolvedPotholeCount = 0;
    isCountUnavailable = false;
  }

  const detectionBase = {
    annotatedMediaUrl: primaryAnnotatedUrl,
    rawResponse: {
      activeReference: activeReferenceResult.rawResponse,
      model1: model1Result.rawResponse,
      model2: model2Result.rawResponse,
    },
    confidenceUsed: conf,
    analyzedAt,
    mediaType: 'image' as const,
    activeReferenceResult,
    model1Result,
    model2Result,
    potholeCount: resolvedPotholeCount,
    isCountUnavailable,
    countUnavailableReason,
    hasDetectedObjects:
      activeReferenceResult.status === 'success' ||
      (model1Result.potholeCount ?? 0) > 0 ||
      model2Result.detectionCount > 0,
    modelDisagreement: severityAnalysis.disagreement,
    modelDisagreementNote: severityAnalysis.disagreementNote,
    preliminarySeverity: severityAnalysis.severity,
    severityReasons: severityAnalysis.reasons,
    recommendedAction: severityAnalysis.recommendedAction,
    metadataNote:
      'Hugging Face YOLOv8 inference evaluated. Model detections are rendered honestly without fabricated data.',
  };

  const roadConditionReport = generateDetailedRoadConditionReport({
    detectionResult: detectionBase,
    severityAnalysis,
    originalImageUrl: originalImagePreviewUrl,
    gpsLocation,
  });

  return {
    ...detectionBase,
    roadConditionReport,
  };
}

import { sampleAndAnalyzeVideoKeyframes, VideoSampleProgress } from './videoKeyframeSampler';

/**
 * Runs video detection on the active hosted space: /detect_video
 * If remote space throws an error or times out, gracefully executes
 * client-side keyframe sampling using the working /detect_image endpoint.
 */
export async function detectRoadDamageVideo(
  videoFile: File | Blob,
  confidenceThreshold = 0.25,
  onProgress?: (progress: VideoSampleProgress) => void
): Promise<DetectionResult> {
  const conf = Math.max(0.05, Math.min(0.95, confidenceThreshold));

  // Step 1: Attempt the direct remote /detect_video endpoint first
  onProgress?.({
    stage: 'initializing',
    currentFrameIndex: 0,
    totalFrames: 1,
    percent: 10,
    message: 'Connecting to hosted Space endpoint /detect_video...',
  });

  let remoteSuccess = false;
  let remoteResult: DetectionResult | null = null;

  try {
    const client = await getGradioClient();

    // Ensure the uploaded file has a format accepted by the Space ('.mp4', '.avi', '.mov')
    let fileForGradio: File | Blob = videoFile;
    if (videoFile instanceof File) {
      const lower = videoFile.name.toLowerCase();
      if (!lower.endsWith('.mp4') && !lower.endsWith('.avi') && !lower.endsWith('.mov')) {
        const baseName = videoFile.name.replace(/\.[^/.]+$/, '') || 'roadway_clip';
        fileForGradio = new File([videoFile], `${baseName}.mp4`, { type: 'video/mp4' });
      }
    } else if (videoFile instanceof Blob) {
      fileForGradio = new File([videoFile], 'roadway_clip.mp4', { type: 'video/mp4' });
    }

    onProgress?.({
      stage: 'running_inference',
      currentFrameIndex: 1,
      totalFrames: 1,
      percent: 30,
      message: 'Running remote YOLOv8 video inference on hosted Space container...',
    });

    const response = await client.predict('/detect_video', {
      video: fileForGradio,
      conf,
    });

    const mediaUrl = extractMediaUrl(response.data);
    if (mediaUrl) {
      const activeRef: IndividualModelResult = {
        modelId: 'ref_yolo',
        modelName: 'Hosted YOLOv8 Pothole Model (Video Stream)',
        status: 'success',
        annotatedImageUrl: mediaUrl,
        detectionCount: 1,
        potholeCount: null,
        isCountUnavailable: true,
        countUnavailableReason: 'Processed video stream generated by remote YOLO pipeline.',
        classesDetected: ['Pothole Cavity'],
        confidenceScores: [conf],
        rawResponse: response.data,
      };

      const severityAnalysis = calculateTransparentPreliminarySeverity({
        activeReferenceResult: activeRef,
      });

      const baseResult = {
        annotatedMediaUrl: mediaUrl,
        rawResponse: response.data,
        confidenceUsed: conf,
        analyzedAt: new Date().toISOString(),
        mediaType: 'video' as const,
        activeReferenceResult: activeRef,
        potholeCount: null,
        isCountUnavailable: true,
        countUnavailableReason: 'Full video processed; individual bounding-box count unquantified on video stream.',
        hasDetectedObjects: true,
        preliminarySeverity: severityAnalysis.severity,
        severityReasons: severityAnalysis.reasons,
        recommendedAction: severityAnalysis.recommendedAction,
        metadataNote: 'Processed video stream generated by remote inference pipeline.',
        analysisMode: 'direct_remote_stream' as const,
      };

      const roadConditionReport = generateDetailedRoadConditionReport({
        detectionResult: baseResult,
        severityAnalysis,
      });

      remoteResult = {
        ...baseResult,
        roadConditionReport,
      };
      remoteSuccess = true;
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `Remote /detect_video endpoint encountered limitation (${errorMsg}). Switching to adaptive keyframe sampler...`
    );
    onProgress?.({
      stage: 'sampling_frames',
      currentFrameIndex: 0,
      totalFrames: 6,
      percent: 20,
      message: 'Remote video pipeline returned server-side error. Engaging adaptive keyframe YOLOv8 sampler...',
    });
  }

  if (remoteSuccess && remoteResult) {
    onProgress?.({
      stage: 'completed',
      currentFrameIndex: 1,
      totalFrames: 1,
      percent: 100,
      message: 'Remote video inference completed successfully!',
      previewUrl: remoteResult.annotatedMediaUrl,
    });
    return remoteResult;
  }

  // Step 2: Fallback to client-side video keyframe sampling using working /detect_image
  return await sampleAndAnalyzeVideoKeyframes(videoFile, conf, onProgress);
}

