import React from 'react';

const Hero = () => {
  return (
    <section className="pt-20 pb-16 px-6 md:px-12 flex flex-col items-center text-center relative z-20">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900">
          Where ideas flow together.
        </h1>
        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto font-normal">
          A minimalist workspace for real-time collaboration. Create, draw, and ideate with your team on an infinite canvas.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button 
            onClick={() => window.location.href = '/signup'}
            className="w-full sm:w-auto px-10 py-4 text-lg bg-brand-blue hover:bg-brand-dark text-white font-semibold rounded-lg transition-colors shadow-md flex items-center justify-center"
          >
            Get Started for Free
          </button>
        </div>
      </div>
      
      {/* Product Mockup Image */}
      <div className="mt-16 w-full max-w-5xl mx-auto">
        <div className="relative rounded-xl overflow-hidden shadow-2xl border border-slate-200/50 bg-slate-100 aspect-video flex items-center justify-center">
          {/* We will use a mock image of the app here. For now a gradient/placeholder to mimic the iPad look */}
          <div className="absolute inset-0 bg-gradient-to-tr from-slate-200 to-slate-100">
            {/* Mockup styling to look like the image (a tablet UI) */}
            <div className="absolute inset-4 sm:inset-8 bg-slate-800 rounded-3xl p-3 shadow-inner">
               <div className="w-full h-full bg-white rounded-2xl relative overflow-hidden shadow-sm flex items-center justify-center">
                  <div className="text-slate-400 font-medium">Product Canvas Visualization</div>
                  {/* Decorative Elements mimicking sticky notes */}
                  <div className="absolute top-1/4 left-1/4 w-24 h-24 bg-blue-100 rotate-[-5deg] shadow-sm flex items-center justify-center text-xs font-bold text-blue-800">PROJECT IDEA</div>
                  <div className="absolute top-1/3 left-1/2 w-24 h-24 bg-yellow-100 rotate-[3deg] shadow-sm flex items-center justify-center text-xs font-bold text-yellow-800">MEETING NOTES</div>
                  <div className="absolute bottom-1/4 right-1/3 w-24 h-24 bg-green-100 rotate-[-2deg] shadow-sm flex items-center justify-center text-xs font-bold text-green-800">TODO LIST</div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
