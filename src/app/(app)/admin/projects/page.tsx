'use client';

import { useAuth } from '@/context/AuthContext';
import { mockProjects } from '@/lib/mock-data';
import type { Project } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Edit3, Trash2, FolderKanban } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function ProjectManagementPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();

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

  const handleEditProject = (projectId: string) => {
    alert(`Edit project ${projectId} (mock functionality)`);
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm(`Are you sure you want to delete project ${projectId}? (mock functionality)`)) {
      alert(`Project ${projectId} deleted (mock).`);
    }
  };
  
  const handleCreateProject = () => {
    alert('Create new project (mock functionality)');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Project Management</h1>
          <p className="text-muted-foreground">Manage all projects within TaskFlow AI.</p>
        </div>
        <Button onClick={handleCreateProject}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create Project
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Projects</CardTitle>
          <CardDescription>List of all projects and their details.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockProjects.map((project: Project) => (
                <TableRow key={project.id}>
                  <TableCell className="font-medium flex items-center">
                    <FolderKanban className="mr-2 h-4 w-4 text-primary" />
                    {project.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-md truncate">{project.description || 'No description'}</TableCell>
                  <TableCell className="text-right">
                     <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEditProject(project.id)} aria-label="Edit project">
                            <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteProject(project.id)} aria-label="Delete project">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
