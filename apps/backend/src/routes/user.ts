import router from 'express';
import jwt from 'jsonwebtoken';
import { sendSignupEmail } from '../services/sendEmail';
import { EMAIL_JWT_SECRET, AUTH_JWT_SECRET } from '@repo/config';

const app = router();

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
        
        const authToken = jwt.sign({
            email
        }, AUTH_JWT_SECRET, { expiresIn: '7d' });
        
        res.cookie("authToken", authToken, {
            httpOnly: true,
            secure: false, 
            sameSite: "lax",
        });
        res.redirect(`https://youtube.com`)

    } catch {
        res.status(500).json({
            message: "failed to signin"
        })
    }
})

export const userRouter = app;