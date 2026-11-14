import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { DashboardStats, SharedAccountAlert } from '@/types/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { FraudRingVisualizer } from '@/components/dashboard/FraudRingVisualizer';
import {
  BarChart3,
  AlertOctagon,
  Clock,
  BrainCircuit,
  TrendingUp,
} from 'lucide-react';

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [alerts, setAlerts] = useState<SharedAccountAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [statsRes, alertsRes] = await Promise.all([
          api.getDashboardStats(),
          api.getSharedAccountAlerts(),
        ]);
        setStats(statsRes.data);
        setAlerts(alertsRes.data);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  if (isLoading || !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12 text-center text-muted-foreground text-sm">
        Loading supervisor metrics...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          Supervisor Operations Dashboard
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Real-time workload, deadline compliance, and multi-victim fraud syndicate detection
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Open Cases */}
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">Total Open Cases</p>
            <p className="text-2xl font-bold text-foreground font-mono">{stats.open_cases}</p>
          </div>
        </Card>

        {/* Overdue (Critical) */}
        <Card className="p-4 flex items-center gap-4 border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20">
          <div className="p-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-rose-700 dark:text-rose-300 font-semibold uppercase">Overdue Cases</p>
            <p className="text-2xl font-bold text-rose-700 dark:text-rose-300 font-mono">{stats.overdue_cases}</p>
          </div>
        </Card>

        {/* Due Soon */}
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">Due Soon (&lt;48h)</p>
            <p className="text-2xl font-bold text-foreground font-mono">{stats.due_soon_cases}</p>
          </div>
        </Card>

        {/* AI Reviews Pending */}
        <Card className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <BrainCircuit className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold uppercase">AI Triage Pending</p>
            <p className="text-2xl font-bold text-foreground font-mono">{stats.ai_review_pending}</p>
          </div>
        </Card>
      </div>

      {/* Shared Account Fraud Syndicate Alerts (High Value Hackathon Demo Feature) */}
      <FraudRingVisualizer alerts={alerts} />

      {/* Grid: Status Distribution & Workload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">Cases by Operational Stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(stats.cases_by_status).map(([status, count]) => (
              <div key={status} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                  <span className="font-mono font-bold">{count}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${Math.max(5, (count / stats.open_cases) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Operator Workload */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-bold">Staff Operator Workload</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.workload.map((w) => (
              <div
                key={w.operator.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {w.operator.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{w.operator.name}</p>
                    <p className="text-[11px] text-muted-foreground">Center Operator</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <p className="text-xs font-mono font-bold text-foreground">{w.open_cases} Active</p>
                    {w.overdue_cases > 0 && (
                      <p className="text-[10px] text-rose-600 font-semibold">{w.overdue_cases} Overdue</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
