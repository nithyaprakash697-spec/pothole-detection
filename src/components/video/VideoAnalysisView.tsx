import React, { useState, useRef } from 'react';
import {
  Video as VideoIcon,
  UploadCloud,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Trash2,
  FileText,
  RefreshCw,
  Film,
  Clock,
  Layers,
  ShieldAlert,
  AlertTriangle,
  Play,
  Eye,
  Sparkles,
} from 'lucide-react';
import { DamageReport, DetectionResult, VideoKeyframeDetection } from '../../types';
import { detectRoadDamageVideo } from '../../services/roadDamageApi';
import { VideoSampleProgress } from '../../services/videoKeyframeSampler';
import { PipelineSteps } from '../common/PipelineSteps';
import { CreateReportModal } from '../reports/CreateReportModal';

interface VideoAnalysisViewProps {
  onSaveReport: (report: DamageReport) => void;
  onNavigateToReports: () => void;
}

export const VideoAnalysisView: React.FC<VideoAnalysisViewProps> = ({
  onSaveReport,
  onNavigateToReports,
}) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number>(0.25);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisProgress, setAnalysisProgress] = useState<VideoSampleProgress | null>(null);
  const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
  const [selectedKeyframeIndex, setSelectedKeyframeIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<'annotated' | 'original' | 'split'>('annotated');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

  const handleFileSelection = (file: File) => {
    setErrorMessage(null);
    setDetectionResult(null);
    setAnalysisProgress(null);
    setSelectedKeyframeIndex(0);

    const isAllowed =
      ALLOWED_TYPES.includes(file.type) ||
      file.name.endsWith('.mp4') ||
      file.name.endsWith('.webm') ||
      file.name.endsWith('.mov') ||
      file.name.endsWith('.avi');

    if (!isAllowed) {
      setErrorMessage(
        `Unsupported video format: ${file.type || file.name}. Please select an MP4, WebM, MOV, or AVI video file.`
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(
        `Video size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds client limit of 50MB.`
      );
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
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
    setAnalysisProgress(null);
    setErrorMessage(null);
    setSelectedKeyframeIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadSampleVideo = async () => {
    try {
      setErrorMessage(null);
      const res = await fetch('/sample_road.mp4');
      if (!res.ok) throw new Error('Could not load sample road video.');
      const blob = await res.blob();
      const sampleFile = new File([blob], 'sample_dashcam_road.mp4', { type: 'video/mp4' });
      handleFileSelection(sampleFile);
    } catch (err) {
      setErrorMessage(`Failed to load sample clip: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage('Please upload a video file first.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setDetectionResult(null);
    setSelectedKeyframeIndex(0);

    try {
      const result = await detectRoadDamageVideo(selectedFile, confidence, (progress) => {
        setAnalysisProgress(progress);
      });
      setDetectionResult(result);

      // If keyframes were extracted, select the first detected frame if available
      if (result.keyframes && result.keyframes.length > 0) {
        const positiveIdx = result.keyframes.findIndex((k) => k.hasPothole);
        setSelectedKeyframeIndex(positiveIdx >= 0 ? positiveIdx : 0);
      }
    } catch (err: unknown) {
      console.error('Video detection error:', err);
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes('sleeping') || msg.includes('waking up') || msg.includes('504')) {
        setErrorMessage(
          'The Hugging Face Space "Sahildandotiya/pothole-detector" is currently asleep or restarting. ' +
          'Free-tier spaces pause during inactivity. Please wait 30-45 seconds and retry.'
        );
      } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        setErrorMessage(
          'Network connection to Hugging Face Space timed out or was blocked. Check connection status.'
        );
      } else {
        setErrorMessage(`Video inference notice: ${msg}`);
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

  const activeKeyframe: VideoKeyframeDetection | undefined =
    detectionResult?.keyframes && detectionResult.keyframes.length > 0
      ? detectionResult.keyframes[selectedKeyframeIndex]
      : undefined;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <PipelineSteps currentStep={currentPipelineStep} />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Controls */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <VideoIcon className="w-4 h-4 text-cyan-400" />
                <span>Roadway Video Input</span>
              </h2>
              <div className="flex items-center gap-2">
                {!selectedFile && (
                  <button
                    type="button"
                    onClick={handleLoadSampleVideo}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/40"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Load Sample Clip</span>
                  </button>
                )}
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
            </div>

            {!selectedFile ? (
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-700 hover:border-cyan-500/60 rounded-xl p-8 text-center cursor-pointer transition-all bg-slate-900/40 hover:bg-slate-900/80 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
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
                  Drop dashboard camera video here, or <span className="text-cyan-400 underline">browse</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports MP4, WebM, MOV, AVI (Max 50MB)
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center">
                  {previewUrl && (
                    <video
                      src={previewUrl}
                      controls
                      className="max-h-full max-w-full"
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

            <div className="text-[11px] text-slate-400 bg-slate-900/50 p-3 rounded-lg border border-slate-800/80 leading-relaxed">
              <span className="text-slate-300 font-medium">Inference Architecture:</span> Connects directly to the hosted YOLO Space (<code className="text-cyan-300 text-[10px]">Sahildandotiya/pothole-detector</code>). Seamlessly runs remote stream or adaptive keyframe sampling.
            </div>
          </div>

          {/* Card: Parameters */}
          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <label
                htmlFor="video-confidence"
                className="text-xs font-semibold text-white flex items-center gap-1.5"
              >
                <Sliders className="w-4 h-4 text-cyan-400" />
                <span>Detection Confidence Threshold</span>
              </label>
              <span className="font-mono text-xs font-semibold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                {Math.round(confidence * 100)}%
              </span>
            </div>

            <input
              id="video-confidence"
              type="range"
              min="0.05"
              max="0.95"
              step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(parseFloat(e.target.value))}
              disabled={isAnalyzing}
              className="w-full accent-cyan-400 cursor-pointer disabled:opacity-50"
            />

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
                  <span>Analyzing Video Recording...</span>
                </>
              ) : (
                <>
                  <Film className="w-4 h-4" />
                  <span>Analyze Road Video</span>
                </>
              )}
            </button>
          </div>

          <div className="p-3 bg-slate-900/40 border border-slate-800/60 rounded-xl text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center justify-between text-slate-300 font-medium">
              <span>Connected Endpoint</span>
              <span className="text-cyan-400 font-mono text-[10px]">/detect_video & /detect_image</span>
            </div>
            <p>
              Hosted Hugging Face Space YOLOv8 pipeline with auto-resilient video keyframe sampler fallback.
            </p>
          </div>
        </div>

        {/* Right Column: Processed Video Output */}
        <div className="lg:col-span-7 space-y-5">
          {errorMessage && (
            <div className="bg-rose-950/30 border border-rose-500/40 rounded-xl p-4 text-xs text-rose-300 flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="font-semibold text-rose-200">Video Inference Notice</div>
                <p className="leading-relaxed">{errorMessage}</p>
              </div>
            </div>
          )}

          <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm min-h-[460px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Film className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Processed Video Output</h3>
              </div>
              {detectionResult && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {detectionResult.analysisMode === 'keyframe_sampler_fallback'
                      ? 'Adaptive Keyframe YOLOv8'
                      : 'Remote Video Stream'}
                  </span>
                  <div className="text-xs text-emerald-400 flex items-center gap-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Analysis Complete</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center">
              {/* Active Analyzing State with Real-Time Progress Bar */}
              {isAnalyzing ? (
                <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-14 h-14 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
                    <Film className="w-6 h-6 text-cyan-400 absolute inset-0 m-auto" />
                  </div>

                  <div className="space-y-1">
                    <div className="text-xs font-semibold text-white">
                      Processing Roadway Video Recording
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-sm">
                      {analysisProgress?.message ||
                        'Running computer vision inference across roadway intervals...'}
                    </p>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full max-w-md space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>Progress</span>
                      <span className="text-cyan-300 font-semibold">{analysisProgress?.percent || 20}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 rounded-full"
                        style={{ width: `${analysisProgress?.percent || 20}%` }}
                      />
                    </div>
                    {analysisProgress && analysisProgress.totalFrames > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                        <span>
                          Interval {analysisProgress.currentFrameIndex} of {analysisProgress.totalFrames}
                        </span>
                        {typeof analysisProgress.detectionsFoundSoFar === 'number' && (
                          <span className="text-amber-300">
                            {analysisProgress.detectionsFoundSoFar} defect(s) flagged
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {analysisProgress?.previewUrl && (
                    <div className="mt-2 w-32 h-20 rounded-lg overflow-hidden border border-slate-700 bg-black">
                      <img
                        src={analysisProgress.previewUrl}
                        alt="Current frame analysis"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              ) : detectionResult ? (
                <div className="space-y-4">
                  {/* Keyframe Viewer or Direct Video Stream */}
                  {detectionResult.keyframes && detectionResult.keyframes.length > 0 ? (
                    <div className="space-y-3">
                      {/* Main Keyframe Stage */}
                      <div className="relative rounded-xl overflow-hidden bg-black border border-slate-800 aspect-video flex items-center justify-center shadow-lg group">
                        {activeKeyframe ? (
                          <>
                            <img
                              src={
                                viewMode === 'original'
                                  ? activeKeyframe.originalFrameUrl
                                  : activeKeyframe.annotatedFrameUrl
                              }
                              alt={`Keyframe at ${activeKeyframe.timestampFormatted}`}
                              className="max-h-full max-w-full object-contain"
                            />

                            {/* Overlay Badge */}
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              <span className="px-2 py-1 rounded bg-black/75 backdrop-blur-sm text-cyan-300 font-mono text-xs border border-cyan-800/60 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                <span>{activeKeyframe.timestampFormatted}</span>
                              </span>
                              {activeKeyframe.hasPothole ? (
                                <span className="px-2 py-1 rounded bg-rose-950/80 backdrop-blur-sm text-rose-300 font-semibold text-xs border border-rose-800/80 flex items-center gap-1">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>Pothole Cavity ({Math.round(activeKeyframe.confidence * 100)}%)</span>
                                </span>
                              ) : (
                                <span className="px-2 py-1 rounded bg-emerald-950/80 backdrop-blur-sm text-emerald-300 text-xs border border-emerald-800/80 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Clear Surface</span>
                                </span>
                              )}
                            </div>

                            {/* View Switcher: Annotated vs Original */}
                            <div className="absolute top-3 right-3 flex items-center bg-black/80 backdrop-blur-sm rounded-lg p-0.5 border border-slate-700 text-[11px]">
                              <button
                                type="button"
                                onClick={() => setViewMode('annotated')}
                                className={`px-2 py-1 rounded font-medium transition-colors ${
                                  viewMode === 'annotated'
                                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                              >
                                Annotated
                              </button>
                              <button
                                type="button"
                                onClick={() => setViewMode('original')}
                                className={`px-2 py-1 rounded font-medium transition-colors ${
                                  viewMode === 'original'
                                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                                    : 'text-slate-300 hover:text-white'
                                }`}
                              >
                                Original
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-slate-500 text-xs">No keyframe selected</div>
                        )}
                      </div>

                      {/* Interactive Keyframe Scrubber Timeline */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-slate-300">
                          <span className="font-semibold flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Sampled Keyframe Timeline</span>
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {detectionResult.keyframes.filter((k) => k.hasPothole).length} defect interval(s) /{' '}
                            {detectionResult.keyframes.length} frames
                          </span>
                        </div>

                        {/* Thumbnail Strip */}
                        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-2 overflow-x-auto pb-1">
                          {detectionResult.keyframes.map((kf, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setSelectedKeyframeIndex(idx)}
                              className={`relative rounded-lg overflow-hidden border aspect-video transition-all text-left group ${
                                selectedKeyframeIndex === idx
                                  ? 'border-cyan-400 ring-2 ring-cyan-400/40 scale-102'
                                  : 'border-slate-800 hover:border-slate-700 opacity-80 hover:opacity-100'
                              }`}
                            >
                              <img
                                src={kf.annotatedFrameUrl}
                                alt={`Frame ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <div
                                className={`absolute inset-x-0 bottom-0 py-0.5 px-1 text-[9px] font-mono flex items-center justify-between backdrop-blur-sm ${
                                  kf.hasPothole
                                    ? 'bg-rose-950/80 text-rose-200'
                                    : 'bg-black/70 text-slate-300'
                                }`}
                              >
                                <span>{kf.timestampFormatted}</span>
                                {kf.hasPothole && <span className="font-bold text-rose-400">●</span>}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Direct Video Stream Player */
                    <div className="relative rounded-xl overflow-hidden bg-black border border-cyan-500/30 aspect-video flex items-center justify-center shadow-lg">
                      <video
                        src={detectionResult.annotatedMediaUrl}
                        controls
                        autoPlay
                        loop
                        className="max-h-full max-w-full"
                      />
                    </div>
                  )}

                  {/* Summary & Road Condition Assessment Card */}
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-cyan-400" />
                        <span className="font-semibold text-white">Roadway Condition Assessment</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border ${
                            detectionResult.preliminarySeverity === 'Critical'
                              ? 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                              : detectionResult.preliminarySeverity === 'High'
                              ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                          }`}
                        >
                          {detectionResult.preliminarySeverity || 'Moderate'} Severity
                        </span>
                        <span className="font-mono text-[11px] text-slate-400">
                          {new Date(detectionResult.analyzedAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400">Pothole Cavities</div>
                        <div className="text-white font-mono text-sm font-bold mt-0.5">
                          {typeof detectionResult.potholeCount === 'number'
                            ? `${detectionResult.potholeCount} confirmed`
                            : 'Detected on stream'}
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400">Urgency Level</div>
                        <div className="text-amber-300 font-semibold mt-0.5">
                          {detectionResult.roadConditionReport?.repairPriority || 'Standard Inspection'}
                        </div>
                      </div>
                      <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800">
                        <div className="text-slate-400">Model Pipeline</div>
                        <div className="text-cyan-300 font-mono mt-0.5 truncate">
                          {detectionResult.activeReferenceResult?.modelName || 'Hosted YOLOv8'}
                        </div>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                      {detectionResult.metadataNote}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-xs text-slate-400">
                      Record this video inspection into the dispatch registry?
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsReportModalOpen(true)}
                      className="px-4 py-2 text-xs font-semibold text-slate-900 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Create Damage Report</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="py-20 flex flex-col items-center justify-center text-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-2">
                    <VideoIcon className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-medium text-slate-300">
                    Awaiting Video Upload
                  </div>
                  <p className="text-[11px] text-slate-400 max-w-sm">
                    Upload a dashboard video on the left or click "Load Sample Clip" to run remote defect detection.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <CreateReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSaveReport={(report) => {
          onSaveReport(report);
          onNavigateToReports();
        }}
        detectionResult={detectionResult}
        originalImagePreview={
          activeKeyframe?.originalFrameUrl || previewUrl || undefined
        }
        mediaType="video"
        confidenceThreshold={confidence}
      />
    </div>
  );
};
