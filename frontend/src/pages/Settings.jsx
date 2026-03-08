import React, { useState, useEffect } from 'react';
import { API, useAuth } from '../App';
import { toast } from 'sonner';
import {
  User,
  Mail,
  Shield,
  Activity,
  Calendar,
  RefreshCw,
  Download,
  Trash2
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Separator } from '../components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../components/ui/alert-dialog';

const Settings = () => {
  const { user } = useAuth();
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const fetchWeeklySummary = async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch(`${API}/analytics/weekly-summary`, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setWeeklySummary(data);
      }
    } catch (error) {
      toast.error('Failed to load weekly summary');
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    fetchWeeklySummary();
  }, []);

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const exportData = async () => {
    try {
      const response = await fetch(`${API}/contacts?limit=1000`, { credentials: 'include' });
      if (response.ok) {
        const contacts = await response.json();
        const csv = convertToCSV(contacts);
        downloadCSV(csv, 'gtm_contacts_export.csv');
        toast.success('Contacts exported successfully');
      }
    } catch (error) {
      toast.error('Export failed');
    }
  };

  const convertToCSV = (data) => {
    if (!data.length) return '';
    const headers = ['email', 'first_name', 'last_name', 'company_name', 'job_title', 'tier', 'score', 'status', 'pipeline_stage'];
    const rows = data.map(row => headers.map(h => row[h] ?? '').join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  return (
    <div className="space-y-6 max-w-4xl" data-testid="settings">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-white tracking-tight">Settings</h1>
        <p className="text-zinc-500 text-sm mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={user?.picture} alt={user?.name} />
              <AvatarFallback className="bg-zinc-800 text-zinc-300 text-lg">
                {getInitials(user?.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-lg font-medium text-white">{user?.name}</h3>
              <p className="text-zinc-500 text-sm flex items-center gap-2">
                <Mail className="w-3 h-3" />
                {user?.email}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                User ID: {user?.user_id}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Health Summary */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Weekly Pipeline Health
            </CardTitle>
            <CardDescription className="text-xs text-zinc-600 mt-1">
              Last 7 days performance summary
            </CardDescription>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={fetchWeeklySummary}
            disabled={loadingSummary}
            className="text-zinc-400"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSummary ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>
        <CardContent>
          {weeklySummary ? (
            <div className="space-y-6">
              {/* Tier Conversions */}
              <div>
                <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Conversion by Tier</h4>
                <div className="grid grid-cols-3 gap-4">
                  {Object.entries(weeklySummary.tier_conversions || {}).map(([tier, data]) => (
                    <div key={tier} className="p-3 rounded-md border border-zinc-800 bg-zinc-900/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-sm font-medium ${
                          tier === 'A' ? 'text-green-500' : 
                          tier === 'B' ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                          Tier {tier}
                        </span>
                        <span className="text-xs text-zinc-500">{data.total} contacts</span>
                      </div>
                      <div className="text-xl font-mono font-semibold text-white">
                        {data.conversion_rate}%
                      </div>
                      <div className="text-xs text-zinc-600">{data.closed_won} closed won</div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-zinc-800" />

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                  label="Avg Deal Velocity"
                  value={`${weeklySummary.avg_deal_velocity_days} days`}
                />
                <MetricCard 
                  label="Contacts Enriched"
                  value={weeklySummary.processing_volume?.contacts_enriched || 0}
                />
                <MetricCard 
                  label="Contacts Scored"
                  value={weeklySummary.processing_volume?.contacts_scored || 0}
                />
                <MetricCard 
                  label="LLM Success Rate"
                  value={`${weeklySummary.llm_health?.success_rate || 100}%`}
                  color={weeklySummary.llm_health?.success_rate < 95 ? 'red' : 'green'}
                />
              </div>

              {/* Top Sources */}
              {weeklySummary.top_acquisition_sources?.length > 0 && (
                <>
                  <Separator className="bg-zinc-800" />
                  <div>
                    <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Top Acquisition Sources</h4>
                    <div className="space-y-2">
                      {weeklySummary.top_acquisition_sources.map((source, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded border border-zinc-800/50">
                          <span className="text-sm text-zinc-300 capitalize">{source.source}</span>
                          <div className="text-right">
                            <span className="text-sm font-mono text-white">${source.revenue.toLocaleString()}</span>
                            <span className="text-xs text-zinc-500 ml-2">({source.deals} deals)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <p className="text-xs text-zinc-600">
                Generated: {new Date(weeklySummary.generated_at).toLocaleString()}
              </p>
            </div>
          ) : (
            <div className="text-center py-8 text-zinc-500">
              Loading summary...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Data Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 rounded-md border border-zinc-800">
            <div>
              <h4 className="text-sm font-medium text-white">Export Contacts</h4>
              <p className="text-xs text-zinc-500">Download all contacts as CSV</p>
            </div>
            <Button 
              variant="outline" 
              onClick={exportData}
              className="border-zinc-700 text-zinc-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 rounded-md border border-red-900/30">
            <div>
              <h4 className="text-sm font-medium text-red-400">Danger Zone</h4>
              <p className="text-xs text-zinc-500">Permanently delete all your data</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="border-red-900/50 text-red-500 hover:bg-red-900/20">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-white">Delete All Data</AlertDialogTitle>
                  <AlertDialogDescription className="text-zinc-400">
                    This will permanently delete all your contacts, activations, and analytics data. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">Cancel</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-600 hover:bg-red-700">
                    Delete Everything
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const MetricCard = ({ label, value, color = 'default' }) => {
  const colorClasses = {
    default: 'text-white',
    green: 'text-green-500',
    red: 'text-red-500'
  };

  return (
    <div className="p-3 rounded-md border border-zinc-800 bg-zinc-900/30">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`text-lg font-mono font-semibold ${colorClasses[color]}`}>{value}</div>
    </div>
  );
};

export default Settings;
