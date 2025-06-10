
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Task, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, XCircle, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { sendEmail, getUserDetailsByIds, wrapHtmlContent } from '@/actions/sendEmailAction';

interface AssigneeDisplayInfo {
  id: string;
  name: string;
  email?: string;
}

export default function ApprovalsPage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [assigneeDetailsMap, setAssigneeDetailsMap] = useState<Record<string, AssigneeDisplayInfo>>({});
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
    setAssigneeDetailsMap({});

    try {
      const { data: tasksData, error: supabaseError } = await supabase
        .from('tasks')
        .select('id, title, description, status, due_date, created_at, assignee_ids, project_id, project:projects(name)')
        .eq('status', 'Completed')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw supabaseError;
      }

      const allAssigneeIds = new Set<string>();
      (tasksData || []).forEach(task => {
        if (task.assignee_ids) {
          task.assignee_ids.forEach(id => allAssigneeIds.add(id));
        }
      });

      if (allAssigneeIds.size > 0) {
        const userProfiles = await getUserDetailsByIds(Array.from(allAssigneeIds));
        const newAssigneeDetailsMap: Record<string, AssigneeDisplayInfo> = {};
        userProfiles.forEach(profile => {
            newAssigneeDetailsMap[profile.id] = { id: profile.id, name: profile.name || 'N/A', email: profile.email || '' };
        });
        setAssigneeDetailsMap(newAssigneeDetailsMap);
      }

      const mappedTasks: Task[] = (tasksData || []).map(task => ({
        id: task.id,
        title: task.title,
        description: task.description,
        dueDate: task.due_date,
        createdAt: task.created_at,
        assignee_ids: task.assignee_ids,
        projectName: task.project?.name || 'N/A',
        projectId: task.project_id,
        priority: task.priority as Task['priority'],
        status: task.status as Task['status'],
        user_id: task.user_id,
        comments: task.comments || [],
        logs: task.logs || [],
      }));
      setTasks(mappedTasks);
    } catch (e: any) {
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
          displayMessage = JSON.stringify(e);
        } catch (stringifyError) {
          displayMessage = String(e);
        }
      } else if (e) {
        displayMessage = String(e);
      }
      
      console.error(
        \`Error fetching pending approval tasks. Supabase Code: \${supabaseErrorCode}, Message: \${supabaseErrorMessage}, Details: \${supabaseErrorDetails}, Hint: \${supabaseErrorHint}. Processed display message: \${displayMessage}\`, e
      );
      console.error('Full error object:', e);
      setError(displayMessage);
      toast({ title: 'Error Fetching Tasks', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchPendingApprovalTasks();
  }, [fetchPendingApprovalTasks]);

  const displayAssigneeNames = (assigneeIds?: string[] | null): string => {
    if (!assigneeIds || assigneeIds.length === 0) return 'Unassigned';
    
    const names = assigneeIds.map(id => assigneeDetailsMap[id]?.name || 'Loading...').join(', ');
    
    if (names.length > 30 && assigneeIds.length > 1) {
        return \`\${assigneeIds.length} Assignees\`;
    }
    return names || 'N/A';
  };


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

 const handleApprove = async (taskId: string, taskAssigneeIds?: string[] | null) => {
    if (!supabase || !currentUser) {
      toast({ title: "Error", description: "Supabase client or user session not available.", variant: "destructive" });
      return;
    }
    const taskToNotify = tasks.find(t => t.id === taskId);
    if (!taskToNotify) {
        toast({ title: "Error", description: "Task details not found for notification.", variant: "destructive" });
        return;
    }

    console.log(\`ApprovalsPage: Approving task "\${taskToNotify.title}" (ID: \${taskId}). Assignees to notify:\`, taskAssigneeIds);

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'Approved' })
        .eq('id', taskId);

      if (updateError) throw updateError;

      let toastDescription = \`Task "\${taskToNotify.title}" has been approved.\`;

      if (taskAssigneeIds && taskAssigneeIds.length > 0 && currentUser) {
        const recipientUserDetails = await getUserDetailsByIds(taskAssigneeIds);
        
        const notificationsToInsert = recipientUserDetails.map(assignee => ({
            user_id: assignee.id,
            message: \`Your task "\${taskToNotify.title}" has been approved by \${currentUser.name}!\`,
            type: 'task_approved' as const,
            link: \`/tasks/\${taskId}\`,
            task_id: taskId,
            triggered_by_user_id: currentUser.id,
        }));
        
        console.log("ApprovalsPage: Notifications to insert on approval:", notificationsToInsert);

        if (notificationsToInsert.length > 0) {
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert(notificationsToInsert);
            if (notificationError) {
                console.error("Error creating approval notifications:", notificationError);
                toastDescription += " Assignees notified (with potential errors).";
            } else {
                 toastDescription += " Assignees have been notified.";
            }
        }

        for (const assignee of recipientUserDetails) {
          if (assignee.email) {
             const emailHtmlContent = \`
                <p>Hello \${assignee.name || 'User'},</p>
                <p>Your task "<strong>\${taskToNotify.title}</strong>" has been approved by \${currentUser.name}.</p>
                <p><strong>Due Date:</strong> \${taskToNotify.dueDate ? format(parseISO(taskToNotify.dueDate), 'PPP') : 'N/A'}</p>
                <p>Great job!</p>
                <p>You can view the task details by clicking the button below:</p>
                <a href="\${process.env.NEXT_PUBLIC_APP_URL}/tasks/\${taskId}" class="button">View Task</a>
              \`;
            await sendEmail({
              to: assignee.email,
              recipientName: assignee.name,
              subject: \`Task Approved: \${taskToNotify.title}\`,
              htmlBody: wrapHtmlContent(emailHtmlContent, \`Task Approved: \${taskToNotify.title}\`),
            });
          }
        }
      }
      toast({ title: "Task Approved", description: toastDescription});
      fetchPendingApprovalTasks();
    } catch (e: any) {
      const displayMessage = e.message || e.details || 'Could not approve task.';
      console.error(\`Error approving task. Supabase Code: \${e.code}, Message: \${e.message}, Details: \${e.details}, Hint: \${e.hint}. Full error:\`, e);
      toast({ title: "Error Approving Task", description: displayMessage, variant: "destructive"});
    }
  };

  const handleReject = async (taskId: string, taskAssigneeIds?: string[] | null) => {
    if (!supabase || !currentUser) {
      toast({ title: "Error", description: "Supabase client or user session not available.", variant: "destructive" });
      return;
    }
    const taskToNotify = tasks.find(t => t.id === taskId);
     if (!taskToNotify) {
        toast({ title: "Error", description: "Task details not found for notification.", variant: "destructive" });
        return;
    }
    console.log(\`ApprovalsPage: Rejecting task "\${taskToNotify.title}" (ID: \${taskId}). Assignees to notify:\`, taskAssigneeIds);

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: 'In Progress' })
        .eq('id', taskId);

      if (updateError) throw updateError;

      let toastDescription = \`Task "\${taskToNotify.title}" has been sent back to 'In Progress'.\`;

      if (taskAssigneeIds && taskAssigneeIds.length > 0 && currentUser) {
        const recipientUserDetails = await getUserDetailsByIds(taskAssigneeIds);

        const notificationsToInsert = recipientUserDetails.map(assignee => ({
            user_id: assignee.id,
            message: \`Your task "\${taskToNotify.title}" was reviewed by \${currentUser.name} and moved back to 'In Progress'.\`,
            type: 'task_rejected' as const,
            link: \`/tasks/\${taskId}\`,
            task_id: taskId,
            triggered_by_user_id: currentUser.id,
        }));
        
        console.log("ApprovalsPage: Notifications to insert on rejection:", notificationsToInsert);

        if (notificationsToInsert.length > 0) {
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert(notificationsToInsert);
            if (notificationError) {
                console.error("Error creating rejection notifications:", notificationError);
                toastDescription += " Assignees notified (with potential errors).";
            } else {
                 toastDescription += " Assignees have been notified.";
            }
        }

        for (const assignee of recipientUserDetails) {
          if (assignee.email) {
            const emailHtmlContent = \`
              <p>Hello \${assignee.name || 'User'},</p>
              <p>Your task "<strong>\${taskToNotify.title}</strong>" was reviewed by \${currentUser.name} and has been moved back to 'In Progress'.</p>
              <p>Please review any comments or feedback and continue working on it.</p>
              <p>You can view the task details by clicking the button below:</p>
              <a href="\${process.env.NEXT_PUBLIC_APP_URL}/tasks/\${taskId}" class="button">View Task</a>
            \`;
            await sendEmail({
              to: assignee.email,
              recipientName: assignee.name,
              subject: \`Task Update: \${taskToNotify.title} - Requires Attention\`,
              htmlBody: wrapHtmlContent(emailHtmlContent, \`Task Update: \${taskToNotify.title}\`),
            });
          }
        }
      }
      toast({ title: "Task Rejected", description: toastDescription, variant: "default"});
      fetchPendingApprovalTasks();
    } catch (e: any) {
      const displayMessage = e.message || e.details || 'Could not reject task.';
      console.error(\`Error rejecting task. Supabase Code: \${e.code}, Message: \${e.message}, Details: \${e.details}, Hint: \${e.hint}. Full error:\`, e);
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
          <CardDescription>{!isLoading && !error && tasks.length > 0 ? \`There are \${tasks.length} tasks awaiting your approval.\` : 'No tasks are currently pending approval or data is loading.'}</CardDescription>
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
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Assignee(s)</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium max-w-xs truncate">
                         <Link href={\`/tasks/\${task.id}\`} className="hover:underline text-primary">{task.title}</Link>
                      </TableCell>
                      <TableCell><span>{displayAssigneeNames(task.assignee_ids)}</span></TableCell>
                      <TableCell><span>{task.projectName || 'N/A'}</span></TableCell>
                      <TableCell><span>{task.dueDate ? format(parseISO(task.dueDate), 'MMM d, yyyy') : 'N/A'}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={\`/tasks/\${task.id}\`}>
                            <Button variant="ghost" size="icon" aria-label="View task details">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button variant="ghost" size="icon" className="text-green-600 hover:text-green-700" onClick={() => handleApprove(task.id, task.assignee_ids)} aria-label="Approve task" disabled={!supabase}>
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleReject(task.id, task.assignee_ids)} aria-label="Reject task" disabled={!supabase}>
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

