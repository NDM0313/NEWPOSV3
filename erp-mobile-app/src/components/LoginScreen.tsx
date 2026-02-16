import { useState } from 'react';
import { Lock, Mail, Zap, Loader2 } from 'lucide-react';
import type { User } from '../types';
import * as authApi from '../api/auth';

interface LoginScreenProps {
  onLogin: (user: User, companyId: string | null) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { data, error: err } = await authApi.signIn(email, password);
      if (err) {
        setError(err.message);
        return;
      }
      if (data) {
        const user: User = { name: data.name, email: data.email, role: data.role };
        onLogin(user, data.companyId);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { data, error: err } = await authApi.signIn('demo@dincollection.com', 'demo123');
      if (err) {
        setError(err.message);
        return;
      }
      if (data) {
        const user: User = { name: data.name, email: data.email, role: data.role };
        onLogin(user, data.companyId);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center">
          <span className="text-3xl font-bold text-white">DC</span>
        </div>
        <h1 className="text-2xl font-bold mb-1 text-white">Din Collection</h1>
        <p className="text-sm text-[#9CA3AF]">Mobile ERP</p>
      </div>

      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-11 pr-4 text-sm text-white placeholder-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] disabled:opacity-70 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
            Sign In
          </button>
        </form>

        <button
          type="button"
          disabled={loading}
          onClick={handleDemoLogin}
          className="mt-4 w-full h-12 bg-[#8B5CF6]/20 border border-[#8B5CF6]/40 text-[#A78BFA] font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
        >
          <Zap className="w-5 h-5" />
          Demo Login
        </button>
      </div>
    </div>
  );
}
