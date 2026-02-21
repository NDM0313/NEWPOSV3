import React, { useState } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Lock, Mail, AlertCircle, Building2, User } from 'lucide-react';
import { CreateBusinessForm } from './CreateBusinessForm';

export const LoginPage: React.FC = () => {
  const { signIn } = useSupabase();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [createBusinessSuccess, setCreateBusinessSuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await signIn(email, password);

    if (signInError) {
      let errorMessage = signInError.message;
      if (signInError.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (signInError.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address first.';
      } else if (signInError.message.includes('User not found')) {
        errorMessage = 'User does not exist. Please create a business first.';
      } else if (signInError.message.includes('Failed to fetch') || (signInError.name && signInError.name.includes('AuthRetryableFetchError'))) {
        errorMessage = 'Network error: Cannot reach the server. If you use erp.dincouture.pk, the admin should set VITE_SUPABASE_URL to https://erp.dincouture.pk and rebuild.';
      }
      setError(errorMessage);
      setLoading(false);
    } else if (data?.user) {
      // Success - reload page to trigger ProtectedRoute re-evaluation
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const handleCreateBusinessSuccess = async (email: string, password: string) => {
    setCreateBusinessSuccess(true);
    setShowCreateBusiness(false);
    setError('');
    
    // Auto-login after business creation
    const { error: signInError } = await signIn(email, password);
    if (!signInError) {
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } else {
      setError('Business created but login failed. Please login manually.');
      setCreateBusinessSuccess(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    setError('');
    const adminEmail = 'ndm313@yahoo.com';
    const adminPassword = '123456';
    setEmail(adminEmail);
    setPassword(adminPassword);
    const { data, error: signInError } = await signIn(adminEmail, adminPassword);
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
    } else if (data?.user) {
      setTimeout(() => window.location.reload(), 500);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    
    // Demo credentials (from demo company)
    const demoEmail = 'demo@dincollection.com';
    const demoPassword = 'demo123';
    
    // Auto-fill form fields (for visual feedback)
    setEmail(demoEmail);
    setPassword(demoPassword);
    
    // Attempt login
    const { data, error: signInError } = await signIn(demoEmail, demoPassword);
    
    if (signInError) {
      let errorMessage = signInError.message;
      if (signInError.message.includes('Invalid login credentials')) {
        errorMessage = 'Demo account not found. Please contact administrator to set up demo account.';
      } else if (signInError.message.includes('Email not confirmed')) {
        errorMessage = 'Demo account email not confirmed. Please contact administrator.';
      } else if (signInError.message.includes('User not found')) {
        errorMessage = 'Demo account does not exist. Please contact administrator.';
      } else if (signInError.message.includes('Failed to fetch') || (signInError.name && signInError.name.includes('AuthRetryableFetchError'))) {
        errorMessage = 'Network error: Cannot reach the server. Admin should set VITE_SUPABASE_URL=https://erp.dincouture.pk and rebuild.';
      }
      setError(errorMessage);
      setLoading(false);
    } else if (data?.user) {
      // Success - reload page to trigger ProtectedRoute re-evaluation
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  // Show create business form
  if (showCreateBusiness) {
    return (
      <CreateBusinessForm
        onSuccess={(email, password) => handleCreateBusinessSuccess(email, password)}
        onCancel={() => {
          setShowCreateBusiness(false);
          setError('');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#111827]">
      <div className="w-full max-w-sm">
        {/* Logo - Mobile style */}
        <div className="mb-8 text-center">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-2xl flex items-center justify-center">
            <span className="text-3xl font-bold text-white">DC</span>
          </div>
          <h1 className="text-2xl font-bold mb-1 text-white">Din Collection</h1>
          <p className="text-sm text-[#9CA3AF]">Bridal Rental Management ERP</p>
        </div>

        {/* Login Form */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {createBusinessSuccess && (
            <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
              Business created successfully! Logging you in...
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="h-12 pl-11 pr-4 bg-[#1F2937] border-[#374151] text-white placeholder:text-[#6B7280] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-lg"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-[#9CA3AF] mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6B7280]" />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 pl-11 pr-4 bg-[#1F2937] border-[#374151] text-white placeholder:text-[#6B7280] focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 rounded-lg"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white font-medium rounded-lg"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-[#374151]"></div>
            <span className="px-4 text-sm text-[#9CA3AF]">OR</span>
            <div className="flex-1 border-t border-[#374151]"></div>
          </div>

          {/* Admin Login Button */}
          <Button
            type="button"
            onClick={handleAdminLogin}
            disabled={loading}
            className="w-full h-12 bg-[#10B981] hover:bg-[#059669] text-white font-medium rounded-lg flex items-center justify-center gap-2 mb-2"
          >
            <User size={18} />
            {loading ? 'Logging in...' : 'Admin'}
          </Button>

          {/* Demo Login Button */}
          <Button
            type="button"
            onClick={handleDemoLogin}
            disabled={loading}
            className="w-full h-12 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-medium rounded-lg flex items-center justify-center gap-2 mb-3"
          >
            <User size={18} />
            {loading ? 'Logging in...' : 'Demo Login'}
          </Button>
          <p className="text-xs text-[#9CA3AF] text-center mb-4">
            Quick access with demo or admin account
          </p>

          {/* Create Business Button */}
          <Button
            type="button"
            onClick={() => setShowCreateBusiness(true)}
            disabled={loading}
            variant="outline"
            className="w-full h-12 bg-[#1F2937] border-[#374151] text-white hover:bg-[#374151] font-medium rounded-lg flex items-center justify-center gap-2"
          >
            <Building2 size={18} />
            Create New Business
          </Button>
          <p className="text-xs text-[#9CA3AF] text-center mt-2">
            Don't have an account? Create your business to get started
          </p>
        </div>
      </div>
    </div>
  );
};
