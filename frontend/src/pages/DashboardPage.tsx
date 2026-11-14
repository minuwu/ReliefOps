import { useEffect, useState } from 'react';
import { api } from '@/services/api';
import { DashboardStats, SharedAccountAlert } from '@/types/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart3,
  AlertOctagon,
  Clock,
  BrainCircuit,
  TrendingUp,
  AlertTriangle,
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
      <Card className="border-rose-200 dark:border-rose-900/50">
        <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-rose-700 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              Shared Destination Account Alerts (Fraud Ring Detection)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Destination bank accounts identified across multiple victim reports at the same or partner banks
            </p>
          </div>
          <Badge variant="destructive">{alerts.length} Suspicious Ring(s) Detected</Badge>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.account_number}
              className="p-4 rounded-xl border border-rose-300 dark:border-rose-900/60 bg-rose-50/20 dark:bg-rose-950/20 space-y-3"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-sm font-bold text-foreground">
                    Account: {alert.account_number}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({alert.bank_name})
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                    Total Inflow: {formatCurrency(alert.total_amount, alert.currency)}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    across {alert.case_count} cases
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-rose-200 dark:border-rose-900/40">
                <span className="text-xs font-semibold text-muted-foreground">Connected Cases:</span>
                {alert.cases.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-background border border-border text-xs font-mono font-bold"
                  >
                    {c.reference}
                    <Badge status={c.status} className="text-[10px] py-0 px-1.5">
                      {c.status}
                    </Badge>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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
