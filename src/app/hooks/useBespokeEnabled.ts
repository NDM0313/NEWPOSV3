import { useSettings } from '@/app/context/SettingsContext';

/** Company-level customization / bespoke work orders (Settings → Enable customization). */
export function useBespokeEnabled(): boolean {
  const { businessSettings } = useSettings();
  return businessSettings.enableBespokeOrders === true;
}
