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
    <div className={cn(
      "flex flex-col items-center justify-center h-[60vh] text-center p-8",
      "bg-muted/40 border-2 border-dashed border-border rounded-xl",
      className
    )}>
      <div className="bg-muted p-4 rounded-full mb-6 ring-4 ring-gray-800/50">
        <Icon size={48} className="text-muted-foreground" />
      </div>
      <h3 className="text-xl font-bold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-sm mb-8">{description}</p>
      <Button 
        variant="outline" 
        onClick={onAction}
        className="border-border text-blue-400 hover:text-blue-300 hover:bg-muted hover:border-blue-500/50 transition-all"
      >
        {actionLabel}
      </Button>
    </div>
  );
};