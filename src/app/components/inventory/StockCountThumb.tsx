/**
 * Count-screen thumbnail using locked ProductImage signing path.
 * Empty/broken refs show a clear placeholder (not a blank dark square).
 */
import React from 'react';
import { Package } from 'lucide-react';
import { ProductImage } from '../products/ProductImage';
import { cn } from '../ui/utils';

type Props = {
  src?: string | null;
  alt?: string;
  className?: string;
  size?: 'sm' | 'md';
};

export function StockCountThumb({ src, alt = '', className, size = 'md' }: Props) {
  const box = size === 'sm' ? 'h-10 w-10' : 'h-14 w-14';
  const shell = cn(
    box,
    'shrink-0 rounded-md overflow-hidden border border-border bg-muted/40 flex items-center justify-center',
    className
  );

  if (!src) {
    return (
      <div className={shell} aria-label={alt || 'No product image'}>
        <Package className="h-5 w-5 text-muted-foreground/70" />
      </div>
    );
  }

  return (
    <div className={shell}>
      <ProductImage src={src} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}
