import React, { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const Signup = () => {
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: Password
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Google OAuth handler for signup
  const handleGoogleSignup = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      setError('');
      try {
        // Get user info from Google using the access token
        const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
        });
        const userInfo = await userInfoRes.json();

        // Send to our backend
        const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: tokenResponse.access_token, email: userInfo.email }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Google signup failed');

        localStorage.setItem('token', data.token);
        setSuccess('Account created with Google!');
        setTimeout(() => {
          const searchParams = new URLSearchParams(window.location.search);
          const room = searchParams.get('room');
          window.location.href = room ? `/whiteboard?room=${room}` : '/whiteboard';
        }, 1000);
      } catch (err) {
        setError(err.message);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError('Google signup failed. Please try again.'),
  });

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (!email) return setError('Email is required');
    
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      
      setSuccess('OTP sent to your email!');
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!otp) return setError('OTP is required');

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');
      
      setSuccess('Email verified! Please create a password.');
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    if (!password) return setError('Password is required');
    if (password.length < 6) return setError('Password must be at least 6 characters');

    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Failed to create account');
      
      setSuccess('Account created successfully!');
      // Store JWT token
      localStorage.setItem('token', data.token);
      
      // Redirect or update app state here
      setTimeout(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const room = searchParams.get('room');
        window.location.href = room ? `/whiteboard?room=${room}` : '/whiteboard';
      }, 1500);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 relative flex flex-col justify-center items-center overflow-hidden font-sans">
      {/* Background Dot Pattern */}
      <div className="absolute inset-0 bg-dot-pattern pointer-events-none z-0"></div>

      {/* Top Header - Logo outside the card */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-center z-20">
        <a href="/" className="text-2xl font-bold tracking-tight text-slate-900">
          Whiteboard
        </a>
      </div>

      {/* Signup Card */}
      <div className="relative z-10 w-full max-w-[440px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 p-8 sm:p-10 mx-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Sign up for free</h2>
          <p className="text-sm text-slate-500">Embark on a new team collaboration journey</p>
        </div>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-md border border-green-100">{success}</div>}

        <form className="space-y-5" onSubmit={step === 1 ? handleSendOtp : step === 2 ? handleVerifyOtp : handleSignup}>
          
          {/* STEP 1: EMAIL */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={step > 1}
              placeholder="Recommend using your work email"
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors text-sm disabled:opacity-50"
            />
          </div>

          {/* STEP 2: OTP */}
          {step >= 2 && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-700">Verification Code (OTP)</label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                disabled={step > 2}
                placeholder="Enter 6-digit code"
                maxLength={6}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors text-sm disabled:opacity-50 text-center tracking-[0.5em] font-medium"
              />
            </div>
          )}

          {/* STEP 3: PASSWORD */}
          {step === 3 && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
              <label className="block text-sm font-medium text-slate-700">Create Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors text-sm"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-blue hover:bg-brand-dark text-white font-medium py-3 rounded-md transition-colors shadow-sm mt-2 mb-6 flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {step === 1 ? 'Continue' : step === 2 ? 'Verify Code' : 'Complete Signup'}
          </button>
        </form>

        {/* Show Google signup only on step 1 */}
        {step === 1 && (
          <button 
            onClick={() => handleGoogleSignup()}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors mt-6 mb-8 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-70"
          >
            {googleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            Sign up with Google
          </button>
        )}

        {/* Footer Links */}
        <div className="mt-8 text-center space-y-3">
          <p className="text-sm text-slate-600">
            Already have account?{' '}
            <a href={`/login${window.location.search}`} className="text-brand-blue hover:text-brand-dark font-medium transition-colors">
              Sign in
            </a>
          </p>
          <p className="text-xs text-slate-400">
            By signing up, you agree with Whiteboard's{' '}
            <a href="#privacy" className="hover:text-slate-600 underline transition-colors">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
