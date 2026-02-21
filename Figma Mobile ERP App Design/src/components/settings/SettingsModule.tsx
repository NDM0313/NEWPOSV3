import { useState } from 'react';
import { ArrowLeft, Settings as SettingsIcon, User as UserIcon, Building2, Lock, Shield, Palette, Globe, ChevronRight, LogOut, Check, Eye, EyeOff, Printer, Check as CheckIcon } from 'lucide-react';
import { User } from '../../App';

interface SettingsModuleProps {
  onBack: () => void;
  user: User;
  onLogout?: () => void;
}

type SettingsSection = 'main' | 'profile' | 'edit-profile' | 'change-password' | 'business' | 'modules' | 'permissions' | 'preferences' | 'printer';

interface AppSettings {
  theme: 'dark' | 'light';
  language: 'en' | 'ur';
  currency: 'PKR' | 'USD';
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY';
  timeFormat: '12h' | '24h';
}

export function SettingsModule({ onBack, user, onLogout }: SettingsModuleProps) {
  const [currentSection, setCurrentSection] = useState<SettingsSection>('main');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Editable profile state
  const [profileData, setProfileData] = useState({
    name: user.name,
    email: user.email,
    phone: '0300-1234567',
  });

  // Password change state
  const [passwordData, setPasswordData] = useState({
    current: '',
    new: '',
    confirm: '',
  });

  // App settings state
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    language: 'en',
    currency: 'PKR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12h',
  });

  const handleSaveProfile = () => {
    // Simulate save
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setCurrentSection('profile');
    }, 1500);
  };

  const handleChangePassword = () => {
    if (passwordData.new === passwordData.confirm && passwordData.current) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setPasswordData({ current: '', new: '', confirm: '' });
        setCurrentSection('profile');
      }, 1500);
    }
  };

  const handleSaveSettings = () => {
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 1500);
  };

  // Edit Profile View
  if (currentSection === 'edit-profile') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('profile')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Edit Profile</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Full Name</label>
            <input
              type="text"
              value={profileData.name}
              onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
              className="w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Email</label>
            <input
              type="email"
              value={profileData.email}
              onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
              className="w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Phone Number</label>
            <input
              type="tel"
              inputMode="tel"
              value={profileData.phone}
              onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
              className="w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          <button
            onClick={handleSaveProfile}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl font-medium transition-colors active:scale-95 flex items-center justify-center gap-2"
          >
            {saveSuccess ? <><Check className="w-5 h-5" /> Saved!</> : 'Save Changes'}
          </button>
        </div>
      </div>
    );
  }

  // Change Password View
  if (currentSection === 'change-password') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('profile')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-semibold">Change Password</h1>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Current Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordData.current}
                onChange={(e) => setPasswordData({ ...passwordData, current: e.target.value })}
                className="w-full h-12 px-4 pr-12 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#3B82F6]"
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-[#374151] rounded-lg transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5 text-[#9CA3AF]" /> : <Eye className="w-5 h-5 text-[#9CA3AF]" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">New Password</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={passwordData.new}
                onChange={(e) => setPasswordData({ ...passwordData, new: e.target.value })}
                className="w-full h-12 px-4 pr-12 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#3B82F6]"
              />
              <button
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-[#374151] rounded-lg transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5 text-[#9CA3AF]" /> : <Eye className="w-5 h-5 text-[#9CA3AF]" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Confirm Password</label>
            <input
              type="password"
              value={passwordData.confirm}
              onChange={(e) => setPasswordData({ ...passwordData, confirm: e.target.value })}
              className="w-full h-12 px-4 bg-[#1F2937] border border-[#374151] rounded-xl text-white focus:outline-none focus:border-[#3B82F6]"
            />
          </div>

          {passwordData.new && passwordData.confirm && passwordData.new !== passwordData.confirm && (
            <p className="text-xs text-[#EF4444]">Passwords do not match</p>
          )}

          <button
            onClick={handleChangePassword}
            disabled={!passwordData.current || !passwordData.new || passwordData.new !== passwordData.confirm}
            className="w-full h-12 bg-[#3B82F6] hover:bg-[#2563EB] text-white rounded-xl font-medium transition-colors active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveSuccess ? <><Check className="w-5 h-5" /> Password Changed!</> : 'Change Password'}
          </button>
        </div>
      </div>
    );
  }

  // Profile Settings View
  if (currentSection === 'profile') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('main')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <UserIcon className="w-6 h-6 text-[#3B82F6]" />
              <h1 className="text-lg font-semibold">Profile Settings</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#3B82F6] to-[#2563EB] rounded-full flex items-center justify-center">
                <span className="text-2xl font-bold">{profileData.name.charAt(0)}</span>
              </div>
              <div>
                <p className="font-medium text-white">{profileData.name}</p>
                <p className="text-sm text-[#9CA3AF]">{profileData.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-[#8B5CF6]/20 text-[#8B5CF6] text-xs rounded-full font-medium">
                  {user.role.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl divide-y divide-[#374151]">
            <button
              onClick={() => setCurrentSection('edit-profile')}
              className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <UserIcon className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-sm text-white">Edit Profile Info</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>
            <button
              onClick={() => setCurrentSection('change-password')}
              className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-sm text-white">Change Password</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>
          </div>

          {onLogout && (
            <button
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-2 h-12 bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] rounded-xl font-medium hover:bg-[#EF4444]/20 transition-colors active:scale-95"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          )}
        </div>
      </div>
    );
  }

  // Business Settings View
  if (currentSection === 'business') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('main')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Building2 className="w-6 h-6 text-[#10B981]" />
              <h1 className="text-lg font-semibold">Business Settings</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl divide-y divide-[#374151]">
            <div className="p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">Company Name</p>
              <p className="text-sm font-medium text-white">Din Collection</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">Business Type</p>
              <p className="text-sm font-medium text-white">Textile & Apparel</p>
            </div>
            <div className="p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">Currency</p>
              <select
                value={settings.currency}
                onChange={(e) => {
                  setSettings({ ...settings, currency: e.target.value as 'PKR' | 'USD' });
                  handleSaveSettings();
                }}
                className="w-full h-10 px-3 bg-[#111827] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="PKR">PKR (Pakistani Rupee)</option>
                <option value="USD">USD (US Dollar)</option>
              </select>
            </div>
            <div className="p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">Date Format</p>
              <select
                value={settings.dateFormat}
                onChange={(e) => {
                  setSettings({ ...settings, dateFormat: e.target.value as 'DD/MM/YYYY' | 'MM/DD/YYYY' });
                  handleSaveSettings();
                }}
                className="w-full h-10 px-3 bg-[#111827] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
            <div className="p-4">
              <p className="text-xs text-[#9CA3AF] mb-1">Time Format</p>
              <select
                value={settings.timeFormat}
                onChange={(e) => {
                  setSettings({ ...settings, timeFormat: e.target.value as '12h' | '24h' });
                  handleSaveSettings();
                }}
                className="w-full h-10 px-3 bg-[#111827] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="12h">12 Hour</option>
                <option value="24h">24 Hour</option>
              </select>
            </div>
          </div>

          {saveSuccess && (
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <p className="text-sm text-[#10B981]">Settings saved successfully</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Modules Settings View
  if (currentSection === 'modules') {
    const modules = [
      { name: 'Sales', enabled: true },
      { name: 'Purchase', enabled: true },
      { name: 'Rental', enabled: true },
      { name: 'Studio', enabled: true },
      { name: 'Accounts', enabled: true },
      { name: 'Expenses', enabled: true },
      { name: 'Inventory', enabled: true },
      { name: 'Products', enabled: true },
      { name: 'POS', enabled: true },
      { name: 'Contacts', enabled: true },
    ];

    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('main')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-[#8B5CF6]" />
              <h1 className="text-lg font-semibold">Module Settings</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-xl p-4">
            <p className="text-xs text-[#8B5CF6]">
              ℹ️ Module availability is controlled by your system administrator
            </p>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl divide-y divide-[#374151]">
            {modules.map((module, idx) => (
              <div key={idx} className="flex items-center justify-between p-4">
                <span className="text-sm text-white">{module.name}</span>
                <div className={`w-12 h-6 rounded-full ${module.enabled ? 'bg-[#10B981]' : 'bg-[#374151]'} flex items-center ${module.enabled ? 'justify-end' : 'justify-start'} px-1`}>
                  <div className="w-4 h-4 bg-white rounded-full"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Permissions View
  if (currentSection === 'permissions') {
    const permissions = {
      sales: ['View Sales', 'Create Sale', 'Edit Sale', 'Delete Sale'],
      purchase: ['View Purchases', 'Create Purchase', 'Edit Purchase'],
      inventory: ['View Stock', 'Update Stock'],
      reports: ['View Reports', 'Export Reports'],
    };

    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('main')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-[#F59E0B]" />
              <h1 className="text-lg font-semibold">Your Permissions</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#8B5CF6]/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Current Role</p>
                <p className="text-xs text-[#9CA3AF]">{user.role.toUpperCase()}</p>
              </div>
            </div>
          </div>

          {Object.entries(permissions).map(([module, perms], idx) => (
            <div key={idx} className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
              <h3 className="text-sm font-medium text-white mb-3 capitalize">{module}</h3>
              <div className="space-y-2">
                {perms.map((perm, pidx) => (
                  <div key={pidx} className="flex items-center gap-2">
                    <div className="w-5 h-5 bg-[#10B981]/20 rounded flex items-center justify-center">
                      <Check className="w-3 h-3 text-[#10B981]" />
                    </div>
                    <span className="text-xs text-[#9CA3AF]">{perm}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Preferences View
  if (currentSection === 'preferences') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('main')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Palette className="w-6 h-6 text-[#EC4899]" />
              <h1 className="text-lg font-semibold">App Preferences</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl divide-y divide-[#374151]">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Palette className="w-5 h-5 text-[#9CA3AF]" />
                <div>
                  <p className="text-sm text-white">Theme</p>
                  <p className="text-xs text-[#9CA3AF]">Dark Mode (Active)</p>
                </div>
              </div>
              <div className="w-12 h-6 rounded-full bg-[#10B981] flex items-center justify-end px-1">
                <div className="w-4 h-4 bg-white rounded-full"></div>
              </div>
            </div>

            <div className="p-4">
              <div className="flex items-center gap-3 mb-2">
                <Globe className="w-5 h-5 text-[#9CA3AF]" />
                <p className="text-sm text-white">Language</p>
              </div>
              <select
                value={settings.language}
                onChange={(e) => {
                  setSettings({ ...settings, language: e.target.value as 'en' | 'ur' });
                  handleSaveSettings();
                }}
                className="w-full h-10 px-3 bg-[#111827] border border-[#374151] rounded-lg text-white focus:outline-none focus:border-[#3B82F6]"
              >
                <option value="en">English</option>
                <option value="ur">Urdu</option>
              </select>
            </div>
          </div>

          {saveSuccess && (
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-3 flex items-center gap-2">
              <Check className="w-5 h-5 text-[#10B981]" />
              <p className="text-sm text-[#10B981]">Preferences saved</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Printer View
  if (currentSection === 'printer') {
    return (
      <div className="min-h-screen bg-[#111827] pb-24">
        <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentSection('main')} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Printer className="w-6 h-6 text-[#F59E0B]" />
              <h1 className="text-lg font-semibold">Printer Settings</h1>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-[#8B5CF6]/20 rounded-lg flex items-center justify-center">
                <Printer className="w-5 h-5 text-[#8B5CF6]" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Current Printer</p>
                <p className="text-xs text-[#9CA3AF]">Default Printer</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
            <h3 className="text-sm font-medium text-white mb-3">Select Printer</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#10B981]/20 rounded flex items-center justify-center">
                  <Check className="w-3 h-3 text-[#10B981]" />
                </div>
                <span className="text-xs text-[#9CA3AF]">Printer 1</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-[#10B981]/20 rounded flex items-center justify-center">
                  <Check className="w-3 h-3 text-[#10B981]" />
                </div>
                <span className="text-xs text-[#9CA3AF]">Printer 2</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Settings Menu
  return (
    <div className="min-h-screen bg-[#111827] pb-24">
      <div className="bg-[#1F2937] border-b border-[#374151] px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors active:scale-95">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-6 h-6 text-[#8B5CF6]" />
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Account */}
        <div>
          <h2 className="text-xs font-medium text-[#9CA3AF] mb-3">ACCOUNT</h2>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl divide-y divide-[#374151]">
            <button onClick={() => setCurrentSection('profile')} className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#3B82F6]/10 rounded-lg flex items-center justify-center">
                  <UserIcon className="w-5 h-5 text-[#3B82F6]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Profile Settings</p>
                  <p className="text-xs text-[#9CA3AF]">Manage your account</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>
          </div>
        </div>

        {/* Business */}
        <div>
          <h2 className="text-xs font-medium text-[#9CA3AF] mb-3">BUSINESS</h2>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl divide-y divide-[#374151]">
            <button onClick={() => setCurrentSection('business')} className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#10B981]/10 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-[#10B981]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Business Settings</p>
                  <p className="text-xs text-[#9CA3AF]">Company info & preferences</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>

            <button onClick={() => setCurrentSection('modules')} className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#8B5CF6]/10 rounded-lg flex items-center justify-center">
                  <SettingsIcon className="w-5 h-5 text-[#8B5CF6]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Module Settings</p>
                  <p className="text-xs text-[#9CA3AF]">Enable/disable modules</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>
          </div>
        </div>

        {/* System */}
        <div>
          <h2 className="text-xs font-medium text-[#9CA3AF] mb-3">SYSTEM</h2>
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl divide-y divide-[#374151]">
            <button onClick={() => setCurrentSection('permissions')} className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                  <Shield className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Permissions & Role</p>
                  <p className="text-xs text-[#9CA3AF]">View your access level</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>

            <button onClick={() => setCurrentSection('preferences')} className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#EC4899]/10 rounded-lg flex items-center justify-center">
                  <Palette className="w-5 h-5 text-[#EC4899]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">App Preferences</p>
                  <p className="text-xs text-[#9CA3AF]">Theme, language & more</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>

            <button onClick={() => setCurrentSection('printer')} className="w-full flex items-center justify-between p-4 hover:bg-[#374151]/30 transition-colors active:scale-[0.98]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#F59E0B]/10 rounded-lg flex items-center justify-center">
                  <Printer className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-white">Printer Settings</p>
                  <p className="text-xs text-[#9CA3AF]">Configure your printer</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#9CA3AF]" />
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4">
          <div className="text-center">
            <p className="text-xs text-[#9CA3AF] mb-1">Din Collection ERP</p>
            <p className="text-xs text-[#6B7280]">Version 1.0.0</p>
            <p className="text-xs text-[#6B7280] mt-2">© 2026 Din Collection</p>
          </div>
        </div>
      </div>
    </div>
  );
}