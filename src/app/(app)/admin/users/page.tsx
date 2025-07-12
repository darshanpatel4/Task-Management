
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Edit3, Trash2, ShieldCheck, UserCircle, Loader2, AlertTriangle, Award, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

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
        .select('id, full_name, email, role, avatar_url, position'); // Added position

      if (supabaseError) throw supabaseError;

      console.log("UserManagementPage: Fetched profiles data from Supabase:", data);

      const mappedUsers: User[] = (data || []).map(profile => ({
        id: profile.id,
        name: profile.full_name || 'N/A',
        email: profile.email || 'N/A (Email missing in profile)',
        role: profile.role as User['role'] || 'User',
        avatar: profile.avatar_url || undefined,
        position: profile.position || 'N/A', // Added position
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

    console.warn(`Mock delete user: ${userId} (${userName}). Actual Supabase admin deletion needed.`);
    // For actual deletion, you'd use supabase.auth.admin.deleteUser(userId)
    // This requires the SUPABASE_SERVICE_ROLE_KEY to be set in your environment for the admin client.
    // Since we don't have admin client setup on front-end, we keep it mocked.
    toast({
      title: "Mock User Deletion",
      description: `User ${userName} delete process initiated (mocked). For actual deletion, a Supabase Admin action is required on the backend or via Supabase Studio.`,
    });
    // To refresh the list optimistically (or after a real backend call):
    // setUsers(prevUsers => prevUsers.filter(u => u.id !== userId));
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
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Link href="/members" passHref>
            <Button variant="outline" disabled={isLoading || !supabase} className="w-full sm:w-auto">
              <UsersIcon className="mr-2 h-4 w-4" /> View Team Members
            </Button>
          </Link>
          <Button onClick={handleAddUser} disabled={isLoading || !supabase} className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" /> Add User
          </Button>
        </div>
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
                    <TableHead>Position</TableHead>
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
                      <TableCell className="text-muted-foreground max-w-[150px] truncate">
                        {user.position || <span className="italic">Not set</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === 'Admin' ? 'default' : 'secondary'} className="capitalize">
                          {user.role === 'Admin' ? <ShieldCheck className="mr-1 h-3 w-3" /> : <UserCircle className="mr-1 h-3 w-3" />}
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                            <Link href={`/admin/users/edit/${user.id}`}>
                              <Button variant="ghost" size="icon" aria-label="Edit user" disabled={!supabase || isLoading}>
                                  <Edit3 className="h-4 w-4" />
                              </Button>
                            </Link>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:text-destructive"
                                  aria-label="Delete user"
                                  disabled={!supabase || isLoading || currentUser?.id === user.id}
                                  title={currentUser?.id === user.id ? "Cannot delete self" : "Delete user"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the user "{user.name}". This action cannot be undone. (This is currently a mock action).
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteUser(user.id, user.name)}>
                                    Yes, delete user
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
