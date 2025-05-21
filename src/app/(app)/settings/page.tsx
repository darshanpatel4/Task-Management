'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  // Mock settings states
  // In a real app, these would come from user preferences or context
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Settings</CardTitle>
          <CardDescription>Manage your application preferences.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold">Notifications</h3>
            <div className="space-y-3 mt-2">
              <div className="flex items-center justify-between p-3 rounded-md border">
                <Label htmlFor="email-notifications" className="flex flex-col space-y-1">
                  <span>Email Notifications</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Receive email updates for important events.
                  </span>
                </Label>
                <Switch id="email-notifications" defaultChecked />
              </div>
              <div className="flex items-center justify-between p-3 rounded-md border">
                <Label htmlFor="inapp-notifications" className="flex flex-col space-y-1">
                  <span>In-App Notifications</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Show notifications within the application.
                  </span>
                </Label>
                <Switch id="inapp-notifications" defaultChecked />
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="text-lg font-semibold">Appearance</h3>
             <div className="flex items-center justify-between p-3 rounded-md border mt-2">
                <Label htmlFor="dark-mode" className="flex flex-col space-y-1">
                  <span>Dark Mode</span>
                  <span className="font-normal leading-snug text-muted-foreground">
                    Toggle dark mode for the application. (Theme toggle is in header)
                  </span>
                </Label>
                <Switch id="dark-mode" disabled /> 
                {/* Theme is handled by header button, this is illustrative */}
              </div>
          </div>
          
          <Separator />

          <div className="flex justify-end">
            <Button>Save Preferences (mock)</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
