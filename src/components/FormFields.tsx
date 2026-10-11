import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}

export function Field({ label, children, required, className }: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-stone-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-lg border border-stone-300 bg-white text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition';

export const selectClass = inputClass;

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${inputClass} ${props.className ?? ''}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${selectClass} ${props.className ?? ''}`} />;
}
