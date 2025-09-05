import dotenv from 'dotenv';
import path from 'path';

// Load .env from the config package directory explicitly so consumers (e.g., apps/backend)
// get consistent env loading regardless of their current working directory.
dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const REDIS_URL = process.env.REDIS_URL as string;
export const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL as string;
export const GOOGLE_APP_PASSWORD = process.env.GOOGLE_APP_PASSWORD as string;
export const EMAIL_JWT_SECRET = process.env.EMAIL_JWT_SECRET as string;
export const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET as string;
export const BACKEND_URL = process.env.BACKEND_URL as string;