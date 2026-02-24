import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Textarea } from '@/app/components/ui/textarea';
import { cn } from '@/app/components/ui/utils';
import { publicContactService } from '@/app/services/publicContactService';
import { CheckCircle2, Phone, Mail, MapPin } from 'lucide-react';

type ContactType = 'customer' | 'supplier' | 'worker';

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  customer: 'Customer',
  supplier: 'Supplier',
  worker: 'Worker',
};

/** Simple fingerprint for rate limiting (screen + user agent hash) */
function getClientFingerprint(): string {
  try {
    const s = `${navigator.userAgent}|${screen.width}x${screen.height}|${new Date().getTimezoneOffset()}`;
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h = ((h << 5) - h) + c;
      h = h & h;
    }
    return String(Math.abs(h));
  } catch {
    return 'unknown';
  }
}

export const PublicContactForm = () => {
  const [contactType, setContactType] = useState<ContactType>('customer');
  const [typeLocked, setTypeLocked] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [notes, setNotes] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const leadSource = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('source') || '';
  }, []);

  const referralCode = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('ref') || '';
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type')?.toLowerCase();
    if (type === 'customer' || type === 'supplier' || type === 'worker') {
      setContactType(type as ContactType);
      setTypeLocked(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const captchaNum = parseInt(captchaAnswer, 10);
    if (isNaN(captchaNum)) {
      setError('Please answer the security question');
      return;
    }

    setSubmitting(true);
    try {
      const result = await publicContactService.register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        mobile: mobile.trim(),
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        country: country.trim() || undefined,
        notes: notes.trim() || undefined,
        contact_type: contactType,
        lead_source: leadSource || undefined,
        referral_code: referralCode || undefined,
        device_info: navigator.userAgent,
        honeypot: honeypot || undefined,
        captcha_answer: captchaNum,
        client_fingerprint: getClientFingerprint(),
      });

      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900/80 border border-gray-700 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Thank You!</h1>
          <p className="text-gray-400 mb-6">
            Your information has been received. We will get in touch with you soon.
          </p>
          <p className="text-sm text-gray-500">
            DIN Couture
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-gray-900/80 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600/20 border-b border-gray-700 px-6 py-4">
          <h1 className="text-xl font-bold text-white">Contact Registration</h1>
          <p className="text-sm text-gray-400 mt-0.5">DIN Couture – We&apos;d love to hear from you</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Section 1: Contact Type */}
          <div>
            <Label className="text-white font-medium mb-3 block">Contact Type</Label>
            <div className="flex gap-4">
              {(['customer', 'supplier', 'worker'] as ContactType[]).map((t) => (
                <label
                  key={t}
                  className={cn(
                    'flex items-center gap-2 cursor-pointer',
                    typeLocked && 'opacity-75'
                  )}
                >
                  <input
                    type="radio"
                    name="contactType"
                    value={t}
                    checked={contactType === t}
                    onChange={() => !typeLocked && setContactType(t)}
                    disabled={typeLocked}
                    className="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600"
                  />
                  <span className="text-gray-300">{CONTACT_TYPE_LABELS[t]}</span>
                </label>
              ))}
            </div>
            {typeLocked && <p className="text-xs text-gray-500 mt-1">Pre-selected from link</p>}
          </div>

          {/* Section 2: Basic Info */}
          <div className="space-y-4">
            <Label className="text-white font-medium block">Basic Information</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400 text-xs">First Name *</Label>
                <Input
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Last Name *</Label>
                <Input
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 text-xs">Mobile Number *</Label>
              <div className="relative mt-1">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  required
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="0300-1234567"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 text-xs">Email (optional)</Label>
              <div className="relative mt-1">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 text-xs">Address (optional)</Label>
              <div className="relative mt-1">
                <MapPin size={16} className="absolute left-3 top-3 text-gray-500" />
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address"
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400 text-xs">City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <Label className="text-gray-400 text-xs">Country</Label>
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="Pakistan"
                  className="mt-1 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div>
              <Label className="text-gray-400 text-xs">Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional information..."
                rows={3}
                className="mt-1 bg-gray-800 border-gray-700 text-white resize-none"
              />
            </div>
          </div>

          {/* Honeypot - hidden from users */}
          <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
            <Label>Leave blank</Label>
            <Input
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          {/* Captcha */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
            <Label className="text-gray-300 block mb-2">Security question *</Label>
            <p className="text-sm text-gray-400 mb-2">What is 3 + 4?</p>
            <Input
              required
              type="number"
              min={0}
              max={20}
              value={captchaAnswer}
              onChange={(e) => setCaptchaAnswer(e.target.value)}
              placeholder="Your answer"
              className="bg-gray-900 border-gray-700 text-white w-24"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-blue-600 hover:bg-blue-500 text-white font-medium"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </Button>
        </form>
      </div>
    </div>
  );
};
