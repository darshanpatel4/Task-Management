
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import type { Task, TaskComment, TaskLog, TaskStatus, TaskPriority, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO } from 'date-fns';
import { CalendarDays, Briefcase, MessageSquare, History, CheckCircle, AlertTriangle, Edit3, Clock, Loader2, XCircle, ThumbsUp, RotateCcw, User as UserIcon, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

const logFormSchema = z.object({
  hoursSpent: z.coerce.number().min(0.1, "Hours spent must be greater than 0.").max(100, "Hours cannot exceed 100."),
  workDescription: z.string().min(10, "Work description must be at least 10 characters.").max(500, "Description too long."),
});

type LogFormValues = z.infer<typeof logFormSchema>;

interface AssigneeProfileDisplay extends Pick<User, 'id' | 'name' | 'avatar'> {}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();

  const [task, setTask] = useState<Task | null>(null);
  const [assigneeDetails, setAssigneeDetails] = useState<AssigneeProfileDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const taskId = params.id as string;

  const logForm = useForm<LogFormValues>({
    resolver: zodResolver(logFormSchema),
    defaultValues: {
      hoursSpent: 0,
      workDescription: '',
    },
  });

  const fetchTaskDetails = useCallback(async () => {
    if (!taskId || !supabase) {
      setError(supabase ? 'Task ID is missing.' : 'Supabase client not available.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setAssigneeDetails([]);

    try {
      const { data, error: fetchError } = await supabase
        .from('tasks')
        .select(`
          id, title, description, due_date, created_at, assignee_ids, project_id, priority, status, user_id, comments, logs,
          project:projects (name)
        `)
        .eq('id', taskId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') { 
          setTask(null);
          setError('Task not found.');
        } else {
          throw fetchError;
        }
      } else if (data) {
        const fetchedTask: Task = {
          id: data.id,
          title: data.title,
          description: data.description,
          dueDate: data.due_date,
          createdAt: data.created_at,
          assignee_ids: data.assignee_ids,
          projectId: data.project_id,
          projectName: data.project?.name || 'N/A',
          priority: data.priority as TaskPriority,
          status: data.status as TaskStatus,
          user_id: data.user_id,
          comments: Array.isArray(data.comments) ? data.comments : [],
          logs: Array.isArray(data.logs) ? data.logs : [],
        };
        setTask(fetchedTask);

        if (fetchedTask.assignee_ids && fetchedTask.assignee_ids.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', fetchedTask.assignee_ids);

          if (profilesError) {
            console.warn('Error fetching assignee profiles:', profilesError);
            // Set a fallback representation if profiles can't be fetched
            setAssigneeDetails(fetchedTask.assignee_ids.map(id => ({ id, name: 'N/A (Profile Error)', avatar: undefined })));
          } else if (profilesData) {
            setAssigneeDetails(profilesData.map(p => ({ id: p.id, name: p.full_name || 'N/A', avatar: p.avatar_url })));
          }
        } else {
            setAssigneeDetails([]); // No assignees
        }

      } else {
        setTask(null);
        setError('Task not found.');
      }
    } catch (e: any) {
      const supabaseErrorCode = e?.code;
      const supabaseErrorMessage = e?.message;
      const supabaseErrorDetails = e?.details;
      const supabaseErrorHint = e?.hint;

      let displayMessage = 'Failed to load task details.';
      if (supabaseErrorMessage) {
        displayMessage = supabaseErrorMessage;
      } else if (supabaseErrorDetails) {
        displayMessage = supabaseErrorDetails;
      } else {
        try {
          displayMessage = JSON.stringify(e); 
        } catch (stringifyError) {
          displayMessage = String(e); 
        }
      }
      
      console.error(
        `Error fetching task details. Supabase Code: ${supabaseErrorCode}, Message: ${supabaseErrorMessage}, Details: ${supabaseErrorDetails}, Hint: ${supabaseErrorHint}. Processed display message: ${displayMessage}`, e
      );
      console.error('Full error object fetching task details:', e); 
      setError(displayMessage);
      toast({ title: 'Error Fetching Task', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [taskId, toast]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  const handleAddComment = async () => {
    if (!task || !currentUser || !newComment.trim() || !supabase) return;

    setIsSubmittingComment(true);
    const newCommentObject: TaskComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      comment: newComment.trim(),
      createdAt: new Date().toISOString(),
    };

    const updatedComments = [...(task.comments || []), newCommentObject];

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ comments: updatedComments })
        .eq('id', task.id);

      if (updateError) throw updateError;

      setTask(prevTask => prevTask ? { ...prevTask, comments: updatedComments } : null);
      setNewComment('');
      toast({ title: 'Success', description: 'Comment added.' });
    } catch (e: any) {
      console.error('Error adding comment:', e);
      toast({ title: 'Error Adding Comment', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleAddLog = async (values: LogFormValues) => {
    if (!task || !currentUser || !supabase) return;

    setIsSubmittingLog(true);
    const newLogObject: TaskLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: currentUser.id,
      userName: currentUser.name,
      hoursSpent: values.hoursSpent,
      workDescription: values.workDescription,
      date: new Date().toISOString(),
    };

    const updatedLogs = [...(task.logs || []), newLogObject];

    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ logs: updatedLogs })
        .eq('id', task.id);

      if (updateError) throw updateError;

      setTask(prevTask => prevTask ? { ...prevTask, logs: updatedLogs } : null);
      logForm.reset();
      toast({ title: 'Success', description: 'Work log added.' });
    } catch (e: any) {
      console.error('Error adding log:', e);
      toast({ title: 'Error Adding Log', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleUpdateStatus = async (newStatus: TaskStatus) => {
    if (!task || !supabase || !currentUser) {
      toast({ title: "Error", description: "Task or user data missing.", variant: "destructive"});
      return;
    }
    
    const isCurrentUserAnAssignee = task.assignee_ids && task.assignee_ids.includes(currentUser.id);

    if (newStatus === 'Completed' && !(isCurrentUserAnAssignee && (task.status === 'In Progress' || task.status === 'Pending'))) {
      toast({ title: "Permission Denied", description: "Only an assignee can mark this task as completed.", variant: "destructive"});
      return;
    }
    if (newStatus === 'Approved' && !(isAdmin && task.status === 'Completed')) {
       toast({ title: "Invalid Action", description: "Only an admin can approve a completed task.", variant: "destructive"});
      return;
    }
     if (newStatus === 'In Progress' && !(isAdmin && task.status === 'Completed')) { // Admin rejecting
        toast({ title: "Invalid Action", description: "Only an admin can send a completed task back to 'In Progress'.", variant: "destructive"});
        return;
    }

    setIsUpdatingStatus(true);
    try {
      const { error: updateError } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', task.id);

      if (updateError) throw updateError;

      setTask(prevTask => prevTask ? { ...prevTask, status: newStatus } : null);
      toast({ title: "Status Updated", description: `Task status changed to ${newStatus}.` });
       if (isAdmin && (newStatus === 'Approved' || (newStatus === 'In Progress' && task.status === 'Completed'))) {
         router.push('/admin/approvals'); 
       }

    } catch (e: any) {
      console.error('Error updating status:', e);
      toast({ title: 'Error Updating Status', description: e.message, variant: 'destructive' });
    } finally {
      setIsUpdatingStatus(false);
    }
  };
  
  const getStatusVariant = (status?: TaskStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'In Progress': return 'default';
      case 'Completed': return 'outline';
      case 'Approved': return 'default'; 
      default: return 'secondary';
    }
  };
  
  const getPriorityVariant = (priority?: TaskPriority): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium': return 'default'; 
      case 'Low': return 'secondary';
      default: return 'secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary mr-2" /> Loading task details...
      </div>
    );
  }

  if (error && !task) { 
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <AlertTriangle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Task</h2>
        <p>{error}</p>
         <Button variant="outline" onClick={fetchTaskDetails} className="mt-4">Try Again</Button>
      </div>
    );
  }
  
  if (!task) { 
     return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <XCircle className="w-12 h-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Task Not Found</h2>
        <p>The task you are looking for does not exist or could not be loaded.</p>
        <Button variant="outline" onClick={() => router.push('/tasks')} className="mt-4">Back to Tasks</Button>
      </div>
    );
  }

  const isCurrentUserAnAssignee = currentUser && task.assignee_ids && task.assignee_ids.includes(currentUser.id);
  const canMarkCompleted = isCurrentUserAnAssignee && (task.status === 'In Progress' || task.status === 'Pending');
  const canAdminApprove = isAdmin && task.status === 'Completed';
  const canAdminReject = isAdmin && task.status === 'Completed';
  const canLogTime = isCurrentUserAnAssignee && (task.status === 'In Progress' || task.status === 'Pending');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <CardTitle className="text-2xl md:text-3xl mb-2 sm:mb-0">{task.title}</CardTitle>
            <div className="flex gap-2 items-center mt-2 sm:mt-0">
                {task.priority && <Badge variant={getPriorityVariant(task.priority)} className="capitalize text-sm px-3 py-1">{task.priority}</Badge>}
                {task.status && <Badge variant={getStatusVariant(task.status)} className="capitalize text-sm px-3 py-1">{task.status}</Badge>}
                {isUpdatingStatus && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
          </div>
          <CardDescription>Created on {task.createdAt ? format(parseISO(task.createdAt), 'PPP') : 'N/A'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-start">
                <Users className="w-4 h-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
                <strong className="mr-1 flex-shrink-0">Assignees:</strong>
                <div className="flex flex-wrap gap-1 items-center">
                  {assigneeDetails.length > 0 ? (
                    assigneeDetails.map(assignee => (
                      <Badge key={assignee.id} variant="outline" className="flex items-center gap-1 px-2 py-0.5">
                        <Avatar className="h-4 w-4" data-ai-hint="user avatar tiny">
                            <AvatarImage src={assignee.avatar || `https://placehold.co/20x20.png`} />
                            <AvatarFallback className="text-xs">{assignee.name?.substring(0,1) || 'U'}</AvatarFallback>
                        </Avatar>
                        <span className="text-xs">{assignee.name}</span>
                      </Badge>
                    ))
                  ) : <span className="ml-1 text-muted-foreground">Unassigned</span>}
                </div>
            </div>
            <div className="flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Due Date:</strong><span className="ml-1">{task.dueDate ? format(parseISO(task.dueDate), 'PPP') : 'N/A'}</span></div>
            <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Project:</strong><span className="ml-1">{task.projectName || 'N/A'}</span></div>
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-1">Description:</h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{task.description || 'No description provided.'}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end items-center gap-2 pt-4 border-t">
          {isAdmin && (
            <Button variant="outline" onClick={() => router.push(`/tasks/edit/${task.id}`)} disabled={isUpdatingStatus || !supabase}><Edit3 className="mr-2 h-4 w-4" /> Edit Task (Admin)</Button>
          )}
          {canMarkCompleted && (
            <Button onClick={() => handleUpdateStatus('Completed')} disabled={isUpdatingStatus || !supabase}><CheckCircle className="mr-2 h-4 w-4" /> Mark as Completed</Button>
          )}
          {canAdminApprove && (
              <Button onClick={() => handleUpdateStatus('Approved')} disabled={isUpdatingStatus || !supabase} className="bg-green-600 hover:bg-green-700"><ThumbsUp className="mr-2 h-4 w-4" /> Approve Task</Button>
          )}
          {canAdminReject && (
              <Button variant="destructive" onClick={() => handleUpdateStatus('In Progress')} disabled={isUpdatingStatus || !supabase}><RotateCcw className="mr-2 h-4 w-4" /> Reject (Back to In Progress)</Button>
          )}
        </CardFooter>
      </Card>

      <Tabs defaultValue="comments" className="w-full">
        <TabsList className="grid w-full grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-2">
          <TabsTrigger value="comments"><MessageSquare className="w-4 h-4 mr-2 inline-block"/>Comments ({task.comments?.length || 0})</TabsTrigger>
          <TabsTrigger value="logs"><History className="w-4 h-4 mr-2 inline-block"/>Activity Logs ({task.logs?.length || 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(task.comments || []).length === 0 && <p className="text-muted-foreground text-center py-4">No comments yet.</p>}
              {(task.comments || []).slice().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ).map(comment => (
                <div key={comment.id} className="flex items-start space-x-3">
                  <Avatar className="h-10 w-10" data-ai-hint="user avatar">
                    <AvatarImage src={comment.userAvatar || `https://placehold.co/40x40.png`} />
                    <AvatarFallback>{comment.userName?.substring(0,2).toUpperCase() || '??'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 p-3 rounded-md bg-muted/50">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{comment.userName}</p>
                      <p className="text-xs text-muted-foreground">{format(parseISO(comment.createdAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                </div>
              ))}
              {currentUser && supabase && (
                <>
                  <Separator className="my-6" />
                  <div className="space-y-2">
                    <Textarea 
                      placeholder="Add a comment..." 
                      value={newComment} 
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      disabled={isSubmittingComment}
                    />
                    <Button onClick={handleAddComment} disabled={!newComment.trim() || isSubmittingComment}>
                      {isSubmittingComment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Add Comment
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Activity Logs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(task.logs || []).length === 0 && <p className="text-muted-foreground text-center py-4">No activity logs yet.</p>}
              {(task.logs || []).slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                <div key={log.id} className="p-3 rounded-md border text-sm">
                    <div className="flex justify-between items-center mb-1">
                        <p><span className="font-semibold">{log.userName}</span> logged <span className="font-semibold">{log.hoursSpent} hours</span></p>
                        <p className="text-xs text-muted-foreground">{format(parseISO(log.date), 'PPP HH:mm')}</p>
                    </div>
                    <p className="text-muted-foreground whitespace-pre-wrap">Description: {log.workDescription}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {canLogTime && currentUser && supabase && (
            <Card className="mt-6">
              <CardHeader><CardTitle>Log Work</CardTitle></CardHeader>
              <CardContent>
                <Form {...logForm}>
                  <form onSubmit={logForm.handleSubmit(handleAddLog)} className="space-y-4">
                    <FormField
                      control={logForm.control}
                      name="hoursSpent"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center"><Clock className="mr-2 h-4 w-4 text-muted-foreground" />Hours Spent</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.1" placeholder="e.g., 2.5" {...field} disabled={isSubmittingLog} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={logForm.control}
                      name="workDescription"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Work Description</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Describe the work you performed..." {...field} rows={3} disabled={isSubmittingLog} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={isSubmittingLog || logForm.formState.isSubmitting}>
                      {isSubmittingLog && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                       Add Log
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

    