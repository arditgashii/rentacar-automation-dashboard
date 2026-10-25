import { forwardRef } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white border-accent hover:bg-accent-hover hover:border-accent-hover",
  secondary: "bg-surface text-ink border-line hover:bg-hover",
  ghost: "bg-transparent text-ink border-transparent hover:bg-hover",
  danger: "bg-fail text-white border-fail hover:bg-[#a92e24] hover:border-[#a92e24]",
};

const SIZES: Record<Size, string> = {
  sm: "h-7 px-2.5 text-sm gap-1.5",
  md: "h-8 px-3 text-sm gap-2",
};

/** The classes of a button, for links that look like one. */
export function buttonClass({ variant = "secondary", size = "md", icon = false }: { variant?: Variant; size?: Size; icon?: boolean } = {}): string {
  return cn(
    "inline-flex shrink-0 items-center justify-center rounded-md border font-medium whitespace-nowrap",
    "transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    VARIANTS[variant],
    SIZES[size],
    icon && (size === "sm" ? "w-7 px-0" : "w-8 px-0"),
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon = false, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonClass({ variant, size, icon }), className)}
      {...props}
    />
  );
});
