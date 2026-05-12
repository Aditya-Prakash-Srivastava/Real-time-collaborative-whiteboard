import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { useGoogleLogin } from '@react-oauth/google';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  // Reset password state
  const [resetMode, setResetMode] = useState(false); // true = show reset flow
  const [resetStep, setResetStep] = useState(1); // 1: send OTP, 2: verify OTP, 3: new password
  const [resetOtp, setResetOtp] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  // Auto-clear reset error after 4 seconds
  useEffect(() => {
    if (resetError) {
      const timer = setTimeout(() => setResetError(''), 4000);
      return () => clearTimeout(timer);
    }
  }, [resetError]);

  // Google OAuth handler
  const handleGoogleLogin = useGoogleLogin({
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
        const res = await fetch('http://localhost:5000/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential: tokenResponse.access_token, email: userInfo.email }),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Google login failed');

        localStorage.setItem('token', data.token);
        window.location.href = '/whiteboard';
      } catch (err) {
        setError(err.message);
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError('Google login failed. Please try again.'),
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      return setError('Please enter both email and password');
    }

    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to login');
      }

      // Save token and redirect
      localStorage.setItem('token', data.token);
      window.location.href = '/whiteboard';
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Reset Password: Send OTP
  const handleResetSendOtp = async (e) => {
    e.preventDefault();
    setResetError('');
    if (!email) return setResetError('Please enter your email first');

    setResetLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');

      setResetSuccess('OTP sent to your email!');
      setResetStep(2);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Reset Password: Verify OTP
  const handleResetVerifyOtp = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (!resetOtp) return setResetError('Please enter the OTP');

    setResetLoading(true);
    try {
      // We verify OTP by trying to reset with a dummy call first — or we can just move to step 3
      // For better UX, let's verify OTP locally by calling verify-otp route
      const res = await fetch('http://localhost:5000/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: resetOtp })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid OTP');

      setResetSuccess('OTP verified! Set your new password.');
      setResetStep(3);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Reset Password: Set New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');
    if (!resetNewPassword || resetNewPassword.length < 6) {
      return setResetError('Password must be at least 6 characters');
    }

    setResetLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/auth/reset-password/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: resetOtp, newPassword: resetNewPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');

      setResetSuccess(data.message);
      // Go back to login after 2 seconds
      setTimeout(() => {
        setResetMode(false);
        setResetStep(1);
        setResetOtp('');
        setResetNewPassword('');
        setResetError('');
        setResetSuccess('');
      }, 2000);
    } catch (err) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  // Go back from reset mode
  const handleBackToLogin = () => {
    setResetMode(false);
    setResetStep(1);
    setResetOtp('');
    setResetNewPassword('');
    setResetError('');
    setResetSuccess('');
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

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-[440px] bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 p-8 sm:p-10 mx-4">
        
        {!resetMode ? (
          <>
            {/* ===== NORMAL LOGIN VIEW ===== */}
            <h2 className="text-2xl font-semibold text-center text-slate-900 mb-8">Sign in</h2>

            {/* Google Sign In Button */}
            <button 
              onClick={() => handleGoogleLogin()}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors mb-6 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-70"
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
              Sign in with Google
            </button>

            {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">{error}</div>}

            <form className="space-y-5" onSubmit={handleLogin}>
              {/* Email Field */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors text-sm"
                />
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Please enter the password"
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

              {/* Reset Password Link */}
              <div className="flex justify-start">
                <button 
                  type="button"
                  onClick={() => {
                    if (!email) {
                      setError('Please enter your email first, then click Reset password');
                      return;
                    }
                    setError('');
                    setResetMode(true);
                  }}
                  className="text-sm font-medium text-brand-blue hover:text-brand-dark transition-colors"
                >
                  Reset password
                </button>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-blue hover:bg-brand-dark text-white font-medium py-3 rounded-md transition-colors shadow-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign in
              </button>
            </form>

            {/* Footer Links */}
            <div className="mt-8 text-center space-y-3">
              <p className="text-sm text-slate-600">
                Don't have an account yet?{' '}
                <a href="/signup" className="text-brand-blue hover:text-brand-dark font-medium transition-colors">
                  Sign up for free
                </a>
              </p>
              <p className="text-xs text-slate-400">
                By signing in, you agree with Whiteboard's{' '}
                <a href="#privacy" className="hover:text-slate-600 underline transition-colors">
                  Privacy Policy
                </a>
              </p>
            </div>
          </>
        ) : (
          <>
            {/* ===== RESET PASSWORD VIEW ===== */}
            <div className="flex items-center gap-3 mb-6">
              <button onClick={handleBackToLogin} className="text-slate-400 hover:text-slate-600 transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-semibold text-slate-900">Reset Password</h2>
            </div>

            {resetError && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100 animate-in fade-in duration-200">
                {resetError}
              </div>
            )}
            {resetSuccess && (
              <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-md border border-green-100 animate-in fade-in duration-200">
                {resetSuccess}
              </div>
            )}

            {/* Email display */}
            <div className="mb-5 p-3 bg-slate-50 rounded-md border border-slate-200">
              <p className="text-xs text-slate-500 mb-0.5">Email</p>
              <p className="text-sm font-medium text-slate-800">{email}</p>
            </div>

            {/* Step 1: Send OTP */}
            {resetStep === 1 && (
              <form onSubmit={handleResetSendOtp} className="space-y-4">
                <p className="text-sm text-slate-600">We'll send a verification code to your email to reset your password.</p>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-brand-blue hover:bg-brand-dark text-white font-medium py-3 rounded-md transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send OTP
                </button>
              </form>
            )}

            {/* Step 2: Verify OTP */}
            {resetStep === 2 && (
              <form onSubmit={handleResetVerifyOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">Enter OTP</label>
                  <input
                    type="text"
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors text-sm text-center tracking-[0.5em] font-medium"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-brand-blue hover:bg-brand-dark text-white font-medium py-3 rounded-md transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verify OTP
                </button>
              </form>
            )}

            {/* Step 3: New Password */}
            {resetStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-slate-700">New Password</label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Create a new password"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-blue/20 focus:border-brand-blue transition-colors text-sm"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                    >
                      {showResetPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full bg-brand-blue hover:bg-brand-dark text-white font-medium py-3 rounded-md transition-colors shadow-sm flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  {resetLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reset Password
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Login;
