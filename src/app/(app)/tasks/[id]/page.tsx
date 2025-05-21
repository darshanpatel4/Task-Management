
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { getTaskById, mockTasks, mockUsers, getUserByEmail } from '@/lib/mock-data';
import type { Task, TaskComment, TaskLog } from '@/types';
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
import { format } from 'date-fns';
import { CalendarDays, User, Tag, Briefcase, MessageSquare, History, CheckCircle, AlertTriangle, Edit3, PlusCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const logFormSchema = z.object({
  hoursSpent: z.coerce.number().min(0.1, "Hours spent must be greater than 0."),
  workDescription: z.string().min(10, "Work description must be at least 10 characters."),
});

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isAdmin } = useAuth();
  const { toast } = useToast();
  const [task, setTask] = useState<Task | null | undefined>(undefined); // undefined for loading, null for not found
  const [newComment, setNewComment] = useState('');

  const logForm = useForm<z.infer<typeof logFormSchema>>({
    resolver: zodResolver(logFormSchema),
    defaultValues: {
      hoursSpent: 0,
      workDescription: '',
    },
  });

  useEffect(() => {
    if (params.id) {
      const foundTask = getTaskById(params.id as string);
      setTask(foundTask);
    }
  }, [params.id]);

  const handleRequestCompletion = () => {
    if (task && currentUser && task.assigneeId === currentUser.id && task.status === 'In Progress') {
      const updatedTask = { ...task, status: 'Completed' as const };
      const taskIndex = mockTasks.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) mockTasks[taskIndex] = updatedTask;
      setTask(updatedTask);
      toast({ title: 'Success', description: 'Task completion requested.' });
    }
  };

  const handleApproveTask = () => {
    if (task && isAdmin && task.status === 'Completed') {
      const updatedTask = { ...task, status: 'Approved' as const };
      const taskIndex = mockTasks.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) mockTasks[taskIndex] = updatedTask;
      setTask(updatedTask);
      toast({ title: 'Success', description: 'Task approved.' });
    }
  };

  const handleAddComment = () => {
    if (!task || !currentUser || !newComment.trim()) return;
    const comment: TaskComment = {
      id: `comment${(task.comments?.length || 0) + 1}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userAvatar: currentUser.avatar,
      comment: newComment.trim(),
      createdAt: new Date().toISOString(),
    };
    const updatedTask = { ...task, comments: [...(task.comments || []), comment] };
    const taskIndex = mockTasks.findIndex(t => t.id === task.id);
    if (taskIndex !== -1) mockTasks[taskIndex] = updatedTask;
    setTask(updatedTask);
    setNewComment('');
    toast({ title: 'Success', description: 'Comment added.' });
  };

  const handleAddLog = (values: z.infer<typeof logFormSchema>) => {
    if (!task || !currentUser) return;
    const newLog: TaskLog = {
      id: `log${(task.logs?.length || 0) + 1}`,
      userId: currentUser.id,
      userName: currentUser.name,
      hoursSpent: values.hoursSpent,
      workDescription: values.workDescription,
      date: new Date().toISOString(),
    };
    const updatedTask = { ...task, logs: [...(task.logs || []), newLog] };
    const taskIndex = mockTasks.findIndex(t => t.id === task.id);
    if (taskIndex !== -1) mockTasks[taskIndex] = updatedTask;
    setTask(updatedTask);
    logForm.reset();
    toast({ title: 'Success', description: 'Work log added.' });
  };
  
  const getStatusVariant = (status: Task['status']): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Pending': return 'secondary';
      case 'In Progress': return 'default';
      case 'Completed': return 'outline';
      case 'Approved': return 'default'; 
      default: return 'secondary';
    }
  };
  
  const getPriorityVariant = (priority: Task['priority']): "default" | "secondary" | "destructive" | "outline" => {
    switch (priority) {
      case 'High': return 'destructive';
      case 'Medium': return 'default'; 
      case 'Low': return 'secondary';
      default: return 'secondary';
    }
  };

  if (task === undefined) return <div className="flex justify-center items-center h-64"><AlertTriangle className="w-8 h-8 text-yellow-500 mr-2" /> Loading task details...</div>;
  if (!task) return <div className="flex justify-center items-center h-64"><XCircle className="w-8 h-8 text-destructive mr-2" />Task not found.</div>;


  const canRequestCompletion = currentUser?.id === task.assigneeId && task.status === 'In Progress';
  const canApprove = isAdmin && task.status === 'Completed';
  const canLogTime = currentUser?.id === task.assigneeId && (task.status === 'In Progress' || task.status === 'Pending');

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <CardTitle className="text-2xl md:text-3xl mb-2 sm:mb-0">{task.title}</CardTitle>
            <div className="flex gap-2">
                <Badge variant={getPriorityVariant(task.priority)} className="capitalize text-sm px-3 py-1">{task.priority}</Badge>
                <Badge variant={getStatusVariant(task.status)} className="capitalize text-sm px-3 py-1">{task.status}</Badge>
            </div>
          </div>
          <CardDescription>Created on {format(new Date(task.createdAt), 'PPP')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center"><User className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Assignee:</strong><span className="ml-1">{task.assigneeName || 'N/A'}</span></div>
            <div className="flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Due Date:</strong><span className="ml-1">{format(new Date(task.dueDate), 'PPP')}</span></div>
            <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2 text-muted-foreground" /><strong>Project:</strong><span className="ml-1">{task.projectName || 'N/A'}</span></div>
            {/* Add more details like reporter if available */}
          </div>
          <Separator />
          <div>
            <h4 className="font-semibold mb-1">Description:</h4>
            <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-end gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => router.push(`/tasks/edit/${task.id}`)}><Edit3 className="mr-2 h-4 w-4" /> Edit Task</Button>
          )}
          {canRequestCompletion && (
            <Button onClick={handleRequestCompletion}><CheckCircle className="mr-2 h-4 w-4" /> Request Completion</Button>
          )}
          {canApprove && (
            <Button onClick={handleApproveTask}><CheckCircle className="mr-2 h-4 w-4" /> Approve Task</Button>
          )}
        </CardFooter>
      </Card>

      <Tabs defaultValue="comments" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-2">
          <TabsTrigger value="comments"><MessageSquare className="w-4 h-4 mr-2 inline-block"/>Comments</TabsTrigger>
          <TabsTrigger value="logs"><History className="w-4 h-4 mr-2 inline-block"/>Activity Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="comments" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Comments</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {(task.comments || []).length === 0 && <p className="text-muted-foreground">No comments yet.</p>}
              {(task.comments || []).slice().sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() ).map(comment => (
                <div key={comment.id} className="flex items-start space-x-3">
                  <Avatar className="h-10 w-10" data-ai-hint="user avatar">
                    <AvatarImage src={comment.userAvatar || `https://placehold.co/40x40.png`} />
                    <AvatarFallback>{comment.userName?.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 p-3 rounded-md bg-muted/50">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm">{comment.userName}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(comment.createdAt), 'MMM d, yyyy HH:mm')}</p>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{comment.comment}</p>
                  </div>
                </div>
              ))}
              <Separator className="my-6" />
              <div className="space-y-2">
                <Textarea 
                  placeholder="Add a comment..." 
                  value={newComment} 
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim()}><PlusCircle className="mr-2 h-4 w-4" />Add Comment</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Activity Logs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(task.logs || []).length === 0 && <p className="text-muted-foreground">No activity logs yet.</p>}
              {(task.logs || []).slice().sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                <div key={log.id} className="p-3 rounded-md border text-sm">
                    <div className="flex justify-between items-center">
                        <p><span className="font-semibold">{log.userName}</span> logged <span className="font-semibold">{log.hoursSpent} hours</span></p>
                        <p className="text-xs text-muted-foreground">{format(new Date(log.date), 'PPP HH:mm')}</p>
                    </div>
                    <p className="text-muted-foreground mt-1">Description: {log.workDescription}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {canLogTime && (
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
                            <Input type="number" step="0.1" placeholder="e.g., 2.5" {...field} />
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
                            <Textarea placeholder="Describe the work you performed..." {...field} rows={3} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" disabled={logForm.formState.isSubmitting}>
                      <PlusCircle className="mr-2 h-4 w-4" /> Add Log
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

