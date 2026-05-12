import React from 'react';
import { RefreshCw, Expand, Users } from 'lucide-react';

const Features = () => {
  const features = [
    {
      icon: <RefreshCw className="w-5 h-5 text-brand-blue" />,
      title: "Real-time Sync",
      description: "Changes reflect instantly for every participant. Zero lag, zero conflict, just pure collaboration."
    },
    {
      icon: <Expand className="w-5 h-5 text-brand-blue" />,
      title: "Infinite Canvas",
      description: "Never run out of space. Your ideas grow as large as your vision, with no boundaries or page breaks."
    },
    {
      icon: <Users className="w-5 h-5 text-brand-blue" />,
      title: "Team Rooms",
      description: "Organize your projects into dedicated spaces. Manage permissions and keep assets all in one place."
    }
  ];

  return (
    <section id="features" className="py-20 px-6 md:px-12 relative z-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div key={index} className="bg-slate-50 border border-slate-100 rounded-xl p-8 hover:shadow-md transition-shadow">
              <div className="w-12 h-12 bg-blue-100/50 rounded-lg flex items-center justify-center mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
              <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
