import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background text-foreground hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Küchentisch-Varianten (design_handoff_rezeptbibliothek_2a)
        tomato:
          "bg-tomato text-white font-semibold shadow-primary hover:bg-tomato-str",
        ink: "bg-ink text-white font-semibold hover:bg-ink-hover",
        inkOutline:
          "border-[1.5px] border-ink bg-transparent text-ink font-semibold hover:bg-ink hover:text-white",
        paper:
          "border border-line bg-white text-ink font-semibold hover:border-tomato",
        gold: "bg-gold text-gold-ink font-bold",
        cookOutline:
          "border-[1.5px] border-[oklch(0.44_0.04_50)] bg-transparent text-[oklch(0.9_0.02_80)] font-semibold hover:border-gold hover:text-white",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9 rounded-md",
        // Pill-Größen aus dem Handoff (Höhe in px)
        "pill-xs": "h-[34px] rounded-full px-[15px] text-[13.5px] [&_svg:not([class*='size-'])]:size-[15px]",
        "pill-sm": "h-[38px] rounded-full px-[15px] gap-2 text-[13.5px] [&_svg:not([class*='size-'])]:size-4",
        pill: "h-[42px] rounded-full px-5 gap-[9px] text-[14.5px] [&_svg:not([class*='size-'])]:size-[17px]",
        "pill-md": "h-[46px] rounded-full px-[22px] gap-[9px] text-[15px] [&_svg:not([class*='size-'])]:size-[17px]",
        "pill-lg": "h-[50px] rounded-full px-6 gap-[9px] text-[15.5px] [&_svg:not([class*='size-'])]:size-[18px]",
        "pill-xl": "h-[60px] rounded-full px-[26px] gap-[10px] text-[16px] [&_svg:not([class*='size-'])]:size-[19px]",
        "icon-round": "size-[34px] rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
