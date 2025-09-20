import router from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { sendSignupEmail } from '../utils/sendEmail';
import { EMAIL_JWT_SECRET, AUTH_JWT_SECRET } from '@repo/config';
import { PrismaClient } from '../../prisma/generated';
import { authMiddleware } from '../middleware';

const app = router();
const prisma = new PrismaClient();

if(!EMAIL_JWT_SECRET || !AUTH_JWT_SECRET) {
    console.log('EMAIL_JWT_SECRET or AUTH_JWT_SECRET is not set');
    process.exit(1);
}

app.post('/signup', async (req, res) => {

    const email = req.body.email;
    const token = jwt.sign({ email }, EMAIL_JWT_SECRET, { expiresIn: '5m' });

    const success = await sendSignupEmail(email, token);

    if (!success) {
        res.status(500).json({
            message: 'failed to send email'
        })
    }

    res.status(200).json({
        message: 'successfully sent email'
    })
});

app.get('/signin/post', async (req, res) => {
    console.log('endpoint has been hit');

    const token = req.query.token as string;

    try {
        console.log('inside try');
        const decoded = jwt.verify(token, EMAIL_JWT_SECRET) as { email: string };
        console.log('decoded');
        const email = decoded.email;
        console.log(email);

        // 🔍 STEP 1: CHECK IF USER EXISTS IN BACKEND DATABASE
        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            console.log(`Existing user ${email} found (ID: ${existingUser.id})`);

            // Generate auth token for existing user
            const authToken = jwt.sign({
                email,
                userId: existingUser.id
            }, AUTH_JWT_SECRET, { expiresIn: '7d' });

            res.cookie("authToken", authToken, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
            });

            console.log(`🔄 Existing user signed in successfully`);
            res.redirect(`http://localhost:3000`);
            return;
        }

        // Step 2: New user - create account in engine first
        console.log(`New user ${email} - creating account in engine first...`);

        try {
            // Generate temp auth token (we don't have userId yet)
            const tempAuthToken = jwt.sign({
                email,
                userId: 0 // Temporary
            }, AUTH_JWT_SECRET, { expiresIn: '7d' });

            // Call engine to create account
            const engineResponse = await axios.post('http://localhost:3005/api/v1/engine', {
                command: 'CREATE_ACCOUNT'
            }, {
                headers: {
                    'Cookie': `authToken=${tempAuthToken}`
                }
            });

            console.log('Engine account created successfully');

            // Step 3: Now create user in backend database
            const newUser = await prisma.user.create({
                data: { email }
            });

            console.log(`User ${newUser.email} created in database (ID: ${newUser.id})`);

                // Note: Balances are maintained in-engine only, no database storage needed

            // Step 5: Generate proper auth token with real user ID
            const authToken = jwt.sign({
                email,
                userId: newUser.id
            }, AUTH_JWT_SECRET, { expiresIn: '7d' });

            res.cookie("authToken", authToken, {
                httpOnly: true,
                secure: false,
                sameSite: "lax",
            });

            console.log(`New user signup completed successfully`);
            res.redirect(`http://localhost:3000`);

        } catch (engineError: any) {
            console.error('Failed to create account in engine:', engineError.response?.data || engineError.message);

            // If engine fails, don't create user in database - return error
            res.status(500).json({
                message: "Failed to create trading account. Please try again."
            });
            return;
        }

    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({
            message: "failed to signin"
        })
    }
})

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
            takeProfitPrice: trade.takeProfitPrice ? trade.takeProfitPrice.toString() : null
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
            const engineResponse = await axios.post('http://localhost:3005/api/v1/engine', {
                command: 'DELETE_USER'
            }, {
                headers: {
                    'Cookie': `authToken=${req.cookies.authToken}`
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

        // Step 3: Clear the auth cookie
        res.clearCookie('authToken', {
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
        });

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