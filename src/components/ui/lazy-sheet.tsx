"use client";

import type { ReactNode } from "react";

import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export function LazySheet({
  children,
  className,
  description,
  onOpenChange,
  open,
  side,
  title,
}: {
  children: ReactNode;
  className?: string;
  description: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  side: "left" | "right";
  title: string;
}) {
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className={className} side={side}>
        <SheetTitle className={className?.includes("p-0") ? "sr-only" : undefined}>{title}</SheetTitle>
        <SheetDescription className={className?.includes("p-0") ? "sr-only" : undefined}>{description}</SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );
}
