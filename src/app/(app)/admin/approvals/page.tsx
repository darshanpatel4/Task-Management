
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
// import { Badge } from '@/components/ui/badge'; // Not used currently
import { CheckCircle2, XCircle, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

export default function ApprovalsPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingApprovalTasks = useCallback(async () => {
    if (!supabase || !isAdmin) {
      setIsLoading(false);
      setError(isAdmin ? "Supabase client not available." : "Access Denied.");
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('tasks')
        .select('id, title, status, due_date, created_at, assignee_id, project_id, project:projects(name), assignee_profile:profiles!assignee_id(full_name)')
        .eq('status', 'Completed')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      const mappedTasks: Task[] = (data || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description, 
        dueDate: task.due_date,
        createdAt: task.created_at,
        assigneeName: task.assignee_profile?.full_name || 'N/A', // Corrected
        assigneeId: task.assignee_id,
        projectName: task.project?.name || 'N/A',
        projectId: task.project_id,
        priority: task.priority as Task['priority'], 
        status: task.status as Task['status'],
        user_id: task.user_id, 
        comments: task.comments || [], 
        logs: task.logs || [], 
        project: undefined, 
        assignee_profile: undefined, 
      }));
      setTasks(mappedTasks);
    } catch (e: any) {
      // Enhanced error logging
      const supabaseErrorCode = e?.code;
      const supabaseErrorMessage = e?.message;
      const supabaseErrorDetails = e?.details;
      const supabaseErrorHint = e?.hint;

      let displayMessage = 'Failed to load tasks for approval.';
      if (supabaseErrorMessage) {
        displayMessage = supabaseErrorMessage;
      } else if (supabaseErrorDetails) {
        displayMessage = supabaseErrorDetails;
      } else if (typeof e === 'object' && e !== null) {
        try {
          displayMessage = JSON.stringify(e); // Try to stringify for more info
        } catch (stringifyError) {
          displayMessage = String(e); // Fallback to simple string conversion
        }
      } else if (e) {
        displayMessage = String(e);
      }
      
      console.error(
        `Error fetching pending approval tasks. Supabase Code: ${supabaseErrorCode}, Message: ${supabaseErrorMessage}, Details: ${supabaseErrorDetails}, Hint: ${supabaseErrorHint}. Processed display message: ${displayMessage}`, e
      );
      console.error('Full error object:', e); // Log the full error object
      setError(displayMessage);
      toast({ title: 'Error Fetching Tasks', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchPendingApprovalTasks();
  }, [fetchPendingApprovalTasks]);


  if (!isAdmin && !isLoading) {
    return (
     <div className="flex items-center justify-center h-full">
         <Card className="w-full max-w-md">
             <CardHeader>
                 <CardTitle>Access Denied</CardTitle>
                 <CardDescription>{error || "You do not have permission to view this page."}</CardDescription>
             </CardHeader>
             <CardContent>
                 <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
             </CardContent>
         </Card>
     </div>
   );
 }

 const handleApprove = async (taskId: string) => {
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'Approved' })
        .eq('id', taskId);

      if (updateError) throw updateError;

      toast({ title: "Task Approved", description: `Task ID ${taskId} has been approved.`});
      fetchPendingApprovalTasks(); // Refresh list
    } catch (e: any) {
      const displayMessage = e.message || e.details || 'Could not approve task.';
      console.error(`Error approving task. Supabase Code: ${e.code}, Message: ${e.message}, Details: ${e.details}, Hint: ${e.hint}. Full error:`, e);
      toast({ title: "Error Approving Task", description: displayMessage, variant: "destructive"});
    }
  };

  const handleReject = async (taskId: string) => {
    if (!supabase) {
      toast({ title: "Error", description: "Supabase client not available.", variant: "destructive" });
      return;
    }
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'In Progress' }) // Send back to 'In Progress'
        .eq('id', taskId);

      if (updateError) throw updateError;

      toast({ title: "Task Rejected", description: `Task ID ${taskId} has been sent back to 'In Progress'.`, variant: "default"});
      fetchPendingApprovalTasks(); // Refresh list
    } catch (e: any) {
      const displayMessage = e.message || e.details || 'Could not reject task.';
      console.error(`Error rejecting task. Supabase Code: ${e.code}, Message: ${e.message}, Details: ${e.details}, Hint: ${e.hint}. Full error:`, e);
      toast({ title: "Error Rejecting Task", description: displayMessage, variant: "destructive"});
    }
  };


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Task Approvals</h1>
        <p className="text-muted-foreground">Review and approve tasks marked as completed.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Approval Queue</CardTitle>
          <CardDescription>{!isLoading && !error && tasks.length > 0 ? `There are ${tasks.length} tasks awaiting your approval.` : 'No tasks are currently pending approval or data is loading.'}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading tasks for approval...</p>
            </div>
          )}
          {error && !isLoading && (
             <div className="flex flex-col items-center justify-center py-8 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Tasks</p>
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchPendingApprovalTasks} disabled={!supabase}>
                Try Again
              </Button>
            </div>
          )}
          {!isLoading && !error && tasks.length === 0 && (
            <p className="text-center text-muted-foreground py-8">All caught up! No tasks to approve.</p>
          )}
          {!isLoading && !error && tasks.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Completed On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                       <Link href={`/tasks/${task.id}`} className="hover:underline text-primary">{task.title}</Link>
                    </TableCell>
                    <TableCell><span>{task.assigneeName || 'N/A'}</span></TableCell>
                    <TableCell><span>{task.projectName || 'N/A'}</span></TableCell>
                    <TableCell><span>{task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'N/A'}</span></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Link href={`/tasks/${task.id}`}>
                          <Button variant="ghost" size="icon" aria-label="View task details">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleApprove(task.id)} aria-label="Approve task" disabled={!supabase}>
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleReject(task.id)} aria-label="Reject task" disabled={!supabase}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
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

