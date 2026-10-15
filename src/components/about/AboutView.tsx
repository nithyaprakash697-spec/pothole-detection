import React from 'react';
import {
  ShieldAlert,
  ArrowRight,
  Upload,
  Cpu,
  Layers,
  FileCheck,
  Sliders,
  ExternalLink,
  AlertCircle,
  Database,
  MapPin,
  CheckCircle,
  Navigation,
} from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Hero Banner */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
        <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          Intelligent Road Damage Detection & Quality Monitoring
        </h2>
        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-3xl">
          RoadGuard AI combines dual computer vision inference, automatic GPS reverse geocoding, and structured reporting to identify visible road damage, eliminate manual address entry, and support data-informed municipal maintenance triage.
        </p>
      </div>

      {/* Dual AI Models & Architecture */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        <div>
          <h3 className="text-base font-bold text-white">Dual AI Model & Geocoding Pipeline</h3>
          <p className="text-xs text-slate-400 mt-1">
            End-to-end data pipeline from citizen observation to municipal dispatch prioritization
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
            <div className="text-cyan-400 font-semibold text-xs flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              <span>Model 1: Pothole Candidate API</span>
            </div>
            <p className="text-xs text-slate-300">
              Evaluates candidate endpoint <code className="text-cyan-300 font-mono text-[11px]">http://13.220.63.113:8000</code>. Verified through live health checks and secure HTTPS proxy. Displays honest availability status without fake results.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
            <div className="text-cyan-400 font-semibold text-xs flex items-center gap-1.5">
              <Cpu className="w-4 h-4" />
              <span>Model 2: Multi-Class Road Damage</span>
            </div>
            <p className="text-xs text-slate-300">
              Targets candidate service <code className="text-cyan-300 font-mono text-[11px]">ProjectRoadDamageDetection/Automated-Road-Damage-Detection</code> (YOLOv8s trained on RDD2022: D00, D10, D20, D40). Configurable via <code className="text-slate-300 font-mono text-[11px]">VITE_MODEL2_ENDPOINT</code>.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
            <div className="text-cyan-400 font-semibold text-xs flex items-center gap-1.5">
              <Navigation className="w-4 h-4" />
              <span>Automatic Location & Reverse Geocoding</span>
            </div>
            <p className="text-xs text-slate-300">
              Acquires high-precision GPS coordinates, renders draggable interactive pins on Google Maps, and auto-resolves street addresses with seamless OpenStreetMap fallback.
            </p>
          </div>
        </div>
      </div>

      {/* 5-Step Workflow Details */}
      <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        <h3 className="text-base font-bold text-white">How the Platform Works</h3>

        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              1
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Upload Road Image or Video</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Users capture pavement conditions using smartphone cameras or dashcam footage and upload media in JPEG, PNG, WebP, MP4, or WebM formats.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              2
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Dual AI Inference Execution</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Models run independently via concurrent asynchronous workers. The system normalizes visual overlays, classes detected, and confidence scores honestly.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              3
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Automatic GPS & Reverse Geocoding</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Inspectors click "Detect My Location" or place a pin on the map. Nearest road names, districts, and municipalities are auto-resolved without typing.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              4
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Transparent Severity Calibration</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Preliminary severity (Low, Medium, High, Critical, or Needs Review) is computed with explicit reasons, flagging any model discrepancies for human review.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
              5
            </div>
            <div>
              <h4 className="text-xs font-semibold text-white">Dispatch Queue & Duplicate Detection</h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Reports are organized into repair queues. Nearby duplicate reports within 80 meters are detected and grouped so teams can audit repeat issues without deleting records.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Attribution & Honest Prototype Notice */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Model Attribution & Citations
          </div>
          <h4 className="text-sm font-bold text-white">Computer Vision Architectures</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            Active hosted pothole model created by <strong className="text-slate-200">Sahil Dandotiya</strong> on Hugging Face Spaces. Model 1 candidate API based on YOLO pothole detector. Model 2 candidate based on <strong className="text-slate-200">ProjectRoadDamageDetection/Automated-Road-Damage-Detection</strong>.
          </p>
        </div>

        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 shadow-sm space-y-3">
          <div className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
            Operational Protocol
          </div>
          <h4 className="text-sm font-bold text-white">Engineering Safety Standard</h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            All AI detections and preliminary severity scores serve as triage guidance to streamline inspection routing. 2D camera images cannot measure subsurface compaction or pavement roughness indices (IRI); physical on-site verification is required before structural repairs.
          </p>
        </div>
      </div>
    </div>
  );
};
