import React from 'react';
import { Share2, Globe } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full bg-slate-50 border-t border-slate-200 py-8 px-6 md:px-12 relative z-20">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex flex-col items-center md:items-start gap-1">
          <span className="text-xl font-bold tracking-tight text-slate-900">Whiteboard</span>
          <span className="text-xs text-slate-500">© 2024 Whiteboard Inc. All rights reserved.</span>
        </div>
        
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600 font-medium">
          <a href="#privacy" className="hover:text-slate-900 transition-colors">Privacy Policy</a>
          <a href="#terms" className="hover:text-slate-900 transition-colors">Terms of Service</a>
          <a href="#support" className="hover:text-slate-900 transition-colors">Contact Support</a>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-300 transition-colors">
            <Share2 className="w-4 h-4" />
          </button>
          <button className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-300 transition-colors">
            <Globe className="w-4 h-4" />
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
