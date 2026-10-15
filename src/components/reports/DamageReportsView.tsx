import React, { useState } from 'react';
import {
  FileText,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  PlusCircle,
  Calendar,
  MapPin,
  ChevronRight,
  Sparkles,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import { DamagePriority, DamageReport, ReportLifecycleStatus, ReportStatus } from '../../types';
import { ReportDetailModal } from './ReportDetailModal';
import { ReportStatusUpdatePayload } from '../../services/reportStorage';
import { isReportUnresolved, normalizeReportStatus } from '../../services/repairRecommendations';

interface DamageReportsViewProps {
  reports: DamageReport[];
  onUpdateStatus: (id: string, update: ReportStatus | ReportStatusUpdatePayload) => void;
  onDeleteReport: (id: string) => void;
  onNavigateToDetection: () => void;
  onSeedSamples: () => void;
}

export const DamageReportsView: React.FC<DamageReportsViewProps> = ({
  reports,
  onUpdateStatus,
  onDeleteReport,
  onNavigateToDetection,
  onSeedSamples,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  // Priority weight for sorting
  const priorityWeight: Record<DamagePriority, number> = {
    Critical: 4,
    High: 3,
    Medium: 2,
    Low: 1,
  };

  // Filtered & Sorted reports
  const filteredReports = reports
    .filter((report) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = report.roadName?.toLowerCase().includes(q);
        const matchesNotes = report.userNotes?.toLowerCase().includes(q);
        const matchesId = report.id.toLowerCase().includes(q);
        if (!matchesName && !matchesNotes && !matchesId) return false;
      }
      // Status
      const norm = normalizeReportStatus(report.status);
      if (statusFilter === 'unresolved' && !isReportUnresolved(report.status)) return false;
      if (statusFilter === 'repaired' && isReportUnresolved(report.status)) return false;
      if (
        statusFilter !== 'all' &&
        statusFilter !== 'unresolved' &&
        statusFilter !== 'repaired' &&
        norm !== statusFilter &&
        report.status !== statusFilter
      ) {
        return false;
      }
      // Priority
      if (priorityFilter !== 'all' && report.priority !== priorityFilter) return false;

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === 'priority') {
        return priorityWeight[b.priority] - priorityWeight[a.priority];
      }
      return 0;
    });

  // Export JSON
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reports, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `roadguard_reports_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Export CSV
  const handleExportCSV = () => {
    if (reports.length === 0) return;
    const headers = ['ID', 'RoadName', 'Latitude', 'Longitude', 'Status', 'Priority', 'Severity', 'Confidence', 'CreatedAt', 'Notes'];
    const rows = reports.map((r) => [
      `"${r.id}"`,
      `"${(r.roadName || '').replace(/"/g, '""')}"`,
      r.latitude ?? '',
      r.longitude ?? '',
      r.status,
      r.priority,
      r.userSeverity,
      r.confidenceThreshold,
      r.createdAt,
      `"${(r.userNotes || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `roadguard_reports_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const getPriorityStyle = (p: DamagePriority) => {
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

  const getStatusStyle = (s: ReportStatus) => {
    const norm = normalizeReportStatus(s);
    switch (norm) {
      case 'Repaired and Verified':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'Repair Completed — Awaiting Verification':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'Repair in Progress':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30';
      case 'Repair Recommended':
      case 'Inspection Completed':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30';
      case 'Awaiting Inspection':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30';
      default:
        return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Top Filter and Controls Bar */}
      <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reports by road name, notes, or ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Action buttons: Export & New Report */}
          <div className="flex items-center gap-2 shrink-0">
            {reports.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Export reports as CSV"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center gap-1.5"
                  title="Export reports as JSON"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>JSON</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onNavigateToDetection}
              className="px-3 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>New Analysis</span>
            </button>
          </div>
        </div>

        {/* Filter Badges & Sorters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs">
          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 mr-1 text-[11px]">Status:</span>
            {[
              { id: 'all', label: 'All Status' },
              { id: 'unresolved', label: 'Active Unresolved' },
              { id: 'Awaiting Inspection', label: 'Awaiting Inspection' },
              { id: 'Repair in Progress', label: 'In Progress' },
              { id: 'repaired', label: 'Repaired & Verified' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setStatusFilter(st.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                  statusFilter === st.id
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          {/* Priority Filter */}
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
                {pr === 'all' ? 'All Priorities' : pr}
              </button>
            ))}
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px]">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'priority')}
              className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500 cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">Highest Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length > 0 ? (
        <div className="space-y-3">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className="bg-[#111827] border border-slate-800 hover:border-slate-700/80 rounded-xl p-4 transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5 min-w-0">
                {/* Media thumbnail */}
                <div
                  onClick={() => setSelectedReport(report)}
                  className="w-16 h-14 rounded-lg overflow-hidden bg-black border border-slate-800 shrink-0 cursor-pointer hover:border-cyan-400/50 transition-colors flex items-center justify-center"
                >
                  {report.annotatedImageUrl ? (
                    <img
                      src={report.annotatedImageUrl}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : report.originalImagePreview ? (
                    <img
                      src={report.originalImagePreview}
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <FileText className="w-5 h-5 text-slate-600" />
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-cyan-400">
                      {report.id}
                    </span>
                    {report.isSample && (
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                        Sample
                      </span>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${getPriorityStyle(report.priority)}`}>
                      {report.priority} Priority
                    </span>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${getStatusStyle(report.status)}`}>
                      {report.status}
                    </span>
                    {report.isCountUnavailable ? (
                      <span className="text-[10px] font-mono bg-amber-950/40 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/40">
                        Count unavailable
                      </span>
                    ) : typeof report.potholeCount === 'number' ? (
                      <span className="text-[10px] font-mono bg-cyan-950/40 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        {report.potholeCount} Pothole(s)
                      </span>
                    ) : null}
                  </div>

                  <h3
                    onClick={() => setSelectedReport(report)}
                    className="text-sm font-semibold text-white hover:text-cyan-300 cursor-pointer transition-colors truncate"
                  >
                    {report.roadName || 'Unnamed Road Segment'}
                  </h3>

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                    </span>
                    {report.latitude && report.longitude && (
                      <span className="flex items-center gap-1 font-mono text-slate-300">
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        <span>
                          {report.latitude.toFixed(4)}, {report.longitude.toFixed(4)}
                        </span>
                      </span>
                    )}
                    {report.userNotes && (
                      <span className="truncate max-w-xs text-slate-400">
                        &ldquo;{report.userNotes}&rdquo;
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Quick Select & Open Action */}
              <div className="flex items-center gap-3 self-end md:self-center shrink-0">
                <select
                  value={normalizeReportStatus(report.status)}
                  onChange={(e) => onUpdateStatus(report.id, e.target.value as ReportStatus)}
                  className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 cursor-pointer"
                >
                  <option value="Reported">1. Reported</option>
                  <option value="Awaiting Inspection">2. Awaiting Inspection</option>
                  <option value="Inspection Completed">3. Inspection Completed</option>
                  <option value="Repair Recommended">4. Repair Recommended</option>
                  <option value="Repair in Progress">5. In Progress</option>
                  <option value="Repair Completed — Awaiting Verification">6. Completed (Pending Audit)</option>
                  <option value="Repaired and Verified">7. Repaired &amp; Verified</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSelectedReport(report)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-800 transition-colors"
                  title="View report details"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Honest Empty State */
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-white">No Damage Reports Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
            {reports.length === 0
              ? 'No damage reports have been submitted yet. Run an AI image or video analysis to generate an annotated detection, then save it to this registry.'
              : 'No reports matched your current search filters. Try clearing the search query or adjusting priority/status filters.'}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
            <button
              type="button"
              onClick={onNavigateToDetection}
              className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Analyze First Road Image</span>
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
