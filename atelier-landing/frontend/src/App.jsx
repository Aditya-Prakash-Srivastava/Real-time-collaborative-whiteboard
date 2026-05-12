import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import CTA from './components/CTA';
import Footer from './components/Footer';
import Login from './components/Login';
import Signup from './components/Signup';
import Whiteboard from './components/Whiteboard';

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
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
    if (!token) {
      window.location.href = '/#cta';
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
