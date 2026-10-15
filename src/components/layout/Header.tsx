import React from 'react';
import {
  Menu,
  Activity,
  RefreshCw,
  PlusCircle,
  ExternalLink,
} from 'lucide-react';
import { ActivePage, ServiceHealthStatus } from '../../types';

interface HeaderProps {
  activePage: ActivePage;
  serviceStatus: ServiceHealthStatus;
  onRefreshHealth: () => void;
  isCheckingHealth: boolean;
  onOpenMobileMenu: () => void;
  onNavigate: (page: ActivePage) => void;
}

const PAGE_TITLES: Record<ActivePage, { title: string; subtitle: string }> = {
  overview: {
    title: 'Operations Overview',
    subtitle: 'System dashboard, recent analyses, and road condition activity',
  },
  detection: {
    title: 'AI Image Detection',
    subtitle: 'Upload pavement photography for automated pothole detection',
  },
  live: {
    title: 'Real-Time Live Monitoring',
    subtitle: 'Continuous camera feed surveillance with automated pothole snapshot capture',
  },
  video: {
    title: 'Road Video Analysis',
    subtitle: 'Analyze continuous roadway video recordings for surface anomalies',
  },
  map: {
    title: 'Interactive Road Map',
    subtitle: 'Geographic visualization of localized road damage reports',
  },
  reports: {
    title: 'Damage Reports',
    subtitle: 'Audited log of citizen & inspector damage submissions',
  },
  priorities: {
    title: 'Repair Priority Queue',
    subtitle: 'Triage prioritization heuristic for municipal maintenance teams',
  },
  about: {
    title: 'About RoadGuard AI',
    subtitle: 'Architecture, YOLO pothole detection model, and methodology',
  },
};

export const Header: React.FC<HeaderProps> = ({
  activePage,
  serviceStatus,
  onRefreshHealth,
  isCheckingHealth,
  onOpenMobileMenu,
  onNavigate,
}) => {
  const current = PAGE_TITLES[activePage];

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-slate-800/80 bg-[#080D18]/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>RoadGuard AI</span>
            <span aria-hidden="true">/</span>
            <span className="text-cyan-400 capitalize">{activePage}</span>
          </div>
          <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight truncate">
            {current.title}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Real Service Reachability Status */}
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs ${
            !serviceStatus.checked
              ? 'border-slate-700 bg-slate-900/60 text-slate-400'
              : serviceStatus.isOnline
              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
              : 'border-amber-500/30 bg-amber-950/20 text-amber-300'
          }`}
          title={
            serviceStatus.errorMessage ||
            (serviceStatus.isOnline
              ? `Hugging Face Space '${serviceStatus.stage || 'RUNNING'}' reachable (${serviceStatus.latencyMs}ms)`
              : 'Service status unconfirmed')
          }
        >
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline font-mono">
            {!serviceStatus.checked
              ? 'Service: Unchecked'
              : serviceStatus.isOnline
              ? `Space: ${serviceStatus.stage || 'Online'} (${serviceStatus.latencyMs}ms)`
              : `Space: ${serviceStatus.stage || 'Offline'}`}
          </span>
          <span className="sm:hidden font-mono">
            {!serviceStatus.checked ? 'Unchecked' : serviceStatus.isOnline ? 'Online' : 'Offline'}
          </span>
          <button
            type="button"
            onClick={onRefreshHealth}
            disabled={isCheckingHealth}
            className="p-0.5 hover:text-white text-slate-400 transition-colors disabled:opacity-40"
            aria-label="Re-check Hugging Face Space health"
          >
            <RefreshCw
              className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin text-cyan-400' : ''}`}
            />
          </button>
        </div>

        {/* Quick action button */}
        {activePage !== 'detection' && (
          <button
            type="button"
            onClick={() => onNavigate('detection')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-md transition-colors shadow-sm"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Analyze Image</span>
          </button>
        )}

        <a
          href="https://huggingface.co/spaces/Sahildandotiya/pothole-detector"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden xl:flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1 rounded"
          title="Open Hugging Face Space source"
        >
          <span>HF Space</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </header>
  );
};
