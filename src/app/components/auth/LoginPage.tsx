import React, { useState } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Lock, Mail, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { signIn } = useSupabase();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { data, error: signInError } = await signIn(email, password);

    if (signInError) {
      // Better error messages
      let errorMessage = signInError.message;
      if (signInError.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Please check your credentials.';
      } else if (signInError.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address first.';
      } else if (signInError.message.includes('User not found')) {
        errorMessage = 'User does not exist. Please contact administrator.';
      }
      setError(errorMessage);
      setLoading(false);
    } else if (data?.user) {
      // Success - page will auto-reload and show dashboard
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    setError('');
    
    // Set demo credentials
    setEmail('admin@dincollection.com');
    setPassword('admin123');

    const { data, error: signInError } = await signIn('admin@dincollection.com', 'admin123');

    if (signInError) {
      // Better error messages
      let errorMessage = signInError.message;
      if (signInError.message.includes('Invalid login credentials') || signInError.message.includes('400')) {
        errorMessage = 'Demo user not found. Please create user in Supabase Dashboard first.';
      } else if (signInError.message.includes('Email not confirmed')) {
        errorMessage = 'Please confirm your email address first.';
      } else if (signInError.message.includes('User not found')) {
        errorMessage = 'Demo user does not exist. Please create user in Supabase Dashboard.';
      }
      setError(errorMessage);
      setLoading(false);
    } else if (data?.user) {
      // Success - page will auto-reload and show dashboard
      setTimeout(() => {
        window.location.reload();
      }, 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#111827] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Din Collection</h1>
          <p className="text-gray-400">Bridal Rental Management ERP</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-white mb-6">Sign In</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@dincollection.com"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base font-semibold"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

                  {/* Demo Account Button */}
                  <div className="mt-6">
                    <Button
                      type="button"
                      onClick={handleDemoLogin}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white h-12 text-base font-semibold shadow-lg"
                    >
                      {loading ? 'Signing in...' : '🚀 Demo Account (Admin Full Access)'}
                    </Button>
                    <p className="text-xs text-gray-400 text-center mt-2">
                      Click to login as demo admin with full access
                    </p>
                    {error && (
                      <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-400 font-semibold mb-1">⚠️ User Not Created Yet</p>
                        <p className="text-xs text-gray-400 mb-2">Create user in Supabase Dashboard first:</p>
                        <ol className="text-xs text-gray-400 list-decimal list-inside space-y-1 mb-2">
                          <li>Go to <a href="https://supabase.com/dashboard/project/pcxfwmbcjrkgzibgdrlz/auth/users" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Supabase Dashboard</a></li>
                          <li>Authentication → Users → Add user</li>
                          <li>Email: admin@dincollection.com</li>
                          <li>Password: admin123</li>
                          <li>Auto Confirm: Yes</li>
                        </ol>
                        <p className="text-xs text-gray-500">Or run: <code className="bg-gray-800 px-1 rounded">node create-user-simple.mjs</code></p>
                      </div>
                    )}
                  </div>

                  {/* Demo Credentials Info */}
                  <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <p className="text-xs text-gray-400 mb-2">Manual Login Credentials:</p>
                    <p className="text-sm text-white">Email: admin@dincollection.com</p>
                    <p className="text-sm text-white">Password: admin123</p>
                    {error && error.includes('not found') && (
                      <div className="mt-3 pt-3 border-t border-gray-700">
                        <p className="text-xs text-yellow-400 mb-2">⚠️ User not created yet!</p>
                        <p className="text-xs text-gray-400 mb-2">Create user in Supabase Dashboard:</p>
                        <a 
                          href="https://supabase.com/dashboard/project/pcxfwmbcjrkgzibgdrlz/auth/users" 
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline"
                        >
                          → Open Supabase Dashboard
                        </a>
                        <p className="text-xs text-gray-500 mt-1">Or run: node create-user-simple.mjs</p>
                      </div>
                    )}
                  </div>
        </div>
      </div>
    </div>
  );
};
