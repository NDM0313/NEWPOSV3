import React, { useState, useEffect } from 'react';
import { useSupabase } from '../../context/SupabaseContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { User, Mail, Phone, Building2, MapPin, Calendar, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export const UserProfilePage = ({ onClose }: { onClose?: () => void }) => {
  const { user, companyId } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    avatar_url: '',
  });

  useEffect(() => {
    loadUserProfile();
  }, [user]);

  const loadUserProfile = async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setUserData(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
          avatar_url: data.avatar_url || '',
        });
      }
    } catch (error: any) {
      console.error('[USER PROFILE] Error loading profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from('users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          avatar_url: formData.avatar_url,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully');
      await loadUserProfile();
      if (onClose) onClose();
    } catch (error: any) {
      console.error('[USER PROFILE] Error saving profile:', error);
      toast.error('Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-gray-800 pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <User size={32} className="text-blue-500" />
            User Profile
          </h2>
          <p className="text-gray-400 mt-1">Manage your account information</p>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={20} />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="bg-gray-900/50 border-gray-800 p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {formData.full_name ? formData.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{formData.full_name || 'User'}</h3>
              <p className="text-sm text-gray-400">{user?.email}</p>
            </div>
            {userData && (
              <div className="text-xs text-gray-500">
                <Calendar size={12} className="inline mr-1" />
                Joined {new Date(userData.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </Card>

        {/* Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-gray-900/50 border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Personal Information</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                  <User size={16} />
                  Full Name
                </Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="bg-gray-950 border-gray-700 text-white"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                  <Mail size={16} />
                  Email
                </Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-gray-950 border-gray-700 text-gray-500"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                  <Phone size={16} />
                  Phone
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-gray-950 border-gray-700 text-white"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block flex items-center gap-2">
                  <Building2 size={16} />
                  Company
                </Label>
                <Input
                  value={userData?.company_id || ''}
                  disabled
                  className="bg-gray-950 border-gray-700 text-gray-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                <Save size={16} className="mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              {onClose && (
                <Button variant="ghost" onClick={onClose} className="text-gray-400 hover:text-white">
                  Cancel
                </Button>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
