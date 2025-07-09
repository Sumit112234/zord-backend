const nodemailer = require("nodemailer")

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
})

const sendVerificationEmail = async (email, otp, name) => {
  const mailOptions = {
    from: `"ZORD" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your ZORD OTP Code",
    html: `
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
        <h2 style="color: #333; text-align: center;">ZORD Email Verification</h2>
        <p>Hi ${name},</p>
        <p>Thank you for signing up on ZORD!</p>
        <p>Your One-Time Password (OTP) is:</p>
        <div style="text-align: center; margin: 30px 20px;">
        <p style="font-size: 30px; letter-spacing: 5px; font-weight: bold; color: #222;">${otp}</p>
        <p style="color: #666; font-size: 16px;">Please enter this code to verify your email address.</p>
        
        </div>
        <p>This OTP is valid for the next <strong>10 minutes</strong>.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
        <p style="color: #666; font-size: 12px; text-align: center;">
          ZORD - Connecting College Communities
        </p>
      </div>
    `,
  }

  await transporter.sendMail(mailOptions)
}


// const sendVerificationEmail = async (email, token, name) => {
//   const verificationUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`

//   const mailOptions = {
//     from: `"ZORD" <${process.env.EMAIL_USER}>`,
//     to: email,
//     subject: "Verify Your ZORD Account",
//     html: `
//       <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
//         <h2 style="color: #333; text-align: center;">Welcome to ZORD!</h2>
//         <p>Hi ${name},</p>
//         <p>Thank you for joining ZORD, the social platform for your college community!</p>
//         <p>Please click the button below to verify your email address:</p>
//         <div style="text-align: center; margin: 30px 0;">
//           <a href="${verificationUrl}" 
//              style="background-color: #007bff; color: white; padding: 12px 30px; 
//                     text-decoration: none; border-radius: 5px; display: inline-block;">
//             Verify Email
//           </a>
//         </div>
//         <p>Or copy and paste this link in your browser:</p>
//         <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
//         <p>This link will expire in 24 hours.</p>
//         <p>If you didn't create this account, please ignore this email.</p>
//         <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
//         <p style="color: #666; font-size: 12px; text-align: center;">
//           ZORD - Connecting College Communities
//         </p>
//       </div>
//     `,
//   }

//   await transporter.sendMail(mailOptions)
// }

module.exports = { sendVerificationEmail }
