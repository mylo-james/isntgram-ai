import React from "react";
import Spinner from "./Spinner";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary" | "outline" | "destructive";
  size?: "sm" | "md" | "lg";
}

const Button: React.FC<ButtonProps> = ({
  children,
  loading = false,
  loadingText,
  variant = "primary",
  size = "md",
  type,
  disabled,
  className = "",
  ...props
}) => {
  const baseClasses = "ui-action";

  const variantClasses = {
    primary: "ui-primary",
    secondary: "ui-secondary",
    outline: "ui-quiet",
    destructive: "ui-destructive",
  };

  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };

  const isDisabled = disabled || loading;
  const buttonType = type ?? "button";

  return (
    <button
      {...props}
      type={buttonType}
      disabled={isDisabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading ? <Spinner size={24} label="" className="mr-2" /> : null}
      {loading && loadingText ? loadingText : children}
    </button>
  );
};

export default Button;
