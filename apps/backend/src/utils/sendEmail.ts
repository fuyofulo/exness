import nodemailer from 'nodemailer';
import { GOOGLE_EMAIL, GOOGLE_APP_PASSWORD, BACKEND_URL } from '@repo/config';

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: GOOGLE_EMAIL,
      pass: GOOGLE_APP_PASSWORD,
    },
});

export async function sendSignupEmail (email: string, token: string) {

    const sendEmail = await transporter.sendMail({
        from: 'pheonixdiaz625@gmail.com',
        to: email,
        subject: 'super 30 assignment',
        text: `go to this url: ${BACKEND_URL}/api/v1/user/signin/post?token=${token}`
    })

    return sendEmail;
}