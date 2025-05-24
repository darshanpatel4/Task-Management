
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Edit3, Trash2, ShieldCheck, UserCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

export default function UserManagementPage() {
  const { currentUser, isAdmin } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!supabase) {
      setError("Supabase client is not available. Please check configuration.");
      setIsLoading(false);
      return;
    }
    if (!isAdmin) {
        setError("Access Denied. You do not have permission to view this page.");
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, avatar_url'); 

      if (supabaseError) throw supabaseError;
      
      console.log("UserManagementPage: Fetched profiles data from Supabase:", data); // Diagnostic log

      const mappedUsers: User[] = (data || []).map(profile => ({
        id: profile.id,
        name: profile.full_name || 'N/A',
        email: profile.email || 'N/A (Email missing in profile)',
        role: profile.role as User['role'] || 'User',
        avatar: profile.avatar_url || undefined,
      }));

      setUsers(mappedUsers);

    } catch (e: any) {
      console.error('Error fetching users:', e);
      setError('Failed to fetch users. ' + e.message);
      toast({
        title: 'Error Fetching Users',
        description: e.message || 'Could not load users from the database.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);


  if (!isAdmin && !isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
              <CardHeader>
                  <CardTitle>Access Denied</CardTitle>
                  <CardDescription>{error || "You do not have permission to view this page."}</CardDescription>
              </CardHeader>
              <CardContent>
                  <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
              </CardContent>
          </Card>
      </div>
    );
  }

  const handleEditUser = (userId: string) => {
    toast({
      title: "Edit User",
      description: `Functionality to edit user ${userId} will be implemented here.`,
    });
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
     if (!supabase) {
      toast({
        title: "Supabase Not Configured",
        description: `Cannot delete user ${userName}. Please check Supabase setup.`,
        variant: "destructive",
      });
      return;
    }
    if (currentUser?.id === userId) {
      toast({
        title: "Cannot Delete Self",
        description: "You cannot delete your own account from the admin panel.",
        variant: "destructive",
      });
      return;
    }

    if (confirm(`Are you sure you want to delete user "${userName}"? This action is permanent and will remove the user from authentication and their profile. This action is currently mocked.`)) {
      console.warn(`Mock delete user: ${userId} (${userName}). Actual Supabase admin deletion needed.`);
      toast({
        title: "Mock User Deletion",
        description: `User ${userName} delete process initiated (mocked). For actual deletion, a Supabase Admin action is required.`,
      });
    }
  };
  
  const handleAddUser = () => {
    router.push('/admin/users/create'); 
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-4 sm:mb-0">
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage all user profiles in the system.</p>
        </div>
        <Button onClick={handleAddUser} disabled={isLoading || !supabase} className="w-full sm:w-auto">
          <UserPlus className="mr-2 h-4 w-4" /> Add User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All User Profiles</CardTitle>
          <CardDescription>List of user profiles from the Supabase `profiles` table.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2">Loading users...</p>
            </div>
          )}
          {error && !isLoading && (
             <div className="flex flex-col items-center justify-center py-8 text-destructive">
              <AlertTriangle className="h-8 w-8 mb-2" />
              <p className="font-semibold">Error Loading Users</p>
              <p className="text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={fetchUsers}>Try Again</Button>
            </div>
          )}
          {!isLoading && !error && users.length === 0 && (
            <p className="text-center text-muted-foreground py-8">No user profiles found. Start by creating one!</p>
          )}
          {!isLoading && !error && users.length > 0 && (
            <div className="relative w-full overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Avatar</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user: User) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <Avatar className="h-9 w-9" data-ai-hint="user avatar">
                          <AvatarImage src={user.avatar || `https://placehold.co/40x40.png?text=${user.name.substring(0,1)}`} alt={user.name} />
                          <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </TableCell>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} className="capitalize">
                          {user.role === 'Admin' ? <ShieldCheck className="mr-1 h-3 w-3" /> : <UserCircle className="mr-1 h-3 w-3" />}
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} aria-label="Edit user" disabled={!supabase || isLoading}>
                                <Edit3 className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive hover:text-destructive" 
                              onClick={() => handleDeleteUser(user.id, user.name)} 
                              aria-label="Delete user" 
                              disabled={!supabase || isLoading || currentUser?.id === user.id}
                              title={currentUser?.id === user.id ? "Cannot delete self" : "Delete user"}
                            >
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
