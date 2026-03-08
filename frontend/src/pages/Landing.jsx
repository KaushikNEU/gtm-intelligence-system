import React from 'react';
import { Target, ArrowRight, Sparkles, BarChart3, Zap } from 'lucide-react';
import { Button } from '../components/ui/button';

const Landing = () => {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const handleLogin = () => {
    const redirectUrl = window.location.origin + '/dashboard';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 backdrop-blur-md bg-[#09090b]/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center">
              <Target className="w-5 h-5 text-black" />
            </div>
            <span className="font-semibold text-white tracking-tight">GTM Intelligence</span>
          </div>
          <Button 
            data-testid="login-btn"
            onClick={handleLogin}
            className="bg-white text-black hover:bg-zinc-200 h-9 px-4 rounded-md font-medium text-sm"
          >
            Sign in with Google
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pt-16">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-400 text-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI-Powered Lead Intelligence</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold text-white tracking-tight leading-tight">
            Turn Contacts into
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-400 via-indigo-400 to-purple-400">
              Revenue-Ready Leads
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Enrich, score, and route leads with LLM-powered intelligence. 
            Know which contacts to prioritize before your competitors do.
          </p>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              data-testid="get-started-btn"
              onClick={handleLogin}
              size="lg"
              className="bg-white text-black hover:bg-zinc-200 h-12 px-8 rounded-md font-medium text-base"
            >
              Get Started
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              variant="outline"
              size="lg"
              className="border-zinc-800 text-zinc-300 hover:bg-zinc-900 h-12 px-8 rounded-md font-medium text-base"
            >
              View Demo
            </Button>
          </div>
        </div>

        {/* Features Grid */}
        <div className="max-w-5xl mx-auto mt-24 grid grid-cols-1 md:grid-cols-3 gap-6">
          <FeatureCard 
            icon={Sparkles}
            title="LLM Enrichment"
            description="Infer firmographics, tech stack, and ICP signals from company data"
          />
          <FeatureCard 
            icon={Target}
            title="Smart Scoring"
            description="Tier contacts A/B/C with reasoning you can audit and trust"
          />
          <FeatureCard 
            icon={Zap}
            title="Auto Activation"
            description="Route hot leads to outbound, warm to nurture, cold to suppress"
          />
        </div>

        {/* Stats */}
        <div className="max-w-4xl mx-auto mt-24 mb-16 grid grid-cols-3 gap-8 border border-zinc-800 rounded-lg p-8 bg-zinc-900/30">
          <StatCard value="2.4x" label="Faster qualification" />
          <StatCard value="85%" label="Scoring accuracy" />
          <StatCard value="40%" label="More pipeline" />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-sm text-zinc-500">
          <span>© 2026 GTM Intelligence</span>
          <div className="flex items-center gap-6">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ icon: Icon, title, description }) => (
  <div className="p-6 rounded-lg border border-zinc-800 bg-[#09090b] hover:border-zinc-700 transition-colors">
    <div className="w-10 h-10 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
      <Icon className="w-5 h-5 text-zinc-300" />
    </div>
    <h3 className="font-medium text-white mb-2">{title}</h3>
    <p className="text-sm text-zinc-500">{description}</p>
  </div>
);

const StatCard = ({ value, label }) => (
  <div className="text-center">
    <div className="text-3xl font-semibold text-white font-mono">{value}</div>
    <div className="text-sm text-zinc-500 mt-1">{label}</div>
  </div>
);

export default Landing;
