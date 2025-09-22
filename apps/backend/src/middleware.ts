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
    // Get token from cookies
    const authToken = req.cookies.authToken;

    if (!authToken) {
      return res.status(401).json({
        success: false,
        error: 'Authentication token not found'
      });
    }

    // Verify and decode the token
    const decoded = jwt.verify(authToken, AUTH_JWT_SECRET!) as {
      email: string;
      userId: number;
    };

    // Attach user info to request object
    req.user = {
      email: decoded.email,
      userId: decoded.userId
    };

    // Continue to next middleware/route handler
    next();

  } catch (error: any) {
    console.error('Auth middleware error:', error.message);

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Authentication token has expired'
      });
    }

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};
