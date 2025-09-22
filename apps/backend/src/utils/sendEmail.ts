import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const { GOOGLE_EMAIL, GOOGLE_APP_PASSWORD, BACKEND_PUBLIC_URL } = process.env;

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
        text: `go to this url: ${BACKEND_PUBLIC_URL}/api/v1/user/signin/post?token=${token}`
    })

    return sendEmail;
}