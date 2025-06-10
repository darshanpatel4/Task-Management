
'use server';

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import sgMail from '@sendgrid/mail';

// Configure SendGrid API Key
// IMPORTANT: Ensure SENDGRID_API_KEY is set in your environment variables (e.g., .env.local)
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY is not set. Email sending will be disabled.');
}

const fromEmail = process.env.SENDGRID_FROM_EMAIL;
if (!fromEmail) {
  console.warn('SENDGRID_FROM_EMAIL is not set. Please set a verified sender email for SendGrid.');
}


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
  if (!process.env.SENDGRID_API_KEY || !fromEmail) {
    const warningMessage = "SendGrid API Key or From Email is not configured. Email not sent. Check server logs.";
    console.warn(warningMessage);
    // Log the email content if SendGrid is not configured, for debugging/development
    console.log("*******************************************");
    console.log("SIMULATING EMAIL SEND (SendGrid not configured):");
    console.log(`To: ${details.to} (${details.recipientName || 'Recipient'})`);
    console.log(`From (intended): ${fromEmail || 'NOT_CONFIGURED@example.com'}`);
    console.log(`Subject: ${details.subject}`);
    console.log("Body (HTML):");
    console.log(details.htmlBody);
    console.log("*******************************************");
    return { success: false, message: warningMessage };
  }

  const msg = {
    to: details.to,
    from: fromEmail, // Use the verified sender email from environment variables
    subject: details.subject,
    html: details.htmlBody,
    // You can add text: 'equivalent plain text content' if needed
  };

  try {
    console.log(`Attempting to send email via SendGrid to: ${details.to} with subject: "${details.subject}"`);
    await sgMail.send(msg);
    console.log(`Email successfully sent to ${details.to} via SendGrid.`);
    return { success: true, message: 'Email sent successfully via SendGrid.' };
  } catch (error: any) {
    console.error('Error sending email via SendGrid:');
    if (error.response) {
      console.error('SendGrid Error Response Body:', error.response.body);
      // error.response.body.errors often contains detailed error messages from SendGrid
      const sendGridErrors = error.response.body.errors?.map((e: any) => e.message).join(', ') || 'Unknown SendGrid API error.';
      return { success: false, message: `Failed to send email via SendGrid: ${sendGridErrors}` };
    }
    // For other types of errors (network, etc.)
    console.error('Non-SendGrid API Error:', error.message || error);
    return { success: false, message: `Failed to send email: ${error.message || 'An unexpected error occurred.'}` };
  }
}

export { getUserDetailsByIds };
