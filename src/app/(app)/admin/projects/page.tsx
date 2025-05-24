
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Project, ProjectStatus } from '@/types'; // Import ProjectStatus
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit3, Trash2, FolderKanban, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge'; // Import Badge
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

  const fetchProjects = useCallback(async () => {
    if (!supabase) {
      setError("Supabase client is not available. Please check configuration.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('projects')
        .select('id, name, description, created_at, user_id, status') // Added status
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
  }, [toast]);

  useEffect(() => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }
    fetchProjects();
  }, [isAdmin, fetchProjects]);

  if (!isAdmin && !isLoading) {
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

  const handleCreateProject = () => {
    if (!supabase) {
      toast({
        title: "Supabase Not Configured",
        description: "Cannot create project. Please check Supabase setup.",
        variant: "destructive",
      });
      return;
    }
    router.push('/admin/projects/create');
  };

  const handleEditProject = (projectId: string) => {
    if (!supabase) {
      toast({
        title: "Supabase Not Configured",
        description: `Cannot edit project ${projectId}. Please check Supabase setup.`,
        variant: "destructive",
      });
      return;
    }
     toast({
      title: "Edit Project (Not Implemented)",
      description: `Functionality to edit project ${projectId} is not yet implemented.`
    });
  };

  const handleDeleteProject = async (projectId: string) => {
    if (!supabase) {
      toast({
        title: "Supabase Not Configured",
        description: `Cannot delete project ${projectId}. Please check Supabase setup.`,
        variant: "destructive",
      });
      return;
    }
    if (confirm(`Are you sure you want to delete project with ID: ${projectId}? This action cannot be undone.`)) {
       setIsLoading(true);
       try {
        const { error: deleteError } = await supabase
            .from('projects')
            .delete()
            .match({ id: projectId });

        if (deleteError) throw deleteError;
        
        toast({ title: "Project Deleted", description: `Project ${projectId} has been deleted.` });
        setProjects(prevProjects => prevProjects.filter(p => p.id !== projectId)); 

       } catch (e: any) {
         toast({
            title: "Error Deleting Project",
            description: e.message || "Could not delete the project.",
            variant: "destructive",
         });
       } finally {
         setIsLoading(false);
       }
    }
  };
  
  const getStatusBadgeVariant = (status?: ProjectStatus) => {
    switch (status) {
      case 'In Progress': return 'default';
      case 'Completed': return 'secondary'; // You might want a 'success' variant later
      case 'On Hold': return 'outline';
      case 'Cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-3xl font-bold tracking-tight">Project Management</h1>
          <p className="text-muted-foreground">Manage all projects within TaskFlow AI.</p>
        </div>
        <Button onClick={handleCreateProject} disabled={!supabase || isLoading} className="w-full sm:w-auto">
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
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchProjects}>Try Again</Button>
            </div>
          )}
          {!isLoading && !error && projects.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No projects found. Start by creating one!</p>
          )}
          {!isLoading && !error && projects.length > 0 && (
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead> {/* New Status Column Header */}
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
                      <TableCell className="text-muted-foreground max-w-xs sm:max-w-md md:max-w-lg truncate">{project.description || 'No description'}</TableCell>
                      <TableCell> {/* New Status Cell */}
                        <Badge variant={getStatusBadgeVariant(project.status)} className="capitalize">
                          {project.status || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                          {project.created_at ? format(new Date(project.created_at), 'MMM d, yyyy') : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                         <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditProject(project.id)} aria-label="Edit project" disabled={!supabase || isLoading}>
                                <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteProject(project.id)} aria-label="Delete project" disabled={!supabase || isLoading}>
                                <Trash2 className="h-4 w-4" />
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
