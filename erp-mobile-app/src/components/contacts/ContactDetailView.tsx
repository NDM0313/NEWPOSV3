import { ArrowLeft, Phone, Mail, MapPin, DollarSign, Edit2, User as UserIcon, Clock, Briefcase } from 'lucide-react';
import type { Contact, ContactRole } from '../../api/contacts';
import type { User } from '../../types';

interface ContactDetailViewProps {
  contact: Contact;
  onBack: () => void;
  onEdit: (contact: Contact) => void;
  user: User;
}

export function ContactDetailView({ contact, onBack, onEdit, user }: ContactDetailViewProps) {
  const getRoleBadgeColor = (role: ContactRole) => {
    switch (role) {
      case 'customer':
        return 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/30';
      case 'supplier':
        return 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30';
      case 'worker':
        return 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30';
      default:
        return 'bg-[#6B7280]/10 text-[#6B7280] border-[#6B7280]/30';
    }
  };

  const getRoleLabel = (role: ContactRole) => role.charAt(0).toUpperCase() + role.slice(1);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const canEdit = user.role === 'admin' || user.role === 'manager';

  return (
    <div className="min-h-screen pb-40 bg-[#111827]">
      <div className="bg-[#1F2937] border-b border-[#374151] sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="p-2 hover:bg-[#374151] rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
            <h1 className="text-white font-semibold text-base">Contact Details</h1>
          </div>
          {canEdit && (
            <button onClick={() => onEdit(contact)} className="p-2 bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-lg transition-colors">
              <Edit2 size={18} className="text-white" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-6 space-y-6">
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-full flex items-center justify-center flex-shrink-0">
              <UserIcon size={28} className="text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-white text-xl font-bold mb-2">{contact.name}</h2>
              <div className="flex flex-wrap gap-1.5">
                {contact.roles.map((role) => (
                  <span key={role} className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${getRoleBadgeColor(role)}`}>
                    {getRoleLabel(role)}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${contact.status === 'active' ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
            <span className={`text-sm font-medium ${contact.status === 'active' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {contact.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
          <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
            <Phone size={18} className="text-[#8B5CF6]" />
            Contact Information
          </h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0">
                <Phone size={18} className="text-[#6B7280]" />
              </div>
              <div>
                <p className="text-xs text-[#9CA3AF]">Phone</p>
                <p className="text-white font-medium">{contact.phone}</p>
              </div>
            </div>
            {contact.email && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Mail size={18} className="text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Email</p>
                  <p className="text-white font-medium">{contact.email}</p>
                </div>
              </div>
            )}
            {(contact.city || contact.address) && (
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-[#111827] rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPin size={18} className="text-[#6B7280]" />
                </div>
                <div>
                  <p className="text-xs text-[#9CA3AF]">Location</p>
                  <p className="text-white font-medium">
                    {contact.address && <span>{contact.address}<br /></span>}
                    {contact.city}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {contact.roles.includes('worker') && contact.workerType && (
          <div className="bg-[#1F2937] border border-[#F59E0B]/30 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Briefcase size={18} className="text-[#F59E0B]" />
              Worker Details
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-[#9CA3AF] mb-1">Worker Type</p>
                <p className="text-white font-medium capitalize">{contact.workerType}</p>
              </div>
              {contact.workerRate && (
                <div>
                  <p className="text-xs text-[#9CA3AF] mb-1">Rate</p>
                  <p className="text-white font-medium">Rs. {contact.workerRate} per piece/day</p>
                </div>
              )}
            </div>
          </div>
        )}

        {(contact.roles.includes('customer') || contact.roles.includes('supplier')) && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <DollarSign size={18} className="text-[#8B5CF6]" />
              Account Balance
            </h3>
            <div className="bg-[#111827] rounded-xl p-6 text-center">
              <div className="text-sm text-[#9CA3AF] mb-2">
                {contact.balance > 0 ? 'Amount Receivable' : contact.balance < 0 ? 'Amount Payable' : 'Settled'}
              </div>
              <div className={`text-3xl font-bold mb-2 ${contact.balance > 0 ? 'text-[#EF4444]' : contact.balance < 0 ? 'text-[#10B981]' : 'text-[#6B7280]'}`}>
                Rs. {Math.abs(contact.balance).toLocaleString()}
              </div>
              {contact.creditLimit && contact.roles.includes('customer') && (
                <div className="text-xs text-[#6B7280] mt-2 pt-2 border-t border-[#374151]">
                  Credit Limit: Rs. {contact.creditLimit.toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        {(contact.createdAt || contact.updatedAt) && (
          <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
              <Clock size={18} className="text-[#8B5CF6]" />
              Activity
            </h3>
            <div className="space-y-3">
              {contact.createdAt && (
                <div className="bg-[#111827] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <UserIcon size={14} className="text-[#10B981]" />
                    <span className="text-sm font-medium text-white">Contact Created</span>
                  </div>
                  <div className="text-xs text-[#6B7280]">{formatDateTime(contact.createdAt)}</div>
                </div>
              )}
              {contact.updatedAt && contact.updatedAt !== contact.createdAt && (
                <div className="bg-[#111827] rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Edit2 size={14} className="text-[#3B82F6]" />
                    <span className="text-sm font-medium text-white">Last Updated</span>
                  </div>
                  <div className="text-xs text-[#6B7280]">{formatDateTime(contact.updatedAt)}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
