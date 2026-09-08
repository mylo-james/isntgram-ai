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
  const baseClasses =
    "inline-flex min-h-11 min-w-11 items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors";

  const variantClasses = {
    primary:
      "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed",
    secondary:
      "bg-white text-gray-800 border border-gray-300 hover:bg-gray-50 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed",
    outline:
      "bg-transparent text-blue-600 border border-transparent hover:underline focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed",
    destructive:
      "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500 disabled:opacity-60 disabled:cursor-not-allowed",
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
