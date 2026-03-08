import React, { useState, useEffect } from 'react';
import { API } from '../App';
import { toast } from 'sonner';
import { GitBranch, DollarSign, TrendingUp, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

const SOURCE_COLORS = ['#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', '#f97316'];
const TIER_COLORS = { A: '#22c55e', B: '#eab308', C: '#ef4444' };

const PipelineAttribution = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`${API}/analytics/attribution`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        toast.error('Failed to load attribution data');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading attribution data...</div>
      </div>
    );
  }

  const bySource = analytics?.by_source || [];
  const byTier = analytics?.by_tier || {};

  // Calculate totals
  const totalRevenue = bySource.reduce((sum, s) => sum + (s.total_revenue || 0), 0);
  const totalDeals = bySource.reduce((sum, s) => sum + (s.deal_count || 0), 0);
  const avgDealSize = totalDeals > 0 ? totalRevenue / totalDeals : 0;

  // Pie chart data
  const pieData = bySource.map((s, i) => ({
    name: s.source,
    value: s.total_revenue,
    color: SOURCE_COLORS[i % SOURCE_COLORS.length]
  }));

  // Tier revenue data
  const tierRevenueData = Object.entries(byTier).map(([tier, data]) => ({
    tier,
    revenue: data.total_revenue || 0,
    deals: data.deal_count || 0,
    color: TIER_COLORS[tier] || '#6b7280'
  }));

  return (
    <div className="space-y-6" data-testid="pipeline-attribution">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Pipeline Attribution</h1>
        <p className="text-zinc-500 text-sm mt-1">Revenue attribution by source and tier</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Revenue"
          value={`$${totalRevenue.toLocaleString()}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard 
          label="Total Deals"
          value={totalDeals}
          icon={BarChart2}
        />
        <StatCard 
          label="Avg Deal Size"
          value={`$${avgDealSize.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          icon={TrendingUp}
        />
        <StatCard 
          label="Top Source"
          value={bySource[0]?.source || '-'}
          icon={GitBranch}
          color="indigo"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Source Pie */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Revenue by Acquisition Source</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `$${value.toLocaleString()}`}
                      contentStyle={{ 
                        backgroundColor: '#18181b', 
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Legend 
                      formatter={(value) => <span className="text-zinc-400 text-xs">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-zinc-500">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Revenue by Source Bar */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Source Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {bySource.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bySource}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis 
                      dataKey="source" 
                      tick={{ fill: '#71717a', fontSize: 11 }}
                    />
                    <YAxis 
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip 
                      formatter={(value, name) => [
                        name === 'total_revenue' ? `$${value.toLocaleString()}` : value,
                        name === 'total_revenue' ? 'Revenue' : 'Deals'
                      ]}
                      contentStyle={{ 
                        backgroundColor: '#18181b', 
                        border: '1px solid #27272a',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="total_revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-zinc-500">
                No source data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Tier */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400">Revenue by Lead Tier</CardTitle>
        </CardHeader>
        <CardContent>
          {tierRevenueData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {tierRevenueData.map((tier) => (
                <div 
                  key={tier.tier}
                  className="p-5 rounded-md border border-zinc-800 bg-zinc-900/30"
                >
                  <div className="flex items-center justify-between mb-3">
                    <Badge 
                      className={`rounded-sm px-2 py-0.5 text-xs font-medium ${
                        tier.tier === 'A' ? 'tier-badge-a' :
                        tier.tier === 'B' ? 'tier-badge-b' : 'tier-badge-c'
                      }`}
                    >
                      Tier {tier.tier}
                    </Badge>
                    <span className="text-xs text-zinc-500">{tier.deals} deals</span>
                  </div>
                  <div className="text-2xl font-mono font-semibold text-white">
                    ${tier.revenue.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500">
              No tier revenue data available. Process and close deals to see attribution.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source Details Table */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400">Source Details</CardTitle>
        </CardHeader>
        <CardContent>
          {bySource.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-3 px-4 text-zinc-500">Source</th>
                    <th className="text-right py-3 px-4 text-zinc-500">Deals</th>
                    <th className="text-right py-3 px-4 text-zinc-500">Revenue</th>
                    <th className="text-right py-3 px-4 text-zinc-500">Avg Deal</th>
                    <th className="text-right py-3 px-4 text-zinc-500">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {bySource.map((source, index) => (
                    <tr key={source.source} className="border-b border-zinc-800/50 hover:bg-zinc-900/30">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: SOURCE_COLORS[index % SOURCE_COLORS.length] }}
                          />
                          <span className="text-zinc-300 capitalize">{source.source}</span>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 text-zinc-300 font-mono">
                        {source.deal_count}
                      </td>
                      <td className="text-right py-3 px-4 text-white font-mono">
                        ${source.total_revenue.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-4 text-zinc-400 font-mono">
                        ${source.avg_deal.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-4 text-zinc-400 font-mono">
                        {totalRevenue > 0 ? ((source.total_revenue / totalRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-zinc-500">
              No source data available
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color = 'default' }) => {
  const colorClasses = {
    default: 'text-white',
    green: 'text-green-500',
    indigo: 'text-indigo-400'
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

export default PipelineAttribution;
