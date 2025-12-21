import React from "react";
import { ValidationResult } from "@/lib/validation";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  error?: string;
  validation?: ValidationResult;
}

const Input: React.FC<InputProps> = ({ label, error, validation, className = "", ...props }) => {
  const hasError = error || (validation && !validation.isValid);
  const errorMessage = error || validation?.message;
  const errorId = hasError ? `${props.id}-error` : undefined;
  const ariaDescribedBy = props["aria-describedby"];
  const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        {...props}
        aria-invalid={hasError ? true : undefined}
        aria-describedby={describedBy}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${hasError ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
          ${className}
        `}
      />
      {hasError && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
    </div>
  );
};

export default Input;
