import router from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { sendSignupEmail } from '../utils/sendEmail';
import { EMAIL_JWT_SECRET, AUTH_JWT_SECRET } from '@repo/config';
import { PrismaClient } from '../../prisma/generated';

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

// Test endpoint to verify database connection
app.get('/me', async (req, res) => {
    try {
        const authToken = req.cookies.authToken;
        if (!authToken) {
            return res.status(401).json({ error: 'No authentication token' });
        }

        const decoded = jwt.verify(authToken, AUTH_JWT_SECRET!) as { email: string; userId: number };

        // Get user (balances are maintained in-engine)
        const user = await prisma.user.findUnique({
            where: { email: decoded.email }
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
        console.error('Auth error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});

export const userRouter = app;