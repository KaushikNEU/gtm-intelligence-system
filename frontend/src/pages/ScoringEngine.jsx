import React, { useState, useEffect } from 'react';
import { API } from '../App';
import { toast } from 'sonner';
import { Target, TrendingUp, AlertTriangle, CheckCircle, Info } from 'lucide-react';
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
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend
} from 'recharts';
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../components/ui/tooltip';

const TIER_COLORS = {
  A: '#22c55e',
  B: '#eab308',
  C: '#ef4444'
};

const ScoringEngine = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`${API}/analytics/scoring`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        toast.error('Failed to load scoring analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading scoring engine...</div>
      </div>
    );
  }

  const tierTrendData = analytics?.tier_trend || [];
  const scoreDistribution = analytics?.score_distribution || [];
  const recentScores = analytics?.recent_scores || [];

  // Calculate stats
  const totalScored = recentScores.length;
  const avgScore = totalScored > 0 
    ? Math.round(recentScores.reduce((sum, s) => sum + (s.score || 0), 0) / totalScored)
    : 0;
  const tierACount = recentScores.filter(s => s.tier === 'A').length;
  const tierBCount = recentScores.filter(s => s.tier === 'B').length;
  const tierCCount = recentScores.filter(s => s.tier === 'C').length;

  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'A': return 'tier-badge-a';
      case 'B': return 'tier-badge-b';
      case 'C': return 'tier-badge-c';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div className="space-y-6" data-testid="scoring-engine">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Scoring Engine</h1>
        <p className="text-zinc-500 text-sm mt-1">Monitor lead scoring performance and tier distribution</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Scored"
          value={totalScored}
          icon={Target}
        />
        <StatCard 
          label="Average Score"
          value={avgScore}
          icon={TrendingUp}
        />
        <StatCard 
          label="Tier A Rate"
          value={totalScored > 0 ? `${Math.round(tierACount / totalScored * 100)}%` : '0%'}
          icon={CheckCircle}
          color="green"
        />
        <StatCard 
          label="Low Quality"
          value={totalScored > 0 ? `${Math.round(tierCCount / totalScored * 100)}%` : '0%'}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score Distribution */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Score Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fill: '#71717a', fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="#6366f1" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Tier Trend */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Tier Breakdown Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={tierTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: '#71717a', fontSize: 11 }}
                  />
                  <YAxis tick={{ fill: '#71717a', fontSize: 11 }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="A" stroke={TIER_COLORS.A} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="B" stroke={TIER_COLORS.B} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="C" stroke={TIER_COLORS.C} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Scores Table */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400">Recent Scores with Reasoning</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="data-table">
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Contact</TableHead>
                  <TableHead className="text-zinc-500">Tier</TableHead>
                  <TableHead className="text-zinc-500">Score</TableHead>
                  <TableHead className="text-zinc-500">Reasoning</TableHead>
                  <TableHead className="text-zinc-500">Scored At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentScores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-zinc-500 py-12">
                      No scored contacts yet. Process contacts from Lead Intelligence.
                    </TableCell>
                  </TableRow>
                ) : (
                  recentScores.map((score) => (
                    <TableRow 
                      key={score.contact_id}
                      className="border-zinc-800/50 hover:bg-zinc-900/30"
                    >
                      <TableCell>
                        <span className="text-zinc-300">{score.email}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getTierBadgeClass(score.tier)} rounded-sm px-2 py-0.5 text-xs font-medium`}>
                          {score.tier}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-white">{score.score}</span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <TooltipProvider>
                          <UITooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 cursor-help">
                                <span className="text-zinc-400 text-xs truncate">
                                  {score.score_reasoning?.slice(0, 80)}...
                                </span>
                                <Info className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm bg-zinc-800 border-zinc-700 text-zinc-300">
                              <p className="text-sm">{score.score_reasoning}</p>
                            </TooltipContent>
                          </UITooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-zinc-500 font-mono">
                          {score.scored_at ? new Date(score.scored_at).toLocaleString() : '-'}
                        </span>
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
    yellow: 'text-yellow-500'
  };

  return (
    <Card className="border-zinc-800 bg-[#09090b]">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-semibold font-mono mt-1 ${colorClasses[color]}`}>{value}</p>
          </div>
          <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Icon className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ScoringEngine;
