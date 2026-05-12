import React from 'react';

const CTA = () => {
  return (
    <section id="cta" className="py-12 px-6 md:px-12 relative z-20">
      <div className="max-w-6xl mx-auto bg-brand-dark rounded-3xl p-12 md:p-20 text-center relative overflow-hidden">
        {/* Decorative inner pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20 pointer-events-none"></div>
        
        <div className="relative z-10 max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Ready to start creating?
          </h2>
          <p className="text-blue-100 text-lg md:text-xl">
            Join thousands of teams already building the future on Whiteboard's collaborative canvas.
          </p>
          <div className="pt-6">
            <button 
              onClick={() => window.location.href = '/signup'} 
              className="px-8 py-3.5 bg-white text-brand-dark hover:bg-slate-50 font-bold rounded-md shadow-sm transition-colors text-sm md:text-base"
            >
              Create Your First Board
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTA;
