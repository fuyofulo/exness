import dotenv from 'dotenv';
dotenv.config();

export const REDIS_URL = process.env.REDIS_URL as string;
export const GOOGLE_EMAIL = process.env.GOOGLE_EMAIL as string;
export const GOOGLE_APP_PASSWORD = process.env.GOOGLE_APP_PASSWORD as string;
export const EMAIL_JWT_SECRET = process.env.EMAIL_JWT_SECRET as string;
export const AUTH_JWT_SECRET = process.env.AUTH_JWT_SECRET as string;
export const BACKEND_URL = process.env.BACKEND_URL as string;