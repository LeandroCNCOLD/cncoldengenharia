import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

const SIZE = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" };

export function LoadingSpinner({ size = "md", label, className = "" }: LoadingSpinnerProps) {
  return (
    <div className={`inline-flex items-center gap-2 text-slate-500 ${className}`}>
      <Loader2 className={`${SIZE[size]} animate-spin`} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}
