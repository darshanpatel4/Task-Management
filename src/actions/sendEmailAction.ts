
'use server';

import { supabase } from '@/lib/supabaseClient';
import type { User } from '@/types';
import sgMail from '@sendgrid/mail';

// Configure SendGrid API Key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY is not set. Email sending will be disabled.');
}

const fromEmailVerified = process.env.SENDGRID_FROM_EMAIL;
const fromName = process.env.SENDGRID_FROM_NAME || 'TaskFlow AI'; // Default if not set

if (!fromEmailVerified) {
  console.warn('SENDGRID_FROM_EMAIL is not set. Please set a verified sender email for SendGrid.');
}


interface EmailDetails {
  to: string; // Recipient's email address
  subject: string;
  rawContent: string; 
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

// Naive HTML to text converter
function htmlToText(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<style([\s\S]*?)<\/style>/gi, ''); // Remove style blocks
  text = text.replace(/<script([\s\S]*?)<\/script>/gi, ''); // Remove script blocks
  text = text.replace(/<[^>]+>/g, ' '); // Remove all other HTML tags
  
  // Replace multiple spaces/newlines with single ones and trim
  text = text.replace(/\s\s+/g, ' ').trim();
  
  // Basic HTML entity decoding
  text = text.replace(/&nbsp;/gi, ' ');
  text = text.replace(/&amp;/gi, '&');
  text = text.replace(/&lt;/gi, '<');
  text = text.replace(/&gt;/gi, '>');
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&copy;/gi, '(c)');
  // Add more entities if needed

  // Attempt to make links somewhat readable
  // This is very basic and might need improvement based on your specific link structures
  // Example: <a href="URL">TEXT</a> becomes TEXT (URL)
  // This part is tricky without a proper parser
  // For now, we'll rely on the general tag stripping above which will leave TEXT and URL separated by spaces.

  return text;
}


export async function sendEmail(details: EmailDetails): Promise<{ success: boolean; message: string }> {
  if (!process.env.SENDGRID_API_KEY || !fromEmailVerified) {
    const warningMessage = "SendGrid API Key or From Email is not configured. Email not sent. Check server logs.";
    console.warn(warningMessage);
    console.log("*******************************************");
    console.log("SIMULATING EMAIL SEND (SendGrid not configured):");
    console.log(`To: ${details.to} (${details.recipientName || 'Recipient'})`);
    console.log(`From (intended): ${fromName} <${fromEmailVerified || 'NOT_CONFIGURED@example.com'}>`);
    console.log(`Subject: ${details.subject}`);
    const simulatedHtmlBody = wrapHtmlContent(details.rawContent, details.subject); 
    const simulatedTextBody = htmlToText(details.rawContent);
    console.log("Body (HTML):");
    console.log(simulatedHtmlBody);
    console.log("Body (Text):");
    console.log(simulatedTextBody);
    console.log("*******************************************");
    return { success: false, message: warningMessage };
  }

  const htmlToSend = wrapHtmlContent(details.rawContent, details.subject);
  const textToSend = htmlToText(details.rawContent); // Generate plain text from the raw content

  const msg = {
    to: details.to,
    from: {
        email: fromEmailVerified,
        name: fromName
    },
    subject: details.subject,
    html: htmlToSend,
    text: textToSend, // Add the plain text version
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
      const sendGridErrors = error.response.body.errors?.map((e: any) => e.message).join(', ') || 'Unknown SendGrid API error.';
      return { success: false, message: `Failed to send email via SendGrid: ${sendGridErrors}` };
    }
    console.error('Non-SendGrid API Error:', error.message || error);
    return { success: false, message: `Failed to send email: ${error.message || 'An unexpected error occurred.'}` };
  }
}

export { getUserDetailsByIds };

// Basic HTML Email Template Wrapper - NO EXPORT KEYWORD
function wrapHtmlContent(content: string, title: string = "Notification"): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #333; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
        .container { max-width: 600px; margin: 20px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eeeeee; }
        .header h1 { color: #333333; margin:0; font-size: 24px; }
        .content { padding: 20px 0; color: #555555; line-height: 1.6; font-size: 16px; }
        .content p { margin: 10px 0 15px; }
        .content strong { color: #333333; }
        .button { display: inline-block; padding: 12px 25px; margin-top: 20px; margin-bottom: 10px; background-color: #6699CC; color: #ffffff !important; text-decoration: none !important; border-radius: 5px; font-weight: bold; font-size: 16px; }
        .button:hover { background-color: #5588BB; }
        .footer { text-align: center; padding-top: 20px; border-top: 1px solid #eeeeee; font-size: 0.9em; color: #aaaaaa; }
        blockquote { border-left: 4px solid #ccc; padding-left: 1em; margin-left: 0; font-style: italic; color: #666; }
        pre { white-space: pre-wrap; font-family: monospace; background: #f9f9f9; padding: 10px; border-radius: 4px; border: 1px solid #eee; overflow-x: auto; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${fromName}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} ${fromName}. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
}

