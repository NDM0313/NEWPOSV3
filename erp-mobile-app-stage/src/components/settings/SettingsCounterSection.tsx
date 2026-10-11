import { useState } from 'react';

import { Lock, Users } from 'lucide-react';

import { SettingsRow } from './settingsUi';

import { getFunctionalRoleLabel } from '../../config/functionalRoles';

import {

  COUNTER_SESSION_POLICY_OPTIONS,

  getDevicePinMaxAgeMs,

  setCounterSessionPolicy,

  type CounterSessionPolicyId,

} from '../../lib/counterSessionPolicy';

import { setPinLockSettings } from '../../lib/pinLock';

import { setSharedCounterModeEnabled } from '../../lib/sharedCounterMode';

import type { EnrolledCounterWorker } from '../../lib/counterWorkerRegistry';



export interface SettingsCounterSectionProps {

  companyId: string | null;

  counterSlotCount: number;

  lockScreenProfiles: EnrolledCounterWorker[];

  lockProfilesLoading: boolean;

  sharedCounterMode: boolean;

  setSharedCounterMode: (v: boolean) => void;

  counterSessionPolicy: CounterSessionPolicyId;

  setCounterSessionPolicyState: (id: CounterSessionPolicyId) => void;

  onOpenCounterPinEnroll: () => void;

  onRemoveWorker: (userId: string) => void | Promise<void>;

}



export function SettingsCounterSection({

  companyId,

  counterSlotCount,

  lockScreenProfiles,

  lockProfilesLoading,

  sharedCounterMode,

  setSharedCounterMode,

  counterSessionPolicy,

  setCounterSessionPolicyState,

  onOpenCounterPinEnroll,

  onRemoveWorker,

}: SettingsCounterSectionProps) {

  const [showDetails, setShowDetails] = useState(false);



  return (

    <>

      {companyId ? (

        <SettingsRow

          icon={Users}

          iconColor="bg-emerald-500/20"

          title="Counter tablet PIN"

          subtitle={`POS / Expense PIN switch · ${counterSlotCount} enrolled`}

          onClick={onOpenCounterPinEnroll}

        />

      ) : null}

      {counterSlotCount === 0 && companyId ? (

        <p className="text-xs text-amber-200/90 px-1 -mt-1">

          Abhi koi worker enrolled nahi — upar Counter tablet PIN tap karke employee ko PIN assign karein (All Branches

          par bhi).

        </p>

      ) : null}

      {companyId ? (

        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 space-y-3">

          <p className="text-xs text-[#9CA3AF] leading-relaxed">

            Har staff ka alag 4-digit PIN is device par save hota hai. Tablet par ek hi Admin session rehti hai — PIN

            sirf local identity switch karta hai, Supabase logout nahi.

          </p>

          <button

            type="button"

            onClick={() => setShowDetails((v) => !v)}

            className="text-xs text-[#3B82F6] font-medium"

          >

            {showDetails ? 'Hide details' : 'How lock screen users work'}

          </button>

          {showDetails && (

            <div className="text-xs text-[#9CA3AF] space-y-2 leading-relaxed border-t border-[#374151] pt-3">

              <p>Har bande ka alag PIN choose karein. Same PIN doosre user ka slot replace kar deti hai.</p>

              {lockProfilesLoading ? (

                <p className="text-[#6B7280]">Loading…</p>

              ) : lockScreenProfiles.length === 0 ? (

                <p className="text-amber-200/90">No counter users yet — enroll via Counter tablet PIN above.</p>

              ) : (

                <ul className="space-y-2">

                  {lockScreenProfiles.map((p) => (

                    <li

                      key={p.pinHash}

                      className="flex items-center justify-between gap-2 rounded-lg bg-[#111827] border border-[#374151] px-3 py-2"

                    >

                      <div className="min-w-0">

                        <p className="text-sm font-medium text-white truncate">{p.displayName}</p>

                        {p.email ? <p className="text-[10px] text-[#6B7280] truncate">{p.email}</p> : null}

                      </div>

                      <div className="flex items-center gap-2 shrink-0">

                        <span className="text-[10px] text-[#9CA3AF]">

                          {p.role ? getFunctionalRoleLabel(p.role) : 'Staff'}

                        </span>

                        <button

                          type="button"

                          onClick={() => void onRemoveWorker(p.userId)}

                          className="text-[10px] text-red-400 hover:text-red-300 font-medium"

                        >

                          Remove

                        </button>

                      </div>

                    </li>

                  ))}

                </ul>

              )}

            </div>

          )}

          <label className="block text-xs font-medium text-[#9CA3AF]">PIN session freshness</label>

          <select

            value={counterSessionPolicy}

            onChange={(e) => {

              const id = e.target.value as CounterSessionPolicyId;

              setCounterSessionPolicy(id);

              setCounterSessionPolicyState(id);

              setPinLockSettings({ sessionMaxAgeMs: getDevicePinMaxAgeMs() });

            }}

            className="w-full px-3 py-2.5 bg-[#111827] border border-[#374151] rounded-lg text-white text-sm focus:outline-none focus:border-[#10B981]"

          >

            {COUNTER_SESSION_POLICY_OPTIONS.map((o) => (

              <option key={o.id} value={o.id}>

                {o.label}

              </option>

            ))}

          </select>

        </div>

      ) : null}

      <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-4 flex items-center justify-between gap-3">

        <div className="flex items-center gap-3 min-w-0">

          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#10B981]/20 shrink-0">

            <Lock className="w-5 h-5 text-[#10B981]" />

          </div>

          <div className="min-w-0">

            <p className="font-medium text-white text-sm">Shared Counter Mode</p>

            <p className="text-xs text-[#9CA3AF]">

              {counterSlotCount === 0

                ? 'Pehle worker enroll karein — phir auto ON ho sakta hai'

                : `Boot / logout → POS lock (${counterSlotCount} enrolled)`}

            </p>

          </div>

        </div>

        <button

          type="button"

          role="switch"

          aria-checked={sharedCounterMode}

          disabled={counterSlotCount === 0}

          onClick={() => {

            const next = !sharedCounterMode;

            setSharedCounterModeEnabled(next);

            setSharedCounterMode(next);

          }}

          className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium ${

            sharedCounterMode ? 'bg-emerald-600/30 text-emerald-200' : 'bg-[#374151] text-[#9CA3AF]'

          } disabled:opacity-40`}

        >

          {sharedCounterMode ? 'On' : 'Off'}

        </button>

      </div>

    </>

  );

}


