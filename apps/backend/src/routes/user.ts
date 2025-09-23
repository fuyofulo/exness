import { Router } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { PrismaClient } from '../../prisma/generated';
import { authMiddleware } from '../middleware';

dotenv.config();

const { AUTH_JWT_SECRET, BACKEND_PUBLIC_URL } = process.env;

const app = Router();
const prisma = new PrismaClient();

if(!AUTH_JWT_SECRET) {
    console.log('AUTH_JWT_SECRET is not set');
    process.exit(1);
}

app.post('/signup', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }

    try {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        console.log(`New user ${email} - creating account in engine first...`);

        // Generate temp auth token (we don't have userId yet)
        const tempAuthToken = jwt.sign({
            email,
            userId: 0 // Temporary
        }, AUTH_JWT_SECRET, { expiresIn: '7d' });

        // Call engine to create account
        const engineResponse = await axios.post(`${BACKEND_PUBLIC_URL}/api/v1/engine`, {
            command: 'CREATE_ACCOUNT'
        }, {
            headers: {
                'Authorization': `Bearer ${tempAuthToken}`
            }
        });

        console.log('Engine account created successfully');

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user in backend database
        const newUser = await prisma.user.create({
            data: { email, password: hashedPassword }
        });

        console.log(`User ${newUser.email} created in database (ID: ${newUser.id})`);

        // Generate JWT token
        const authToken = jwt.sign({
            email,
            userId: newUser.id
        }, AUTH_JWT_SECRET, { expiresIn: '7d' });

        console.log(`New user signup completed successfully`);

        res.status(201).json({
            success: true,
            token: authToken,
            message: 'User created successfully'
        });

    } catch (engineError: any) {
        console.error('Failed to create account in engine:', engineError.response?.data || engineError.message);
        res.status(500).json({
            message: "Failed to create trading account. Please try again."
        });
    }
});

// Add this new /signin route (replace the old /signin/post):
app.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password required' });
    }

    try {
        // Find user
        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const authToken = jwt.sign({
            email: user.email,
            userId: user.id
        }, AUTH_JWT_SECRET, { expiresIn: '7d' });

        console.log(`User ${email} signed in successfully`);

        res.json({
            success: true,
            token: authToken,
            message: 'Signin successful'
        });

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({ message: 'Signin failed' });
    }
});

// Cleanup on exit
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});

// Get user profile
app.get('/me', authMiddleware, async (req, res) => {
    try {
        // User info is already available from authMiddleware
        const { email, userId } = req.user!;

        // Get user (balances are maintained in-engine)
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            user: {
                id: user.id,
                email: user.email
                // Note: Balances are fetched from engine via GET_BALANCE command
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ 
            error: 'Failed to fetch user profile',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get all orders for the authenticated user
app.get('/orders', authMiddleware, async (req, res) => {
    try {
        // User info is already available from authMiddleware
        const { userId } = req.user!;

        // Get all orders for the user from database
        const orders = await prisma.order.findMany({
            where: {
                userId: userId
            },
            orderBy: {
                id: 'desc' // Most recent orders first (using ID as proxy for creation order)
            },
            select: {
                orderId: true,
                command: true,
                status: true,
                asset: true,
                direction: true,
                amount: true,
                leverage: true,
                tradeId: true,
                id: true, // Include ID for ordering reference
                latencyMs: true
            }
        });

        // Convert BigInt fields to strings for JSON serialization
        const serializedOrders = orders.map(order => ({
            ...order,
            amount: order.amount ? order.amount.toString() : null,
            leverage: order.leverage ? order.leverage.toString() : null
        }));

        res.json({
            success: true,
            orders: serializedOrders,
            count: orders.length
        });
    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ 
            error: 'Failed to fetch orders',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Get all trades for the authenticated user
app.get('/trades', authMiddleware, async (req, res) => {
    try {
        // User info is already available from authMiddleware
        const { userId } = req.user!;

        // Get all trades for the user from database
        const trades = await prisma.trade.findMany({
            where: {
                userId: userId
            },
            orderBy: {
                id: 'desc' // Most recent trades first (using ID as proxy for creation order)
            },
            select: {
                tradeId: true,
                asset: true,
                direction: true,
                margin: true,
                leverage: true,
                entryPrice: true,
                entryPriceDecimals: true,
                liquidationPrice: true,
                liquidationPriceDecimals: true,
                stopLossPrice: true,
                takeProfitPrice: true,
                triggerDecimals: true,
                exitPrice: true,
                exitPriceDecimals: true,
                pnl: true,
                status: true,
                createdAt: true,
                updatedAt: true,
                id: true // Include ID for ordering reference
            }
        });

        // Convert BigInt fields to strings for JSON serialization
        const serializedTrades = trades.map(trade => ({
            ...trade,
            margin: trade.margin ? trade.margin.toString() : null,
            leverage: trade.leverage ? trade.leverage.toString() : null,
            entryPrice: trade.entryPrice ? trade.entryPrice.toString() : null,
            liquidationPrice: trade.liquidationPrice ? trade.liquidationPrice.toString() : null,
            stopLossPrice: trade.stopLossPrice ? trade.stopLossPrice.toString() : null,
            takeProfitPrice: trade.takeProfitPrice ? trade.takeProfitPrice.toString() : null,
            exitPrice: trade.exitPrice ? trade.exitPrice.toString() : null,
            pnl: trade.pnl ? trade.pnl.toString() : null
        }));

        res.json({
            success: true,
            trades: serializedTrades,
            count: trades.length
        });
    } catch (error) {
        console.error('Error fetching user trades:', error);
        res.status(500).json({ 
            error: 'Failed to fetch trades',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

// Delete user account
app.delete('/delete', authMiddleware, async (req, res) => {
    try {
        // User info is already available from authMiddleware
        const { email, userId } = req.user!;

        console.log(`Deleting user account for ${email} (ID: ${userId})`);

        // Step 1: Delete user from engine (this will close all open trades and return balances)
        try {
            const authToken = req.headers.authorization?.replace('Bearer ', '');
            const engineResponse = await axios.post(`${BACKEND_PUBLIC_URL}/api/v1/engine`, {
                command: 'DELETE_USER'
            }, {
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });

            if (!engineResponse.data.success) {
                return res.status(400).json({
                    success: false,
                    error: 'Failed to delete user from engine',
                    details: engineResponse.data.error
                });
            }

            console.log('User deleted from engine successfully');
        } catch (engineError: any) {
            console.error('Failed to delete user from engine:', engineError.response?.data || engineError.message);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete user from engine',
                details: engineError.response?.data?.error || engineError.message
            });
        }

        // Step 2: Delete user and all related data from database
        try {
            // Delete in correct order to handle foreign key constraints
            await prisma.trade.deleteMany({
                where: { userId: userId }
            });

            await prisma.order.deleteMany({
                where: { userId: userId }
            });

            await prisma.user.delete({
                where: { id: userId }
            });

            console.log(`User ${email} and all related data deleted from database`);
        } catch (dbError: any) {
            console.error('Failed to delete user from database:', dbError?.message || dbError);
            return res.status(500).json({
                success: false,
                error: 'Failed to delete user data from database',
                details: dbError?.message || 'Unknown database error'
            });
        }

        // Token is handled on frontend

        res.json({
            success: true,
            message: 'User account deleted successfully',
            userId: userId,
            email: email
        });

    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ 
            error: 'Failed to delete user account',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

export const userRouter = app;