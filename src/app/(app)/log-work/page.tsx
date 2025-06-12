
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { Task, TaskLog } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertTriangle, Clock, Briefcase } from 'lucide-react';

const logWorkFormSchema = z.object({
  selectedTaskId: z.string({ required_error: 'Please select a task.' }),
  hoursSpent: z.coerce.number().min(0.1, "Hours spent must be greater than 0.").max(100, "Hours cannot exceed 100."),
  workDescription: z.string().min(10, "Work description must be at least 10 characters.").max(500, "Description too long."),
});

type LogWorkFormValues = z.infer<typeof logWorkFormSchema>;

export default function LogWorkPage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [assignedTasks, setAssignedTasks] = useState<Pick<Task, 'id' | 'title'>[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(true);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<LogWorkFormValues>({
    resolver: zodResolver(logWorkFormSchema),
    defaultValues: {
      selectedTaskId: undefined,
      hoursSpent: 0,
      workDescription: '',
    },
  });

  const fetchAssignedTasks = useCallback(async () => {
    if (!currentUser || isAdmin || !supabase) {
      setIsLoadingTasks(false);
      if (isAdmin) setError("Admins log work directly on task pages if assigned.");
      else if (!currentUser) setError("You must be logged in to log work.");
      else setError("Supabase client not available.");
      return;
    }

    setIsLoadingTasks(true);
    setError(null);
    try {
      const { data, error: tasksError } = await supabase
        .from('tasks')
        .select('id, title')
        .contains('assignee_ids', [currentUser.id])
        .in('status', ['Pending', 'In Progress']) // Only allow logging for active tasks
        .order('title', { ascending: true });

      if (tasksError) throw tasksError;
      setAssignedTasks(data || []);
    } catch (e: any) {
      const displayMessage = e.message || 'Failed to load your assigned tasks.';
      setError(displayMessage);
      toast({ title: 'Error Loading Tasks', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoadingTasks(false);
    }
  }, [currentUser, isAdmin, toast]);

  useEffect(() => {
    fetchAssignedTasks();
  }, [fetchAssignedTasks]);

  async function onSubmit(values: LogWorkFormValues) {
    if (!currentUser || !supabase || !values.selectedTaskId) {
      toast({ title: 'Error', description: 'User, Supabase, or selected task unavailable.', variant: 'destructive' });
      return;
    }
    setIsSubmittingLog(true);

    try {
      // Fetch the task to get its current logs
      const { data: taskData, error: fetchTaskError } = await supabase
        .from('tasks')
        .select('logs')
        .eq('id', values.selectedTaskId)
        .single();

      if (fetchTaskError) throw fetchTaskError;
      if (!taskData) throw new Error("Selected task not found.");

      const newLogObject: TaskLog = {
        id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        userId: currentUser.id,
        userName: currentUser.name, // userName comes from currentUser context
        hoursSpent: values.hoursSpent,
        workDescription: values.workDescription,
        date: new Date().toISOString(),
      };

      const updatedLogs = [...(taskData.logs || []), newLogObject];

      const { error: updateError } = await supabase
        .from('tasks')
        .update({ logs: updatedLogs })
        .eq('id', values.selectedTaskId);

      if (updateError) throw updateError;
      
      const selectedTaskTitle = assignedTasks.find(t => t.id === values.selectedTaskId)?.title || 'the selected task';
      toast({ title: 'Work Logged', description: `Successfully logged ${values.hoursSpent} hours for task "${selectedTaskTitle}".` });
      form.reset({ selectedTaskId: values.selectedTaskId, hoursSpent: 0, workDescription: '' }); // Keep task selected, reset other fields
      // Optionally, redirect or refresh data if needed
      // router.push(`/tasks/${values.selectedTaskId}`);
    } catch (error: any) {
      console.error('Error logging work:', error);
      toast({ title: 'Error Logging Work', description: error.message || 'An unexpected error occurred.', variant: 'destructive' });
    } finally {
      setIsSubmittingLog(false);
    }
  }

  if (!currentUser && !isLoadingTasks) {
     return (
        <Card className="max-w-xl mx-auto mt-10">
            <CardHeader><CardTitle>Access Denied</CardTitle></CardHeader>
            <CardContent><p>{error || "You need to be logged in to access this page."}</p></CardContent>
        </Card>
     );
  }
  
  if (isAdmin && !isLoadingTasks) {
    return (
        <Card className="max-w-xl mx-auto mt-10">
            <CardHeader><CardTitle>Access Information</CardTitle></CardHeader>
            <CardContent><p>Administrators can log time on tasks they are assigned to directly from the task's detail page.</p></CardContent>
        </Card>
     );
  }


  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center">
            <Clock className="mr-2 h-6 w-6 text-primary" /> Log Your Work
        </CardTitle>
        <CardDescription>Select a task and record the time you spent on it.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingTasks && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p>Loading your assigned tasks...</p>
          </div>
        )}
        {error && !isLoadingTasks && (
          <div className="flex flex-col items-center justify-center py-10 text-destructive">
            <AlertTriangle className="mr-2 h-8 w-8" />
            <p className="font-semibold">Error</p>
            <p>{error}</p>
            <Button onClick={fetchAssignedTasks} variant="outline" size="sm" className="mt-4" disabled={isLoadingTasks}>Try Again</Button>
          </div>
        )}
        {!isLoadingTasks && !error && assignedTasks.length === 0 && (
           <div className="text-center py-10 text-muted-foreground">
             <Briefcase className="mx-auto h-12 w-12 mb-4" />
             <p className="font-semibold">No Active Tasks Found</p>
             <p>You don't have any 'Pending' or 'In Progress' tasks assigned to you to log time against.</p>
           </div>
        )}
        {!isLoadingTasks && !error && assignedTasks.length > 0 && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="selectedTaskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task to Log Work Against</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a task" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assignedTasks.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hoursSpent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hours Spent</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="e.g., 2.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="workDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Work Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Describe the work you performed..." {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmittingLog}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmittingLog || isLoadingTasks || !form.formState.isValid}>
                  {isSubmittingLog && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Work Log
                </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
