import React from 'react';
import {
  LayoutDashboard,
  ScanEye,
  Radio,
  Video,
  MapPin,
  FileText,
  AlertTriangle,
  Info,
  ShieldAlert,
  X,
  ChevronRight,
} from 'lucide-react';
import { ActivePage, DamageReport } from '../../types';

interface SidebarProps {
  activePage: ActivePage;
  onNavigate: (page: ActivePage) => void;
  reports: DamageReport[];
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  reports,
  isMobileOpen,
  onCloseMobile,
}) => {
  const openReportsCount = reports.filter((r) => r.status !== 'Resolved').length;
  const criticalReportsCount = reports.filter(
    (r) => r.status !== 'Resolved' && (r.priority === 'Critical' || r.priority === 'High')
  ).length;

  const navItems: Array<{
    id: ActivePage;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    badgeVariant?: 'cyan' | 'amber';
  }> = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'detection', label: 'AI Detection', icon: ScanEye },
    { id: 'live', label: 'Live Monitoring', icon: Radio },
    { id: 'video', label: 'Video Analysis', icon: Video },
    { id: 'map', label: 'Road Map', icon: MapPin },
    {
      id: 'reports',
      label: 'Damage Reports',
      icon: FileText,
      count: reports.length > 0 ? reports.length : undefined,
    },
    {
      id: 'priorities',
      label: 'Repair Priorities',
      icon: AlertTriangle,
      count: criticalReportsCount > 0 ? criticalReportsCount : undefined,
      badgeVariant: 'amber',
    },
    { id: 'about', label: 'About the Project', icon: Info },
  ];

  const handleNavClick = (page: ActivePage) => {
    onNavigate(page);
    onCloseMobile();
  };

  const content = (
    <div className="flex flex-col h-full bg-[#0B1120] border-r border-slate-800/90 w-64 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              <span>RoadGuard AI</span>
            </div>
            <p className="text-[11px] text-slate-400 tracking-normal">
              Intelligent Road Monitoring
            </p>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <div className="px-3 py-2 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
          Platform Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-cyan-400' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.count !== undefined ? (
                <span
                  className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                    item.badgeVariant === 'amber'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {item.count}
                </span>
              ) : isActive ? (
                <ChevronRight className="w-3.5 h-3.5 text-cyan-400/60 shrink-0" />
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Inspection Pipeline Banner */}
      <div className="p-3 mx-3 mb-3 rounded-lg bg-slate-900/80 border border-slate-800 text-xs">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          Workflow Pipeline
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 gap-1 overflow-x-auto">
          <span className="text-cyan-400 font-semibold">UPLOAD</span>
          <span>→</span>
          <span className="text-cyan-400 font-semibold">DETECT</span>
          <span>→</span>
          <span>ANALYZE</span>
          <span>→</span>
          <span>REPORT</span>
        </div>
      </div>

      {/* Footer / System status */}
      <div className="p-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span>Active Reports</span>
          <span className="font-mono text-slate-200">{openReportsCount}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>YOLOv8 Pothole Space</span>
          <span className="text-slate-400">HF Hosted</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (persistent) */}
      <aside className="hidden lg:block shrink-0 sticky top-0 h-screen z-20">
        {content}
      </aside>

      {/* Mobile Drawer (responsive overlay) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0B1120] z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
