
'use client';

import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Loading profile...</p></div>;
  if (!currentUser) {
    // This should ideally be handled by the AppLayout redirecting.
    // router.push('/auth/login') might cause issues if called during render cycle.
    // Consider returning a loader or a message, or relying on AppLayout.
    if (typeof window !== 'undefined') router.push('/auth/login'); 
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /> <p className="ml-2">Redirecting...</p></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">My Profile</CardTitle>
          <CardDescription>View your profile information. Avatar images are managed by administrators.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center space-y-4">
            <Avatar className="h-24 w-24 ring-2 ring-primary/50 ring-offset-2 ring-offset-background" data-ai-hint="user avatar large">
              {/* currentUser.avatar will be a real URL or an initials-based placeholder from AuthContext */}
              <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              <AvatarFallback className="text-3xl">{currentUser.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="text-sm text-muted-foreground">Profile pictures are managed by administrators.</p>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" defaultValue={currentUser.name} readOnly className="bg-muted/50 border-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" defaultValue={currentUser.email} readOnly className="bg-muted/50 border-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="position">Position</Label>
              <Input id="position" defaultValue={currentUser.position || 'Not set'} readOnly className="bg-muted/50 border-muted" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="role">Role</Label>
              <Input id="role" defaultValue={currentUser.role} readOnly className="bg-muted/50 border-muted" />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
             <h3 className="text-lg font-semibold">Password</h3>
             <Button variant="outline" disabled>Change Password (Not Implemented)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
