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
      "bg-gray-900/50 border-2 border-dashed border-gray-800 rounded-xl",
      className
    )}>
      <div className="bg-gray-800 p-4 rounded-full mb-6 ring-4 ring-gray-800/50">
        <Icon size={48} className="text-gray-500" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 max-w-sm mb-8">{description}</p>
      <Button 
        variant="outline" 
        onClick={onAction}
        className="border-gray-700 text-blue-400 hover:text-blue-300 hover:bg-gray-800 hover:border-blue-500/50 transition-all"
      >
        {actionLabel}
      </Button>
    </div>
  );
};