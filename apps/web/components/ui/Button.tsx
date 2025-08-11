import React from "react";

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
  disabled,
  className = "",
  ...props
}) => {
  const baseClasses =
    "inline-flex items-center justify-center font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors";

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

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        ${baseClasses}
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading && (
        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {loading && loadingText ? loadingText : children}
    </button>
  );
};

export default Button;
