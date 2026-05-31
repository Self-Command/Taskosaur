import React from "react";
import { Button } from "@/components/ui/button";
import { HiPlus } from "react-icons/hi2";

export interface ActionButtonProps {
  id?: string;
  "data-automation-id"?: string;
  form?: string;
  "aria-label"?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "outline" | "ghost" | "secondary" | "link" | "destructive";
  onClick?: (any) => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  isLoading?: boolean;
  loadingText?: string;
  asChild?: boolean;
  showPlusIcon?: boolean;
  secondary?: boolean;
  primary?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  onMouseEnter?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

const Spinner = () => (
  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
  </svg>
);

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      leftIcon,
      rightIcon,
      children,
      className = "",
      variant = "default",
      onClick,
      type = "button",
      disabled = false,
      isLoading = false,
      loadingText,
      asChild = false,
      showPlusIcon = false,
      secondary = false,
      primary = false,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;
    // Define semantic classes based on props
    const getSemanticClasses = () => {
      let classes = "actionbutton-base";

      if (secondary) {
        classes += " actionbutton-secondary";
      } else if (primary) {
        classes += " actionbutton-primary";
      } else {
        switch (variant) {
          case "outline":
            classes += " actionbutton-outline";
            break;
          case "ghost":
            classes += " actionbutton-ghost";
            break;
          case "destructive":
            classes += " actionbutton-destructive";
            break;
          default:
            classes += " actionbutton-default";
        }
      }

      return classes;
    };

    // Combine all classes
    const combinedClasses = `${getSemanticClasses()} ${className}`;

    if (asChild) {
      return (
        <Button
          ref={ref}
          variant={variant}
          className={combinedClasses}
          onClick={isLoading ? undefined : onClick}
          type={type}
          disabled={isDisabled}
          asChild
          {...props}
        >
          {children}
        </Button>
      );
    }

    const displayText = isLoading && loadingText ? loadingText : children;

    return (
      <Button
        ref={ref}
        variant={variant}
        className={combinedClasses}
        onClick={isLoading ? undefined : onClick}
        type={type}
        disabled={isDisabled}
        {...props}
      >
        {isLoading && <span className="flex-shrink-0"><Spinner /></span>}
        {!isLoading && showPlusIcon && (
          <span className="flex-shrink-0">
            <HiPlus className="w-4 h-4" />
          </span>
        )}
        {!isLoading && leftIcon && <span className="flex-shrink-0">{leftIcon}</span>}
        <span className="truncate">{displayText}</span>
        {!isLoading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </Button>
    );
  }
);

ActionButton.displayName = "ActionButton";

export default ActionButton;
