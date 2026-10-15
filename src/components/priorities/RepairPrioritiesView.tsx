import React, { useState } from 'react';
import {
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  Sliders,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { DamagePriority, DamageReport, ReportStatus } from '../../types';
import { ReportDetailModal } from '../reports/ReportDetailModal';
import { ReportStatusUpdatePayload } from '../../services/reportStorage';
import { isReportUnresolved, normalizeReportStatus } from '../../services/repairRecommendations';

interface RepairPrioritiesViewProps {
  reports: DamageReport[];
  onUpdateStatus: (id: string, update: ReportStatus | ReportStatusUpdatePayload) => void;
  onDeleteReport: (id: string) => void;
  onNavigateToDetection: () => void;
  onSeedSamples: () => void;
}

export const RepairPrioritiesView: React.FC<RepairPrioritiesViewProps> = ({
  reports,
  onUpdateStatus,
  onDeleteReport,
  onNavigateToDetection,
  onSeedSamples,
}) => {
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('active'); // active = unresolved
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  // Priority weight
  const priorityWeight: Record<DamagePriority, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  const filteredQueue = reports
    .filter((r) => {
      const isUnresolved = isReportUnresolved(r.status);
      if (statusFilter === 'active' && !isUnresolved) return false;
      if (statusFilter === 'resolved' && isUnresolved) return false;
      if (priorityFilter !== 'all' && r.priority !== priorityFilter) return false;
      return true;
    })
    .sort((a, b) => {
      // Sort primarily by priority weight desc, then by date asc (older first)
      const diff = priorityWeight[b.priority] - priorityWeight[a.priority];
      if (diff !== 0) return diff;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

  const getPriorityStyle = (p: DamagePriority) => {
    switch (p) {
      case 'Critical':
        return 'border-rose-500/40 bg-rose-950/20 text-rose-300';
      case 'High':
        return 'border-amber-500/40 bg-amber-950/20 text-amber-300';
      case 'Medium':
        return 'border-yellow-500/40 bg-yellow-950/20 text-yellow-300';
      case 'Low':
        return 'border-sky-500/40 bg-sky-950/20 text-sky-300';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Transparency Header & Methodology Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-cyan-400">
          <Sliders className="w-5 h-5 shrink-0" />
          <h2 className="text-base font-semibold text-white">
            Preliminary Inspection-Priority Heuristic Queue
          </h2>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          This dispatch queue prioritizes municipal road verification by evaluating observable attributes: field-assessed visual severity, exact GPS coordinate accessibility, and open ticket age.
        </p>

        {/* Disclaimer Callout */}
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-lg text-[11px] text-slate-400 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-slate-200">
              Operational Disclaimer:
            </span>
            <p>
              This heuristic is designed to help organize and triage physical inspection workflows. It is not an automated civil engineering certification, pavement roughness (IRI) index, or structural integrity calculation. On-site field verification by authorized road engineering personnel is strictly required.
            </p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-400 mr-1 text-[11px]">Lifecycle:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Active Triage Queue
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Records
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('resolved')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                statusFilter === 'resolved'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Resolved History
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 mr-1 text-[11px]">Priority:</span>
            {['all', 'Critical', 'High', 'Medium', 'Low'].map((pr) => (
              <button
                key={pr}
                type="button"
                onClick={() => setPriorityFilter(pr)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  priorityFilter === pr
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {pr === 'all' ? 'All' : pr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Queue List */}
      {filteredQueue.length > 0 ? (
        <div className="space-y-3">
          {filteredQueue.map((report, idx) => (
            <div
              key={report.id}
              className={`bg-[#111827] border rounded-xl p-5 shadow-sm transition-all space-y-3 ${
                report.priority === 'Critical'
                  ? 'border-rose-900/60'
                  : report.priority === 'High'
                  ? 'border-amber-900/60'
                  : 'border-slate-800'
              }`}
            >
              {/* Row Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-md bg-slate-900 border border-slate-800 flex items-center justify-center font-mono text-xs font-bold text-slate-300">
                    #{idx + 1}
                  </span>
                  <span className="font-mono text-xs text-cyan-400 font-semibold">
                    {report.id}
                  </span>
                  {report.isSample && (
                    <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                      Sample
                    </span>
                  )}
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${getPriorityStyle(report.priority)}`}>
                    {report.priority} Priority
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400">Status:</span>
                  <span className="font-medium text-slate-200">{report.status}</span>
                </div>
              </div>

              {/* Content Grid */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                {/* Media Thumbnail */}
                <div className="md:col-span-3">
                  <div
                    onClick={() => setSelectedReport(report)}
                    className="relative aspect-video rounded-lg overflow-hidden bg-black border border-slate-800 cursor-pointer hover:border-cyan-400/50 transition-colors flex items-center justify-center"
                  >
                    {report.annotatedImageUrl ? (
                      <img
                        src={report.annotatedImageUrl}
                        alt="Damage visual"
                        className="w-full h-full object-cover"
                      />
                    ) : report.originalImagePreview ? (
                      <img
                        src={report.originalImagePreview}
                        alt="Original visual"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-[11px] text-slate-400">No media stored</div>
                    )}
                  </div>
                </div>

                {/* Details & Rationale */}
                <div className="md:col-span-6 space-y-1.5">
                  <h3
                    onClick={() => setSelectedReport(report)}
                    className="text-sm font-semibold text-white hover:text-cyan-300 cursor-pointer transition-colors"
                  >
                    {report.roadName || 'Unnamed Road Segment'}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </span>
                    {report.latitude && report.longitude && (
                      <span className="flex items-center gap-1 font-mono text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                        <span>
                          {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Priority Factors List */}
                  {report.priorityRationale && (
                    <div className="pt-1">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                        Priority Calibration Rationale:
                      </div>
                      <ul className="text-[11px] text-slate-300 space-y-0.5 list-disc pl-4">
                        {report.priorityRationale.map((f, i) => (
                          <li key={i}>{f}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Maintenance Triage Actions */}
                <div className="md:col-span-3 flex flex-col gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <div className="text-[11px] text-slate-400">Dispatch Actions:</div>
                  {report.status === 'New' && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(report.id, 'Under Review')}
                      className="px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-800/60 rounded-lg text-xs font-medium transition-colors text-center"
                    >
                      Assign to Field Team
                    </button>
                  )}

                  {report.status === 'Under Review' && (
                    <button
                      type="button"
                      onClick={() => onUpdateStatus(report.id, 'Resolved')}
                      className="px-3 py-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 rounded-lg text-xs font-medium transition-colors text-center"
                    >
                      Mark Repaired / Resolved
                    </button>
                  )}

                  {report.status === 'Resolved' && (
                    <div className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Repair Verified</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setSelectedReport(report)}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs rounded-lg border border-slate-800 transition-colors text-center"
                  >
                    View Full Audit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">
            Dispatch Queue Clear
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {reports.length === 0
              ? 'No damage reports have been registered. Once road images are analyzed and reports saved, they appear in this prioritized queue.'
              : 'All pending reports in this filter category have been resolved or filtered out.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={onNavigateToDetection}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm"
            >
              Analyze Road Photo
            </button>
            {reports.length === 0 && (
              <button
                type="button"
                onClick={onSeedSamples}
                className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Load 3 Illustrative Samples</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <ReportDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onUpdateStatus={(id, st) => {
          onUpdateStatus(id, st);
          if (selectedReport && selectedReport.id === id) {
            const nextStatus = typeof st === 'string' ? st : st.status;
            setSelectedReport({ ...selectedReport, status: nextStatus });
          }
        }}
        onDeleteReport={(id) => {
          onDeleteReport(id);
          setSelectedReport(null);
        }}
      />
    </div>
  );
};
