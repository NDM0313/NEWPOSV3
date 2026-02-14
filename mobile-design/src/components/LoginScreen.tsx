import { useState } from 'react';
import { Lock, Mail, Zap } from 'lucide-react';
import { User } from '../App';

interface LoginScreenProps {
  onLogin: (user: User) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    // Mock login - in real app would call API
    const mockUser: User = {
      name: 'Ahmed Ali',
      email: email,
      role: 'admin'
    };

    onLogin(mockUser);
  };

  const handleDemoLogin = () => {
    // Auto-fill and login with demo credentials
    const mockUser: User = {
      name: 'Ahmed Ali',
      email: 'demo@dincollection.com',
      role: 'admin'
    };

    onLogin(mockUser);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center">
          <span className="text-3xl font-bold">DC</span>
        </div>
        <h1 className="text-2xl font-bold mb-1">Din Collection</h1>
        <p className="text-sm text-[#9CA3AF]">Mobile ERP</p>
      </div>

      {/* Login Form */}
      <div className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email Input */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all"
              />
            </div>
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full h-12 bg-[#1F2937] border border-[#374151] rounded-lg pl-11 pr-4 text-sm focus:outline-none focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 transition-all"
              />
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg">
              <p className="text-sm text-[#EF4444]">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] active:scale-[0.98] text-white font-medium rounded-lg transition-all"
          >
            Sign In
          </button>

          {/* Demo Login Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full h-12 bg-gradient-to-r from-[#8B5CF6] to-[#EC4899] hover:from-[#7C3AED] hover:to-[#DB2777] active:scale-[0.98] text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-5 h-5" />
            Quick Demo Login
          </button>

          {/* Demo Credentials Info */}
          <div className="mt-6 p-4 bg-[#1F2937] border border-[#374151] rounded-lg">
            <p className="text-xs text-[#6B7280] mb-2">Demo Credentials:</p>
            <p className="text-xs text-[#D1D5DB]">Email: demo@dincollection.com</p>
            <p className="text-xs text-[#D1D5DB]">Password: demo123</p>
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-[#6B7280]">Version 1.0.0</p>
        <p className="text-xs text-[#6B7280] mt-1">© 2026 Din Collection</p>
      </div>
    </div>
  );
}