import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { API } from '../App';
import { toast } from 'sonner';
import {
  Users,
  Upload,
  Search,
  Filter,
  MoreVertical,
  Play,
  Sparkles,
  Target,
  CheckCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Mail,
  Building2,
  Briefcase
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';

const LeadIntelligence = () => {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState('all');
  const [processingIds, setProcessingIds] = useState(new Set());
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  const fetchContacts = useCallback(async () => {
    try {
      let url = `${API}/contacts?limit=100`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (tierFilter !== 'all') url += `&tier=${tierFilter}`;
      
      const response = await fetch(url, { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setContacts(data);
      }
    } catch (error) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, tierFilter]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const processContact = async (contactId) => {
    setProcessingIds(prev => new Set([...prev, contactId]));
    try {
      const response = await fetch(`${API}/contacts/${contactId}/process`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Contact processed: Tier ${result.tier} (Score: ${result.score})`);
        fetchContacts();
      } else {
        toast.error('Failed to process contact');
      }
    } catch (error) {
      toast.error('Processing failed');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  };

  const enrichContact = async (contactId) => {
    setProcessingIds(prev => new Set([...prev, contactId]));
    try {
      const response = await fetch(`${API}/contacts/${contactId}/enrich`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        toast.success('Contact enriched successfully');
        fetchContacts();
      }
    } catch (error) {
      toast.error('Enrichment failed');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  };

  const scoreContact = async (contactId) => {
    setProcessingIds(prev => new Set([...prev, contactId]));
    try {
      const response = await fetch(`${API}/contacts/${contactId}/score`, {
        method: 'POST',
        credentials: 'include'
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Scored: Tier ${result.tier} (${result.score})`);
        fetchContacts();
      }
    } catch (error) {
      toast.error('Scoring failed');
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(contactId);
        return next;
      });
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${API}/contacts/bulk`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (response.ok) {
        const result = await response.json();
        toast.success(`Uploaded ${result.contacts_created} contacts`);
        setUploadDialogOpen(false);
        fetchContacts();
      }
    } catch (error) {
      toast.error('Upload failed');
    }
  };

  const bulkProcess = async () => {
    setBulkProcessing(true);
    try {
      const response = await fetch(`${API}/contacts/bulk-process`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const result = await response.json();
        const processed = result.results.filter(r => r.status === 'processed').length;
        toast.success(`Processed ${processed} contacts`);
        fetchContacts();
      }
    } catch (error) {
      toast.error('Bulk processing failed');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleAddContact = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
      const response = await fetch(`${API}/contacts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (response.ok) {
        toast.success('Contact added');
        setAddContactOpen(false);
        fetchContacts();
      }
    } catch (error) {
      toast.error('Failed to add contact');
    }
  };

  const filteredContacts = contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.email?.toLowerCase().includes(q) ||
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q)
    );
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'enriching': case 'scoring': return <RefreshCw className="w-3 h-3 animate-spin" />;
      case 'enriched': case 'scored': return <CheckCircle className="w-3 h-3" />;
      case 'activated': return <Sparkles className="w-3 h-3" />;
      default: return <AlertCircle className="w-3 h-3" />;
    }
  };

  const getTierBadgeClass = (tier) => {
    switch (tier) {
      case 'A': return 'tier-badge-a';
      case 'B': return 'tier-badge-b';
      case 'C': return 'tier-badge-c';
      default: return 'bg-zinc-800 text-zinc-400';
    }
  };

  return (
    <div className="space-y-6" data-testid="lead-intelligence">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Lead Intelligence</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage, enrich, and score your contacts</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Bulk Process */}
          <Button 
            variant="outline" 
            onClick={bulkProcess}
            disabled={bulkProcessing}
            className="border-zinc-800 text-zinc-300"
            data-testid="bulk-process-btn"
          >
            {bulkProcessing ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            Process All Pending
          </Button>

          {/* CSV Upload */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-zinc-800 text-zinc-300" data-testid="upload-csv-btn">
                <Upload className="w-4 h-4 mr-2" />
                Upload CSV
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-white">Upload Contacts CSV</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <p className="text-sm text-zinc-400">
                  Upload a CSV file with columns: email, first_name, last_name, company_name, company_domain, job_title
                </p>
                <Input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* Add Contact */}
          <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
            <DialogTrigger asChild>
              <Button className="bg-white text-black hover:bg-zinc-200" data-testid="add-contact-btn">
                <Users className="w-4 h-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Contact</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddContact} className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email" className="text-zinc-400">Email *</Label>
                    <Input name="email" id="email" required className="bg-zinc-800 border-zinc-700 mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="first_name" className="text-zinc-400">First Name</Label>
                    <Input name="first_name" id="first_name" className="bg-zinc-800 border-zinc-700 mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="last_name" className="text-zinc-400">Last Name</Label>
                    <Input name="last_name" id="last_name" className="bg-zinc-800 border-zinc-700 mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="company_name" className="text-zinc-400">Company</Label>
                    <Input name="company_name" id="company_name" className="bg-zinc-800 border-zinc-700 mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="company_domain" className="text-zinc-400">Domain</Label>
                    <Input name="company_domain" id="company_domain" className="bg-zinc-800 border-zinc-700 mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="job_title" className="text-zinc-400">Job Title</Label>
                    <Input name="job_title" id="job_title" className="bg-zinc-800 border-zinc-700 mt-1" />
                  </div>
                </div>
                <Button type="submit" className="w-full bg-white text-black hover:bg-zinc-200">
                  Add Contact
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <Input 
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-900 border-zinc-800"
                data-testid="search-input"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] bg-zinc-900 border-zinc-800" data-testid="status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="enriched">Enriched</SelectItem>
                <SelectItem value="scored">Scored</SelectItem>
                <SelectItem value="activated">Activated</SelectItem>
                <SelectItem value="nurtured">Nurtured</SelectItem>
                <SelectItem value="suppressed">Suppressed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-[120px] bg-zinc-900 border-zinc-800" data-testid="tier-filter">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800">
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="A">Tier A</SelectItem>
                <SelectItem value="B">Tier B</SelectItem>
                <SelectItem value="C">Tier C</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={fetchContacts}
              className="text-zinc-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card className="border-zinc-800 bg-[#09090b]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="data-table">
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Contact</TableHead>
                  <TableHead className="text-zinc-500">Company</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                  <TableHead className="text-zinc-500">Tier</TableHead>
                  <TableHead className="text-zinc-500">Score</TableHead>
                  <TableHead className="text-zinc-500">Source</TableHead>
                  <TableHead className="text-zinc-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                      Loading contacts...
                    </TableCell>
                  </TableRow>
                ) : filteredContacts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-zinc-500 py-12">
                      No contacts found. Add contacts or seed demo data.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredContacts.map((contact) => (
                    <TableRow 
                      key={contact.contact_id} 
                      className="border-zinc-800/50 hover:bg-zinc-900/30 cursor-pointer"
                      data-testid={`contact-row-${contact.contact_id}`}
                      onClick={() => navigate(`/leads/${contact.contact_id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-300">
                            {contact.first_name?.[0]}{contact.last_name?.[0]}
                          </div>
                          <div>
                            <div className="font-medium text-white text-sm">
                              {contact.first_name} {contact.last_name}
                            </div>
                            <div className="text-xs text-zinc-500">{contact.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3 h-3 text-zinc-600" />
                          <span className="text-zinc-300">{contact.company_name || '-'}</span>
                        </div>
                        {contact.job_title && (
                          <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                            <Briefcase className="w-3 h-3" />
                            {contact.job_title}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 text-xs status-${contact.status}`}>
                          {getStatusIcon(contact.status)}
                          <span className="capitalize">{contact.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.tier ? (
                          <Badge className={`${getTierBadgeClass(contact.tier)} rounded-sm px-2 py-0.5 text-xs font-medium`}>
                            {contact.tier}
                          </Badge>
                        ) : (
                          <span className="text-zinc-600">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-zinc-300">
                          {contact.score !== null ? contact.score : '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-zinc-500 capitalize">{contact.source}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={processingIds.has(contact.contact_id)}
                              data-testid={`contact-actions-${contact.contact_id}`}
                            >
                              {processingIds.has(contact.contact_id) ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreVertical className="w-4 h-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800">
                            <DropdownMenuItem 
                              onClick={() => processContact(contact.contact_id)}
                              className="text-zinc-300 focus:bg-zinc-800 cursor-pointer"
                            >
                              <Play className="w-4 h-4 mr-2" />
                              Full Pipeline
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => enrichContact(contact.contact_id)}
                              className="text-zinc-300 focus:bg-zinc-800 cursor-pointer"
                            >
                              <Sparkles className="w-4 h-4 mr-2" />
                              Enrich Only
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => scoreContact(contact.contact_id)}
                              className="text-zinc-300 focus:bg-zinc-800 cursor-pointer"
                              disabled={!contact.enrichment_data}
                            >
                              <Target className="w-4 h-4 mr-2" />
                              Score Only
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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

export default LeadIntelligence;
