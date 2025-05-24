
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
import { useRouter, useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, AlertTriangle, Save } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import type { Project, ProjectStatus } from '@/types';

const projectStatuses: ProjectStatus[] = ['In Progress', 'Completed', 'On Hold', 'Cancelled'];

const projectFormSchema = z.object({
  name: z.string().min(3, { message: 'Project name must be at least 3 characters.' }).max(100, { message: 'Project name must be 100 characters or less.' }),
  description: z.string().max(500, { message: 'Description must be 500 characters or less.' }).optional(),
  status: z.enum(projectStatuses, { required_error: 'Project status is required.' }),
});

type ProjectFormValues = z.infer<typeof projectFormSchema>;

export default function EditProjectPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: '',
      description: '',
      status: 'In Progress',
    },
  });

  const fetchProjectDetails = useCallback(async () => {
    if (!projectId || !supabase) {
      setError(supabase ? 'Project ID is missing.' : 'Supabase client not available.');
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('id, name, description, status, user_id, created_at')
        .eq('id', projectId)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          setError('Project not found.');
          setProject(null);
        } else {
          throw fetchError;
        }
      } else if (data) {
        setProject(data as Project);
        form.reset({
          name: data.name || '',
          description: data.description || '',
          status: data.status || 'In Progress',
        });
      } else {
         setError('Project not found.');
         setProject(null);
      }
    } catch (e: any) {
      console.error('Error fetching project details:', e);
      const displayMessage = e.message || e.details || 'Failed to load project details.';
      setError(displayMessage);
      toast({ title: 'Error Fetching Project', description: displayMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, toast, form]);

  useEffect(() => {
    if (isAdmin) {
      fetchProjectDetails();
    } else {
      setIsLoading(false);
      setError("Access Denied.");
    }
  }, [isAdmin, fetchProjectDetails]);


  if (!isAdmin && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>{error || "You do not have permission to edit projects."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="ml-2">Loading project details...</p>
      </div>
    );
  }

  if (error && !project) {
     return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Project</h2>
        <p>{error}</p>
        <Button onClick={() => router.push('/admin/projects')} variant="outline" className="mt-4">
          Back to Project Management
        </Button>
      </div>
    );
  }
  
  if (!supabase) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-destructive">
        <AlertTriangle className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Supabase Client Not Available</h2>
         <Button onClick={() => router.push('/admin/projects')} variant="outline" className="mt-4">
          Back to Project Management
        </Button>
      </div>
    );
  }


  async function onSubmit(values: ProjectFormValues) {
    if (!project || !supabase) {
      toast({ title: 'Error', description: 'Project data or Supabase client unavailable.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase
        .from('projects')
        .update({
          name: values.name,
          description: values.description,
          status: values.status,
        })
        .eq('id', project.id);

      if (updateError) throw updateError;

      toast({
        title: 'Project Updated',
        description: `Project "${values.name}" has been successfully updated.`,
      });
      router.push('/admin/projects');
    } catch (error: any) {
      // Enhanced error logging
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
        `Error updating project. Supabase Code: ${supabaseErrorCode}, Message: ${supabaseErrorMessage}, Details: ${supabaseErrorDetails}, Hint: ${supabaseErrorHint}. Processed display message: ${displayMessage}`, error
      );
      console.error('Full error object during project update:', error); 
      
      toast({
        title: 'Error Updating Project',
        description: displayMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Edit Project</CardTitle>
        <CardDescription>Modify the details for project: {project?.name || 'Loading...'}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter project name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Provide a brief description of the project" {...field} rows={4} />
                  </FormControl>
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
                  <Select onValueChange={field.onChange} value={field.value} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project status" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projectStatuses.map(status => (
                        <SelectItem key={status} value={status}>{status}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => router.push('/admin/projects')} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isLoading}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
