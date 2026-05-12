import React, { useState, useEffect } from 'react';

const Navbar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsLoggedIn(true);
      try {
        // Decode JWT payload (base64url)
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload && payload.email) {
          // Extract just the name part before @ for display
          setUserEmail(payload.email.split('@')[0]);
        }
      } catch (err) {
        console.error('Failed to parse token');
      }
    }
  }, []);

  const handleWhiteboardClick = (e) => {
    if (!isLoggedIn) {
      e.preventDefault();
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
      }, 4000);
    }
  };

  return (
    <>
      <nav className="w-full py-4 px-6 md:px-12 flex justify-between items-center bg-transparent relative z-20">
        <div className="flex items-center gap-8">
          <a href="/" className="text-2xl font-bold tracking-tight text-slate-900">
            Whiteboard
          </a>
          <div className="hidden md:flex gap-6 text-sm font-medium text-slate-600">
            <a 
              href={isLoggedIn ? "/whiteboard" : "#"} 
              onClick={handleWhiteboardClick}
              className={`transition-colors hover:text-slate-900 cursor-pointer`}
            >
              Whiteboard
            </a>
            <a href="/#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="/#about" className="hover:text-slate-900 transition-colors">About</a>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-block text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
                Logged in as <span className="text-slate-700">{userEmail}</span>
              </span>
            </div>
          ) : (
            <>
              <a href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 px-4 py-2 border border-slate-200 rounded-md transition-colors bg-white hover:bg-slate-50">
                Login
              </a>
              <a href="/signup" className="text-sm font-medium text-white bg-brand-blue hover:bg-brand-dark px-4 py-2 rounded-md transition-colors shadow-sm">
                Sign Up
              </a>
            </>
          )}
        </div>
      </nav>

      {/* Toast Notification Popup */}
      {showToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900/90 backdrop-blur text-white px-6 py-3 rounded-lg shadow-xl text-sm font-medium flex items-center gap-3 border border-slate-700">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Login to access whiteboard
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;
