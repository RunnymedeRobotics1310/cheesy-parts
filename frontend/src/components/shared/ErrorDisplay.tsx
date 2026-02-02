import { AlertCircle } from 'lucide-react';

interface ErrorDisplayProps {
  error: Error | string | null;
  title?: string;
}

export function ErrorDisplay({ error, title = 'Error' }: ErrorDisplayProps) {
  if (!error) return null;

  const message = error instanceof Error ? error.message : error;

  return (
    <div className="rounded-md bg-destructive/10 p-4 border border-destructive/20">
      <div className="flex">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
        <div className="ml-3">
          <h3 className="text-sm font-medium text-destructive">{title}</h3>
          <p className="mt-1 text-sm text-destructive/80">{message}</p>
        </div>
      </div>
    </div>
  );
}
