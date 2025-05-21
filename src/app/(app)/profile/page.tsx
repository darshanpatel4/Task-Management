'use client';

import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();

  if (loading) return <p>Loading profile...</p>;
  if (!currentUser) {
    router.push('/auth/login'); // Should be handled by layout too
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">My Profile</CardTitle>
          <CardDescription>View and manage your profile information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24" data-ai-hint="user avatar large">
              <AvatarImage src={currentUser.avatar || `https://placehold.co/150x150.png`} alt={currentUser.name} />
              <AvatarFallback className="text-3xl">{currentUser.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm">Change Avatar (mock)</Button>
          </div>
          <Separator />
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue={currentUser.name} readOnly className="mt-1 bg-muted/50" />
            </div>
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue={currentUser.email} readOnly className="mt-1 bg-muted/50" />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Input id="role" defaultValue={currentUser.role} readOnly className="mt-1 bg-muted/50" />
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
             <h3 className="text-lg font-semibold">Password</h3>
             <Button variant="outline">Change Password (mock)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
