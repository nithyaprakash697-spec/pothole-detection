import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileImage,
  AlertCircle,
  CheckCircle2,
  Sliders,
  Sparkles,
  RefreshCw,
  FileText,
  Trash2,
  Eye,
  Layers,
  HelpCircle,
  ExternalLink,
  Cpu,
  SplitSquareVertical,
  Activity,
  AlertTriangle,
  Info,
  MapPin,
  Clock,
  Printer,
  ShieldAlert,
  Check,
  FileCheck,
  Navigation,
} from 'lucide-react';
import { DamageReport, DetectionResult } from '../../types';
import { detectRoadDamageImage } from '../../services/roadDamageApi';
import { createSamplePotholeImageFile } from '../../services/sampleImages';
import { PipelineSteps } from '../common/PipelineSteps';
import { CreateReportModal } from '../reports/CreateReportModal';

interface ImageDetectionViewProps {
  onSaveReport: (report: DamageReport) => void;
  onNavigateToReports: () => void;
}

export const ImageDetectionView: React.FC<ImageDetectionViewProps> = ({
  onSaveReport,
  onNavigateToReports,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0.25);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeModelTab, setActiveModelTab] = useState<'combined' | 'ref' | 'model1' | 'model2'>('combined');
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);
  const [isGeneratingSample, setIsGeneratingSample] = useState<boolean>(false);
  const [detectedGps, setDetectedGps] = useState<{
    latitude: number;
    longitude: number;
    roadName?: string;
    isConfirmed: boolean;
  } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  const handleFileSelection = (file: File) => {
    setErrorMessage(null);
    setDetectionResult(null);

    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage(
        `Unsupported file type: ${file.type || 'unknown'}. Please select a JPEG, PNG, or WebP image.`
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed 10MB limit.`
      );
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setDetectionResult(null); // Reset count and detection data for new image
    setErrorMessage(null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setDetectionResult(null);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadSample = async (type: 'pothole' | 'cracked') => {
    setIsGeneratingSample(true);
    setErrorMessage(null);
    try {
      const sampleFile = await createSamplePotholeImageFile(type);
      handleFileSelection(sampleFile);
    } catch (err) {
      setErrorMessage('Failed to generate sample image: ' + String(err));
    } finally {
      setIsGeneratingSample(false);
    }
  };

  const handleAcquireGps = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Geolocation is not supported by this browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        const loc = {
          latitude: lat,
          longitude: lng,
          isConfirmed: true,
        };
        setDetectedGps(loc);
        if (detectionResult?.roadConditionReport) {
          setDetectionResult({
            ...detectionResult,
            roadConditionReport: {
              ...detectionResult.roadConditionReport,
              gpsLocation: loc,
            },
          });
        }
      },
      (err) => {
        setIsLocating(false);
        setErrorMessage(`Could not retrieve location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a road image file first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setDetectionResult(null);

    try {
      const result = await detectRoadDamageImage(
        selectedFile,
        confidence,
        previewUrl || undefined,
        detectedGps || undefined
      );
      setDetectionResult(result);
    } catch (err: unknown) {
      console.error('Detection error:', err);
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('sleeping') || msg.includes('waking up') || msg.includes('504')) {
        setErrorMessage(
          'Hugging Face Space is waking up. Free-tier spaces pause during inactivity. Please wait a moment and click "Analyze Road Image" again.'
        );
      } else {
        setErrorMessage(`Inference failed: ${msg}`);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentPipelineStep = detectionResult
    ? 'analyze'
    : selectedFile
    ? 'detect'
    : 'upload';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Visual Pipeline Progression */}
      <PipelineSteps currentStep={currentPipelineStep} />

      {/* Main Grid: Upload & Controls / Dual AI Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Parameters (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card: Upload Media */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileImage className="w-4 h-4 text-cyan-400" />
                <span>Road Image Input</span>
              </h2>
              {selectedFile && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Drop Zone */}
            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-6 text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/80 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelection(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform">
                  <UploadCloud className="w-6 h-6" />
                </div>

                <p className="text-xs font-semibold text-slate-200">
                  Drop road photo here, or <span className="text-cyan-400 underline">browse</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports JPEG, PNG, WebP (max 10MB)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                  {previewUrl && (
                    <img
                      src={previewUrl}
                      alt="Selected road"
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="truncate max-w-[200px] text-slate-200 font-mono text-[11px]">
                    {selectedFile.name}
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 shrink-0">
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </div>
                </div>
              </div>
            )}

            {/* Quick Sample Image Buttons */}
            <div className="pt-2 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                <span>Need test media? Generate realistic sample:</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleLoadSample('pothole')}
                  disabled={isGeneratingSample || isAnalyzing}
                  className="px-2.5 py-1.5 text-[11px] text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Sample Pothole</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadSample('cracked')}
                  disabled={isGeneratingSample || isAnalyzing}
                  className="px-2.5 py-1.5 text-[11px] text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  <span>Cracked Pavement</span>
                </button>
              </div>
            </div>
          </div>

          {/* Card: Dual Model Parameters */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label
                htmlFor="confidence-slider"
                className="text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Detection Confidence Threshold</span>
              </label>
              <span className="font-mono text-xs font-semibold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                {Math.round(confidence * 100)}% ({confidence.toFixed(2)})
              </span>
            </div>

            <input
              id="confidence-slider"
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              disabled={isAnalyzing}
              className="w-full accent-cyan-400 cursor-pointer disabled:opacity-50"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.05 (High Recall)</span>
              <span>Default (0.25)</span>
              <span>0.95 (High Precision)</span>
            </div>

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={!selectedFile || isAnalyzing}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md ${
                !selectedFile || isAnalyzing
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                  : 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-cyan-950 border border-cyan-300'
              }`}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
                  <span>Running Dual AI Model Inference...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>Analyze Road Image (Dual AI)</span>
                </>
              )}
            </button>
          </div>

          {/* Model Status Directory Card */}
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl text-xs space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>AI Model Registry Status</span>
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
            </div>

            {/* Model 1 */}
            <div className="flex items-start justify-between text-[11px] pb-2 border-b border-slate-800/80">
              <div>
                <span className="font-semibold text-slate-200">Model 1: Pothole API</span>
                <p className="text-[10px] text-slate-400 font-mono">13.220.63.113:8000</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/50">
                Unavailable
              </span>
            </div>

            {/* Model 2 */}
            <div className="flex items-start justify-between text-[11px] pb-2 border-b border-slate-800/80">
              <div>
                <span className="font-semibold text-slate-200">Model 2: Road Damage</span>
                <p className="text-[10px] text-slate-400 font-mono">ProjectRoadDamageDetection</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 text-amber-300 border border-amber-800/50">
                Unavailable (503)
              </span>
            </div>

            {/* Reference YOLO */}
            <div className="flex items-start justify-between text-[11px]">
              <div>
                <span className="font-semibold text-slate-200">Active YOLO Space</span>
                <p className="text-[10px] text-slate-400 font-mono">Sahildandotiya (HF)</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                Online / Active
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Dual AI Results & Analysis (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Error Banner */}
          {errorMessage && (
            <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-rose-200">Notice</div>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          {/* Card: Dual Model Visual Output & Inspection Tab */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm min-h-[460px] flex flex-col">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Dual AI Model Inspection</h3>
              </div>

              {/* Model View Tabs */}
              {detectionResult && (
                <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveModelTab('combined')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeModelTab === 'combined'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Combined Analysis
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModelTab('ref')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeModelTab === 'ref'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    YOLO Space
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModelTab('model1')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeModelTab === 'model1'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Model 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModelTab('model2')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      activeModelTab === 'model2'
                        ? 'bg-cyan-500/20 text-cyan-300'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Model 2
                  </button>
                </div>
              )}
            </div>

            {/* Display Area */}
            <div className="flex-1 flex flex-col justify-center">
              {isAnalyzing ? (
                <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                  <div className="text-xs font-semibold text-white">
                    Executing Independent Model Pipelines...
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Querying Model 1 candidate API, checking Model 2 endpoint, and running YOLO pothole detector concurrently...
                  </p>
                </div>
              ) : detectionResult ? (
                <div className="space-y-4">
                  {/* Media Viewport */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-[11px] text-slate-400 flex items-center justify-between">
                        <span>Original Pavement</span>
                        <span className="font-mono text-[10px]">RAW INPUT</span>
                      </div>
                      <div className="relative rounded-lg overflow-hidden bg-black border border-slate-800 aspect-[4/3] flex items-center justify-center">
                        {previewUrl && (
                          <img
                            src={previewUrl}
                            alt="Original road"
                            className="max-h-full max-w-full object-contain"
                          />
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="text-[11px] text-cyan-300 font-medium flex items-center justify-between">
                        <span>
                          {activeModelTab === 'model1'
                            ? 'Model 1 (13.220.63.113)'
                            : activeModelTab === 'model2'
                            ? 'Model 2 (ProjectRoadDamageDetection)'
                            : activeModelTab === 'ref'
                            ? 'Hosted YOLO Space (Sahildandotiya)'
                            : 'AI Annotated Result'}
                        </span>
                        <span className="font-mono text-[10px] text-cyan-400">INFERENCE</span>
                      </div>
                      <div className="relative rounded-lg overflow-hidden bg-black border border-cyan-500/30 aspect-[4/3] flex items-center justify-center shadow-inner">
                        {activeModelTab === 'model1' && detectionResult.model1Result?.status !== 'success' ? (
                          <div className="p-4 text-center space-y-1 text-slate-400">
                            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                            <div className="text-xs font-semibold text-white">Model 1 Unavailable</div>
                            <p className="text-[10px]">Candidate host 13.220.63.113:8000 is unreachable.</p>
                          </div>
                        ) : activeModelTab === 'model2' && detectionResult.model2Result?.status !== 'success' ? (
                          <div className="p-4 text-center space-y-1 text-slate-400">
                            <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                            <div className="text-xs font-semibold text-white">
                              {detectionResult.model2Result?.status === 'Not configured'
                                ? 'Model 2 Not Configured'
                                : 'Model 2 Unavailable'}
                            </div>
                            <p className="text-[10px] max-w-xs mx-auto text-slate-400 leading-normal">
                              {detectionResult.model2Result?.errorMessage ||
                                'Candidate Space is currently unavailable on Hugging Face (scheduling error / HTTP 503).'}
                            </p>
                          </div>
                        ) : (
                          <img
                            src={
                              activeModelTab === 'model2' && detectionResult.model2Result?.annotatedImageUrl
                                ? detectionResult.model2Result.annotatedImageUrl
                                : activeModelTab === 'model1' && detectionResult.model1Result?.annotatedImageUrl
                                ? detectionResult.model1Result.annotatedImageUrl
                                : detectionResult.annotatedMediaUrl
                            }
                            alt="AI detection output"
                            className="max-h-full max-w-full object-contain"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Model Disagreement Flag */}
                  {detectionResult.modelDisagreement && (
                    <div className="p-3 bg-amber-950/30 border border-amber-500/40 rounded-xl text-xs text-amber-300 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <span className="font-semibold text-amber-200">Model Discrepancy Flag:</span>
                        <p className="text-[11px] leading-relaxed">{detectionResult.modelDisagreementNote}</p>
                      </div>
                    </div>
                  )}

                  {/* Comprehensive Detailed Road-Condition Report */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 text-xs shadow-md">
                    {/* Header: Title & Badges */}
                    <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-800">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileCheck className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-sm font-bold text-white tracking-wide">
                            Detailed Road-Condition Report
                          </h4>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Evidence-grounded assessment from computer vision detections & road maintenance triage
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Overall Estimated Road Condition Badge */}
                        <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300">
                          <span className="text-slate-500 mr-1.5">Condition:</span>
                          <strong className="text-cyan-300">
                            {detectionResult.roadConditionReport?.overallCondition || 'Evaluated'}
                          </strong>
                        </div>

                        {/* 4. Severity Level Badge */}
                        <span
                          className={`font-semibold px-2.5 py-1 rounded-lg border text-xs ${
                            detectionResult.preliminarySeverity === 'Critical'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : detectionResult.preliminarySeverity === 'High'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : detectionResult.preliminarySeverity === 'Moderate' ||
                                detectionResult.preliminarySeverity === 'Medium'
                              ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                              : detectionResult.preliminarySeverity === 'Low'
                              ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          Severity: {detectionResult.preliminarySeverity}
                        </span>

                        {/* 6. Repair Priority Badge */}
                        <span
                          className={`font-semibold px-2.5 py-1 rounded-lg border text-xs ${
                            detectionResult.roadConditionReport?.repairPriority === 'Critical'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-600/50'
                              : detectionResult.roadConditionReport?.repairPriority === 'High'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-600/50'
                              : detectionResult.roadConditionReport?.repairPriority === 'Medium'
                              ? 'bg-yellow-950/60 text-yellow-300 border-yellow-600/50'
                              : 'bg-sky-950/60 text-sky-300 border-sky-600/50'
                          }`}
                        >
                          Priority: {detectionResult.roadConditionReport?.repairPriority || 'Standard'}
                        </span>
                      </div>
                    </div>

                    {/* Section 1: Detections & Confidence Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* 2. Detected Damage Types & Counts */}
                      <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
                        <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Detected Damage Types & Counts</span>
                          </span>
                          {detectionResult.isCountUnavailable ? (
                            <span className="text-[10px] text-amber-300 font-mono bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                              Count unavailable
                            </span>
                          ) : typeof detectionResult.potholeCount === 'number' ? (
                            <span className="text-[10px] text-cyan-300 font-mono bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
                              {detectionResult.potholeCount} Defect(s)
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">
                              0 Defect(s)
                            </span>
                          )}
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {detectionResult.roadConditionReport?.detectedDamageTypes &&
                          detectionResult.roadConditionReport.detectedDamageTypes.length > 0 ? (
                            detectionResult.roadConditionReport.detectedDamageTypes.map((item, idx) => (
                              <div
                                key={idx}
                                className="text-[11px] bg-slate-900 px-2.5 py-2 rounded border border-slate-800/60 space-y-1"
                              >
                                <div className="flex items-center justify-between">
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
                                {item.note && (
                                  <div className="text-[10px] text-slate-400 leading-normal">
                                    {item.note}
                                  </div>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="text-[11px] text-slate-400 italic">
                              No defects detected above selected threshold.
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            Bounding boxes: rendered visually on the annotated output image.
                          </div>
                        </div>
                      </div>

                      {/* 3. Detection Confidence & Analysis Metadata */}
                      <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
                        <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Detection Confidence & Model Parameters</span>
                        </div>

                        <div className="space-y-1.5 pt-1 text-[11px]">
                          <div className="flex items-center justify-between bg-slate-900 px-2 py-1.5 rounded border border-slate-800/60">
                            <span className="text-slate-400">Confidence Threshold Used:</span>
                            <span className="font-mono text-cyan-300 font-semibold">
                              {Math.round(confidence * 100)}% ({confidence.toFixed(2)})
                            </span>
                          </div>

                          {/* 9. Analysis Timestamp */}
                          <div className="flex items-center justify-between bg-slate-900 px-2 py-1.5 rounded border border-slate-800/60">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Analysis Timestamp:</span>
                            </span>
                            <span className="font-mono text-[10px] text-slate-300">
                              {new Date(detectionResult.analyzedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 4. Severity Level & Reasoning */}
                    <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200 flex items-center gap-1.5 text-[11px]">
                          <ShieldAlert className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Severity Level & Assignment Reasoning:</span>
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          Level: {detectionResult.preliminarySeverity}
                        </span>
                      </div>

                      {detectionResult.severityReasons && (
                        <ul className="text-[11px] text-slate-300 space-y-1 list-disc pl-4 bg-slate-900/60 p-2.5 rounded border border-slate-800/60 leading-relaxed">
                          {detectionResult.severityReasons.map((r, i) => (
                            <li key={i}>{r}</li>
                          ))}
                        </ul>
                      )}
                      <p className="text-[10px] text-slate-400 italic">
                        Note: Severity is estimated strictly from observable 2D optical evidence without assuming unverified subsurface depth, structural layer compaction, or accident statistics.
                      </p>
                    </div>

                    {/* 5. Recommended Maintenance Action & 6. Repair Priority Explanation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1.5">
                        <div className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider">
                          Recommended Maintenance Action:
                        </div>
                        <p className="text-slate-200 text-[11px] leading-relaxed bg-slate-900/80 p-2.5 rounded border border-slate-800/60">
                          {detectionResult.recommendedAction}
                        </p>
                      </div>

                      <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg space-y-1.5">
                        <div className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">
                          Repair Priority & Rationale:
                        </div>
                        <p className="text-slate-300 text-[11px] leading-relaxed bg-slate-900/80 p-2.5 rounded border border-slate-800/60">
                          {detectionResult.roadConditionReport?.priorityExplanation ||
                            'Priority determined based on carriageway defect location and potential impact on passing vehicular traffic.'}
                        </p>
                      </div>
                    </div>

                    {/* 8. GPS Location Status */}
                    <div className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-200 text-[11px]">
                            GPS Location & Geotag Status
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {detectedGps ? (
                              <span className="text-emerald-400">
                                Lat: {detectedGps.latitude.toFixed(6)}, Lng: {detectedGps.longitude.toFixed(6)}{' '}
                                (Confirmed)
                              </span>
                            ) : (
                              <span className="text-amber-400">
                                Location awaiting confirmation (Will default to user picker upon report creation)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {!detectedGps && (
                        <button
                          type="button"
                          onClick={handleAcquireGps}
                          disabled={isLocating}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <Navigation className={`w-3 h-3 text-cyan-400 ${isLocating ? 'animate-spin' : ''}`} />
                          <span>{isLocating ? 'Acquiring GPS...' : 'Attach Device GPS'}</span>
                        </button>
                      )}
                    </div>

                    {/* 10. Engineering Limitations & Physical Inspection Recommendation */}
                    <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-[11px] text-amber-300 flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <div className="font-semibold text-amber-200">
                          Limitations & On-Site Physical Inspection Recommendation:
                        </div>
                        <p className="leading-relaxed text-amber-300/90 text-[11px]">
                          {detectionResult.roadConditionReport?.limitations ||
                            'AI evaluation is derived strictly from 2D optical surface imagery. It cannot measure cavity depth, void compaction, sub-base stability, or international roughness index (IRI). Physical on-site inspection by a certified road maintenance technician is recommended before executing asphalt repairs.'}
                        </p>
                      </div>
                    </div>

                    {/* Action Bar: Create Report & Export */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                      <div className="text-xs text-slate-400">
                        Ready to document this defect for municipal road crews?
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="px-3 py-2 text-xs font-medium text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print / Export</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsReportModalOpen(true)}
                          className="px-4 py-2 text-xs font-bold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm shadow-cyan-950"
                        >
                          <FileText className="w-4 h-4" />
                          <span>Create Saved Report</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-2">
                    <Eye className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-medium text-slate-300">
                    Awaiting Dual AI Inference
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Select a road photo on the left and click{' '}
                    <span className="text-slate-300 font-semibold">"Analyze Road Image"</span> to evaluate both models independently.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <CreateReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSaveReport={(report) => {
          onSaveReport(report);
          onNavigateToReports();
        }}
        detectionResult={detectionResult}
        originalImagePreview={previewUrl || undefined}
        mediaType="image"
        confidenceThreshold={confidence}
      />
    </div>
  );
};
