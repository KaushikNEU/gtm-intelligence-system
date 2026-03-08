import React, { useState, useEffect } from 'react';
import { API } from '../App';
import { toast } from 'sonner';
import { Zap, Mail, Users, X, Clock, Send, Eye, MessageSquare } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

const ACTION_COLORS = {
  outbound: '#22c55e',
  nurture: '#eab308',
  suppress: '#ef4444'
};

const STATUS_ICONS = {
  pending: Clock,
  sent: Send,
  delivered: Send,
  opened: Eye,
  replied: MessageSquare
};

const ActivationLog = () => {
  const [activations, setActivations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    const fetchActivations = async () => {
      try {
        let url = `${API}/activations?limit=100`;
        if (actionFilter !== 'all') {
          url += `&action_type=${actionFilter}`;
        }
        const response = await fetch(url, { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setActivations(data);
        }
      } catch (error) {
        toast.error('Failed to load activations');
      } finally {
        setLoading(false);
      }
    };
    fetchActivations();
  }, [actionFilter]);

  // Calculate stats
  const outboundCount = activations.filter(a => a.action_type === 'outbound').length;
  const nurtureCount = activations.filter(a => a.action_type === 'nurture').length;
  const suppressCount = activations.filter(a => a.action_type === 'suppress').length;

  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'A': return 'tier-badge-a';
      case 'B': return 'tier-badge-b';
      case 'C': return 'tier-badge-c';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'outbound': return <Zap className="w-4 h-4" />;
      case 'nurture': return <Mail className="w-4 h-4" />;
      case 'suppress': return <X className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6" data-testid="activation-log">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Activation Log</h1>
          <p className="text-zinc-500 text-sm mt-1">Track contact routing and outbound actions</p>
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[150px] bg-zinc-900 border-zinc-800" data-testid="action-filter">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="outbound">Outbound</SelectItem>
            <SelectItem value="nurture">Nurture</SelectItem>
            <SelectItem value="suppress">Suppress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label="Outbound"
          value={outboundCount}
          icon={Zap}
          color="green"
          description="Tier A - Hot leads"
        />
        <StatCard 
          label="Nurture"
          value={nurtureCount}
          icon={Mail}
          color="yellow"
          description="Tier B - Warm leads"
        />
        <StatCard 
          label="Suppressed"
          value={suppressCount}
          icon={X}
          color="red"
          description="Tier C - Not a fit"
        />
      </div>

      {/* Activations Table */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-zinc-400">Recent Activations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="data-table">
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Contact ID</TableHead>
                  <TableHead className="text-zinc-500">Action</TableHead>
                  <TableHead className="text-zinc-500">Tier</TableHead>
                  <TableHead className="text-zinc-500">Sequence</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                  <TableHead className="text-zinc-500">Email Variants</TableHead>
                  <TableHead className="text-zinc-500">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                      Loading activations...
                    </TableCell>
                  </TableRow>
                ) : activations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                      No activations yet. Process contacts to see routing actions.
                    </TableCell>
                  </TableRow>
                ) : (
                  activations.map((activation) => {
                    const StatusIcon = STATUS_ICONS[activation.status] || Clock;
                    return (
                      <TableRow 
                        key={activation.log_id}
                        className="border-zinc-800/50 hover:bg-zinc-900/30"
                      >
                        <TableCell>
                          <span className="text-xs font-mono text-zinc-400">
                            {activation.contact_id}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div 
                            className="inline-flex items-center gap-2 px-2 py-1 rounded-sm text-xs font-medium"
                            style={{
                              backgroundColor: `${ACTION_COLORS[activation.action_type]}15`,
                              color: ACTION_COLORS[activation.action_type],
                              border: `1px solid ${ACTION_COLORS[activation.action_type]}30`
                            }}
                          >
                            {getActionIcon(activation.action_type)}
                            <span className="capitalize">{activation.action_type}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${getTierBadgeClass(activation.tier)} rounded-sm px-2 py-0.5 text-xs font-medium`}>
                            {activation.tier}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-zinc-400">
                            {activation.sequence_name || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5 text-zinc-400">
                            <StatusIcon className="w-3 h-3" />
                            <span className="text-xs capitalize">{activation.status}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {activation.email_variants && activation.email_variants.length > 0 ? (
                            <div className="space-y-1">
                              {activation.email_variants.slice(0, 2).map((variant, i) => (
                                <div key={i} className="text-xs text-zinc-500 truncate max-w-[200px]">
                                  {i + 1}. {variant.slice(0, 50)}...
                                </div>
                              ))}
                              {activation.email_variants.length > 2 && (
                                <span className="text-xs text-zinc-600">
                                  +{activation.email_variants.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-600">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-zinc-500 font-mono">
                            {new Date(activation.created_at).toLocaleString()}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({ label, value, icon: Icon, color = 'default', description }) => {
  const colorClasses = {
    default: 'text-white',
    green: 'text-green-500',
    yellow: 'text-yellow-500',
    red: 'text-red-500'
  };

  const bgClasses = {
    default: 'bg-zinc-900',
    green: 'bg-green-500/10',
    yellow: 'bg-yellow-500/10',
    red: 'bg-red-500/10'
  };

  return (
    <Card className="border-zinc-800 bg-[#09090b]">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-md ${bgClasses[color]} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${colorClasses[color]}`} />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-semibold font-mono mt-1 ${colorClasses[color]}`}>{value}</p>
            {description && (
              <p className="text-xs text-zinc-600 mt-1">{description}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivationLog;
