import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { VisuallyHidden } from "./visually-hidden";

/**
 * Accessible Dialog Component
 * Ensures all dialogs have a title for screen readers
 */

interface AccessibleDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogContent> {
  /** Title for the dialog (required for accessibility) */
  title: string;
  /** Description for the dialog (optional but recommended) */
  description?: string;
  /** Whether to visually hide the title (defaults to false) */
  hideTitle?: boolean;
  /** Custom header content (will be shown if hideTitle is false) */
  headerContent?: React.ReactNode;
  /** Footer content */
  footerContent?: React.ReactNode;
}

export const AccessibleDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  AccessibleDialogContentProps
>(
  (
    {
      title,
      description,
      hideTitle = false,
      headerContent,
      footerContent,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <DialogContent ref={ref} {...props}>
        <DialogHeader className={hideTitle ? "sr-only" : undefined}>
          {hideTitle ? (
            <VisuallyHidden>
              <DialogTitle>{title}</DialogTitle>
            </VisuallyHidden>
          ) : (
            <DialogTitle>{title}</DialogTitle>
          )}
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {headerContent}
        {children}
        {footerContent && <DialogFooter>{footerContent}</DialogFooter>}
      </DialogContent>
    );
  }
);

AccessibleDialogContent.displayName = "AccessibleDialogContent";

export { Dialog };
