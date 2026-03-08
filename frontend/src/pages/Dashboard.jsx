import React, { useState, useEffect } from 'react';
import { API } from '../App';
import { toast } from 'sonner';
import {
  Users,
  Target,
  Zap,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
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
  LineChart,
  Line
} from 'recharts';

const TIER_COLORS = {
  A: '#22c55e',
  B: '#eab308',
  C: '#ef4444'
};

const Dashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch(`${API}/analytics/dashboard`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAnalytics();
  };

  const seedDemoData = async () => {
    try {
      const response = await fetch(`${API}/seed/demo`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Created ${data.contacts_created} demo contacts`);
        fetchAnalytics();
      }
    } catch (error) {
      toast.error('Failed to seed demo data');
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading dashboard...</div>
      </div>
    );
  }

  const tierData = analytics?.tiers ? [
    { name: 'Tier A', value: analytics.tiers.A, color: TIER_COLORS.A },
    { name: 'Tier B', value: analytics.tiers.B, color: TIER_COLORS.B },
    { name: 'Tier C', value: analytics.tiers.C, color: TIER_COLORS.C }
  ] : [];

  const pipelineData = analytics?.pipeline ? Object.entries(analytics.pipeline).map(([stage, count]) => ({
    stage: stage.replace('_', ' '),
    count
  })) : [];

  return (
    <div className="space-y-8" data-testid="dashboard">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-500 text-sm mt-1">Real-time GTM intelligence overview</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            data-testid="seed-demo-btn"
            onClick={seedDemoData}
            variant="outline"
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-900"
          >
            Seed Demo Data
          </Button>
          <Button 
            data-testid="refresh-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-white text-black hover:bg-zinc-200"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={Users}
          label="Total Contacts"
          value={analytics?.contacts?.total || 0}
          subtext={`${analytics?.contacts?.pending || 0} pending`}
        />
        <StatCard 
          icon={CheckCircle}
          label="Scored"
          value={analytics?.contacts?.scored || 0}
          subtext="ready for routing"
          color="green"
        />
        <StatCard 
          icon={Activity}
          label="LLM Calls Today"
          value={analytics?.llm?.calls_today || 0}
          subtext={`${analytics?.llm?.success_rate || 100}% success rate`}
          color="indigo"
        />
        <StatCard 
          icon={Clock}
          label="Avg Latency"
          value={`${analytics?.llm?.avg_latency_ms || 0}ms`}
          subtext="LLM response time"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Tier Distribution */}
        <Card className="lg:col-span-4 border-zinc-800 bg-[#09090b]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Tier Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {tierData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-4">
              {tierData.map((tier) => (
                <div key={tier.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: tier.color }} />
                  <span className="text-xs text-zinc-400">{tier.name}</span>
                  <span className="text-xs font-mono text-white">{tier.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Funnel */}
        <Card className="lg:col-span-8 border-zinc-800 bg-[#09090b]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Pipeline Stages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipelineData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#71717a', fontSize: 11 }} />
                  <YAxis 
                    dataKey="stage" 
                    type="category" 
                    tick={{ fill: '#71717a', fontSize: 11 }}
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#18181b', 
                      border: '1px solid #27272a',
                      borderRadius: '6px',
                      fontSize: '12px'
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Attribution */}
      {analytics?.revenue_by_source && Object.keys(analytics.revenue_by_source).length > 0 && (
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Revenue by Source</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(analytics.revenue_by_source).map(([source, value]) => (
                <div key={source} className="p-4 rounded-md border border-zinc-800 bg-zinc-900/30">
                  <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">{source}</div>
                  <div className="text-xl font-mono text-white">${value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ActionCard 
              icon={Users}
              title="Import Contacts"
              description="Upload CSV or connect HubSpot"
              href="/leads"
            />
            <ActionCard 
              icon={Target}
              title="View Scores"
              description="Review scored contacts by tier"
              href="/scoring"
            />
            <ActionCard 
              icon={Zap}
              title="Activations"
              description="See recent routing actions"
              href="/activations"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, subtext, color = 'default' }) => {
  const colorClasses = {
    default: 'text-zinc-300',
    green: 'text-green-500',
    indigo: 'text-indigo-400',
    yellow: 'text-yellow-500',
    red: 'text-red-500'
  };

  return (
    <Card className="border-zinc-800 bg-[#09090b]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-semibold font-mono mt-1 ${colorClasses[color]}`}>{value}</p>
            {subtext && <p className="text-xs text-zinc-600 mt-1">{subtext}</p>}
          </div>
          <div className="w-9 h-9 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <Icon className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ActionCard = ({ icon: Icon, title, description, href }) => (
  <a 
    href={href}
    className="block p-4 rounded-md border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-zinc-700 transition-colors"
  >
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center">
        <Icon className="w-5 h-5 text-zinc-300" />
      </div>
      <div>
        <h3 className="font-medium text-white text-sm">{title}</h3>
        <p className="text-xs text-zinc-500">{description}</p>
      </div>
    </div>
  </a>
);

export default Dashboard;
