'use client';

import { useAuth } from '@/context/AuthContext';
import { mockUsers } from '@/lib/mock-data';
import type { User } from '@/types';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Edit3, Trash2, ShieldCheck, UserCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

export default function UserManagementPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();

  if (!isAdmin) {
    // Layout should ideally prevent non-admins from reaching this page
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

  const handleEditUser = (userId: string) => {
    alert(`Edit user ${userId} (mock functionality)`);
    // router.push(`/admin/users/edit/${userId}`); // For actual implementation
  };

  const handleDeleteUser = (userId: string) => {
    if (confirm(`Are you sure you want to delete user ${userId}? (mock functionality)`)) {
      alert(`User ${userId} deleted (mock).`);
      // Add logic to remove user from mockUsers or call API
    }
  };
  
  const handleCreateUser = () => {
    alert('Create new user (mock functionality)');
    // router.push('/admin/users/create'); // For actual implementation
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground">Manage all users in the system.</p>
        </div>
        <Button onClick={handleCreateUser}>
          <PlusCircle className="mr-2 h-4 w-4" /> Create User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>List of all registered users in TaskFlow AI.</CardDescription>
        </CardHeader>
        <CardContent>
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
              {mockUsers.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <Avatar className="h-9 w-9" data-ai-hint="user avatar">
                      <AvatarImage src={user.avatar || `https://placehold.co/40x40.png`} alt={user.name} />
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
                        <Button variant="ghost" size="icon" onClick={() => handleEditUser(user.id)} aria-label="Edit user">
                            <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteUser(user.id)} aria-label="Delete user">
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
