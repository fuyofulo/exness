import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
const { AUTH_JWT_SECRET } = process.env;

// Extend Express Request to include user info
declare global {
  namespace Express { 
    interface Request {
      user?: {
        email: string;
        userId: number;
      };
    }
  }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('Auth middleware: Checking authentication');
    console.log('Headers:', req.headers.authorization ? 'Authorization header present' : 'No Authorization header');

    // Get token from Authorization header
    const authToken = req.headers.authorization?.replace('Bearer ', '');

    console.log('Auth token found:', authToken ? 'Yes' : 'No');

    if (!authToken) {
      console.log('Auth middleware: No token found, returning 401');
      return res.status(401).json({
        success: false,
        error: 'Authentication token not found'
      });
    }

    console.log('Auth middleware: Verifying token');

    // Verify and decode the token
    const decoded = jwt.verify(authToken, AUTH_JWT_SECRET!) as {
      email: string;
      userId: number;
    };

    console.log('Auth middleware: Token verified successfully for user:', decoded.email);

    // Attach user info to request object
    req.user = {
      email: decoded.email,
      userId: decoded.userId
    };

    console.log('Auth middleware: Proceeding to next handler');

    // Continue to next middleware/route handler
    next();

  } catch (error: any) {
    console.error('Auth middleware error:', error.message);
    console.error('Error name:', error.name);

    if (error.name === 'TokenExpiredError') {
      console.log('Auth middleware: Token expired');
      return res.status(401).json({
        success: false,
        error: 'Authentication token has expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      console.log('Auth middleware: Invalid token');
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    console.log('Auth middleware: Other auth error');
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};
