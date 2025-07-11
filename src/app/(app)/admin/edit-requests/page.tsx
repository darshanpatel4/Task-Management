
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, ThumbsUp, XCircle, Mail, Check, Ban } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { NoteEditRequest } from '@/types';

export default function EditRequestsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<NoteEditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!isAdmin || !supabase) {
      setIsLoading(false);
      setError(isAdmin ? "Supabase client not available." : "Access Denied.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('note_edit_requests')
        .select('*, note:notes (title)')
        .order('created_at', { ascending: false });
        
      if (fetchError) throw fetchError;

      const mappedData: NoteEditRequest[] = data.map(req => ({
        id: req.id,
        created_at: req.created_at,
        note_id: req.note_id,
        requester_name: req.requester_name,
        requester_email: req.requester_email,
        status: req.status as NoteEditRequest['status'],
        edit_token: req.edit_token,
        note_title: req.note?.title || 'N/A'
      }));

      setRequests(mappedData);

    } catch (e: any) {
      console.error('Error fetching edit requests:', e);
      setError(e.message || 'Failed to load requests.');
      toast({ title: 'Error', description: e.message || 'Could not load requests.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateRequest = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    if (!supabase) return;

    try {
        const { data, error } = await supabase
            .from('note_edit_requests')
            .update({ status: newStatus })
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;
        
        toast({ title: 'Success', description: `Request has been ${newStatus}.` });
        
        // TODO: Send email notification to user
        console.log(`TODO: Send email to ${data.requester_email} that their request was ${newStatus}.`);

        fetchRequests(); // Refresh list

    } catch (e: any) {
        toast({ title: 'Error', description: e.message || `Could not update request.`, variant: 'destructive' });
    }
  }

  const getStatusBadgeVariant = (status: NoteEditRequest['status']) => {
    switch (status) {
      case 'approved': return 'default';
      case 'rejected': return 'destructive';
      case 'pending':
      default:
        return 'secondary';
    }
  };


  if (!isLoading && !isAdmin) {
    return (
      <Card className="w-full max-w-md mx-auto mt-10">
        <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
        <CardContent><p>You do not have permission to view this page.</p></CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Note Edit Requests</h1>
          <p className="text-muted-foreground">Approve or reject requests to edit public notes.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Requests</CardTitle>
          <CardDescription>Review requests from users who want to contribute.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3">Loading...</p></div>
          )}
          {error && !isLoading && (
            <div className="text-destructive text-center py-12"><AlertTriangle className="mx-auto h-8 w-8 mb-2" /><p>{error}</p></div>
          )}
          {!isLoading && !error && requests.length === 0 && (
            <p className="text-center text-muted-foreground py-12">No edit requests found.</p>
          )}
          {!isLoading && !error && requests.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Note Title</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Requested At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium">
                      <Link href={`/notes/${request.note_id}`} target="_blank" className="hover:underline text-primary">
                        {request.note_title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div>{request.requester_name}</div>
                      <a href={`mailto:${request.requester_email}`} className="text-xs text-muted-foreground hover:underline flex items-center">
                        <Mail className="mr-1 h-3 w-3" /> {request.requester_email}
                      </a>
                    </TableCell>
                    <TableCell>{format(parseISO(request.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(request.status)} className="capitalize">
                         {request.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                       {request.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleUpdateRequest(request.id, 'approved')}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleUpdateRequest(request.id, 'rejected')}>
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
