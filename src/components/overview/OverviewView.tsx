import React from 'react';
import {
  ShieldAlert,
  ScanEye,
  Radio,
  Video,
  MapPin,
  FileText,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { ActivePage, DamageReport } from '../../types';

interface OverviewViewProps {
  reports: DamageReport[];
  onNavigate: (page: ActivePage) => void;
  onSelectReport: (report: DamageReport) => void;
  onSeedSamples: () => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  reports,
  onNavigate,
  onSelectReport,
  onSeedSamples,
}) => {
  const totalReports = reports.length;
  const imageReports = reports.filter((r) => r.mediaType === 'image');
  const openReports = reports.filter((r) => r.status !== 'Resolved');
  const criticalReports = reports.filter(
    (r) => r.status !== 'Resolved' && (r.priority === 'Critical' || r.priority === 'High')
  );
  const geocodedReports = reports.filter(
    (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number'
  );

  const recentReports = reports.slice(0, 5);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Hero Welcome & Quick Action Card */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 text-xs text-cyan-400 font-semibold tracking-wide uppercase">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Infrastructure Intelligence</span>
          </div>

          <h2 className="text-xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            Automated Road Damage Detection & Repair Triage
          </h2>

          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Connect directly to real computer vision inference models to detect pavement potholes, record geocoded field reports, and prioritize municipal roadway maintenance.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('detection')}
              className="px-4 py-2.5 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-xl transition-all flex items-center gap-2 shadow-md shadow-cyan-950"
            >
              <ScanEye className="w-4 h-4" />
              <span>Analyze Road Image</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('live')}
              className="px-4 py-2.5 text-xs font-bold text-cyan-300 bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-500/40 rounded-xl transition-all flex items-center gap-2 shadow-md shadow-cyan-950/40"
            >
              <Radio className="w-4 h-4 text-cyan-400" />
              <span>Live Road Monitoring</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('video')}
              className="px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl transition-colors flex items-center gap-2"
            >
              <Video className="w-4 h-4 text-cyan-400" />
              <span>Analyze Video File</span>
            </button>

            {reports.length === 0 && (
              <button
                type="button"
                onClick={onSeedSamples}
                className="px-3 py-2 text-xs text-slate-400 hover:text-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                <span>Load 3 Sample Reports</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Honest Operational KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Reports */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Total Reports Filed</span>
            <FileText className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {totalReports}
          </div>
          <div className="text-[10px] text-slate-400">
            {totalReports === 0 ? 'No submissions yet' : 'In local storage registry'}
          </div>
        </div>

        {/* KPI 2: Images Analyzed */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Images Analyzed</span>
            <ScanEye className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
            {imageReports.length}
          </div>
          <div className="text-[10px] text-slate-400">
            {imageReports.length === 0 ? 'Awaiting first image run' : 'Processed via YOLO Space'}
          </div>
        </div>

        {/* KPI 3: Awaiting Inspection */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>Pending Dispatch</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-300 tabular-nums">
            {openReports.length}
          </div>
          <div className="text-[10px] text-slate-400">
            {openReports.length === 0 ? 'Dispatch queue clear' : 'Active triage tickets'}
          </div>
        </div>

        {/* KPI 4: Critical / High Priority */}
        <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 shadow-sm space-y-1">
          <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
            <span>High/Critical Urgency</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-300 tabular-nums">
            {criticalReports.length}
          </div>
          <div className="text-[10px] text-slate-400">
            {criticalReports.length === 0 ? 'Zero critical alerts' : 'Requires field dispatch'}
          </div>
        </div>
      </div>

      {/* 2-Column Split: Recent Activity List & Map Overview preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Reports Activity (7 cols) */}
        <div className="lg:col-span-7 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>Recent Activity Registry</span>
            </h3>
            {totalReports > 0 && (
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>View all ({totalReports})</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>

          {recentReports.length > 0 ? (
            <div className="space-y-2.5">
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  onClick={() => onSelectReport(report)}
                  className="bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 p-3 rounded-lg flex items-center justify-between gap-3 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-10 rounded bg-black border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {report.annotatedImageUrl ? (
                        <img
                          src={report.annotatedImageUrl}
                          alt="Thumb"
                          className="w-full h-full object-cover"
                        />
                      ) : report.originalImagePreview ? (
                        <img
                          src={report.originalImagePreview}
                          alt="Thumb"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-600" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="text-xs font-semibold text-white truncate">
                        {report.roadName || 'Unnamed Road Anomaly'}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-2">
                        <span className="font-mono text-cyan-400">{report.id}</span>
                        <span>&middot;</span>
                        <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        {report.isSample && (
                          <>
                            <span>&middot;</span>
                            <span className="text-slate-400">Sample</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                        report.priority === 'Critical'
                          ? 'text-rose-400 bg-rose-500/10 border-rose-500/30'
                          : report.priority === 'High'
                          ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
                          : 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                      }`}
                    >
                      {report.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p className="text-xs">No road analyses performed yet.</p>
              <p className="text-[11px] text-slate-400">
                Click "Analyze Road Image" above to test the hosted YOLO pothole detector.
              </p>
            </div>
          )}
        </div>

        {/* Map Preview & Geo Summary (5 cols) */}
        <div className="lg:col-span-5 bg-[#111827] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" />
                <span>Geographic Overview</span>
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('map')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <span>Open Full Map</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Real interactive OpenStreetMap layer displaying localized damage reports color-coded by inspection urgency.
            </p>
          </div>

          {/* Interactive Preview Container */}
          <div
            onClick={() => onNavigate('map')}
            className="my-3 p-4 bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-xl cursor-pointer transition-all space-y-3 group"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 font-medium">Mapped Incidents</span>
              <span className="font-mono text-cyan-400 font-semibold">
                {geocodedReports.length} Plotted
              </span>
            </div>

            <div className="h-28 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center relative overflow-hidden group-hover:border-cyan-400/40 transition-colors">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#22d3ee_1px,transparent_1px)] [background-size:16px_16px]" />
              <div className="text-center space-y-1 z-10 p-2">
                <MapPin className="w-6 h-6 text-cyan-400 mx-auto" />
                <span className="text-[11px] font-medium text-slate-300 block">
                  Click to Explore Interactive Map
                </span>
                <span className="text-[10px] text-slate-400 block font-mono">
                  OpenStreetMap & CARTO Tiles
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Model: Pothole Detection</span>
            <span className="text-cyan-400 font-mono">Sahildandotiya Space</span>
          </div>
        </div>
      </div>
    </div>
  );
};
