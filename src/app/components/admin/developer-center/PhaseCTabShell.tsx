import React from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/app/components/ui/card';

interface Props {
  title: string;
  phase: string;
  blurb: string;
  initialQuery?: string;
}

/** Read-only placeholder until the matching Phase C tab ships (C2–C6). */
export function PhaseCTabShell({ title, phase, blurb, initialQuery }: Props) {
  return (
    <Card className="border-border bg-card/40">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-400" />
          {title}
        </CardTitle>
        <CardDescription>{blurb}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-violet-300/90 font-medium">Coming in {phase} — read-only diagnostics only.</p>
        <p className="text-muted-foreground">
          No repair queue, void, sync, seed, archive, or apply actions. Service logic not wired in C1.
        </p>
        {initialQuery ? (
          <div className="rounded-md border border-border bg-input-background/60 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Deep-link query (q)</p>
            <p className="font-mono text-gray-200">{initialQuery}</p>
            <p className="text-xs text-muted-foreground mt-1">Preserved from URL for Phase C trace tabs.</p>
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">Optional deep link: add ?q=REF to the URL when this tab ships.</p>
        )}
      </CardContent>
    </Card>
  );
}
