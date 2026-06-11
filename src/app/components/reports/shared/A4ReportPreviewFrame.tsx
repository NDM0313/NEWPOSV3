import React, { useLayoutEffect, useRef, useState } from 'react';
import type { ReportPrintOrientation } from './reportPrintConfig';

/** CSS mm → px at 96dpi (matches browser print layout). */
const MM_TO_PX = 96 / 25.4;

const A4_PORTRAIT = { widthMm: 210, heightMm: 297 };
const A4_LANDSCAPE = { widthMm: 297, heightMm: 210 };

function pageSizePx(orientation: ReportPrintOrientation) {
  const size = orientation === 'landscape' ? A4_LANDSCAPE : A4_PORTRAIT;
  return {
    widthPx: size.widthMm * MM_TO_PX,
    minHeightPx: size.heightMm * MM_TO_PX,
  };
}

export interface A4ReportPreviewFrameProps {
  orientation?: ReportPrintOrientation;
  children: React.ReactNode;
  /** Show hint when preview is scaled below 100%. */
  showScaleHint?: boolean;
  className?: string;
}

/**
 * Settings-sidebar A4 preview frame — scales full-size `.pdf-document` to fit
 * available width without clipping. Print/PDF capture uses unscaled content.
 */
export function A4ReportPreviewFrame({
  orientation = 'portrait',
  children,
  showScaleHint = true,
  className = '',
}: A4ReportPreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [contentHeightPx, setContentHeightPx] = useState(0);

  const { widthPx, minHeightPx } = pageSizePx(orientation);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateScale = () => {
      const available = container.clientWidth - 8;
      if (available <= 0) return;
      setScale(Math.min(1, available / widthPx));
    };

    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(container);
    return () => ro.disconnect();
  }, [widthPx]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;

    const measure = () => {
      setContentHeightPx(Math.max(content.offsetHeight, minHeightPx));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    return () => ro.disconnect();
  }, [minHeightPx, children, orientation]);

  const scaledW = widthPx * scale;
  const scaledH = contentHeightPx * scale;

  return (
    <div className={`w-full a4-report-preview-frame ${className}`.trim()}>
      <div
        ref={containerRef}
        className="overflow-auto w-full max-h-[min(70vh,720px)] rounded-sm"
      >
        <div className="flex justify-center py-2 px-1">
          <div
            className="bg-white shadow-xl rounded-sm shrink-0"
            style={{ width: scaledW, height: scaledH || undefined }}
          >
            <div
              ref={contentRef}
              style={{
                width: widthPx,
                minHeight: minHeightPx,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
      {showScaleHint && scale < 0.995 ? (
        <p className="text-[10px] text-gray-500 text-center mt-1.5 px-1">
          Preview scaled to fit panel · print/PDF uses full A4 size
        </p>
      ) : null}
    </div>
  );
}
