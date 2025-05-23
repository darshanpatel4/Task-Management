
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit3, Trash2, FolderKanban, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';


export default function ProjectManagementPage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      // Non-admins should not see this page, handled by layout/redirect ideally
      // but added protection here.
      setIsLoading(false);
      return;
    }

    async function fetchProjects() {
      if (!supabase) {
        setError("Supabase client is not available. Please check configuration.");
        setIsLoading(false);
        // Optionally load mock data here as a fallback if desired
        // import { mockProjects } from '@/lib/mock-data';
        // setProjects(mockProjects);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: supabaseError } = await supabase
          .from('projects')
          .select('id, name, description, created_at, user_id')
          .order('created_at', { ascending: false });

        if (supabaseError) {
          throw supabaseError;
        }
        setProjects(data || []);
      } catch (e: any) {
        console.error('Error fetching projects:', e);
        setError('Failed to fetch projects. ' + e.message);
        toast({
          title: 'Error Fetching Projects',
          description: e.message || 'Could not load projects from the database.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchProjects();
  }, [isAdmin, toast]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
              <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
                  <CardDescription>You do not have permission to view this page.</CardDescription>
              </CardHeader>
              <CardContent>
                  <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
              </CardContent>
          </Card>
      </div>
    );
  }

  const handleCreateProject = async () => {
    // Placeholder: This would navigate to a create project form or open a dialog
    // For now, we'll just log and show a toast.
    // In a real implementation, you would collect project details and insert into Supabase.
    // Example: router.push('/admin/projects/create');
    alert('Create new project (Supabase integration pending for CUD operations)');
    toast({
      title: "Create Project",
      description: "Functionality to create projects via Supabase will be added here."
    });
  };

  const handleEditProject = (projectId: string) => {
    // Placeholder: This would navigate to an edit project form
    // Example: router.push(`/admin/projects/edit/${projectId}`);
    alert(`Edit project ${projectId} (Supabase integration pending for CUD operations)`);
     toast({
      title: "Edit Project",
      description: `Functionality to edit project ${projectId} via Supabase will be added here.`
    });
  };

  const handleDeleteProject = async (projectId: string) => {
    // Placeholder: This would call Supabase to delete the project
    if (confirm(`Are you sure you want to delete project ${projectId}? (Supabase integration pending)`)) {
       alert(`Project ${projectId} delete action (Supabase integration pending).`);
       toast({
        title: "Delete Project",
        description: `Functionality to delete project ${projectId} via Supabase will be added here.`,
        variant: "destructive"
      });
      // Example Supabase call:
      // if (supabase) {
      //   const { error } = await supabase.from('projects').delete().match({ id: projectId });
      //   if (error) {
      //     toast({ title: "Error", description: error.message, variant: "destructive" });
      //   } else {
      //     toast({ title: "Success", description: "Project deleted." });
      //     setProjects(prev => prev.filter(p => p.id !== projectId));
      //   }
      // }
    }
  };
  

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Management</h1>
          <p className="text-muted-foreground">Manage all projects within TaskFlow AI.</p>
        </div>
        <Button onClick={handleCreateProject} disabled={!supabase || isLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>List of all projects from the database.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading projects...</p>
            </div>
          )}
          {error && !isLoading && (
             <div className="flex flex-col items-center justify-center py-8 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Projects</p>
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          )}
          {!isLoading && !error && projects.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No projects found. Start by creating one!</p>
          )}
          {!isLoading && !error && projects.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project: Project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium flex items-center">
                      <FolderKanban className="mr-2 h-4 w-4 text-primary" />
                      {project.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-md truncate">{project.description || 'No description'}</TableCell>
                    <TableCell className="text-muted-foreground">
                        {project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : 'N/A'}
                    </TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditProject(project.id)} aria-label="Edit project" disabled={!supabase}>
                              <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteProject(project.id)} aria-label="Delete project" disabled={!supabase}>
                              <Trash2 className="h-4 w-4" />
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
