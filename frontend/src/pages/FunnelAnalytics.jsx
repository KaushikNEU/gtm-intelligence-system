import React, { useState, useEffect } from 'react';
import { API } from '../App';
import { toast } from 'sonner';
import { TrendingUp, ArrowRight, Users, DollarSign, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  FunnelChart,
  Funnel,
  LabelList,
  Cell
} from 'recharts';

const STAGE_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#22c55e'];

const FunnelAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const response = await fetch(`${API}/analytics/funnel`, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setAnalytics(data);
        }
      } catch (error) {
        toast.error('Failed to load funnel analytics');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading funnel analytics...</div>
      </div>
    );
  }

  const stages = analytics?.stages || {};
  const conversions = analytics?.conversions || [];
  
  // Prepare funnel data
  const funnelData = Object.entries(stages).map(([stage, count], index) => ({
    name: stage.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: count,
    fill: STAGE_COLORS[index % STAGE_COLORS.length]
  }));

  // Calculate totals
  const totalLeads = stages.new || 0;
  const closedWon = stages.closed_won || 0;
  const overallConversion = totalLeads > 0 ? ((closedWon / totalLeads) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6" data-testid="funnel-analytics">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Funnel Analytics</h1>
        <p className="text-zinc-500 text-sm mt-1">Track conversion rates and pipeline velocity</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard 
          label="Total Leads"
          value={totalLeads}
          icon={Users}
        />
        <StatCard 
          label="Closed Won"
          value={closedWon}
          icon={DollarSign}
          color="green"
        />
        <StatCard 
          label="Overall Conversion"
          value={`${overallConversion}%`}
          icon={TrendingUp}
          color="indigo"
        />
        <StatCard 
          label="Avg Deal Velocity"
          value={`${analytics?.avg_deal_velocity_days || 0} days`}
          icon={Clock}
        />
      </div>

      {/* Funnel Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel Chart */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Pipeline Funnel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <FunnelChart>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Funnel
                    data={funnelData}
                    dataKey="value"
                    isAnimationActive
                  >
                    <LabelList 
                      position="center" 
                      fill="#fff" 
                      stroke="none"
                      fontSize={12}
                      formatter={(value) => `${value}`}
                    />
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Funnel>
                </FunnelChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {funnelData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: STAGE_COLORS[index % STAGE_COLORS.length] }} 
                  />
                  <span className="text-xs text-zinc-400">{item.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Stage Bar Chart */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Contacts by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    width={90}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversion Rates */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400">Stage-to-Stage Conversion Rates</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {conversions.map((conv, index) => (
              <div 
                key={index}
                className="flex flex-col items-center p-4 rounded-md border border-zinc-800 bg-zinc-900/30"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                  <span className="capitalize">{conv.from.replace('_', ' ')}</span>
                  <ArrowRight className="w-3 h-3" />
                  <span className="capitalize">{conv.to.replace('_', ' ')}</span>
                </div>
                <div className={`text-2xl font-mono font-semibold ${
                  conv.rate >= 50 ? 'text-green-500' : 
                  conv.rate >= 25 ? 'text-yellow-500' : 'text-red-500'
                }`}>
                  {conv.rate}%
                </div>
              </div>
            ))}
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
    indigo: 'text-indigo-400',
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

export default FunnelAnalytics;
