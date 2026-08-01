import React from 'react';
import {
  Phone,
  MessageCircle,
  Mail,
  MapPin,
  CreditCard,
  X,
  UserCheck,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { ContactProfileActivityTabs } from './ContactProfileActivityTabs';

interface ViewContactProfileProps {
  isOpen?: boolean;
  onClose?: () => void;
  contact?: {
    id?: number;
    uuid?: string;
    name: string;
    code?: string;
    type?: string;
    email?: string;
    phone?: string;
    receivables?: number;
    payables?: number;
    netBalance?: number;
    status?: string;
    branch?: string;
    address?: string;
    lastTransaction?: string;
    workerRole?: string;
    referralCode?: string | null;
    leadSource?: string | null;
    leadStatus?: string | null;
    createdFrom?: string | null;
  } | null;
  canApproveLead?: boolean;
  onApproveLead?: () => void;
}

function getDisplayRef(contact: NonNullable<ViewContactProfileProps['contact']>): string | null {
  if (contact.code && contact.code !== '—') return contact.code;
  if (contact.referralCode?.trim()) return `Ref: ${contact.referralCode.trim()}`;
  return null;
}

export const ViewContactProfile: React.FC<ViewContactProfileProps> = ({
  isOpen = true,
  onClose,
  contact,
  canApproveLead,
  onApproveLead,
}) => {
  if (!isOpen) return null;
  if (!contact) return null;

  const initials =
    (contact.name || '')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?';
  const typeLabel = (contact.type || 'contact').charAt(0).toUpperCase() + (contact.type || '').slice(1);
  const displayRef = getDisplayRef(contact);
  const isPublicLead = contact.createdFrom === 'public_form';

  return (
    <div className="fixed inset-0 z-50 bg-[var(--erp-overlay)] backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-background rounded-xl border border-border w-full max-w-7xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-card/95 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        )}

        <div className="flex flex-col lg:flex-row gap-6 p-6 overflow-hidden flex-1 min-h-0">
          <div className="w-full lg:w-1/4 bg-card border border-border rounded-xl p-6 flex flex-col items-center text-center h-fit lg:sticky lg:top-6 shrink-0">
            <Avatar className="h-32 w-32 mb-4 border-4 border-border shadow-xl">
              <AvatarFallback className="bg-blue-900 text-foreground text-2xl">{initials}</AvatarFallback>
            </Avatar>

            <h2 className="text-2xl font-bold text-foreground mb-2">{contact.name}</h2>

            <div className="flex flex-wrap gap-2 justify-center mb-4">
              <Badge className="bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border-blue-500/20">{typeLabel}</Badge>
              {displayRef && (
                <Badge variant="outline" className="border-border text-muted-foreground font-mono">
                  {displayRef}
                </Badge>
              )}
              {contact.leadStatus === 'New' && isPublicLead && (
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40">Pending lead</Badge>
              )}
              {contact.status && (
                <Badge variant="outline" className="border-border text-muted-foreground">
                  {contact.status}
                </Badge>
              )}
            </div>

            {isPublicLead && (
              <div className="w-full mb-4 rounded-lg border border-border bg-input-background/60 p-3 text-left text-sm space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Registration info</p>
                <p className="text-muted-foreground">
                  <span className="text-muted-foreground">Source:</span> {contact.leadSource?.trim() || '—'}
                </p>
                <p className="text-muted-foreground font-mono text-xs">
                  <span className="text-muted-foreground font-sans">Referral:</span>{' '}
                  {contact.referralCode?.trim() || '—'}
                </p>
                <p className="text-muted-foreground">
                  <span className="text-muted-foreground">Status:</span> {contact.leadStatus || '—'}
                </p>
              </div>
            )}

            {canApproveLead && onApproveLead && (
              <Button
                type="button"
                className="w-full mb-4 bg-amber-600 hover:bg-amber-500 text-foreground"
                onClick={onApproveLead}
              >
                <UserCheck size={16} className="mr-2" />
                Approve lead
              </Button>
            )}

            <div className="w-full space-y-4 text-left mb-8">
              {contact.address && (
                <div className="flex items-start gap-3 text-muted-foreground text-sm">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{contact.address}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <Phone className="h-4 w-4 shrink-0" />
                <span>{contact.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-3 text-muted-foreground text-sm">
                <Mail className="h-4 w-4 shrink-0" />
                <span>{contact.email || '—'}</span>
              </div>
              {contact.branch && (
                <div className="flex items-center gap-3 text-muted-foreground text-sm">
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span>{contact.branch}</span>
                </div>
              )}
            </div>

            <div className="w-full grid grid-cols-3 gap-2">
              <Button className="bg-green-600 hover:bg-green-500 text-foreground h-10 px-0" title="Call">
                <Phone size={18} />
              </Button>
              <Button
                variant="outline"
                className="border-green-600 text-green-500 hover:bg-green-900/10 h-10 px-0"
                title="WhatsApp"
              >
                <MessageCircle size={18} />
              </Button>
              <Button className="bg-muted hover:bg-gray-600 text-foreground h-10 px-0" title="Email">
                <Mail size={18} />
              </Button>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-6 min-w-0 min-h-0 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
              <Card className="bg-red-950/20 border-red-900/30">
                <CardContent className="p-6">
                  <p className="text-red-400 text-sm font-medium uppercase tracking-wide">
                    {contact.type === 'customer' ? 'Receivables' : 'Payables'}
                  </p>
                  <h3 className="text-3xl font-bold text-foreground mt-1">
                    $
                    {(contact.type === 'customer' ? contact.receivables ?? 0 : contact.payables ?? 0).toLocaleString()}
                  </h3>
                </CardContent>
              </Card>

              <Card className="bg-muted/40 border-border">
                <CardContent className="p-6">
                  <p className="text-muted-foreground text-sm font-medium uppercase tracking-wide">Net Balance</p>
                  <h3 className="text-2xl font-bold text-foreground mt-1">${(contact.netBalance ?? 0).toLocaleString()}</h3>
                  {contact.lastTransaction && (
                    <p className="text-xs text-muted-foreground mt-1">Last activity: {contact.lastTransaction}</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-green-950/20 border-green-900/30">
                <CardContent className="p-6">
                  <p className="text-[var(--erp-money-positive)] text-sm font-medium uppercase tracking-wide">Status</p>
                  <h3 className="text-3xl font-bold text-foreground mt-1 capitalize">{contact.status ?? 'Active'}</h3>
                  {contact.branch && <p className="text-xs text-muted-foreground mt-1">{contact.branch}</p>}
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 flex flex-col min-h-0 overflow-hidden border border-border rounded-xl bg-card/20 p-4">
              <ContactProfileActivityTabs contact={contact} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
