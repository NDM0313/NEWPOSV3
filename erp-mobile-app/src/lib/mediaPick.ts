/** True when `accept` allows image capture (camera). */
export function acceptAllowsCamera(accept: string): boolean {
  const a = accept.toLowerCase();
  return (
    a.includes('image') ||
    a.includes('.png') ||
    a.includes('.jpg') ||
    a.includes('.jpeg') ||
    a.includes('.webp') ||
    a.includes('.gif')
  );
}
