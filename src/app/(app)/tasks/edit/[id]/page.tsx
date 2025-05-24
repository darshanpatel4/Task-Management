
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, AlertTriangle, Users, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useParams } from 'next/navigation';
import type { Task, TaskPriority, TaskStatus, User, Project } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState, useCallback } from 'react';

const taskPriorities: TaskPriority[] = ['Low', 'Medium', 'High'];
const editableTaskStatuses: TaskStatus[] = ['Pending', 'In Progress', 'Completed', 'Approved'];

const editTaskFormSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  assignee_id: z.string().nullable().optional(),
  dueDate: z.date({ required_error: 'Due date is required.' }),
  priority: z.enum(taskPriorities),
  project_id: z.string({ required_error: 'Project is required.' }),
  status: z.enum(editableTaskStatuses),
});

type EditTaskFormValues = z.infer<typeof editTaskFormSchema>;

export default function EditTaskPage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [originalAssigneeId, setOriginalAssigneeId] = useState<string | null | undefined>(undefined);
  const [allUsers, setAllUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<EditTaskFormValues>({
    resolver: zodResolver(editTaskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      assignee_id: null,
      priority: 'Medium',
      status: 'Pending',
      project_id: '',
    },
  });

  const fetchTaskAndRelatedData = useCallback(async () => {
    if (!taskId || !supabase) {
      setError(supabase ? 'Task ID is missing.' : 'Supabase client not available.');
      setIsLoadingData(false);
      return;
    }
    if (!isAdmin) {
      setError("Access Denied. You must be an admin to edit tasks.");
      setIsLoadingData(false);
      return;
    }

    setIsLoadingData(true);
    setError(null);
    try {
      const [taskResponse, usersResponse, projectsResponse] = await Promise.all([
        supabase.from('tasks').select('*').eq('id', taskId).single(),
        supabase.from('profiles').select('id, full_name').order('full_name', { ascending: true }),
        supabase.from('projects').select('id, name').order('name', { ascending: true })
      ]);

      if (taskResponse.error) {
        if (taskResponse.error.code === 'PGRST116') setError('Task not found.');
        else throw taskResponse.error;
      }
      if (usersResponse.error) throw usersResponse.error;
      if (projectsResponse.error) throw projectsResponse.error;
      
      const fetchedTask = taskResponse.data as Task | null;
      setTask(fetchedTask);
      setOriginalAssigneeId(fetchedTask?.assignee_id); 
      setAllUsers(usersResponse.data?.map(u => ({ id: u.id, name: u.full_name || 'Unnamed User' })) || []);
      setProjects(projectsResponse.data || []);

      if (fetchedTask) {
        form.reset({
          title: fetchedTask.title || '',
          description: fetchedTask.description || '',
          assignee_id: fetchedTask.assignee_id || null,
          dueDate: fetchedTask.dueDate ? parseISO(fetchedTask.dueDate) : new Date(),
          priority: fetchedTask.priority || 'Medium',
          project_id: fetchedTask.project_id || '',
          status: fetchedTask.status || 'Pending',
        });
      }
    } catch (e: any) {
      console.error(`EditTaskPage: Error fetching task or related data. Code: ${e.code}, Message: ${e.message}, Details: ${e.details}, Hint: ${e.hint}`, e);
      const displayMessage = e.message || e.details || 'Failed to load initial data for editing.';
      setError(displayMessage);
      toast({ title: 'Error Loading Data', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoadingData(false);
    }
  }, [taskId, isAdmin, toast, form]);

  useEffect(() => {
    fetchTaskAndRelatedData();
  }, [fetchTaskAndRelatedData]);


  if (!isAdmin && !isLoadingData && error?.includes("Access Denied")) {
    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Access Denied</CardTitle>
                    <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  if (isLoadingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading task details...</p>
      </div>
    );
  }
  
  if (error && !task) { 
     return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Task for Editing</h2>
        <p>{error}</p>
        <Button onClick={() => router.push('/tasks')} variant="outline" className="mt-4">
          Back to Tasks
        </Button>
      </div>
    );
  }
  
  if (!supabase) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Supabase Client Not Available</h2>
         <Button onClick={() => router.push('/tasks')} variant="outline" className="mt-4">
          Back to Tasks
        </Button>
      </div>
    );
  }


  async function onSubmit(values: EditTaskFormValues) {
    if (!currentUser || !supabase || !task) {
      toast({ title: 'Error', description: 'User, Supabase, or task data unavailable.', variant: 'destructive' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const taskToUpdate = {
        title: values.title,
        description: values.description,
        assignee_id: values.assignee_id || null,
        due_date: values.dueDate.toISOString(),
        priority: values.priority,
        project_id: values.project_id,
        status: values.status,
      };

      const { error: updateError } = await supabase
        .from('tasks')
        .update(taskToUpdate)
        .eq('id', task.id);

      if (updateError) throw updateError;

      let toastDescription = `Task "${values.title}" has been successfully updated.`;
      if (values.assignee_id && values.assignee_id !== originalAssigneeId) {
        const assignee = allUsers.find(u => u.id === values.assignee_id);
        const assigneeName = assignee ? assignee.name : 'the new assignee';
        console.log(`SIMULATING EMAIL: Task "${values.title}" re-assigned to ${assigneeName} (ID: ${values.assignee_id}). Link: /tasks/${task.id}`);
        toastDescription += ` ${assigneeName} would be notified about the assignment.`;
      } else if (!values.assignee_id && originalAssigneeId) {
         console.log(`SIMULATING EMAIL: Task "${values.title}" unassigned. Previous assignee (ID: ${originalAssigneeId}) might be notified.`);
         toastDescription += ` Task is now unassigned.`;
      }


      toast({
        title: 'Task Updated',
        description: toastDescription,
      });
      router.push(`/tasks/${task.id}`); 
    } catch (error: any) {
      console.error(`Error updating task. Code: ${error.code}, Message: ${error.message}, Details: ${error.details}, Hint: ${error.hint}. Full error object:`, error);
      let displayMessage = 'An unexpected error occurred. Please try again.';
      if (error.message) {
        displayMessage = error.message;
      } else if (error.details) {
        displayMessage = error.details;
      } else {
        try {
          displayMessage = JSON.stringify(error);
        } catch (e) {
          displayMessage = String(error);
        }
      }
      toast({
        title: 'Error Updating Task',
        description: displayMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Edit Task: {task?.title || 'Loading...'}</CardTitle>
        <CardDescription>Modify the details for this task.</CardDescription>
      </CardHeader>
      <CardContent>
        {!isLoadingData && !error && task && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="Enter task title" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Provide a detailed task description" {...field} rows={5} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="assignee_id" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      Assignee
                    </FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === '_UNASSIGNED_' ? null : value)} 
                      value={field.value || '_UNASSIGNED_'}
                      disabled={allUsers.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an assignee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="_UNASSIGNED_">Unassigned</SelectItem>
                        {allUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>Select a user to assign to this task.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn("pl-3 text-left font-normal", !field.value && "text-muted-foreground")}
                            >
                              {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {taskPriorities.map(priority => (
                            <SelectItem key={priority} value={priority}>{priority}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="project_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Project</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={projects.length === 0}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select a project" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {editableTaskStatuses.map(status => ( 
                            <SelectItem key={status} value={status}>{status}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSubmitting}>Cancel</Button>
                  <Button type="submit" disabled={isSubmitting || isLoadingData}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}
