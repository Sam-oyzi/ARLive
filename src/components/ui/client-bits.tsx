"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button, type ButtonSize, type ButtonVariant } from "./button";

export function SubmitButton({
  children,
  pendingText,
  variant,
  size,
  className,
  disabled,
}: {
  children: ReactNode;
  pendingText?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled}>
      {pending && <LoaderCircle className="animate-spin" />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}

export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size={label ? "sm" : "icon-sm"}
      className={className}
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label={label ?? "Copy"}
    >
      {copied ? <Check className="text-emerald-600" /> : <Copy />}
      {label}
    </Button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={`size-4 animate-spin ${className ?? ""}`} />;
}
