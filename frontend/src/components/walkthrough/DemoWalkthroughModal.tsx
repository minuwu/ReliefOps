import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_PASSWORD } from '@/services/mockData';
import { errorMessage } from '@/services/http';
import { toast } from '@/store/useToastStore';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
  PlayCircle,
  Lock,
} from 'lucide-react';
import { SCENARIOS } from './scenarios';

export interface DemoWalkthroughModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DemoWalkthroughModal({ isOpen, onClose }: DemoWalkthroughModalProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const currentScenario = SCENARIOS[selectedIndex];
  const Icon = currentScenario.icon;

  const handleLaunchScenario = async () => {
    try {
      await login(currentScenario.userEmail, DEMO_PASSWORD);
      navigate(currentScenario.targetPath);
      onClose();
    } catch (err) {
      toast(errorMessage(err, 'Could not start this scenario.'), 'error');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="4xl">
      <div className="space-y-5 font-['Space_Grotesk',sans-serif]">
        {/* Header */}
        <div className="border-b border-[#09090B]/15 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-['Dela_Gothic_One'] text-[#09090B] uppercase">
              Scenario walkthroughs
            </h2>
            <p className="text-xs text-[#52525B] font-medium max-w-2xl">
              Select a persona below to explore each role in the fraud relief platform.
            </p>
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : SCENARIOS.length - 1))}
              className="p-1.5 rounded-lg border border-[#09090B] bg-[#F8F4E8] hover:bg-[#D2E823] transition-colors cursor-pointer"
              title="Previous scenario"
              aria-label="Previous scenario"
            >
              <ChevronLeft className="w-4 h-4 text-[#09090B]" />
            </button>
            <span className="font-mono text-xs font-bold px-2 text-[#09090B]">
              {selectedIndex + 1}/{SCENARIOS.length}
            </span>
            <button
              type="button"
              onClick={() => setSelectedIndex((prev) => (prev < SCENARIOS.length - 1 ? prev + 1 : 0))}
              className="p-1.5 rounded-lg border border-[#09090B] bg-[#F8F4E8] hover:bg-[#D2E823] transition-colors cursor-pointer"
              title="Next scenario"
              aria-label="Next scenario"
            >
              <ChevronRight className="w-4 h-4 text-[#09090B]" />
            </button>
          </div>
        </div>

        {/* Persona Selector Rows */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {SCENARIOS.map((sc, idx) => {
            const ScIcon = sc.icon;
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer whitespace-nowrap border ${
                  isSelected
                    ? 'bg-[#09090B] text-[#D2E823] border-[#09090B]'
                    : 'bg-[#F8F4E8] text-[#09090B] border-[#09090B]/20 hover:bg-[#D2E823]/30'
                }`}
              >
                <ScIcon className="w-3.5 h-3.5" />
                <span>{sc.badge}</span>
              </button>
            );
          })}
        </div>

        {/* Active Scenario Content */}
        <div className="space-y-4">
          {/* Top Title & Persona */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-[#09090B]/15 pb-3">
            <div className="flex items-start gap-2.5">
              <span className="p-2 rounded-lg bg-[#09090B] text-[#D2E823] shrink-0 mt-0.5">
                <Icon className="w-4 h-4" />
              </span>
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-[#09090B]">
                  {currentScenario.title}
                </h3>
                <p className="text-xs text-[#52525B]">
                  {currentScenario.subtitle}
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-[#09090B]/15 bg-[#F8F4E8] p-2.5 text-xs space-y-0.5 shrink-0">
              <div className="font-bold uppercase text-xs text-[#52525B]">Persona:</div>
              <div className="font-bold text-[#09090B]">{currentScenario.persona}</div>
              <div className="text-xs text-[#52525B] max-w-xs">{currentScenario.roleDescription}</div>
            </div>
          </div>

          {/* Context & Goal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8] space-y-1">
              <span className="font-bold uppercase tracking-wide text-[#09090B] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#FF334B]" /> Context
              </span>
              <p className="text-xs text-[#09090B] leading-relaxed">
                {currentScenario.story}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8] space-y-1">
              <span className="font-bold uppercase tracking-wide text-[#09090B] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#09090B]" /> Goal
              </span>
              <p className="text-xs text-[#09090B] leading-relaxed">
                {currentScenario.goal}
              </p>
            </div>
          </div>

          {/* End-to-End Steps (Plain Numbered List) */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-[#52525B]">
              Walkthrough steps
            </h4>
            <ol className="divide-y divide-[#09090B]/10 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8]">
              {currentScenario.steps.map((step) => (
                <li key={step.number} className="p-3 flex items-start gap-3 text-xs">
                  <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-[#09090B] text-[#D2E823] shrink-0">
                    {step.number}
                  </span>
                  <div className="space-y-0.5">
                    <p className="font-bold text-[#09090B]">{step.action}</p>
                    <p className="text-[#52525B] text-xs leading-normal">{step.outcome}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Guarantee Note */}
          <div className="p-2.5 rounded-xl border border-[#09090B]/15 bg-[#F8F4E8] text-xs flex items-center justify-between gap-3 text-[#52525B]">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#09090B] shrink-0" />
              <span>
                <strong className="text-[#09090B]">Safety rule:</strong> {currentScenario.systemGuarantee}
              </span>
            </div>
            <span className="hidden sm:inline-block font-mono text-xs text-[#52525B]">
              Law No. 133
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-[#09090B]/15 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-[#52525B]">
            Launching configures the persona account and opens the target workspace.
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={onClose} className="w-1/3 sm:w-auto">
              CLOSE
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleLaunchScenario}
              className="w-2/3 sm:w-auto gap-2"
            >
              <PlayCircle className="w-4 h-4" />
              <span>{currentScenario.actionLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
