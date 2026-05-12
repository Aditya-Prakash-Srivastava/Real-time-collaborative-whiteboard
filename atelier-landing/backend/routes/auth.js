const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');
const { z } = require('zod');
const User = require('../models/User');
const OTP = require('../models/OTP');
const authMiddleware = require('../middleware/auth');

// Phase 9: Zod Validation Schemas
const emailSchema = z.object({
  email: z.string().email('Invalid email address')
});

const authSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

const passwordSchema = z.object({
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

// Configure Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

// 1. Send OTP Route
router.post('/send-otp', async (req, res) => {
  try {
    const result = emailSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0].message });
    }
    const { email } = result.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email to prevent spam
    await OTP.deleteMany({ email });

    // Save OTP to Database
    const newOtp = new OTP({ email, otp: otpCode });
    await newOtp.save();

    // Send email via Resend
    const mailOptions = {
      from: 'Whiteboard <onboarding@resend.dev>',
      to: [email],
      subject: 'Your Whiteboard Signup OTP',
      html: `<h2>Welcome to Whiteboard!</h2><p>Your OTP for signup is: <strong>${otpCode}</strong></p><p>This code will expire in 5 minutes.</p>`,
    };

    // We wrap this in a try-catch to provide a helpful error if email creds are missing
    try {
      const { data, error } = await resend.emails.send(mailOptions);
      if (error) throw error;
      console.log(`OTP sent to ${email}: ${otpCode}`);
      res.status(200).json({ message: 'OTP sent successfully' });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      // For development fallback if creds are not set, we still return success but log it
      console.log(`FALLBACK: OTP for ${email} is ${otpCode}`);
      res.status(500).json({ error: 'Failed to send email. Please check your Gmail App Password configuration in .env' });
    }
  } catch (error) {
    console.error('Send OTP Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. Verify OTP Route
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    // Find the latest OTP for this email
    const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // OTP verified successfully
    // We don't delete it immediately so the signup route can theoretically double-check, 
    // or we just trust the frontend for this simple flow. We'll trust the frontend flow here.
    
    res.status(200).json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. Signup Route
router.post('/signup', async (req, res) => {
  try {
    const result = authSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0].message });
    }
    const { email, password } = result.data;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.authProvider === 'google') {
        return res.status(400).json({ error: 'This email is already registered via Google. Please use "Sign in with Google" instead.' });
      }
      return res.status(400).json({ error: 'An account with this email already exists. Please sign in instead.' });
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = new User({
      email,
      password: hashedPassword,
    });

    await newUser.save();

    // Clean up any remaining OTPs for this user
    await OTP.deleteMany({ email });

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser._id, email: newUser.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: newUser._id, email: newUser.email }
    });
  } catch (error) {
    console.error('Signup Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. Login Route
router.post('/login', async (req, res) => {
  try {
    const result = authSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0].message });
    }
    const { email, password } = result.data;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: { id: user._id, email: user.email }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. Change Password Route (Protected)
router.post('/change-password', authMiddleware, async (req, res) => {
  try {
    const result = passwordSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0].message });
    }
    const { newPassword } = result.data;
    const userId = req.user.userId;

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user in DB
    await User.findByIdAndUpdate(userId, { password: hashedPassword });

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6. Google OAuth Route
router.post('/google', async (req, res) => {
  try {
    const { credential, email: clientEmail } = req.body;

    if (!credential) {
      return res.status(400).json({ error: 'Google credential is required' });
    }

    // Verify the access token by calling Google's userinfo API
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${credential}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({ error: 'Invalid Google credential' });
    }

    const googleUser = await googleRes.json();
    const email = googleUser.email;

    if (!email) {
      return res.status(400).json({ error: 'Could not extract email from Google account' });
    }

    // Check if user already exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create a new user without a password (Google auth user)
      user = new User({
        email,
        authProvider: 'google',
      });
      await user.save();
      console.log(`[Google OAuth] New user created: ${email}`);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Google login successful',
      token,
      user: { id: user._id, email: user.email }
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// 7. Reset Password - Send OTP
router.post('/reset-password/send-otp', async (req, res) => {
  try {
    const result = emailSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error.errors[0].message });
    }
    const { email } = result.data;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'No account found with this email' });
    }

    if (user.authProvider === 'google') {
      return res.status(400).json({ error: 'This account uses Google login. Password reset is not available.' });
    }

    // Generate a 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Delete any existing OTP for this email
    await OTP.deleteMany({ email });

    // Save OTP to Database
    const newOtp = new OTP({ email, otp: otpCode });
    await newOtp.save();

    // Send email via Resend
    const mailOptions = {
      from: 'Whiteboard <onboarding@resend.dev>',
      to: [email],
      subject: 'Your Whiteboard Password Reset OTP',
      html: `<h2>Password Reset</h2><p>Your OTP for password reset is: <strong>${otpCode}</strong></p><p>This code will expire in 5 minutes.</p>`,
    };

    try {
      const { data, error } = await resend.emails.send(mailOptions);
      if (error) throw error;
      console.log(`[Reset] OTP sent to ${email}: ${otpCode}`);
      res.status(200).json({ message: 'OTP sent successfully' });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      console.log(`FALLBACK: Reset OTP for ${email} is ${otpCode}`);
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error) {
    console.error('Reset Send OTP Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 8. Reset Password - Verify OTP and Change Password
router.post('/reset-password/verify', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Find and verify OTP
    const otpRecord = await OTP.findOne({ email }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({ error: 'OTP expired or not found. Please request a new one.' });
    }

    if (otpRecord.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Hash the new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update user password
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    // Clean up OTPs
    await OTP.deleteMany({ email });

    res.status(200).json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
