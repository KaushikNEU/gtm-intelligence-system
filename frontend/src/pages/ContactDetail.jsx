import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API } from '../App';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Mail,
  Building2,
  Briefcase,
  Phone,
  Globe,
  Calendar,
  Target,
  Sparkles,
  Zap,
  Activity,
  Trash2,
  Play,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
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

const ContactDetail = () => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const fetchContact = async () => {
    try {
      const response = await fetch(`${API}/contacts/${contactId}`, { credentials: 'include' });
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error('Contact not found');
        navigate('/leads');
      }
    } catch (error) {
      toast.error('Failed to load contact');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContact();
  }, [contactId]);

  const processContact = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`${API}/contacts/${contactId}/process`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Processed: Tier ${result.tier} (Score: ${result.score})`);
        fetchContact();
      }
    } catch (error) {
      toast.error('Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const deleteContact = async () => {
    try {
      const response = await fetch(`${API}/contacts/${contactId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Contact deleted');
        navigate('/leads');
      }
    } catch (error) {
      toast.error('Delete failed');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-zinc-400">Loading contact...</div>
      </div>
    );
  }

  const contact = data?.contact || {};
  const activations = data?.activations || [];
  const llmLogs = data?.llm_logs || [];
  const enrichment = contact.enrichment_data || {};

  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'A': return 'tier-badge-a';
      case 'B': return 'tier-badge-b';
      case 'C': return 'tier-badge-c';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div className="space-y-6" data-testid="contact-detail">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/leads')}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              {contact.first_name} {contact.last_name}
            </h1>
            <p className="text-zinc-500 text-sm">{contact.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            onClick={processContact}
            disabled={processing}
            className="bg-white text-black hover:bg-zinc-200"
            data-testid="process-contact-btn"
          >
            {processing ? (
              <Clock className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Process
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="border-red-900/50 text-red-500 hover:bg-red-900/20">
                <Trash2 className="w-4 h-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-zinc-900 border-zinc-800">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-white">Delete Contact</AlertDialogTitle>
                <AlertDialogDescription className="text-zinc-400">
                  This will permanently delete this contact and all associated data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="bg-zinc-800 border-zinc-700 text-zinc-300">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteContact} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Status & Score */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Status</p>
            <p className={`text-lg font-medium capitalize status-${contact.status}`}>
              {contact.status || 'pending'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Tier</p>
            {contact.tier ? (
              <Badge className={`${getTierBadgeClass(contact.tier)} text-lg px-3 py-1`}>
                {contact.tier}
              </Badge>
            ) : (
              <span className="text-zinc-600">Not scored</span>
            )}
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Score</p>
            <p className="text-2xl font-mono font-semibold text-white">
              {contact.score ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pipeline</p>
            <p className="text-lg font-medium text-white capitalize">
              {contact.pipeline_stage?.replace('_', ' ') || 'new'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info & Enrichment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contact Info */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={Mail} label="Email" value={contact.email} />
            <InfoRow icon={Building2} label="Company" value={contact.company_name} />
            <InfoRow icon={Globe} label="Domain" value={contact.company_domain} />
            <InfoRow icon={Briefcase} label="Job Title" value={contact.job_title} />
            <InfoRow icon={Phone} label="Phone" value={contact.phone} />
            <InfoRow icon={Target} label="Source" value={contact.source} />
            <InfoRow icon={Sparkles} label="Acquisition" value={contact.acquisition_source} />
            <InfoRow 
              icon={Calendar} 
              label="Created" 
              value={contact.created_at ? new Date(contact.created_at).toLocaleDateString() : '-'} 
            />
          </CardContent>
        </Card>

        {/* Enrichment Data */}
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Enrichment Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(enrichment).length > 0 ? (
              <>
                <InfoRow label="Company Size" value={enrichment.company_size} />
                <InfoRow label="Industry" value={enrichment.industry} />
                <InfoRow label="Funding Stage" value={enrichment.funding_stage} />
                <InfoRow label="ICP Signal" value={enrichment.icp_signal} />
                <InfoRow label="Decision Level" value={enrichment.decision_maker_level} />
                <InfoRow label="Department" value={enrichment.department} />
                {enrichment.tech_stack?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {enrichment.tech_stack.map((tech, i) => (
                      <Badge key={i} variant="outline" className="text-xs border-zinc-700 text-zinc-400">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-zinc-500 text-sm">Not enriched yet. Click Process to enrich.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Score Reasoning */}
      {contact.score_reasoning && (
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Target className="w-4 h-4 text-green-500" />
              Score Reasoning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-zinc-300 text-sm leading-relaxed">{contact.score_reasoning}</p>
          </CardContent>
        </Card>
      )}

      {/* Activation History */}
      {activations.length > 0 && (
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Activation History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="data-table">
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-500">Action</TableHead>
                  <TableHead className="text-zinc-500">Tier</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                  <TableHead className="text-zinc-500">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activations.map((act) => (
                  <TableRow key={act.log_id} className="border-zinc-800/50">
                    <TableCell className="capitalize text-zinc-300">{act.action_type}</TableCell>
                    <TableCell>
                      <Badge className={`${getTierBadgeClass(act.tier)} rounded-sm`}>{act.tier}</Badge>
                    </TableCell>
                    <TableCell className="capitalize text-zinc-400">{act.status}</TableCell>
                    <TableCell className="text-xs text-zinc-500 font-mono">
                      {new Date(act.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* LLM Logs */}
      {llmLogs.length > 0 && (
        <Card className="border-zinc-800 bg-[#09090b]">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              LLM Call History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table className="data-table">
              <TableHeader>
                <TableRow className="border-zinc-800">
                  <TableHead className="text-zinc-500">Type</TableHead>
                  <TableHead className="text-zinc-500">Model</TableHead>
                  <TableHead className="text-zinc-500">Latency</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                  <TableHead className="text-zinc-500">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {llmLogs.map((log) => (
                  <TableRow key={log.log_id} className="border-zinc-800/50">
                    <TableCell className="capitalize text-zinc-300">
                      {log.call_type.replace('_', ' ')}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400 font-mono">{log.model_name}</TableCell>
                    <TableCell className={`font-mono text-xs ${
                      log.latency_ms > 2000 ? 'text-red-500' : 
                      log.latency_ms > 1000 ? 'text-yellow-500' : 'text-green-500'
                    }`}>
                      {log.latency_ms}ms
                    </TableCell>
                    <TableCell>
                      {log.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500 font-mono">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const InfoRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3">
    {Icon && <Icon className="w-4 h-4 text-zinc-600" />}
    <span className="text-xs text-zinc-500 w-24">{label}</span>
    <span className="text-sm text-zinc-300">{value || '-'}</span>
  </div>
);

export default ContactDetail;
