import { Loader2 } from 'lucide-react';

export function LoadingSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
      {label && <p className="text-sm text-stone-400">{label}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-6 text-center">
      <p className="text-red-700">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 text-sm text-red-600 underline">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ message, icon: Icon }: { message: string; icon?: typeof Loader2 }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && <Icon className="w-10 h-10 text-stone-300 mb-3" />}
      <p className="text-stone-400">{message}</p>
    </div>
  );
}
