import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { DialogContent } from "@/shared/components/ui/dialog";
import { cn } from "@/shared/utils/utils";

export const CashDialogContent = forwardRef<ElementRef<typeof DialogContent>, ComponentPropsWithoutRef<typeof DialogContent>>(({ className, children, ...props }, ref) => (
  <DialogContent ref={ref} {...props} className={cn("w-[calc(100%-2rem)] max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain p-4 sm:p-6 [&>*]:min-w-0 [&_[role=heading]]:pr-6 [&_p]:break-words", className)}>
    {children}
  </DialogContent>
));
CashDialogContent.displayName = "CashDialogContent";
