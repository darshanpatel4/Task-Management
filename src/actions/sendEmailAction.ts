
'use server';

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';

interface EmailDetails {
  to: string; // Recipient's email address
  subject: string;
  htmlBody: string;
  recipientName?: string; // Optional: For personalized greeting
}

// Function to fetch user details (including email) by ID
async function getUserDetailsByIds(userIds: string[]): Promise<User[]> {
  if (!userIds || userIds.length === 0) {
    return [];
  }
  if (!supabase) {
    console.error("sendEmailAction: Supabase client is not available.");
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, avatar_url, position')
      .in('id', userIds);

    if (error) {
      console.error('sendEmailAction: Error fetching user details:', error);
      return [];
    }
    return (data || []).map(profile => ({
      id: profile.id,
      name: profile.full_name || 'User',
      email: profile.email || '',
      role: profile.role as User['role'] || 'User',
      avatar: profile.avatar_url || undefined,
      position: profile.position || undefined,
    }));
  } catch (e) {
    console.error('sendEmailAction: Exception fetching user details:', e);
    return [];
  }
}

export async function sendEmail(details: EmailDetails): Promise<{ success: boolean; message: string }> {
  console.log("*******************************************");
  console.log("SIMULATING EMAIL SEND:");
  console.log(`To: ${details.to} (${details.recipientName || 'Recipient'})`);
  console.log(`Subject: ${details.subject}`);
  console.log("Body (HTML):");
  console.log(details.htmlBody);
  console.log("*******************************************");

  // In a real application, you would integrate with an email service here.
  // Example using a hypothetical email service client:
  // try {
  //   const emailProvider = new EmailProvider(process.env.EMAIL_PROVIDER_API_KEY);
  //   await emailProvider.send({
  //     to: details.to,
  //     from: 'noreply@taskflow.ai',
  //     subject: details.subject,
  //     html: details.htmlBody,
  //   });
  //   return { success: true, message: 'Email sent successfully (simulated).' };
  // } catch (error) {
  //   console.error('Failed to send email:', error);
  //   return { success: false, message: 'Failed to send email.' };
  // }

  // For now, we'll assume success for the simulation.
  return { success: true, message: 'Email logged to console (simulated send).' };
}

export { getUserDetailsByIds };
