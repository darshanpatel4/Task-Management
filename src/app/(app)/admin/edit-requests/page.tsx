
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertTriangle, ThumbsUp, XCircle, Mail, Check, Ban, Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import type { NoteEditRequest } from '@/types';
import { sendEmail } from '@/actions/sendEmailAction';

export default function EditRequestsPage() {
  const { isAdmin, currentUser } = useAuth();
  const { toast } = useToast();

  const [requests, setRequests] = useState<NoteEditRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

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
    if (!supabase || !currentUser) return;
    setUpdatingId(requestId);

    try {
        const { data: updatedRequest, error } = await supabase
            .from('note_edit_requests')
            .update({ status: newStatus })
            .eq('id', requestId)
            .select('*, note:notes (id, title)')
            .single();

        if (error) throw error;
        
        toast({ title: 'Success', description: `Request has been ${newStatus}.` });
        
        // Send email notification to user
        const editUrl = `${window.location.origin}/notes/${updatedRequest.note.id}/edit`;
        const noteUrl = `${window.location.origin}/notes/${updatedRequest.note.id}`;

        let emailSubject = '';
        let emailContent = '';

        if (newStatus === 'approved') {
            emailSubject = `Your request to edit "${updatedRequest.note.title}" has been approved!`;
            emailContent = `
                <p>Hello ${updatedRequest.requester_name},</p>
                <p>Great news! Your request to edit the note "<strong>${updatedRequest.note.title}</strong>" has been approved by an administrator.</p>
                <p>You can now edit the note by clicking the secure link below. This link is for you only and can be used once.</p>
                <a href="${editUrl}" class="button">Edit Note Now</a>
                <p>If the button doesn't work, please copy and paste this URL into your browser:</p>
                <p>${editUrl}</p>
            `;
            // Add the generated token to the URL - this part is tricky without a page to handle it.
            // Let's assume the session-based approach on the edit page will work.
            // For a token-based approach, the URL would be like: /notes/edit?token=${updatedRequest.edit_token}

        } else { // Rejected
            emailSubject = `Update on your request to edit "${updatedRequest.note.title}"`;
            emailContent = `
                <p>Hello ${updatedRequest.requester_name},</p>
                <p>Thank you for your interest in contributing to the note "<strong>${updatedRequest.note.title}</strong>".</p>
                <p>At this time, we have decided not to proceed with the requested changes. We appreciate your submission and may reconsider it in the future.</p>
                <p>You can still view the note here:</p>
                <a href="${noteUrl}" class="button">View Note</a>
            `;
        }

        await sendEmail({
            to: updatedRequest.requester_email,
            subject: emailSubject,
            rawContent: emailContent,
            recipientName: updatedRequest.requester_name,
        });

        fetchRequests(); // Refresh list

    } catch (e: any) {
        console.error("Error updating request or sending email:", e);
        toast({ title: 'Error', description: e.message || `Could not update request.`, variant: 'destructive' });
    } finally {
      setUpdatingId(null);
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
          <p className="text-muted-foreground">Approve or reject requests from users to edit public notes.</p>
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
                          <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleUpdateRequest(request.id, 'approved')} disabled={updatingId === request.id}>
                            {updatingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80" onClick={() => handleUpdateRequest(request.id, 'rejected')} disabled={updatingId === request.id}>
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
