
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarIcon, Loader2, AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { TaskPriority, TaskStatus, User, Project } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';

const taskPriorities: TaskPriority[] = ['Low', 'Medium', 'High'];
const userSettableTaskStatuses: TaskStatus[] = ['Pending', 'In Progress'];


const formSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  assignee_ids: z.array(z.string()).optional(), // Array of user IDs, optional
  dueDate: z.date({ required_error: 'Due date is required.' }),
  priority: z.enum(taskPriorities),
  project_id: z.string({ required_error: 'Project is required.' }),
  status: z.enum(userSettableTaskStatuses).default('Pending'),
});

type TaskFormValues = z.infer<typeof formSchema>;

export default function CreateTaskPage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [allUsers, setAllUsers] = useState<Pick<User, 'id' | 'name'>[]>([]);
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const form = useForm<TaskFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      priority: 'Medium',
      status: 'Pending',
      assignee_ids: [], // Initialize as an empty array
      project_id: undefined, // Or an empty string if your Select handles it
      // dueDate will be undefined by default, handled by Calendar
    },
  });

  useEffect(() => {
    async function fetchData() {
      if (!supabase || !isAdmin) {
        setIsLoadingData(false);
        if (!isAdmin) setDataError("Access Denied. You must be an admin to create tasks.");
        else setDataError("Supabase client not available.");
        return;
      }

      setIsLoadingData(true);
      setDataError(null);
      try {
        const [usersResponse, projectsResponse] = await Promise.all([
          supabase.from('profiles').select('id, full_name').order('full_name', { ascending: true }),
          supabase.from('projects').select('id, name').order('name', { ascending: true })
        ]);

        if (usersResponse.error) throw usersResponse.error;
        if (projectsResponse.error) throw projectsResponse.error;
        
        console.log("CreateTaskPage: Fetched users (for assignee dropdown) from Supabase:", usersResponse.data);
        setAllUsers(usersResponse.data?.map(u => ({ id: u.id, name: u.full_name || 'Unnamed User' })) || []);
        setProjects(projectsResponse.data || []);

      } catch (error: any) {
        console.error('CreateTaskPage: Error fetching users or projects:', error);
        setDataError('Failed to load necessary data. ' + (error.message || 'Unknown error'));
        toast({
          title: 'Error Loading Data',
          description: 'Could not load users or projects. Please try again later. ' + (error.message || ''),
          variant: 'destructive',
        });
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchData();
  }, [isAdmin, toast]);


  if (!isAdmin && !isLoadingData && dataError?.includes("Access Denied")) {
    return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Access Denied</CardTitle>
                    <CardDescription>{dataError}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  if (!supabase && !isLoadingData) {
     return (
        <div className="flex items-center justify-center h-full">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-destructive" /> Configuration Error</CardTitle>
                    <CardDescription>Supabase client is not configured. Please check environment variables.</CardDescription>
                </CardHeader>
                 <CardContent>
                    <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                </CardContent>
            </Card>
        </div>
    );
  }


  async function onSubmit(values: TaskFormValues) {
    if (!currentUser || !supabase) {
      toast({
        title: 'Error',
        description: 'User not authenticated or Supabase not available.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const taskToInsert = {
        title: values.title,
        description: values.description,
        assignee_ids: values.assignee_ids && values.assignee_ids.length > 0 ? values.assignee_ids : null, // Send null if empty
        due_date: values.dueDate.toISOString(),
        priority: values.priority,
        project_id: values.project_id,
        status: values.status,
        user_id: currentUser.id, 
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert([taskToInsert])
        .select()
        .single(); 

      if (error) throw error;

      toast({
        title: 'Task Created',
        description: `Task "${values.title}" has been successfully created.`,
      });
      router.push('/tasks'); 
    } catch (error: any) {
      console.error('Error creating task:', error);
      toast({
        title: 'Error Creating Task',
        description: error.message || 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Create New Task</CardTitle>
        <CardDescription>Fill in the details below to create a new task.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingData && (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="mr-2 h-8 w-8 animate-spin" />
            <p>Loading users and projects...</p>
          </div>
        )}
        {dataError && !isLoadingData && (
           <div className="flex flex-col items-center justify-center py-10 text-destructive">
            <AlertTriangle className="mr-2 h-8 w-8" />
            <p className="font-semibold">Error loading data</p>
            <p>{dataError}</p>
          </div>
        )}
        {!isLoadingData && !dataError && (
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
                name="assignee_ids"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center">
                      <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                      Assignees
                    </FormLabel>
                    <FormControl>
                      <ScrollArea className="h-40 w-full rounded-md border p-2">
                        {allUsers.map((user) => (
                          <div key={user.id} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              id={`assignee-${user.id}`}
                              checked={(field.value || []).includes(user.id)}
                              onCheckedChange={(checked) => {
                                const currentAssignees = field.value || [];
                                let newAssigneeIds;
                                if (checked) {
                                  newAssigneeIds = [...currentAssignees, user.id];
                                } else {
                                  newAssigneeIds = currentAssignees.filter(
                                    (id) => id !== user.id
                                  );
                                }
                                field.onChange(newAssigneeIds); // Always pass an array
                              }}
                            />
                            <label
                              htmlFor={`assignee-${user.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {user.name}
                            </label>
                          </div>
                        ))}
                        {allUsers.length === 0 && (
                          <p className="text-sm text-muted-foreground">No users available to assign.</p>
                        )}
                      </ScrollArea>
                    </FormControl>
                    <FormDescription>Select one or more users to assign to this task.</FormDescription>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value} disabled={projects.length === 0}>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {userSettableTaskStatuses.map(status => ( 
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
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Task
                  </Button>
              </div>
            </form>
          </Form>
        )}
      </CardContent>
    </Card>
  );
}

