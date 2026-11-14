import { useState } from 'react';
import { SharedAccountAlert } from '@/types/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';
import {
  AlertTriangle,
  Building2,
  Lock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Eye,
} from 'lucide-react';

interface FraudRingVisualizerProps {
  alerts: SharedAccountAlert[];
  onInspectCase?: (caseId: string) => void;
}

export function FraudRingVisualizer({ alerts, onInspectCase }: FraudRingVisualizerProps) {
  const [selectedRingIndex, setSelectedRingIndex] = useState(0);
  const [frozenAccounts, setFrozenAccounts] = useState<Record<string, boolean>>({});

  if (!alerts || alerts.length === 0) return null;

  const currentAlert = alerts[selectedRingIndex] || alerts[0];
  const isFrozen = frozenAccounts[currentAlert.account_number];

  const handleSimulateFreeze = (accountNumber: string) => {
    setFrozenAccounts((prev) => ({
      ...prev,
      [accountNumber]: true,
    }));
  };

  return (
    <div className="rounded-xl border border-rose-300/80 dark:border-rose-900/60 bg-gradient-to-b from-rose-500/5 via-card to-card p-5 space-y-5 shadow-xs">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-200/60 dark:border-rose-900/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </span>
            <h3 className="text-base font-bold text-foreground">
              Syndicate Destination Visualizer (Cross-Bank Ring Map)
            </h3>
            <Badge variant="destructive" className="animate-pulse">
              Active Threat
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time topology correlating common illicit beneficiary accounts across partner institutions
          </p>
        </div>

        {/* Ring Selector Tabs */}
        {alerts.length > 1 && (
          <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border">
            {alerts.map((alert, idx) => (
              <button
                key={alert.account_number}
                onClick={() => setSelectedRingIndex(idx)}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                  selectedRingIndex === idx
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Ring #{idx + 1} ({alert.case_count} cases)
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Visual Network Topology Canvas */}
      <div className="relative rounded-xl border border-border bg-slate-950 p-6 overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #f43f5e 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Left Column: Victims & Feeder Bank Nodes */}
          <div className="md:col-span-5 space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400" /> Affected Victim Institutions & Cases
            </p>

            <div className="space-y-2.5">
              {currentAlert.cases.map((c) => (
                <div
                  key={c.id}
                  className="group relative p-3 rounded-lg border border-slate-800 bg-slate-900/90 hover:border-slate-700 transition-all text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-200">{c.reference}</span>
                    <Badge status={c.status} className="text-[10px] py-0 px-1.5">
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
                    <span>Associated Claim File</span>
                    <span className="font-mono text-emerald-400 font-semibold">
                      {formatCurrency(currentAlert.total_amount / Math.max(1, currentAlert.case_count), currentAlert.currency)}
                    </span>
                  </div>

                  {onInspectCase && (
                    <button
                      onClick={() => onInspectCase(c.id)}
                      className="mt-2 text-[10px] text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Eye className="w-3 h-3" /> Inspect Case Facts
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Middle: Flow Directed Vectors */}
          <div className="md:col-span-2 flex flex-col items-center justify-center py-2 text-rose-500">
            <div className="hidden md:flex flex-col items-center gap-1">
              <span className="text-[9px] uppercase tracking-widest text-slate-400 font-mono">
                Wire Inflow
              </span>
              <div className="w-0.5 h-12 bg-gradient-to-b from-blue-500 via-rose-500 to-rose-600 animate-pulse" />
              <ArrowRight className="w-5 h-5 text-rose-500 animate-bounce" />
            </div>
          </div>

          {/* Right Column: Flagged Destination Account Hub */}
          <div className="md:col-span-5">
            <div className={`p-4 rounded-xl border transition-all ${
              isFrozen
                ? 'border-emerald-600 bg-emerald-950/40'
                : 'border-rose-600/80 bg-rose-950/50 shadow-lg shadow-rose-950/50'
            }`}>
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-rose-400">
                    {isFrozen ? 'Emergency Freeze Imposed' : 'Shared Suspect Destination'}
                  </span>
                  <h4 className="text-sm sm:text-base font-mono font-bold text-white mt-0.5">
                    {currentAlert.account_number}
                  </h4>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Institution: <strong className="text-white">{currentAlert.bank_name}</strong>
                  </p>
                </div>
                <div className={`p-2 rounded-lg ${isFrozen ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {isFrozen ? <Lock className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5 animate-bounce" />}
                </div>
              </div>

              {/* Inflow Aggregates */}
              <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Total Illicit Volume</p>
                  <p className="font-mono text-base font-bold text-rose-400">
                    {formatCurrency(currentAlert.total_amount, currentAlert.currency)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Connected Victims</p>
                  <p className="font-mono text-base font-bold text-white">
                    {currentAlert.case_count} Independent Claims
                  </p>
                </div>
              </div>

              {/* Action Button: Simulate Immediate Multi-Bank Freeze */}
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                {isFrozen ? (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Statutory Freezing Notice Issued to {currentAlert.bank_name}</span>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleSimulateFreeze(currentAlert.account_number)}
                    className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold gap-1.5 shadow-md"
                  >
                    <Lock className="w-3.5 h-3.5" /> Issue Collaborative Emergency Account Freeze
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Regulatory Context Footer */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
        <span>
          Under the Relief Act guidelines, multi-victim accounts trigger priority statutory publication and automated inter-bank hold coordination to protect restitution pools.
        </span>
      </div>
    </div>
  );
}
