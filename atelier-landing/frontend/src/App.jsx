import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import CTA from './components/CTA';
import Footer from './components/Footer';
import Login from './components/Login';
import Signup from './components/Signup';
import Whiteboard from './components/Whiteboard';

/**
 * Root Application Component
 * 
 * Architecture Overview:
 * 1. Handles client-side routing using a custom hook/event listener (popstate) to avoid heavy dependencies like react-router if not needed.
 * 2. Implements Authentication Guards: Protects the `/whiteboard` route by checking for a valid JWT token.
 * 3. Preserves URL parameters (e.g. `?room=123`) during redirects to ensure seamless invitation links.
 */
function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    
    // Auto-redirect to whiteboard if root URL has a room code
    if (window.location.pathname === '/') {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      if (room) {
        window.location.href = `/whiteboard?room=${room}`;
      }
    }
    
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  if (currentPath === '/login') {
    return <Login />;
  }
  
  if (currentPath === '/signup') {
    return <Signup />;
  }

  if (currentPath === '/whiteboard') {
    const token = localStorage.getItem('token');
    if (!token || token === 'undefined' || token === 'null') {
      const params = new URLSearchParams(window.location.search);
      const room = params.get('room');
      if (room) {
        window.location.href = `/login?room=${room}`;
      } else {
        window.location.href = '/login';
      }
      return null;
    }
    return <Whiteboard />;
  }

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background Dot Pattern */}
      <div className="absolute inset-0 bg-dot-pattern opacity-[0.4] pointer-events-none z-0"></div>
      
      {/* Content wrapper with relative positioning so it sits above the background pattern */}
      <div className="relative z-10 font-sans">
        <Navbar />
        <main>
          <Hero />
          <Features />
          <CTA />
        </main>
        <Footer />
      </div>
    </div>
  );
}

export default App;
