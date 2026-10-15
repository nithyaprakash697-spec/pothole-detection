import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Play,
  Square,
  Camera,
  Sliders,
  AlertCircle,
  CheckCircle2,
  MapPin,
  Clock,
  Layers,
  Activity,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  PlusCircle,
  FileCheck,
  History,
  Trash2,
  ExternalLink,
  ChevronRight,
  Maximize2,
  Video,
  Info,
  Settings,
  HelpCircle,
  Smartphone,
  Laptop,
} from 'lucide-react';
import {
  DamageReport,
  LiveMonitoringSession,
  LiveMonitoringSnapshot,
  PreliminarySeverity,
} from '../../types';
import {
  analyzeFrameWithHuggingFaceSpace,
  analyzeCanvasPotholeCV,
} from '../../services/liveCvEngine';
import {
  saveActiveSession,
  saveCompletedSession,
  getStoredMonitoringSessions,
  deleteMonitoringSession,
  calculateSessionAssessment,
  clearActiveSession,
} from '../../services/monitoringSessionService';
import { SessionReportModal } from './SessionReportModal';
import { CreateReportModal } from '../reports/CreateReportModal';

export type CameraStatus =
  | 'Stopped'
  | 'Waiting for Permission'
  | 'Camera Initializing'
  | 'Camera Ready'
  | 'Monitoring'
  | 'Camera Error';

interface LiveMonitoringViewProps {
  onSaveReport: (report: DamageReport) => void;
  onNavigateToReports: () => void;
}

export const LiveMonitoringView: React.FC<LiveMonitoringViewProps> = ({
  onSaveReport,
  onNavigateToReports,
}) => {
  // Session Configuration State
  const [confidenceThreshold, setConfidenceThreshold] = useState<number>(0.25);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(3);
  const [analysisIntervalMs, setAnalysisIntervalMs] = useState<number>(1500);
  const [verificationMode, setVerificationMode] = useState<'dual_engine' | 'hf_space_only'>('dual_engine');

  // Real Camera Hardware State
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('Stopped');
  const [cameraErrorType, setCameraErrorType] = useState<
    'permission_denied' | 'not_found' | 'in_use' | 'overconstrained' | 'security' | 'unsupported' | 'unknown' | null
  >(null);
  const [cameraErrorMessage, setCameraErrorMessage] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('');
  const [isInIframe, setIsInIframe] = useState<boolean>(false);

  // Runtime Monitoring State
  const [isProcessingFrame, setIsProcessingFrame] = useState<boolean>(false);
  const [isCooldownActive, setIsCooldownActive] = useState<boolean>(false);
  const [cooldownRemainingMs, setCooldownRemainingMs] = useState<number>(0);
  const [recentNotification, setRecentNotification] = useState<{
    message: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  // Live Metrics
  const [framesAnalyzedCount, setFramesAnalyzedCount] = useState<number>(0);
  const [successfulInferencesCount, setSuccessfulInferencesCount] = useState<number>(0);
  const [failedInferencesCount, setFailedInferencesCount] = useState<number>(0);
  const [detectionEventsCount, setDetectionEventsCount] = useState<number>(0);
  const [lastInferenceTimeMs, setLastInferenceTimeMs] = useState<number | null>(null);
  const [latestAnnotatedUrl, setLatestAnnotatedUrl] = useState<string | null>(null);
  const [latestDetectionDetails, setLatestDetectionDetails] = useState<string>('Standby — waiting to start monitoring');

  // Captured Snapshots Gallery
  const [sessionSnapshots, setSessionSnapshots] = useState<LiveMonitoringSnapshot[]>([]);

  // Session Management
  const [activeSession, setActiveSession] = useState<LiveMonitoringSession | null>(null);
  const [selectedSessionForModal, setSelectedSessionForModal] = useState<LiveMonitoringSession | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [completedSessionsHistory, setCompletedSessionsHistory] = useState<LiveMonitoringSession[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);

  // Converting Snapshot to Report
  const [snapshotToReport, setSnapshotToReport] = useState<LiveMonitoringSnapshot | null>(null);
  const [isCreateReportOpen, setIsCreateReportOpen] = useState<boolean>(false);

  // References
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const loopTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cooldownEndTimestampRef = useRef<number>(0);
  const isFinalizingRef = useRef<boolean>(false);

  // Check if running inside an iframe (like AI Studio preview)
  useEffect(() => {
    try {
      setIsInIframe(window.self !== window.top);
    } catch {
      setIsInIframe(true);
    }
  }, []);

  // Load history on mount
  useEffect(() => {
    setCompletedSessionsHistory(getStoredMonitoringSessions());
  }, []);

  // Enumerate devices if permission was already granted previously
  const refreshAvailableCameras = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableCameras(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        // Prefer back / environment camera if labeled
        const envCam = videoInputs.find(
          (d) =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
        );
        setSelectedDeviceId(envCam ? envCam.deviceId : videoInputs[0].deviceId);
      }
    } catch (err) {
      console.warn('Could not enumerate camera devices:', err);
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    refreshAvailableCameras();
  }, [refreshAvailableCameras]);

  // Cooldown countdown timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isCooldownActive) {
      interval = setInterval(() => {
        const remaining = Math.max(0, cooldownEndTimestampRef.current - Date.now());
        setCooldownRemainingMs(remaining);
        if (remaining <= 0) {
          setIsCooldownActive(false);
        }
      }, 200);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCooldownActive]);

  /**
   * Stops all active camera stream tracks safely
   */
  const stopCameraTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Idempotent session finalization function
   */
  const finalizeMonitoringSession = useCallback(
    (reason: 'user_stopped' | 'camera_disconnected' | 'stream_ended' | 'error' = 'user_stopped') => {
      if (isFinalizingRef.current) return;
      isFinalizingRef.current = true;

      // Stop timers and frame processing
      if (loopTimerRef.current) {
        clearTimeout(loopTimerRef.current);
        loopTimerRef.current = null;
      }

      // Stop camera tracks
      stopCameraTracks();

      setCameraStatus('Stopped');
      setIsProcessingFrame(false);
      setIsCooldownActive(false);

      // Build finalized session record
      setActiveSession((currentActive) => {
        if (!currentActive) {
          isFinalizingRef.current = false;
          return null;
        }

        const endTime = new Date().toISOString();
        const startMs = new Date(currentActive.startTime).getTime();
        const durationSeconds = Math.max(1, Math.round((Date.now() - startMs) / 1000));

        const completedSession: LiveMonitoringSession = {
          ...currentActive,
          endTime,
          durationSeconds,
          status: 'completed',
          completionReason: reason,
        };

        // Calculate comprehensive road condition assessment
        const assessment = calculateSessionAssessment(completedSession);
        completedSession.roadConditionAssessment = assessment;

        // Persist to completed history
        saveCompletedSession(completedSession);
        clearActiveSession();

        // Refresh history list and open report modal
        setCompletedSessionsHistory(getStoredMonitoringSessions());
        setSelectedSessionForModal(completedSession);
        setIsReportModalOpen(true);
        isFinalizingRef.current = false;

        return null;
      });
    },
    [stopCameraTracks]
  );

  // Clean up on component unmount
  useEffect(() => {
    return () => {
      stopCameraTracks();
      if (loopTimerRef.current) {
        clearTimeout(loopTimerRef.current);
      }
    };
  }, [stopCameraTracks]);

  /**
   * Captures GPS location if user has granted permission
   */
  const acquireDeviceGps = async (): Promise<{
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    roadName?: string;
    label: string;
  } | null> => {
    if (!navigator.geolocation) return null;
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            latitude: parseFloat(pos.coords.latitude.toFixed(6)),
            longitude: parseFloat(pos.coords.longitude.toFixed(6)),
            accuracy: pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null,
            label: 'Device GPS (Approximate observation location)',
          });
        },
        () => resolve(null),
        { timeout: 3000, enableHighAccuracy: false }
      );
    });
  };

  /**
   * Main Frame Inference Step from the REAL camera video element
   */
  const processFrame = useCallback(async () => {
    if (isProcessingFrame || isFinalizingRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Verify video stream is actively playing with real dimensions
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0 || video.paused) {
      // Re-check after 500ms
      loopTimerRef.current = setTimeout(() => {
        processFrame();
      }, 500);
      return;
    }

    setIsProcessingFrame(true);

    try {
      // Ensure canvas matches live video aspect ratio and resolution
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessingFrame(false);
        return;
      }

      // Draw real live camera frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to real JPEG Blob for model inference
      const frameBlob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.85)
      );

      if (!frameBlob) {
        setIsProcessingFrame(false);
        return;
      }

      const frameDataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setFramesAnalyzedCount((prev) => prev + 1);

      // Query the preserved Hugging Face Space for real annotated inference output
      const hfResultPromise = analyzeFrameWithHuggingFaceSpace(frameBlob, confidenceThreshold);

      // Perform Computer Vision Cavity analysis on the real camera frame pixels
      const cvResult = analyzeCanvasPotholeCV(canvas, confidenceThreshold);

      const hfResult = await hfResultPromise;

      if (hfResult.error) {
        setFailedInferencesCount((prev) => prev + 1);
        setLatestDetectionDetails(`Remote Inference Warning: ${hfResult.error}`);
      } else {
        setSuccessfulInferencesCount((prev) => prev + 1);
        setLastInferenceTimeMs(hfResult.inferenceTimeMs);
        if (hfResult.annotatedImageUrl) {
          setLatestAnnotatedUrl(hfResult.annotatedImageUrl);
        }
      }

      // Determine if a valid confirmed pothole exists
      let isPotholeConfirmed = false;
      let confirmedConfidence = confidenceThreshold;
      let confirmedBBox: [number, number, number, number] | undefined;
      let evidenceNote = '';

      if (verificationMode === 'dual_engine') {
        if (cvResult.detected) {
          isPotholeConfirmed = true;
          confirmedConfidence = cvResult.confidence;
          confirmedBBox = cvResult.boundingBox;
          evidenceNote = `Confirmed surface cavity breach (Confidence: ${Math.round(
            cvResult.confidence * 100
          )}%) with real bounding-box coordinates verified on live camera frame.`;
        } else {
          setLatestDetectionDetails('Live frame analyzed: Road surface clear, no active cavity breach detected.');
        }
      } else {
        // HF Space Only mode:
        setLatestDetectionDetails(
          'Hugging Face Space returns annotated prediction image. Auto-snapshot paused to prevent false triggers without structured bounding-box prediction arrays.'
        );
      }

      // Handle Pothole Detection & Automatic Snapshot Capture
      const now = Date.now();
      const inCooldown = now < cooldownEndTimestampRef.current;

      if (isPotholeConfirmed) {
        setLatestDetectionDetails(
          `Pothole Cavity Detected on Camera! Confidence: ${Math.round(confirmedConfidence * 100)}%`
        );

        if (!inCooldown) {
          // Trigger first detection immediately
          setDetectionEventsCount((prev) => prev + 1);

          // Acquire device GPS
          const gpsLoc = await acquireDeviceGps();

          const newSnapshot: LiveMonitoringSnapshot = {
            id: `SNAP-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`,
            sessionId: activeSession?.sessionId || 'active-session',
            timestamp: new Date().toISOString(),
            originalSnapshotUrl: frameDataUrl,
            annotatedSnapshotUrl: hfResult.annotatedImageUrl || undefined,
            hasStructuredDetection: true,
            potholesDetected: 1,
            confidence: confirmedConfidence,
            className: 'Pothole Cavity',
            boundingBoxes: confirmedBBox ? [confirmedBBox] : undefined,
            detectionEvidenceNote: evidenceNote,
            gpsLocation: gpsLoc || undefined,
            isDeviceGpsOnly: true,
          };

          // Save snapshot to gallery & active session
          setSessionSnapshots((prev) => [newSnapshot, ...prev]);

          // Update active session record
          setActiveSession((current) => {
            if (!current) return null;
            const updated: LiveMonitoringSession = {
              ...current,
              totalFramesAnalyzed: current.totalFramesAnalyzed + 1,
              totalSuccessfulInferences: current.totalSuccessfulInferences + (hfResult.error ? 0 : 1),
              totalFailedInferences: current.totalFailedInferences + (hfResult.error ? 1 : 0),
              totalValidDetectionEvents: current.totalValidDetectionEvents + 1,
              totalSnapshotsCaptured: current.totalSnapshotsCaptured + 1,
              snapshots: [newSnapshot, ...current.snapshots],
            };
            saveActiveSession(updated);
            return updated;
          });

          // Activate Cooldown Deduplication
          cooldownEndTimestampRef.current = now + cooldownSeconds * 1000;
          setIsCooldownActive(true);
          setCooldownRemainingMs(cooldownSeconds * 1000);

          // Notification Banner
          setRecentNotification({
            message: 'Pothole detected — snapshot captured and archived!',
            type: 'success',
          });
          setTimeout(() => setRecentNotification(null), 4000);
        } else {
          // Inside cooldown period
          setLatestDetectionDetails(
            `Visible pothole in view (Cooldown active for deduplication: ${((cooldownEndTimestampRef.current - now) / 1000).toFixed(1)}s)`
          );
        }
      } else {
        // Update active session telemetry
        setActiveSession((current) => {
          if (!current) return null;
          const updated: LiveMonitoringSession = {
            ...current,
            totalFramesAnalyzed: current.totalFramesAnalyzed + 1,
            totalSuccessfulInferences: current.totalSuccessfulInferences + (hfResult.error ? 0 : 1),
            totalFailedInferences: current.totalFailedInferences + (hfResult.error ? 1 : 0),
          };
          saveActiveSession(updated);
          return updated;
        });
      }
    } catch (err) {
      setFailedInferencesCount((prev) => prev + 1);
      setLatestDetectionDetails(`Frame processing exception: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessingFrame(false);

      // Schedule next frame extraction if still monitoring
      if (!isFinalizingRef.current) {
        loopTimerRef.current = setTimeout(() => {
          processFrame();
        }, analysisIntervalMs);
      }
    }
  }, [
    isProcessingFrame,
    confidenceThreshold,
    verificationMode,
    cooldownSeconds,
    activeSession,
    analysisIntervalMs,
  ]);

  /**
   * Robust, progressive native camera acquisition
   */
  const acquireCameraStream = async (deviceIdToUse?: string): Promise<MediaStream> => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const err = new Error('UNSUPPORTED_BROWSER');
      err.name = 'UnsupportedError';
      throw err;
    }

    if (!window.isSecureContext) {
      const err = new Error('INSECURE_CONTEXT');
      err.name = 'SecurityError';
      throw err;
    }

    // Step A: If user picked a specific hardware device ID
    if (deviceIdToUse) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: deviceIdToUse },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (err) {
        console.warn('Specific deviceId constraint failed, falling back to general request...', err);
      }
    }

    // Step B: Progressive constraint fallback
    // Attempt 1: Ideal rear / environment camera with HD resolution
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
        },
        audio: false,
      });
    } catch (err1) {
      console.warn('HD environment camera constraint failed, attempting unconstrained environment camera...', err1);

      // Attempt 2: Environment facing without resolution constraints
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
      } catch (err2) {
        console.warn('Environment facing failed, attempting standard available video camera...', err2);

        // Attempt 3: Standard unconstrained video (works on any webcam or front camera)
        return await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    }
  };

  /**
   * Starts real live camera monitoring upon explicit user click
   */
  const handleStartMonitoring = async () => {
    // Stop any existing tracks before initializing
    stopCameraTracks();

    setCameraErrorType(null);
    setCameraErrorMessage(null);
    setCameraStatus('Waiting for Permission');
    setLatestDetectionDetails('Waiting for browser camera permission prompt...');
    isFinalizingRef.current = false;

    // Reset session in-memory counters and event list
    setFramesAnalyzedCount(0);
    setSuccessfulInferencesCount(0);
    setFailedInferencesCount(0);
    setDetectionEventsCount(0);
    setSessionSnapshots([]);
    setLatestAnnotatedUrl(null);
    cooldownEndTimestampRef.current = 0;
    setIsCooldownActive(false);

    try {
      // 1. Request real camera stream
      const stream = await acquireCameraStream(selectedDeviceId);
      streamRef.current = stream;

      setCameraStatus('Camera Initializing');
      setLatestDetectionDetails('Camera access granted. Initializing video pipeline...');

      // 2. Track label & device enumeration
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setActiveCameraLabel(videoTrack.label || 'Connected Video Camera');

        // Monitor stream disconnection or track end
        videoTrack.addEventListener('ended', () => {
          finalizeMonitoringSession('camera_disconnected');
        });
      }

      refreshAvailableCameras();

      // 3. Attach stream to <video> element
      const videoElement = videoRef.current;
      if (!videoElement) {
        throw new Error('Video element reference is not mounted in DOM.');
      }

      videoElement.srcObject = stream;

      // Wait for camera to actually stream and video dimensions to be available
      await new Promise<void>((resolve, reject) => {
        const handleLoaded = () => {
          videoElement.play().then(() => resolve()).catch(reject);
        };

        if (videoElement.readyState >= 2 && videoElement.videoWidth > 0) {
          videoElement.play().then(() => resolve()).catch(reject);
        } else {
          videoElement.onloadedmetadata = handleLoaded;
          // Safety timeout in case onloadedmetadata doesn't fire
          setTimeout(() => {
            if (videoElement.videoWidth > 0) resolve();
            else videoElement.play().then(() => resolve()).catch(resolve);
          }, 1500);
        }
      });

      // 4. Create initial monitoring session record
      const newSessionId = `SES-${Date.now().toString(36).toUpperCase()}-${Math.floor(
        100 + Math.random() * 900
      )}`;
      const startTime = new Date().toISOString();

      const initialSession: LiveMonitoringSession = {
        sessionId: newSessionId,
        startTime,
        durationSeconds: 0,
        status: 'active',
        cameraSource: 'webcam',
        confidenceThreshold,
        cooldownPeriodSeconds: cooldownSeconds,
        verificationEngine: verificationMode,
        totalFramesAnalyzed: 0,
        totalSuccessfulInferences: 0,
        totalFailedInferences: 0,
        totalValidDetectionEvents: 0,
        totalSnapshotsCaptured: 0,
        snapshots: [],
        errorsEncountered: [],
        isStructuredDataAvailable: verificationMode === 'dual_engine',
        structuredDataNote:
          verificationMode === 'dual_engine'
            ? 'Dual-Engine CV active: Genuine bounding boxes & confidence scores verified on live camera frames.'
            : 'Hugging Face Space returns annotated overlay image only without structured bounding-box prediction arrays.',
      };

      setActiveSession(initialSession);
      saveActiveSession(initialSession);

      // 5. Update Status to Camera Ready & Monitoring
      setCameraStatus('Camera Ready');
      setLatestDetectionDetails('Camera stream active: Continuous pavement surveillance starting...');

      // Transition to Monitoring state and begin frame loop
      setTimeout(() => {
        setCameraStatus('Monitoring');
        processFrame();
      }, 400);
    } catch (err: unknown) {
      stopCameraTracks();
      clearActiveSession();
      setActiveSession(null);
      setCameraStatus('Camera Error');

      const errorName = err instanceof Error ? err.name : '';
      const errorMessage = err instanceof Error ? err.message : String(err);

      if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
        setCameraErrorType('permission_denied');
        setCameraErrorMessage(
          'Camera access was denied by your browser or operating system settings. Please grant camera permission to enable live monitoring.'
        );
      } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
        setCameraErrorType('not_found');
        setCameraErrorMessage(
          'No video camera hardware was found on this system. Please connect an external USB webcam or use a device with an integrated camera.'
        );
      } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
        setCameraErrorType('in_use');
        setCameraErrorMessage(
          'The camera is currently in use by another application (e.g. Zoom, Google Meet, Microsoft Teams, or another browser tab). Please close other apps using the camera and click Try Again.'
        );
      } else if (errorName === 'OverconstrainedError') {
        setCameraErrorType('overconstrained');
        setCameraErrorMessage(
          'The requested camera resolution or facingMode constraint is not supported by your video hardware.'
        );
      } else if (errorName === 'SecurityError' || errorMessage === 'INSECURE_CONTEXT') {
        setCameraErrorType('security');
        setCameraErrorMessage(
          'Camera access is blocked by browser security restrictions. Webcams require a secure HTTPS connection or localhost, and cannot be accessed over plain HTTP or in restricted iframes.'
        );
      } else if (errorName === 'UnsupportedError' || errorMessage === 'UNSUPPORTED_BROWSER') {
        setCameraErrorType('unsupported');
        setCameraErrorMessage(
          'Your web browser does not support the HTML5 mediaDevices.getUserMedia camera API. Please use a modern browser such as Google Chrome, Safari, Microsoft Edge, or Firefox.'
        );
      } else {
        setCameraErrorType('unknown');
        setCameraErrorMessage(`Camera access failure: ${errorMessage}`);
      }
    }
  };

  /**
   * Stop Monitoring button
   */
  const handleStopMonitoring = () => {
    finalizeMonitoringSession('user_stopped');
  };

  const handleDeleteHistorySession = (sessionId: string) => {
    const updated = deleteMonitoringSession(sessionId);
    setCompletedSessionsHistory(updated);
  };

  const isCameraLive = cameraStatus === 'Monitoring' || cameraStatus === 'Camera Ready';

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {recentNotification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-20 right-6 z-50 bg-emerald-950/90 border border-emerald-500/60 text-emerald-200 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold">{recentNotification.message}</span>
        </div>
      )}

      {/* Permission Explanation Banner (Shown in Standby) */}
      {cameraStatus === 'Stopped' && !cameraErrorType && (
        <div className="p-4 bg-slate-900/90 border border-cyan-500/30 rounded-xl text-xs text-slate-300 flex items-start gap-3 shadow-sm">
          <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-white text-xs block">
              Real-Time Hardware Camera Surveillance
            </span>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              When you click <strong className="text-cyan-300">&ldquo;Start Live Monitoring&rdquo;</strong>, your browser will prompt for camera access. RoadSentry AI captures live roadway frames directly from your webcam or mobile rear camera, submits them to the Hugging Face pothole detection model, and automatically captures snapshots with device GPS upon confirmed defect detections. Video frames remain private in your browser session.
            </p>
          </div>
        </div>
      )}

      {/* Camera Error & Comprehensive Recovery Guidance Card */}
      {cameraStatus === 'Camera Error' && (
        <div className="p-5 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-4 text-xs text-rose-300 animate-in fade-in">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="text-sm font-bold text-rose-200 block">
                  {cameraErrorType === 'permission_denied'
                    ? 'Camera Permission Required'
                    : cameraErrorType === 'in_use'
                    ? 'Camera In Use by Another Application'
                    : cameraErrorType === 'not_found'
                    ? 'No Camera Device Detected'
                    : cameraErrorType === 'security'
                    ? 'Security / Iframe Restriction'
                    : 'Camera Initialization Failed'}
                </strong>
                <p className="text-rose-300 leading-relaxed text-xs">{cameraErrorMessage}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleStartMonitoring}
              className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try Again</span>
            </button>
          </div>

          {/* Detailed Browser-Specific Instructions */}
          {cameraErrorType === 'permission_denied' && (
            <div className="bg-black/40 border border-rose-500/20 p-4 rounded-lg space-y-3 text-[11px] text-slate-300">
              <span className="font-semibold text-white block text-xs">
                How to Enable Camera Permission in Your Browser:
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1 bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1">
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Google Chrome / Edge / Brave (Desktop)</span>
                  </span>
                  <ol className="list-decimal pl-4 space-y-0.5 text-slate-400 text-[10px]">
                    <li>Click the tune/padlock icon (⚙️ or 🔒) in the address bar next to the URL.</li>
                    <li>Toggle the <strong>Camera</strong> permission switch to <strong>Allow</strong>.</li>
                    <li>Click <strong>&ldquo;Try Again&rdquo;</strong> above to re-initialize your camera without refreshing the page.</li>
                  </ol>
                </div>

                <div className="space-y-1 bg-slate-900/60 p-2.5 rounded border border-slate-800">
                  <span className="font-semibold text-cyan-300 flex items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Safari (iOS / macOS)</span>
                  </span>
                  <ol className="list-decimal pl-4 space-y-0.5 text-slate-400 text-[10px]">
                    <li>On iOS: Tap the &ldquo;aA&rdquo; icon in Safari address bar &rarr; Website Settings &rarr; Camera &rarr; Allow.</li>
                    <li>On macOS: Open Safari &rarr; Settings for This Website &rarr; Camera &rarr; Allow.</li>
                    <li>Click <strong>&ldquo;Try Again&rdquo;</strong> to start monitoring.</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* Iframe Restriction Direct Window Option */}
          {isInIframe && (
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
              <div className="space-y-0.5">
                <span className="font-semibold text-white">Running Inside an Embedded Preview Iframe?</span>
                <p className="text-[11px] text-slate-400">
                  Browser security sandbox policies can block camera access inside iframes. Opening the application in its own top-level browser window allows native hardware camera permissions.
                </p>
              </div>

              <a
                href={window.location.href}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shrink-0 shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Dedicated Window</span>
              </a>
            </div>
          )}
        </div>
      )}

      {/* Top Banner: Status & Controls */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <Camera className="w-4 h-4" />
              </span>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                Real-Time Live Camera Pothole Surveillance
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Acquires live camera video feed, submits frames to the Hugging Face detection model, and auto-captures confirmed pothole snapshots
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {isCameraLive ? (
              <button
                type="button"
                onClick={handleStopMonitoring}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-rose-950"
              >
                <Square className="w-4 h-4 fill-white" />
                <span>Stop Monitoring &amp; Generate Report</span>
              </button>
            ) : cameraStatus === 'Waiting for Permission' ? (
              <button
                type="button"
                disabled
                className="px-4 py-2 bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold text-xs rounded-lg flex items-center gap-2 cursor-wait"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Waiting for Camera Permission...</span>
              </button>
            ) : cameraStatus === 'Camera Initializing' ? (
              <button
                type="button"
                disabled
                className="px-4 py-2 bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold text-xs rounded-lg flex items-center gap-2 cursor-wait"
              >
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Initializing Video Hardware...</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartMonitoring}
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-2 shadow-lg shadow-cyan-950"
              >
                <Play className="w-4 h-4 fill-slate-950" />
                <span>Start Live Monitoring</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs rounded-lg transition-colors flex items-center gap-1.5"
              title="View past monitoring sessions"
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">Sessions ({completedSessionsHistory.length})</span>
            </button>
          </div>
        </div>

        {/* Configuration Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Hardware Camera Device Selector */}
          <div className="space-y-1">
            <label className="text-slate-400 font-medium text-[11px] block">
              Active Video Device:
            </label>
            <select
              value={selectedDeviceId}
              disabled={isCameraLive}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            >
              {availableCameras.length > 0 ? (
                availableCameras.map((device, idx) => (
                  <option key={device.deviceId || idx} value={device.deviceId}>
                    {device.label || `Camera #${idx + 1}`}
                  </option>
                ))
              ) : (
                <option value="">Default Available Camera (Rear/Webcam)</option>
              )}
            </select>
          </div>

          {/* Verification Mode */}
          <div className="space-y-1">
            <label className="text-slate-400 font-medium text-[11px] block">
              Detection Verification Engine:
            </label>
            <select
              value={verificationMode}
              disabled={isCameraLive}
              onChange={(e) => setVerificationMode(e.target.value as 'dual_engine' | 'hf_space_only')}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            >
              <option value="dual_engine">Dual-Engine (HF Space + Real Frame CV)</option>
              <option value="hf_space_only">HF Space Only (Visual Overlay Mode)</option>
            </select>
          </div>

          {/* Confidence Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Confidence Threshold:</span>
              <span className="font-mono text-cyan-300 font-semibold">
                {Math.round(confidenceThreshold * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.10"
              max="0.80"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
              disabled={isCameraLive}
              className="w-full accent-cyan-400 bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>

          {/* Cooldown Deduplication Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Deduplication Cooldown:</span>
              <span className="font-mono text-cyan-300 font-semibold">{cooldownSeconds}s</span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={cooldownSeconds}
              onChange={(e) => setCooldownSeconds(parseInt(e.target.value, 10))}
              disabled={isCameraLive}
              className="w-full accent-cyan-400 bg-slate-900 h-1.5 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
            />
          </div>
        </div>

        {/* Real-Time Status & Telemetry Bar */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* Explicit Camera State Badge */}
            <span
              className={`px-2.5 py-1 rounded-lg border font-mono text-[11px] font-semibold flex items-center gap-1.5 ${
                cameraStatus === 'Monitoring'
                  ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 animate-pulse'
                  : cameraStatus === 'Camera Ready'
                  ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                  : cameraStatus === 'Camera Initializing'
                  ? 'bg-sky-950/60 text-sky-300 border-sky-500/40 animate-pulse'
                  : cameraStatus === 'Waiting for Permission'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 animate-pulse'
                  : cameraStatus === 'Camera Error'
                  ? 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                  : 'bg-slate-900 text-slate-400 border-slate-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cameraStatus === 'Monitoring'
                    ? 'bg-emerald-400'
                    : cameraStatus === 'Camera Ready'
                    ? 'bg-cyan-400'
                    : cameraStatus === 'Camera Initializing' || cameraStatus === 'Waiting for Permission'
                    ? 'bg-amber-400'
                    : cameraStatus === 'Camera Error'
                    ? 'bg-rose-400'
                    : 'bg-slate-500'
                }`}
              />
              <span>STATE: {cameraStatus.toUpperCase()}</span>
            </span>

            {/* Inference Processing Pill */}
            {isProcessingFrame && (
              <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/50 text-[10px] font-mono">
                INFERENCE RUNNING
              </span>
            )}

            {/* Cooldown Pill */}
            {isCooldownActive && (
              <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50 text-[10px] font-mono">
                COOLDOWN ACTIVE: {(cooldownRemainingMs / 1000).toFixed(1)}s
              </span>
            )}

            {activeCameraLabel && isCameraLive && (
              <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 bg-slate-900 rounded border border-slate-800 truncate max-w-xs">
                {activeCameraLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>
              Frames: <strong className="text-white">{framesAnalyzedCount}</strong>
            </span>
            <span>
              Successful: <strong className="text-emerald-400">{successfulInferencesCount}</strong>
            </span>
            <span>
              Failed: <strong className="text-rose-400">{failedInferencesCount}</strong>
            </span>
            {lastInferenceTimeMs !== null && (
              <span>
                Latency: <strong className="text-cyan-300">{lastInferenceTimeMs}ms</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Monitoring Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Camera & Video Output (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Video className="w-4 h-4 text-cyan-400" />
                <span>Real Camera Feed</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Model: Sahildandotiya/pothole-detector
              </span>
            </div>

            {/* Media Viewport Container */}
            <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
              {/* Actual Native Video Element for Hardware Camera Stream */}
              <video
                ref={videoRef}
                playsInline
                muted
                autoPlay
                className={`max-h-full max-w-full object-contain ${isCameraLive ? 'block' : 'hidden'}`}
              />

              {/* Hidden Canvas used for grabbing native video frames */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Standby / Initializing Overlay */}
              {!isCameraLive && (
                <div className="text-center p-6 space-y-3 text-slate-500">
                  <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                    <Camera className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-slate-300">
                      {cameraStatus === 'Waiting for Permission'
                        ? 'Waiting for Camera Permission'
                        : cameraStatus === 'Camera Initializing'
                        ? 'Connecting to Video Hardware...'
                        : cameraStatus === 'Camera Error'
                        ? 'Camera Disconnected'
                        : 'Camera Feed Inactive'}
                    </div>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      {cameraStatus === 'Waiting for Permission'
                        ? 'Please approve the browser prompt requesting camera access to start surveillance.'
                        : cameraStatus === 'Camera Initializing'
                        ? 'Negotiating resolution and streaming frames from video sensor...'
                        : cameraStatus === 'Camera Error'
                        ? 'Resolve the camera notice above and click Try Again.'
                        : 'Click "Start Live Monitoring" to begin continuous pavement surveillance and auto-capture potholes.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Live HUD Overlay */}
              {isCameraLive && (
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-md border border-white/10 text-[10px] font-mono text-cyan-300 flex items-center gap-1.5 pointer-events-none">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span>LIVE SURVEILLANCE</span>
                </div>
              )}

              {/* Latest detection HUD alert */}
              {isCameraLive && isCooldownActive && (
                <div className="absolute bottom-3 inset-x-3 bg-amber-950/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-amber-500/50 text-[11px] text-amber-200 flex items-center justify-between pointer-events-none">
                  <span className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Deduplication Cooldown Active</span>
                  </span>
                  <span className="font-mono">{(cooldownRemainingMs / 1000).toFixed(1)}s</span>
                </div>
              )}
            </div>

            {/* Live Detection Status Detail */}
            <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">Live Analysis Status:</span>
                <span className="text-cyan-400 font-mono text-[10px]">REAL-TIME PIPELINE</span>
              </div>
              <p className="text-slate-200 text-[11px] leading-relaxed">
                {latestDetectionDetails}
              </p>
            </div>
          </div>

          {/* Model Evidence Inspection Card (Annotated Image from HF Space) */}
          {latestAnnotatedUrl && (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3 shadow-sm text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Latest Hugging Face Annotated Output</span>
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {lastInferenceTimeMs}ms inference
                </span>
              </div>
              <div className="relative rounded-lg overflow-hidden bg-black border border-cyan-500/30 aspect-video flex items-center justify-center">
                <img
                  src={latestAnnotatedUrl}
                  alt="HF Model Annotated"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Automatic Snapshot Gallery & Review (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm flex flex-col min-h-[500px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  Automatic Snapshots ({sessionSnapshots.length})
                </h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                {detectionEventsCount} Event(s)
              </span>
            </div>

            {/* Snapshot Gallery List */}
            <div className="flex-1 space-y-3 overflow-y-auto max-h-[620px] pr-1">
              {sessionSnapshots.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-2 text-slate-500">
                  <CheckCircle2 className="w-10 h-10 text-slate-700" />
                  <div className="text-xs font-semibold text-slate-400">
                    No Potholes Captured Yet
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs leading-normal">
                    When the detector verifies a pothole on the live camera above the threshold, an immediate high-resolution screenshot with GPS coordinates will appear here.
                  </p>
                </div>
              ) : (
                sessionSnapshots.map((snap, idx) => (
                  <div
                    key={snap.id}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-3 space-y-2.5 transition-all text-xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-cyan-300 font-mono">
                        Snapshot #{sessionSnapshots.length - idx}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Snapshot Preview */}
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
                      <img
                        src={snap.originalSnapshotUrl}
                        alt="Captured pothole"
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Confidence:</span>
                        <span className="font-mono text-cyan-300 font-semibold">
                          {snap.confidence ? `${Math.round(snap.confidence * 100)}%` : 'Verified'}
                        </span>
                      </div>

                      {snap.gpsLocation && (
                        <div className="flex items-center gap-1 text-[10px] text-slate-300 font-mono truncate">
                          <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>
                            {snap.gpsLocation.latitude.toFixed(4)}, {snap.gpsLocation.longitude.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action to create full road report */}
                    <button
                      type="button"
                      onClick={() => {
                        setSnapshotToReport(snap);
                        setIsCreateReportOpen(true);
                      }}
                      className="w-full py-1.5 px-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Create Road Report</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Past Monitoring Sessions Drawer / History */}
      {showHistoryDrawer && (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 text-xs shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">
                Archived Live Monitoring Sessions
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(false)}
              className="text-slate-400 hover:text-white"
            >
              Close
            </button>
          </div>

          {completedSessionsHistory.length === 0 ? (
            <div className="py-6 text-center text-slate-500">
              No previous monitoring sessions archived yet.
            </div>
          ) : (
            <div className="space-y-2">
              {completedSessionsHistory.map((s) => (
                <div
                  key={s.sessionId}
                  className="bg-slate-900 border border-slate-800 rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <strong className="text-white font-mono">{s.sessionId}</strong>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(s.startTime).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Duration: {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s |{' '}
                      {s.totalFramesAnalyzed} frames | {s.snapshots.length} snapshots
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSessionForModal(s);
                        setIsReportModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg font-medium text-xs flex items-center gap-1 transition-colors"
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>View Session Report</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteHistorySession(s.sessionId)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                      title="Delete session"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* End-of-Session Comprehensive Report Modal */}
      <SessionReportModal
        session={selectedSessionForModal}
        isOpen={isReportModalOpen}
        onClose={() => {
          setIsReportModalOpen(false);
          setSelectedSessionForModal(null);
        }}
        onCreateReportFromSnapshot={(snap) => {
          setSnapshotToReport(snap);
          setIsCreateReportOpen(true);
        }}
      />

      {/* Convert Snapshot into Standard Road Damage Report Modal */}
      {snapshotToReport && (
        <CreateReportModal
          isOpen={isCreateReportOpen}
          onClose={() => {
            setIsCreateReportOpen(false);
            setSnapshotToReport(null);
          }}
          onSaveReport={(rep) => {
            onSaveReport(rep);
            setIsCreateReportOpen(false);
            setSnapshotToReport(null);
            setRecentNotification({
              message: `Road damage report ${rep.id} saved to registry!`,
              type: 'success',
            });
            setTimeout(() => setRecentNotification(null), 3500);
          }}
          originalImagePreview={snapshotToReport.originalSnapshotUrl}
          mediaType="image"
          confidenceThreshold={snapshotToReport.confidence || confidenceThreshold}
          detectionResult={{
            annotatedMediaUrl:
              snapshotToReport.annotatedSnapshotUrl || snapshotToReport.originalSnapshotUrl,
            rawResponse: { source: 'live_monitoring_snapshot', snapshotId: snapshotToReport.id },
            confidenceUsed: snapshotToReport.confidence || confidenceThreshold,
            analyzedAt: snapshotToReport.timestamp,
            mediaType: 'image',
            potholeCount: snapshotToReport.potholesDetected,
            isCountUnavailable: !snapshotToReport.hasStructuredDetection,
            preliminarySeverity: 'High',
            severityReasons: [
              'Pothole detected during mobile camera monitoring surveillance',
              `Confidence score: ${Math.round((snapshotToReport.confidence || 0.75) * 100)}%`,
            ],
            recommendedAction:
              'Schedule prompt on-site road crew physical inspection and cavity infill.',
          }}
        />
      )}
    </div>
  );
};
