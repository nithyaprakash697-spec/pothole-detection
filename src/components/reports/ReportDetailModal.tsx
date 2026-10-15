import React, { useState } from 'react';
import {
  X,
  Calendar,
  MapPin,
  Clock,
  Layers,
  Sliders,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  FileText,
  ExternalLink,
  Cpu,
  Info,
  ShieldCheck,
  Compass,
  Hammer,
  UserCheck,
  Camera,
  Check,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import {
  DamagePriority,
  DamageReport,
  PreliminarySeverity,
  ReportLifecycleStatus,
  ReportStatus,
} from '../../types';
import {
  generatePracticalRepairRecommendation,
  normalizeReportStatus,
} from '../../services/repairRecommendations';
import { ReportStatusUpdatePayload } from '../../services/reportStorage';

interface ReportDetailModalProps {
  report: DamageReport | null;
  onClose: () => void;
  onUpdateStatus: (id: string, update: ReportStatus | ReportStatusUpdatePayload) => void;
  onDeleteReport: (id: string) => void;
}

const LIFECYCLE_STAGES: { key: ReportLifecycleStatus; label: string; desc: string }[] = [
  { key: 'Reported', label: '1. Reported', desc: 'Notice filed via AI / Citizen submission' },
  { key: 'Awaiting Inspection', label: '2. Awaiting Inspection', desc: 'Queued for physical on-site road audit' },
  { key: 'Inspection Completed', label: '3. Inspected', desc: 'Field dimensions & sub-base confirmed' },
  { key: 'Repair Recommended', label: '4. Repair Recommended', desc: 'Engineering approach prescribed' },
  { key: 'Repair in Progress', label: '5. In Progress', desc: 'Asphalt crew actively deployed on-site' },
  { key: 'Repair Completed — Awaiting Verification', label: '6. Completed (Pending Audit)', desc: 'Work done; awaits supervisor sign-off' },
  { key: 'Repaired and Verified', label: '7. Repaired & Verified', desc: 'Confirmed closed; red dot removed from active map' },
];

export const ReportDetailModal: React.FC<ReportDetailModalProps> = ({
  report,
  onClose,
  onUpdateStatus,
  onDeleteReport,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditingLifecycle, setIsEditingLifecycle] = useState(false);

  // Status update form states
  const [targetStatus, setTargetStatus] = useState<ReportLifecycleStatus>('Reported');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [repairNotes, setRepairNotes] = useState('');
  const [responsiblePersonnel, setResponsiblePersonnel] = useState('');
  const [repairDate, setRepairDate] = useState('');
  const [verificationEvidence, setVerificationEvidence] = useState('');
  const [afterPhotoPreview, setAfterPhotoPreview] = useState<string | null>(null);

  // Sync state when report changes
  React.useEffect(() => {
    if (report) {
      const currentNorm = normalizeReportStatus(report.status);
      setTargetStatus(currentNorm);
      setInspectionNotes(report.inspectionNotes || '');
      setRepairNotes(report.repairNotes || '');
      setResponsiblePersonnel(report.responsiblePersonnel || '');
      setRepairDate(report.repairDate || new Date().toISOString().split('T')[0]);
      setVerificationEvidence(report.verificationEvidence || '');
      setAfterPhotoPreview(report.afterRepairPhoto || null);
      setIsEditingLifecycle(false);
      setShowDeleteConfirm(false);
    }
  }, [report]);

  if (!report) return null;

  const currentLifecycle = normalizeReportStatus(report.status);

  // Calculate practical repair recommendations if not already embedded
  const practicalRec =
    report.suggestedRepairApproach && report.damageCategories
      ? {
          detectedDamageCategories: report.damageCategories,
          preliminarySeverity: report.preliminarySeverity,
          recommendedAction: report.recommendedAction,
          inspectionUrgency: report.inspectionUrgency || 'Within 7 Days',
          urgencyReasons: report.urgencyReasons || report.severityReasons,
          suggestedRepairApproach: report.suggestedRepairApproach,
          onSiteInspectionRequired: true,
          humanVerificationStatus: report.humanVerified ? 'Human Verified' : 'Pending Physical Verification',
          disclaimer:
            'AI models evaluate 2D photographic features only and cannot measure cavity depth, sub-base void compaction, or international roughness index (IRI). Suggested repair approaches must be verified on-site by certified road engineers prior to civil works.',
        }
      : generatePracticalRepairRecommendation({
          preliminarySeverity: report.preliminarySeverity,
          model1Result: report.model1Result,
          model2Result: report.model2Result,
          activeReferenceResult: report.activeReferenceResult,
          hasConfirmedLocation: report.latitude !== null && report.longitude !== null,
          isPhysicallyInspected: report.humanVerified,
          duplicateCount: report.linkedDuplicateIds?.length || 0,
        });

  const getPriorityBadge = (p: DamagePriority) => {
    switch (p) {
      case 'Critical':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      case 'High':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'Medium':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      case 'Low':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
    }
  };

  const getLifecycleColor = (s: ReportLifecycleStatus) => {
    switch (s) {
      case 'Repaired and Verified':
        return 'text-emerald-300 bg-emerald-950/60 border-emerald-500/40';
      case 'Repair Completed — Awaiting Verification':
        return 'text-amber-300 bg-amber-950/60 border-amber-500/40';
      case 'Repair in Progress':
        return 'text-cyan-300 bg-cyan-950/60 border-cyan-500/40';
      case 'Repair Recommended':
        return 'text-indigo-300 bg-indigo-950/60 border-indigo-500/40';
      case 'Inspection Completed':
        return 'text-blue-300 bg-blue-950/60 border-blue-500/40';
      case 'Awaiting Inspection':
        return 'text-yellow-300 bg-yellow-950/60 border-yellow-500/40';
      default:
        return 'text-rose-300 bg-rose-950/60 border-rose-500/40';
    }
  };

  const handleSaveStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const isVerifiedRepair = targetStatus === 'Repaired and Verified';

    const payload: ReportStatusUpdatePayload = {
      status: targetStatus,
      inspectionNotes: inspectionNotes.trim() || undefined,
      repairNotes: repairNotes.trim() || undefined,
      responsiblePersonnel: responsiblePersonnel.trim() || undefined,
      repairDate: repairDate || undefined,
      afterRepairPhoto: afterPhotoPreview || undefined,
      verificationEvidence: verificationEvidence.trim() || undefined,
      verifiedDate: isVerifiedRepair ? new Date().toISOString() : undefined,
      humanVerified: isVerifiedRepair ? true : report.humanVerified,
    };

    onUpdateStatus(report.id, payload);
    setIsEditingLifecycle(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setAfterPhotoPreview(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl bg-[#0F172A] border border-slate-800 rounded-2xl shadow-2xl p-5 sm:p-6 my-6 max-h-[92vh] overflow-y-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-slate-800 gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-cyan-400 font-semibold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40">
                {report.id}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${getLifecycleColor(currentLifecycle)}`}>
                {currentLifecycle}
              </span>
              {report.isSample && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                  Illustrative Sample
                </span>
              )}
              {report.humanVerified && (
                <span className="text-[10px] bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.5 rounded flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Human Verified</span>
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {report.roadName || 'Unnamed Roadway Anomaly'}
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(report.createdAt).toLocaleDateString()}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>{new Date(report.createdAt).toLocaleTimeString()}</span>
              </span>
              {report.latitude && report.longitude && (
                <span className="flex items-center gap-1 font-mono text-cyan-300">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                  </span>
                  {report.locationSource && (
                    <span className="text-slate-500 font-sans text-[10px]">
                      ({report.locationSource.replace('_', ' ')})
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7-Stage Pothole Lifecycle Stepper */}
        <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Hammer className="w-4 h-4 text-cyan-400" />
              <span>Pothole Lifecycle Progress (7 Stages)</span>
            </span>
            <button
              type="button"
              onClick={() => setIsEditingLifecycle(!isEditingLifecycle)}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium underline flex items-center gap-1"
            >
              <span>{isEditingLifecycle ? 'Hide Status Form' : 'Update Lifecycle / Work Log'}</span>
            </button>
          </div>

          {/* Stepper bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5 pt-1">
            {LIFECYCLE_STAGES.map((st, idx) => {
              const currentIdx = LIFECYCLE_STAGES.findIndex((s) => s.key === currentLifecycle);
              const isPast = idx < currentIdx;
              const isCurrent = st.key === currentLifecycle;

              return (
                <div
                  key={st.key}
                  className={`p-2 rounded-lg border text-center transition-all ${
                    isCurrent
                      ? 'bg-cyan-950/80 border-cyan-400/80 text-cyan-200 shadow-sm'
                      : isPast
                      ? 'bg-slate-950/60 border-slate-700/60 text-slate-300'
                      : 'bg-slate-950/20 border-slate-800/40 text-slate-500'
                  }`}
                >
                  <div className="text-[10px] font-bold truncate">
                    {st.label}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5 line-clamp-1">
                    {isCurrent ? 'Current Phase' : isPast ? 'Done' : 'Pending'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status Note explaining automatic red dot removal */}
          <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
            <span>
              Map Behavior:{' '}
              {currentLifecycle === 'Repaired and Verified' ? (
                <strong className="text-emerald-400">
                  Repaired & Verified (Red dot removed from active map; saved in Repaired History)
                </strong>
              ) : currentLifecycle === 'Repair Completed — Awaiting Verification' ? (
                <strong className="text-amber-400">
                  Awaiting Verification (Amber marker on map)
                </strong>
              ) : (
                <strong className="text-rose-400">
                  Active Unresolved Pothole (Visible as small red dot on Google Maps)
                </strong>
              )}
            </span>
            {report.verifiedDate && (
              <span className="text-emerald-400 font-mono text-[10px]">
                Verified on {new Date(report.verifiedDate).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Status Lifecycle Update Form (collapsible) */}
        {isEditingLifecycle && (
          <form
            onSubmit={handleSaveStatusUpdate}
            className="p-4 bg-slate-950/90 border border-cyan-500/40 rounded-xl space-y-4 animate-in fade-in duration-200"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>Authorized Status Update & Repair Documentation</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                Authentic audit record (No simulated repairs)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  New Lifecycle Status:
                </label>
                <select
                  value={targetStatus}
                  onChange={(e) => setTargetStatus(e.target.value as ReportLifecycleStatus)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-400"
                >
                  {LIFECYCLE_STAGES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label} — {s.desc}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Responsible Road Crew / Inspector:
                </label>
                <input
                  type="text"
                  value={responsiblePersonnel}
                  onChange={(e) => setResponsiblePersonnel(e.target.value)}
                  placeholder="e.g. District Road Crew #2 / Inspector J. Doe"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Inspection / Field Triage Notes:
                </label>
                <textarea
                  rows={2}
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="Physical measurements, cavity depth, sub-base condition verified..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">
                  Repair Work & Materials Notes:
                </label>
                <textarea
                  rows={2}
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  placeholder="Compaction infill method, hot/cold mix used, square meters restored..."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>

              {targetStatus === 'Repaired and Verified' && (
                <div className="sm:col-span-2 p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-2">
                  <label className="block text-emerald-300 font-semibold">
                    Sign-Off Verification Evidence (Mandatory for Removal of Red Dot):
                  </label>
                  <input
                    type="text"
                    value={verificationEvidence}
                    onChange={(e) => setVerificationEvidence(e.target.value)}
                    placeholder="e.g. Supervisor confirmed smooth flush grade and road opened to traffic on 2026-10-15"
                    required
                    className="w-full px-3 py-2 bg-slate-900 border border-emerald-600/60 rounded-lg text-white text-xs placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                  <p className="text-[10px] text-slate-400">
                    Per municipality protocol, AI predictions alone cannot mark repairs completed. Authentic physical verification by authorized personnel removes the active red dot.
                  </p>
                </div>
              )}
            </div>

            {/* After repair photo attachment */}
            <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300 font-medium">After-Repair Photograph:</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="text-[11px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[11px] file:bg-slate-800 file:text-cyan-300 hover:file:bg-slate-700"
                />
              </div>

              {afterPhotoPreview && (
                <div className="flex items-center gap-2">
                  <img
                    src={afterPhotoPreview}
                    alt="After repair preview"
                    className="w-10 h-10 object-cover rounded border border-cyan-500"
                  />
                  <button
                    type="button"
                    onClick={() => setAfterPhotoPreview(null)}
                    className="text-[10px] text-rose-400 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingLifecycle(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-cyan-950"
              >
                <Check className="w-4 h-4" />
                <span>Save Status & Sync Map</span>
              </button>
            </div>
          </form>
        )}

        {/* Practical Real-World Road Repair Recommendations Card (Section 1) */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">
                Practical Real-World Road Repair Recommendations
              </h3>
            </div>
            <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
              Urgency: {practicalRec.inspectionUrgency}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Detected Damage Categories */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Detected Damage Categories (AI Verified):
                </span>
                {report.isCountUnavailable ? (
                  <span className="text-[10px] text-amber-300 font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                    Count unavailable
                  </span>
                ) : typeof report.potholeCount === 'number' ? (
                  <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                    {report.potholeCount} Pothole(s)
                  </span>
                ) : null}
              </div>

              {report.roadConditionReport?.detectedDamageTypes &&
              report.roadConditionReport.detectedDamageTypes.length > 0 ? (
                <div className="space-y-1.5">
                  {report.roadConditionReport.detectedDamageTypes.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] bg-slate-900 px-2.5 py-1.5 rounded border border-slate-800/60"
                    >
                      <span className="font-medium text-slate-200">{item.category}</span>
                      {item.countUnavailable || item.count === null ? (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
                          Count unavailable
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/40">
                          Count: {item.count}
                        </span>
                      )}
                    </div>
                  ))}
                  {report.isCountUnavailable && (
                    <p className="text-[10px] text-amber-400/80 italic">
                      Note: Visual overlay rendered. Hugging Face Space returns an annotated image only without structured bounding-box counts.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {practicalRec.detectedDamageCategories.map((cat, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-mono text-[11px]"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Preliminary Severity & Priority */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Preliminary Severity & Inspection Priority:
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded border font-semibold ${getPriorityBadge(report.priority)}`}>
                  Severity: {report.preliminarySeverity}
                </span>
                <span className="text-slate-400 text-xs">
                  Priority: <strong className="text-white">{report.priority}</strong>
                </span>
                {report.overallCondition && (
                  <span className="text-cyan-300 font-mono text-[11px] bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                    {report.overallCondition}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Suggested Repair Approach for Assessment by Qualified Personnel */}
          <div className="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Suggested Repair Approach for Assessment by Road Crew:</span>
            </span>
            <p className="text-slate-300 leading-relaxed text-xs">
              {practicalRec.suggestedRepairApproach}
            </p>
          </div>

          {/* Urgency Reasons & Recommended Action */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <span className="font-semibold text-slate-300">Inspection Urgency Rationale:</span>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                {practicalRec.urgencyReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <span className="font-semibold text-cyan-400">Recommended Real-World Action:</span>
              <p className="text-slate-200 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 leading-relaxed">
                {practicalRec.recommendedAction}
              </p>
            </div>
          </div>

          {/* Disclaimer & On-Site Inspection Required Notice */}
          <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-amber-200">
                On-Site Field Inspection Required Prior to Civil Works:
              </span>
              <p className="leading-relaxed text-amber-300/90">
                {practicalRec.disclaimer}
              </p>
            </div>
          </div>
        </div>

        {/* Media Inspection View (Original & AI-annotated) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Pothole Photographic Evidence & AI Visual Annotations</span>
            </span>
            <span className="text-slate-400 text-[11px] font-mono">
              Detection Threshold: {Math.round(report.confidenceThreshold * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Original Image */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400">Original Roadway Photo</div>
              <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                {report.originalImagePreview ? (
                  <img
                    src={report.originalImagePreview}
                    alt="Original pavement"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center p-4 text-xs text-slate-500">
                    Original media preserved in session memory
                  </div>
                )}
              </div>
            </div>

            {/* AI Annotated Result */}
            <div className="space-y-1.5">
              <div className="text-[11px] text-cyan-300 font-medium">
                AI Annotated Detection Overlay
              </div>
              <div className="relative rounded-xl overflow-hidden bg-black border border-cyan-500/30 aspect-video flex items-center justify-center">
                {report.annotatedImageUrl ? (
                  <img
                    src={report.annotatedImageUrl}
                    alt="AI Annotated"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : report.annotatedVideoUrl ? (
                  <video
                    src={report.annotatedVideoUrl}
                    controls
                    className="max-h-full max-w-full"
                  />
                ) : (
                  <div className="text-center p-4 text-xs text-slate-500">
                    No visual media annotation attached
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Before and After Repair Photographs (when present) */}
        {(report.beforeRepairPhoto || report.afterRepairPhoto) && (
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3 text-xs">
            <span className="font-semibold text-white flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-emerald-400" />
              <span>Before & After Road Restoration Verification</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {report.beforeRepairPhoto && (
                <div>
                  <div className="text-[11px] text-slate-400 mb-1">Pre-Repair Defect</div>
                  <img
                    src={report.beforeRepairPhoto}
                    alt="Before repair"
                    className="rounded-lg border border-slate-800 max-h-48 object-cover w-full"
                  />
                </div>
              )}
              {report.afterRepairPhoto && (
                <div>
                  <div className="text-[11px] text-emerald-300 mb-1">Restored & Verified Roadway</div>
                  <img
                    src={report.afterRepairPhoto}
                    alt="After repair"
                    className="rounded-lg border border-emerald-500/40 max-h-48 object-cover w-full"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Inspector & Repair Notes History */}
        {(report.inspectionNotes || report.repairNotes || report.verificationEvidence) && (
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-2 text-xs">
            <span className="font-semibold text-white">Historical Resolution & Crew Log:</span>
            {report.responsiblePersonnel && (
              <p className="text-slate-300">
                <strong className="text-slate-400">Assigned Team:</strong> {report.responsiblePersonnel}
              </p>
            )}
            {report.inspectionNotes && (
              <p className="text-slate-300">
                <strong className="text-slate-400">Inspection Note:</strong> {report.inspectionNotes}
              </p>
            )}
            {report.repairNotes && (
              <p className="text-slate-300">
                <strong className="text-slate-400">Repair Note:</strong> {report.repairNotes}
              </p>
            )}
            {report.verificationEvidence && (
              <p className="text-emerald-300">
                <strong className="text-emerald-400">Verification Evidence:</strong> {report.verificationEvidence}
              </p>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {showDeleteConfirm ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-400 font-medium">
                Confirm permanent deletion?
              </span>
              <button
                type="button"
                onClick={() => {
                  onDeleteReport(report.id);
                  onClose();
                }}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                Confirm Delete
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Report</span>
            </button>
          )}

          <div className="flex items-center gap-2">
            {!isEditingLifecycle && (
              <button
                type="button"
                onClick={() => setIsEditingLifecycle(true)}
                className="px-3 py-1.5 text-xs font-medium text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Hammer className="w-3.5 h-3.5" />
                <span>Update Lifecycle</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              Close Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
