import React, { useState, useEffect } from 'react';
import { API } from '../App';
import { toast } from 'sonner';
import { Activity, Clock, AlertTriangle, CheckCircle, Zap, Database, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const CALL_TYPE_COLORS = {
  enrichment: '#3b82f6',
  scoring: '#8b5cf6',
  email_personalization: '#22c55e',
  judge_check: '#f97316',
  guardrail: '#ef4444'
};

const LLMObservability = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`${API}/analytics/llm`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        toast.error('Failed to load LLM analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading LLM observability...</div>
      </div>
    );
  }

  const callsByType = analytics?.calls_by_type || {};
  const latencyTrend = analytics?.latency_trend || [];
  const recentLogs = analytics?.recent_logs || [];
  const tokenUsage = analytics?.token_usage || { input: 0, output: 0 };

  // Prepare chart data
  const callTypeData = Object.entries(callsByType).map(([type, count]) => ({
    type: type.replace('_', ' '),
    count,
    color: CALL_TYPE_COLORS[type] || '#6b7280'
  }));

  const avgLatency = latencyTrend.length > 0 
    ? Math.round(latencyTrend.reduce((sum, l) => sum + l.avg_latency, 0) / latencyTrend.length)
    : 0;

  return (
    <div className="space-y-6" data-testid="llm-observability">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">LLM Observability</h1>
        <p className="text-zinc-500 text-sm mt-1">Monitor LLM call performance, latency, and token usage</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard 
          label="Total Calls"
          value={analytics?.total_calls || 0}
          icon={Activity}
        />
        <StatCard 
          label="Avg Latency"
          value={`${avgLatency}ms`}
          icon={Clock}
          color="yellow"
        />
        <StatCard 
          label="Error Rate"
          value={`${analytics?.error_rate || 0}%`}
          icon={AlertTriangle}
          color={analytics?.error_rate > 5 ? 'red' : 'green'}
        />
        <StatCard 
          label="Input Tokens"
          value={tokenUsage.input.toLocaleString()}
          icon={Database}
        />
        <StatCard 
          label="Output Tokens"
          value={tokenUsage.output.toLocaleString()}
          icon={Zap}
          color="indigo"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Latency Trend */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Latency Trend (24h)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fill: '#71717a', fontSize: 10 }}
                    interval={2}
                  />
                  <YAxis 
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    tickFormatter={(value) => `${value}ms`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'avg_latency' ? `${value}ms` : value,
                      name === 'avg_latency' ? 'Latency' : 'Calls'
                    ]}
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avg_latency" 
                    stroke="#6366f1" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Calls by Type */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Calls by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={callTypeData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis 
                    dataKey="type" 
                    type="category" 
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {callTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Call Type Legend */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-center gap-6">
            {Object.entries(CALL_TYPE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs text-zinc-400 capitalize">{type.replace('_', ' ')}</span>
                <span className="text-xs font-mono text-zinc-500">{callsByType[type] || 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Logs Table */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400">Recent LLM Calls</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table className="data-table">
              <TableHeader className="sticky top-0 bg-zinc-900">
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Timestamp</TableHead>
                  <TableHead className="text-zinc-500">Type</TableHead>
                  <TableHead className="text-zinc-500">Model</TableHead>
                  <TableHead className="text-zinc-500">Latency</TableHead>
                  <TableHead className="text-zinc-500">Tokens</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-zinc-500 py-12">
                      No LLM calls logged yet
                    </TableCell>
                  </TableRow>
                ) : (
                  recentLogs.map((log) => (
                    <TableRow 
                      key={log.log_id}
                      className="border-zinc-800/50 hover:bg-zinc-900/30"
                    >
                      <TableCell>
                        <span className="text-xs text-zinc-500 font-mono">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          className="rounded-sm px-2 py-0.5 text-xs font-medium"
                          style={{ 
                            backgroundColor: `${CALL_TYPE_COLORS[log.call_type]}20`,
                            color: CALL_TYPE_COLORS[log.call_type],
                            border: `1px solid ${CALL_TYPE_COLORS[log.call_type]}40`
                          }}
                        >
                          {log.call_type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-zinc-400 font-mono">{log.model_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`font-mono text-xs ${
                          log.latency_ms > 2000 ? 'text-red-500' : 
                          log.latency_ms > 1000 ? 'text-yellow-500' : 'text-green-500'
                        }`}>
                          {log.latency_ms}ms
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-zinc-400 font-mono">
                          {log.input_tokens} / {log.output_tokens}
                        </span>
                      </TableCell>
                      <TableCell>
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color = 'default' }) => {
  const colorClasses = {
    default: 'text-white',
    green: 'text-green-500',
    red: 'text-red-500',
    yellow: 'text-yellow-500',
    indigo: 'text-indigo-400'
  };

  return (
    <Card className="border-zinc-800 bg-[#09090b]">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className={`text-xl font-semibold font-mono mt-1 ${colorClasses[color]}`}>{value}</p>
          </div>
          <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Icon className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LLMObservability;
