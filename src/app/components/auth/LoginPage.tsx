import React, { useState } from 'react';
import { useSupabase, STORAGE_BLOCKED_MESSAGE } from '@/app/context/SupabaseContext';
import { formatSignInError, isStorageSecurityError } from '@/app/utils/authErrorMessages';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Lock, Mail, AlertCircle, Building2 } from 'lucide-react';
import { CreateBusinessWizard } from './CreateBusinessWizard';

export const LoginPage: React.FC = () => {
  const { signIn } = useSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCreateBusiness, setShowCreateBusiness] = useState(false);
  const [createBusinessSuccess, setCreateBusinessSuccess] = useState(false);

  const runSignIn = async (signInEmail: string, signInPassword: string): Promise<boolean> => {
    setLoading(true);
    setError('');
    try {
      const { data, error: signInError } = await signIn(signInEmail, signInPassword);
      if (signInError) {
        setError(
          formatSignInError(signInError, {
            storageBlockedMessage: STORAGE_BLOCKED_MESSAGE,
            attemptedEmail: signInEmail,
          })
        );
        return false;
      }
      if (!data?.user) {
        setError('Sign in did not return a user. Please try again.');
        return false;
      }
      return true;
    } catch (e: unknown) {
      if (isStorageSecurityError(e)) {
        setError(STORAGE_BLOCKED_MESSAGE);
      } else {
        setError(e instanceof Error ? e.message : 'Sign in failed unexpectedly.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await runSignIn(email, password);
  };

  const handleCreateBusinessSuccess = async (createdEmail: string, createdPassword: string) => {
    setShowCreateBusiness(false);
    setError('');
    const ok = await runSignIn(createdEmail, createdPassword);
    if (ok) {
      setCreateBusinessSuccess(true);
    } else {
      setError('Business created but login failed. Please login manually.');
      setCreateBusinessSuccess(false);
    }
  };

  // Show create business wizard
  if (showCreateBusiness) {
    return (
      <CreateBusinessWizard
        onSuccess={(createdEmail, createdPassword) => handleCreateBusinessSuccess(createdEmail, createdPassword)}
        onCancel={() => {
          setShowCreateBusiness(false);
          setError('');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
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

          <div className="my-6 flex items-center">
            <div className="flex-1 border-t border-[#374151]"></div>
            <span className="px-4 text-sm text-[#9CA3AF]">OR</span>
            <div className="flex-1 border-t border-[#374151]"></div>
          </div>

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
