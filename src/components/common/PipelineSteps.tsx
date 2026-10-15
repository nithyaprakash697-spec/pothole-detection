import React from 'react';
import { Upload, Scan, Search, FileCheck, ArrowUpRight } from 'lucide-react';

export type PipelineStep = 'upload' | 'detect' | 'analyze' | 'report' | 'prioritize';

interface PipelineStepsProps {
  currentStep: PipelineStep;
  className?: string;
}

const STEPS: Array<{ id: PipelineStep; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'upload', label: '1. Upload', icon: Upload },
  { id: 'detect', label: '2. Detect', icon: Scan },
  { id: 'analyze', label: '3. Analyze', icon: Search },
  { id: 'report', label: '4. Report', icon: FileCheck },
  { id: 'prioritize', label: '5. Prioritize', icon: ArrowUpRight },
];

export const PipelineSteps: React.FC<PipelineStepsProps> = ({ currentStep, className = '' }) => {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div
      className={`bg-slate-900/60 border border-slate-800/80 rounded-xl p-3 sm:p-4 backdrop-blur-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {STEPS.map((step, idx) => {
          const Icon = step.icon;
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-xs font-semibold transition-all ${
                    isCurrent
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-sm shadow-cyan-900/50'
                      : isDone
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800/60 text-slate-400 border border-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <span
                  className={`mt-1.5 text-[10px] sm:text-xs font-medium truncate max-w-full ${
                    isCurrent
                      ? 'text-cyan-300 font-semibold'
                      : isDone
                      ? 'text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 flex-1 max-w-[28px] sm:max-w-[48px] self-center -mt-4 transition-colors ${
                    idx < currentIndex ? 'bg-emerald-500/50' : 'bg-slate-800'
                  }`}
                  aria-hidden="true"
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
