import React from 'react';
import { Button } from "./button";
import { LucideIcon } from 'lucide-react';
import { cn } from "./utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className
}) => {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center h-[60vh] text-center p-8 border-2 border-dashed rounded-xl",
        className
      )}
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.5)',
        borderColor: 'var(--color-border-primary)',
        borderRadius: 'var(--radius-xl)'
      }}
    >
      <div 
        className="p-4 rounded-full mb-6"
        style={{
          backgroundColor: 'var(--color-bg-card)',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 0 0 4px rgba(31, 41, 55, 0.5)'
        }}
      >
        <Icon 
          size={48} 
          style={{ color: 'var(--color-text-tertiary)' }}
        />
      </div>
      <h3 
        className="text-xl font-bold mb-2"
        style={{ color: 'var(--color-text-primary)' }}
      >
        {title}
      </h3>
      <p 
        className="max-w-sm mb-8"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {description}
      </p>
      <Button 
        variant="outline" 
        onClick={onAction}
        style={{
          borderColor: 'var(--color-border-secondary)',
          color: 'var(--color-primary)'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-primary)';
          e.currentTarget.style.backgroundColor = 'var(--color-hover-bg)';
          e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-primary)';
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
        }}
      >
        {actionLabel}
      </Button>
    </div>
  );
};