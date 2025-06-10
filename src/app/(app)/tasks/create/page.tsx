
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Loader2, AlertTriangle, Users, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import type { TaskPriority, TaskStatus, User, Project, NotificationType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabaseClient';
import { useEffect, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { sendEmail } from '@/actions/sendEmailAction';


const taskPriorities: TaskPriority[] = ['Low', 'Medium', 'High'];
const userSettableTaskStatuses: TaskStatus[] = ['Pending', 'In Progress'];

const formSchema = z.object({
  title: z.string().min(3, { message: 'Title must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  assignee_ids: z.array(z.string()).optional().default([]),
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

  const [allUsers, setAllUsers] = useState<Pick<User, 'id' | 'name' | 'email'>[]>([]);
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
      assignee_ids: [],
      project_id: undefined,
      dueDate: undefined,
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
          supabase.from('profiles').select('id, full_name, email').order('full_name', { ascending: true }),
          supabase.from('projects').select('id, name').order('name', { ascending: true })
        ]);

        if (usersResponse.error) throw usersResponse.error;
        if (projectsResponse.error) throw projectsResponse.error;

        setAllUsers(usersResponse.data?.map(u => ({ id: u.id, name: u.full_name || 'Unnamed User', email: u.email || '' })) || []);
        setProjects(projectsResponse.data || []);

      } catch (error: any) {
        const displayMessage = error.message || error.details || 'Failed to load initial data for task creation.';
        setDataError(displayMessage);
        toast({
          title: 'Error Loading Data',
          description: displayMessage,
          variant: 'destructive',
        });
      } finally {
        setIsLoadingData(false);
      }
    }
    fetchData();
  }, [isAdmin, toast]);

  const getAssigneeButtonLabel = (selectedIds: string[] | undefined) => {
    const safeSelectedIds = selectedIds || [];
    if (safeSelectedIds.length === 0) {
      return "Select assignees";
    }
    if (safeSelectedIds.length === 1) {
      const user = allUsers.find(u => u.id === safeSelectedIds[0]);
      return user ? user.name : "1 user selected";
    }
    return `${safeSelectedIds.length} users selected`;
  };

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
        assignee_ids: values.assignee_ids && values.assignee_ids.length > 0 ? values.assignee_ids : null,
        due_date: values.dueDate.toISOString(),
        priority: values.priority,
        project_id: values.project_id,
        status: values.status,
        user_id: currentUser.id, 
      };

      const { data: createdTaskData, error: taskInsertError } = await supabase
        .from('tasks')
        .insert([taskToInsert])
        .select()
        .single();

      if (taskInsertError) throw taskInsertError;

      let toastDescription = `Task "${values.title}" has been successfully created.`;
      
      if (createdTaskData && values.assignee_ids && values.assignee_ids.length > 0 && currentUser) {
        const assignedUserDetails = allUsers.filter(u => values.assignee_ids?.includes(u.id));

        const notificationsToInsert = assignedUserDetails.map(assignee => ({
            user_id: assignee.id, 
            message: `${currentUser.name} assigned you a new task: "${values.title}".`,
            link: `/tasks/${createdTaskData.id}`,
            type: 'task_assigned' as NotificationType, 
            task_id: createdTaskData.id,
            triggered_by_user_id: currentUser.id, 
        }));
        
        if (notificationsToInsert.length > 0) {
            const { error: notificationError } = await supabase
                .from('notifications')
                .insert(notificationsToInsert);

            if (notificationError) {
                 console.error(
                    "Error creating assignment notifications. Code:", notificationError.code, 
                    "Message:", notificationError.message, 
                    "Details:", notificationError.details,
                    "Hint:", notificationError.hint,
                    "Full Error:", notificationError
                );
                if (notificationError.code === '42501') {
                     toast({
                        title: "Notification Error (Admin Action)",
                        description: "Task created, but failed to send notifications. Please check admin permissions (RLS) for inserting notifications.",
                        variant: "destructive",
                        duration: 7000,
                    });
                } else {
                    toastDescription += ` Assignees notified (with potential errors in notification creation: ${notificationError.message}).`;
                }
            } else {
                 toastDescription += ` Assignees have been notified.`;
            }
        }

        // Send emails to assigned users
        for (const assignee of assignedUserDetails) {
          if (assignee.email) {
            const emailHtmlContent = `
              <p>Hello ${assignee.name || 'User'},</p>
              <p>You have been assigned a new task by <strong>${currentUser.name}</strong>:</p>
              <p><strong>Task:</strong> ${values.title}</p>
              <p><strong>Description:</strong> ${values.description}</p>
              <p><strong>Due Date:</strong> ${format(values.dueDate, 'PPP')}</p>
              <p><strong>Priority:</strong> ${values.priority}</p>
              <p>You can view the task details by clicking the button below:</p>
              <a href="${process.env.NEXT_PUBLIC_APP_URL}/tasks/${createdTaskData.id}" class="button">View Task</a>
            `;
            await sendEmail({
              to: assignee.email,
              recipientName: assignee.name,
              subject: `New Task Assigned: ${values.title}`,
              rawContent: emailHtmlContent,
            });
          }
        }
      }

      toast({
        title: 'Task Created',
        description: toastDescription,
      });
      router.push('/tasks');
    } catch (error: any) {
      const supabaseErrorCode = error?.code;
      const supabaseErrorMessage = error?.message;
      const supabaseErrorDetails = error?.details;
      const supabaseErrorHint = error?.hint;
      
      let displayMessage = 'An unexpected error occurred. Please try again.';
      if (supabaseErrorMessage) {
        displayMessage = supabaseErrorMessage;
      } else if (supabaseErrorDetails) {
        displayMessage = supabaseErrorDetails;
      } else {
          try {
            displayMessage = JSON.stringify(error);
          } catch (stringifyError) {
            displayMessage = String(error);
          }
      }

      console.error(
        `Error creating task. Supabase Code: ${supabaseErrorCode}, Message: ${supabaseErrorMessage}, Details: ${supabaseErrorDetails}, Hint: ${supabaseErrorHint}. Processed display message: ${displayMessage}`, error
      );
      console.error('Full error object during task creation:', error); 

      toast({
        title: 'Error Creating Task',
        description: displayMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

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
             <Button onClick={() => { setIsLoadingData(true); useEffect(() => { async function fetchData() { if (!supabase || !isAdmin) { setIsLoadingData(false); if (!isAdmin) setDataError("Access Denied. You must be an admin to create tasks."); else setDataError("Supabase client not available."); return; } setIsLoadingData(true); setDataError(null); try { const [usersResponse, projectsResponse] = await Promise.all([ supabase.from('profiles').select('id, full_name, email').order('full_name', { ascending: true }), supabase.from('projects').select('id, name').order('name', { ascending: true }) ]); if (usersResponse.error) throw usersResponse.error; if (projectsResponse.error) throw projectsResponse.error; setAllUsers(usersResponse.data?.map(u => ({ id: u.id, name: u.full_name || 'Unnamed User', email: u.email || '' })) || []); setProjects(projectsResponse.data || []); } catch (error: any) { const displayMessage = error.message || error.details || 'Failed to load initial data for task creation.'; setDataError(displayMessage); toast({ title: 'Error Loading Data', description: displayMessage, variant: 'destructive', }); } finally { setIsLoadingData(false); } } fetchData(); }, [isAdmin, toast]); }} variant="outline" size="sm" className="mt-4">Try Again</Button>
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full justify-between">
                          {getAssigneeButtonLabel(field.value)}
                          <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width]">
                        <DropdownMenuLabel>Select Assignees</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <ScrollArea className="h-48">
                          {allUsers.length > 0 ? allUsers.map((user) => (
                            <DropdownMenuCheckboxItem
                              key={user.id}
                              checked={(field.value || []).includes(user.id)}
                              onCheckedChange={(checked) => {
                                const currentAssigneeIds = field.value || [];
                                const newAssigneeIds = checked
                                  ? [...currentAssigneeIds, user.id]
                                  : currentAssigneeIds.filter((id) => id !== user.id);
                                field.onChange(newAssigneeIds);
                              }}
                              onSelect={(e) => e.preventDefault()} 
                            >
                              {user.name}
                            </DropdownMenuCheckboxItem>
                          )) : <DropdownMenuCheckboxItem disabled>No users available</DropdownMenuCheckboxItem>}
                        </ScrollArea>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <FormDescription>Select users to assign to this task.</FormDescription>
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

