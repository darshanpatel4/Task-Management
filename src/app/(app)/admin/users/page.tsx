
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit3, Trash2, ShieldCheck, UserCircle, Loader2, AlertTriangle } from 'lucide-react';
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
      // Fetch users from the 'profiles' table.
      // Supabase auth users are in auth.users, but roles and full_name are in profiles.
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select('id, full_name, email:user_email, role, avatar_url'); // Assuming email is stored in profiles or you join with auth.users

      if (supabaseError) throw supabaseError;
      
      // Map fetched data to the User type.
      // Note: Supabase profiles might not directly have an 'email' field.
      // The `AuthContext` maps `auth.users.email` to `User.email`.
      // Here, we'll try to get email from profile if available, otherwise use a placeholder.
      // For a complete solution, you might need to join 'profiles' with 'auth.users' server-side
      // or make another call to get emails if they are not in 'profiles'.
      // For simplicity, we'll use the structure as if email were directly on profiles.
      // Or, even better, just use the fields we have in `profiles`: id, full_name, role, avatar_url.
      // The `User` type expects `name` and `email`. We'll adapt.
      
      const mappedUsers: User[] = (data || []).map(profile => ({
        id: profile.id,
        name: profile.full_name || 'N/A',
        // Email is typically sensitive and might not be in 'profiles' table by default
        // or might be fetched separately. For this UI, we'll show what 'profiles' gives us.
        // If your `profiles` table has an email, use `profile.email_column_name`.
        // The AuthContext handles the primary email from `auth.users`.
        // We'll rely on the fact that the `User` type has email as mandatory.
        // This part might need adjustment based on your exact `profiles` table schema.
        // Let's assume for now that an email field might be available or we'll show N/A.
        email: profile.user_email || 'Email not in profile table', // Example, adjust if you store email in profiles
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
    // Placeholder for navigating to an edit user page
    // router.push(`/admin/users/edit/${userId}`);
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
      // Actual Deletion Logic (requires Supabase Admin privileges, typically via a Server Action)
      // For now, we'll just log and remove from local state if you want to simulate.
      console.warn(`Mock delete user: ${userId} (${userName}). Actual Supabase admin deletion needed.`);
      toast({
        title: "Mock User Deletion",
        description: `User ${userName} delete process initiated (mocked). For actual deletion, a Supabase Admin action is required.`,
      });
      // Example of removing from local state for UI update (if not re-fetching)
      // setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
    }
  };
  
  const handleCreateUser = () => {
    router.push('/admin/users/create'); // Navigate to the new create user page
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage all user profiles in the system.</p>
        </div>
        <Button onClick={handleCreateUser} disabled={!supabase || isLoading}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create User
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avatar</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email (from profile, if exists)</TableHead>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
