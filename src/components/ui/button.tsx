import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary: "bg-action text-action-ink hover:bg-action-hover",
  secondary: "border border-border bg-surface text-ink hover:bg-surface-soft",
  ghost: "text-ink-secondary hover:bg-surface-soft hover:text-ink",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button className={cn(baseClasses, variantClasses[variant], className)} {...props} />
  );
}

interface LinkButtonProps {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function LinkButton({ href, variant = "primary", className, children }: LinkButtonProps) {
  return (
    <Link href={href} className={cn(baseClasses, variantClasses[variant], className)}>
      {children}
    </Link>
  );
}
