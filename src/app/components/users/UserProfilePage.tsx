import React, { useState, useEffect, useCallback } from 'react';
import { useSupabase } from '../../context/SupabaseContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Card } from '../ui/card';
import { User, Mail, Phone, Building2, Calendar, Save, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { userService, type User as ErpUser } from '@/app/services/userService';

export const UserProfilePage = ({ onClose }: { onClose?: () => void }) => {
  const {
    user,
    companyId,
    supabaseClient,
    refreshUserProfile,
    refreshErpProfileDisplay,
  } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<ErpUser | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });

  const loadUserProfile = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setLoadError(null);
      const data = await userService.getProfileForAuthUser(user.id, companyId);

      if (!data) {
        setLoadError('Profile not found. Please try again.');
        return;
      }

      setUserData(data);
      setFormData({
        full_name: data.full_name || '',
        phone: data.phone || '',
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to load profile';
      console.error('[USER PROFILE] Error loading profile:', error);
      setLoadError(message);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyId]);

  useEffect(() => {
    void loadUserProfile();
  }, [loadUserProfile]);

  const handleSave = async () => {
    if (!user?.id) return;

    const trimmedName = formData.full_name.trim();
    if (!trimmedName) {
      toast.error('Full name is required');
      return;
    }

    try {
      setSaving(true);
      const updatedRow = await userService.updateOwnProfile(user.id, companyId, {
        full_name: trimmedName,
        phone: formData.phone.trim() || null,
      });

      setUserData(updatedRow);
      setFormData({
        full_name: updatedRow.full_name || '',
        phone: updatedRow.phone || '',
      });

      refreshErpProfileDisplay({
        full_name: updatedRow.full_name,
        phone: updatedRow.phone ?? null,
      });

      try {
        await supabaseClient.auth.updateUser({
          data: { full_name: updatedRow.full_name },
        });
      } catch (authErr) {
        console.warn('[USER PROFILE] Auth metadata sync failed (ERP profile saved):', authErr);
      }

      refreshUserProfile();
      toast.success('Profile updated successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save profile';
      console.error('[USER PROFILE] Error saving profile:', error);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex justify-between items-start border-b border-border pb-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <User size={32} className="text-blue-500" />
            User Profile
          </h2>
          <p className="text-muted-foreground mt-1">Manage your account information</p>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={20} />
          </Button>
        )}
      </div>

      {loadError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span>{loadError}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void loadUserProfile()}
            className="text-amber-100 hover:text-foreground shrink-0"
          >
            <RefreshCw size={14} className="mr-1" />
            Retry
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <Card className="bg-muted/40 border-border p-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-emerald-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
              {formData.full_name ? formData.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U'}
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{formData.full_name || 'User'}</h3>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            {userData?.created_at && (
              <div className="text-xs text-muted-foreground">
                <Calendar size={12} className="inline mr-1" />
                Joined {new Date(userData.created_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </Card>

        {/* Form */}
        <div className="md:col-span-2 space-y-6">
          <Card className="bg-muted/40 border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Personal Information</h3>
            
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground mb-2 block flex items-center gap-2">
                  <User size={16} />
                  Full Name
                </Label>
                <Input
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="bg-input-background border-border text-white"
                  placeholder="Enter your full name"
                />
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block flex items-center gap-2">
                  <Mail size={16} />
                  Email
                </Label>
                <Input
                  value={user?.email || ''}
                  disabled
                  className="bg-input-background border-border text-muted-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block flex items-center gap-2">
                  <Phone size={16} />
                  Phone
                </Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="bg-input-background border-border text-white"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <Label className="text-muted-foreground mb-2 block flex items-center gap-2">
                  <Building2 size={16} />
                  Company
                </Label>
                <Input
                  value={userData?.company_id || companyId || ''}
                  disabled
                  className="bg-input-background border-border text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => void handleSave()}
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-500 text-white"
              >
                <Save size={16} className="mr-2" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              {onClose && (
                <Button variant="ghost" onClick={onClose} className="text-muted-foreground hover:text-foreground">
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
