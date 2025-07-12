
import { nextHandler } from '@genkit-ai/next';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export const POST = nextHandler();
