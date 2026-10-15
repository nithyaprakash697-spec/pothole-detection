import React from 'react';
import {
  X,
  FileCheck,
  Calendar,
  Clock,
  MapPin,
  ShieldAlert,
  AlertTriangle,
  Download,
  Printer,
  PlusCircle,
  ExternalLink,
  Layers,
  Activity,
  CheckCircle2,
  Camera,
} from 'lucide-react';
import { LiveMonitoringSession, LiveMonitoringSnapshot } from '../../types';

interface SessionReportModalProps {
  session: LiveMonitoringSession | null;
  isOpen: boolean;
  onClose: () => void;
  onCreateReportFromSnapshot?: (snapshot: LiveMonitoringSnapshot) => void;
}

export const SessionReportModal: React.FC<SessionReportModalProps> = ({
  session,
  isOpen,
  onClose,
  onCreateReportFromSnapshot,
}) => {
  if (!isOpen || !session) return null;

  const assessment = session.roadConditionAssessment;

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(session, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `RoadGuard-Session-${session.sessionId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  const getSeverityStyle = (sev?: string) => {
    switch (sev) {
      case 'Critical':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'High':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'Moderate':
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      case 'Low':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto"
    >
      <div className="bg-[#0B1120] border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 sm:p-7 space-y-6 text-slate-100 shadow-2xl relative my-auto">
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                <FileCheck className="w-5 h-5" />
              </span>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Live Road Monitoring Session Report
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Evidence-grounded condition audit generated upon camera termination
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors border border-slate-800"
              title="Print report"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors border border-slate-800"
              title="Export as JSON"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Section A: Session Summary Banner */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">Session ID:</span>
              <strong className="text-sm font-mono text-cyan-300">{session.sessionId}</strong>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                Source: {session.cameraSource.replace('_', ' ').toUpperCase()}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                  session.status === 'completed'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                    : 'bg-amber-950/60 text-amber-300 border-amber-800/50'
                }`}
              >
                Status: {session.status.toUpperCase()}
              </span>
              {assessment && (
                <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded border ${getSeverityStyle(assessment.severity)}`}>
                  Severity: {assessment.severity}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-xs">
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block mb-0.5">Duration</span>
              <strong className="text-slate-200 font-mono text-sm">
                {Math.floor(session.durationSeconds / 60)}m {session.durationSeconds % 60}s
              </strong>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block mb-0.5">Frames Analyzed</span>
              <strong className="text-slate-200 font-mono text-sm">
                {session.totalFramesAnalyzed}
              </strong>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block mb-0.5">Inference Success/Fail</span>
              <strong className="text-slate-200 font-mono text-sm">
                <span className="text-emerald-400">{session.totalSuccessfulInferences}</span> /{' '}
                <span className="text-rose-400">{session.totalFailedInferences}</span>
              </strong>
            </div>
            <div className="p-2.5 bg-slate-950/60 rounded-lg border border-slate-800/60">
              <span className="text-[10px] text-slate-400 block mb-0.5">Confirmed Detections</span>
              <strong className="text-cyan-300 font-mono text-sm">
                {session.totalValidDetectionEvents} Events ({session.totalSnapshotsCaptured} Snapshots)
              </strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-400 pt-1">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Started: {new Date(session.startTime).toLocaleString()}</span>
            </span>
            {session.endTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                <span>Ended: {new Date(session.endTime).toLocaleTimeString()}</span>
              </span>
            )}
          </div>
        </div>

        {/* Section C: Road-Condition Assessment */}
        {assessment && (
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">
                  Road Condition Assessment & Severity Analysis
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                Confidence Threshold: {Math.round(session.confidenceThreshold * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Estimated Roadway Condition:
                </span>
                <p className="text-sm font-semibold text-cyan-300 bg-slate-950/80 p-3 rounded-lg border border-slate-800">
                  {assessment.overallCondition}
                </p>
                <div className="text-[11px] text-slate-400 pt-1">
                  <strong>Damage Summary:</strong> {assessment.observedDamageSummary}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-400 uppercase font-semibold">
                  Recommended Maintenance Action:
                </span>
                <ul className="space-y-1.5">
                  {assessment.recommendedActions.map((act, i) => (
                    <li
                      key={i}
                      className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-slate-200 text-[11px] leading-relaxed flex items-start gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Assessment Evidence List */}
            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-1.5">
              <span className="font-semibold text-slate-300 text-[11px] flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400" />
                <span>Supporting Optical Evidence:</span>
              </span>
              <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                {assessment.evidence.map((ev, i) => (
                  <li key={i}>{ev}</li>
                ))}
              </ul>
            </div>

            {/* Limitations Disclaimer */}
            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold text-amber-200">
                  Technical Limitations & Physical Field Inspection Requirement:
                </span>
                <ul className="list-disc pl-4 space-y-0.5 text-amber-300/90 text-[10px]">
                  {assessment.limitations.map((lim, i) => (
                    <li key={i}>{lim}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Section B: Pothole Detection Summary & Snapshot Gallery */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">
                Archived Pothole Snapshots ({session.snapshots.length})
              </h3>
            </div>
            <div className="text-[11px] text-slate-400">
              * Note: The number of snapshots reflects event triggers; multiple snapshots may represent the same prolonged cavity.
            </div>
          </div>

          {session.snapshots.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-400">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <div className="font-medium text-white text-sm">No Potholes Captured During Session</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No pavement surface breaches exceeded the detection confidence threshold ({Math.round(session.confidenceThreshold * 100)}%) during continuous camera monitoring.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {session.snapshots.map((snap, idx) => (
                <div
                  key={snap.id}
                  className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden p-3.5 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-cyan-300 font-mono">
                        Snapshot #{idx + 1}
                      </span>
                      <span className="text-slate-400 font-mono">
                        {new Date(snap.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Image comparison preview */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400">Original Camera Frame</span>
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-800 flex items-center justify-center">
                          <img
                            src={snap.originalSnapshotUrl}
                            alt="Original snapshot"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-cyan-400">AI Model Output</span>
                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black border border-cyan-500/30 flex items-center justify-center">
                          {snap.annotatedSnapshotUrl ? (
                            <img
                              src={snap.annotatedSnapshotUrl}
                              alt="Annotated model output"
                              className="max-h-full max-w-full object-contain"
                            />
                          ) : (
                            <div className="text-[10px] text-slate-500 text-center p-2">
                              Visual annotation pending
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detection metadata */}
                    <div className="space-y-1 text-[11px] pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Class &amp; Confidence:</span>
                        <span className="font-mono text-cyan-300 font-semibold">
                          {snap.className || 'Pothole Cavity'}{' '}
                          {snap.confidence ? `(${Math.round(snap.confidence * 100)}%)` : ''}
                        </span>
                      </div>

                      {snap.boundingBoxes && snap.boundingBoxes.length > 0 && (
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>Bounding Box [Y, X, H, W]:</span>
                          <span className="font-mono text-slate-300">
                            [{snap.boundingBoxes[0].map((v: number) => v.toFixed(2)).join(', ')}]
                          </span>
                        </div>
                      )}

                      {/* GPS device location */}
                      {snap.gpsLocation ? (
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 text-[10px] text-slate-300 space-y-0.5">
                          <div className="flex items-center gap-1 text-cyan-400 font-semibold">
                            <MapPin className="w-3 h-3" />
                            <span>{snap.gpsLocation.label}</span>
                          </div>
                          <div className="font-mono text-slate-400">
                            {snap.gpsLocation.latitude.toFixed(5)}, {snap.gpsLocation.longitude.toFixed(5)}
                            {snap.gpsLocation.accuracy && ` (±${Math.round(snap.gpsLocation.accuracy)}m)`}
                          </div>
                          {snap.gpsLocation.roadName && (
                            <div className="text-slate-300 font-sans truncate">
                              {snap.gpsLocation.roadName}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-500 italic">
                          Location coordinates not available (permission was not granted)
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400 italic leading-tight pt-1">
                        {snap.detectionEvidenceNote}
                      </p>
                    </div>
                  </div>

                  {/* Escalate to Road Damage Report action */}
                  {onCreateReportFromSnapshot && (
                    <button
                      type="button"
                      onClick={() => {
                        onCreateReportFromSnapshot(snap);
                        onClose();
                      }}
                      className="w-full mt-2 py-2 px-3 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Create Road Damage Report from Snapshot</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section E: Errors and Reliability */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-xs space-y-2">
          <span className="font-semibold text-slate-300">System Integrity &amp; Session Reliability Notes:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-400">
            <div>
              <strong className="text-slate-300">Hugging Face Detector:</strong>{' '}
              {session.totalSuccessfulInferences > 0
                ? 'Operational throughout monitoring session.'
                : 'No remote responses received.'}
            </div>
            <div>
              <strong className="text-slate-300">Structured Data Status:</strong>{' '}
              {session.isStructuredDataAvailable
                ? 'Structured bounding box predictions verified.'
                : session.structuredDataNote}
            </div>
          </div>
          {session.errorsEncountered.length > 0 && (
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <span className="text-amber-400 font-semibold text-[11px]">Recorded Anomalies:</span>
              <ul className="text-[10px] text-slate-400 space-y-0.5 list-disc pl-4">
                {session.errorsEncountered.map((err, i) => (
                  <li key={i}>
                    {new Date(err.timestamp).toLocaleTimeString()}: {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            Session data archived in local session history.
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors"
            >
              Close Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
