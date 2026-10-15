import React, { useState, useEffect, useCallback } from 'react';
import { ActivePage, DamageReport, ReportStatus, ServiceHealthStatus } from './types';
import {
  getStoredReports,
  saveReportToStorage,
  updateStoredReportStatus,
  deleteStoredReport,
  getIllustrativeSamples,
  ReportStatusUpdatePayload,
} from './services/reportStorage';
import { checkServiceHealth } from './services/roadDamageApi';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { OverviewView } from './components/overview/OverviewView';
import { ImageDetectionView } from './components/detection/ImageDetectionView';
import { LiveMonitoringView } from './components/live/LiveMonitoringView';
import { VideoAnalysisView } from './components/video/VideoAnalysisView';
import { RoadMapView } from './components/map/RoadMapView';
import { DamageReportsView } from './components/reports/DamageReportsView';
import { RepairPrioritiesView } from './components/priorities/RepairPrioritiesView';
import { AboutView } from './components/about/AboutView';
import { ReportDetailModal } from './components/reports/ReportDetailModal';

export default function App() {
  const [activePage, setActivePage] = useState<ActivePage>('overview');
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);
  const [isMobileOpen, setIsMobileOpen] = useState<boolean>(false);

  // Real Service Health
  const [serviceStatus, setServiceStatus] = useState<ServiceHealthStatus>({
    checked: false,
    isOnline: false,
  });
  const [isCheckingHealth, setIsCheckingHealth] = useState<boolean>(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState<boolean>(false);

  // Listen to Google Maps Platform quota defense event
  useEffect(() => {
    const handleQuota = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Load stored reports on initial mount
  useEffect(() => {
    const loaded = getStoredReports();
    setReports(loaded);
  }, []);

  // Health check on initial mount
  const runHealthCheck = useCallback(async () => {
    setIsCheckingHealth(true);
    try {
      const status = await checkServiceHealth();
      setServiceStatus(status);
    } catch {
      setServiceStatus({
        checked: true,
        isOnline: false,
        errorMessage: 'Network failure when querying Hugging Face API',
      });
    } finally {
      setIsCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  // Report Actions
  const handleSaveReport = (newReport: DamageReport) => {
    saveReportToStorage(newReport);
    setReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)]);
  };

  const handleUpdateStatus = (
    id: string,
    update: ReportStatus | ReportStatusUpdatePayload
  ) => {
    const updated = updateStoredReportStatus(id, update);
    setReports(updated);
    if (selectedReport && selectedReport.id === id) {
      const refreshed = updated.find((r) => r.id === id);
      setSelectedReport(refreshed || null);
    }
  };

  const handleDeleteReport = (id: string) => {
    const updated = deleteStoredReport(id);
    setReports(updated);
    if (selectedReport && selectedReport.id === id) {
      setSelectedReport(null);
    }
  };

  const handleSeedSamples = () => {
    const samples = getIllustrativeSamples();
    samples.forEach((sample) => saveReportToStorage(sample));
    setReports(getStoredReports());
  };

  return (
    <div className="min-h-screen bg-[#080D18] text-slate-100 flex flex-col antialiased">
      <div className="flex flex-1 min-h-screen">
        {/* Desktop Sidebar & Mobile Drawer */}
        <Sidebar
          activePage={activePage}
          onNavigate={(page) => {
            setActivePage(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          reports={reports}
          isMobileOpen={isMobileOpen}
          onCloseMobile={() => setIsMobileOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            activePage={activePage}
            serviceStatus={serviceStatus}
            onRefreshHealth={runHealthCheck}
            isCheckingHealth={isCheckingHealth}
            onOpenMobileMenu={() => setIsMobileOpen(true)}
            onNavigate={(page) => {
              setActivePage(page);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />

          {gmpQuotaExceeded && (
            <div className="bg-amber-950/80 border-b border-amber-500/40 text-amber-200 px-4 py-2.5 text-xs text-center sticky top-16 z-40 shadow-sm backdrop-blur-sm">
              <span>
                Google Maps Platform quota reached. If you are the app owner, visit{' '}
                <a
                  href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-semibold text-amber-300 hover:text-amber-100"
                >
                  maps developer site
                </a>{' '}
                for instructions to update your account. (Switched to OpenStreetMap fallback)
              </span>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {activePage === 'overview' && (
              <OverviewView
                reports={reports}
                onNavigate={setActivePage}
                onSelectReport={setSelectedReport}
                onSeedSamples={handleSeedSamples}
              />
            )}

            {activePage === 'detection' && (
              <ImageDetectionView
                onSaveReport={handleSaveReport}
                onNavigateToReports={() => setActivePage('reports')}
              />
            )}

            {activePage === 'live' && (
              <LiveMonitoringView
                onSaveReport={handleSaveReport}
                onNavigateToReports={() => setActivePage('reports')}
              />
            )}

            {activePage === 'video' && (
              <VideoAnalysisView
                onSaveReport={handleSaveReport}
                onNavigateToReports={() => setActivePage('reports')}
              />
            )}

            {activePage === 'map' && (
              <RoadMapView
                reports={reports}
                onSelectReport={setSelectedReport}
                onNavigateToDetection={() => setActivePage('detection')}
                onSeedSamples={handleSeedSamples}
                onUpdateStatus={handleUpdateStatus}
              />
            )}

            {activePage === 'reports' && (
              <DamageReportsView
                reports={reports}
                onUpdateStatus={handleUpdateStatus}
                onDeleteReport={handleDeleteReport}
                onNavigateToDetection={() => setActivePage('detection')}
                onSeedSamples={handleSeedSamples}
              />
            )}

            {activePage === 'priorities' && (
              <RepairPrioritiesView
                reports={reports}
                onUpdateStatus={handleUpdateStatus}
                onDeleteReport={handleDeleteReport}
                onNavigateToDetection={() => setActivePage('detection')}
                onSeedSamples={handleSeedSamples}
              />
            )}

            {activePage === 'about' && <AboutView />}
          </main>
        </div>
      </div>

      {/* Global Report Detail Modal for clicks from Map or Overview */}
      <ReportDetailModal
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        onUpdateStatus={handleUpdateStatus}
        onDeleteReport={handleDeleteReport}
      />
    </div>
  );
}
