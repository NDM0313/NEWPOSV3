import { useCallback } from 'react';



import type { ThermalPaperSize } from '@/app/constants/thermalPrintDimensions';

import { getThermalDimensions } from '@/app/constants/thermalPrintDimensions';



export type { ThermalPaperSize };



const BODY_CLASS = 'print-thermal-receipt';

const PAGE_STYLE_ID = 'thermal-print-page-size';



function injectThermalPageStyle(paperSize: ThermalPaperSize): void {

  const dims = getThermalDimensions(paperSize);

  let el = document.getElementById(PAGE_STYLE_ID) as HTMLStyleElement | null;

  if (!el) {

    el = document.createElement('style');

    el.id = PAGE_STYLE_ID;

    document.head.appendChild(el);

  }

  el.textContent = `@media print { @page { size: ${dims.widthMm}mm auto; margin: ${dims.printMarginMm}mm; } }`;

}



function removeThermalPageStyle(): void {

  document.getElementById(PAGE_STYLE_ID)?.remove();

}



function applyThermalPrintMode(paperSize: ThermalPaperSize): void {

  const dims = getThermalDimensions(paperSize);

  const widthLabel = `${dims.widthMm}mm`;

  document.documentElement.style.setProperty('--thermal-width', widthLabel);

  document.documentElement.style.setProperty('--thermal-roll-width', widthLabel);

  document.body.classList.add(BODY_CLASS);

  document.body.dataset.thermalWidth = paperSize;

  injectThermalPageStyle(paperSize);

}



function clearThermalPrintMode(): void {

  document.body.classList.remove(BODY_CLASS);

  delete document.body.dataset.thermalWidth;

  document.documentElement.style.removeProperty('--thermal-width');

  document.documentElement.style.removeProperty('--thermal-roll-width');

  removeThermalPageStyle();

}



/**

 * Browser print for thermal receipts — sets @page roll width via injected CSS.

 */

export function useThermalPrint() {

  const printThermal = useCallback((paperSize: ThermalPaperSize = '58mm') => {

    const cleanup = () => {

      clearThermalPrintMode();

      window.removeEventListener('afterprint', cleanup);

    };



    applyThermalPrintMode(paperSize);

    window.addEventListener('afterprint', cleanup);

    window.print();

  }, []);



  return { printThermal, applyThermalPrintMode, clearThermalPrintMode: clearThermalPrintMode };

}



/** Standalone helper when hook is not available. */

export function triggerThermalPrint(paperSize: ThermalPaperSize = '58mm'): void {

  applyThermalPrintMode(paperSize);

  const cleanup = () => {

    clearThermalPrintMode();

    window.removeEventListener('afterprint', cleanup);

  };

  window.addEventListener('afterprint', cleanup);

  window.print();

}


