import React from "react";
import { ValidationResult } from "@/lib/validation";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  validation?: ValidationResult;
}

const Input: React.FC<InputProps> = ({ label, error, validation, className = "", ...props }) => {
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Call the parent's onBlur handler if provided
    if (props.onBlur) {
      props.onBlur(e);
    }
  };

  const hasError = error || (validation && !validation.isValid);
  const errorMessage = error || validation?.message;

  return (
    <div className="space-y-2">
      <label htmlFor={props.id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        {...props}
        className={`
          block w-full px-3 py-2 border rounded-md shadow-sm placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
          ${hasError ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300"}
          ${className}
        `}
        onBlur={handleBlur}
      />
      {hasError && <p className="text-sm text-red-600">{errorMessage}</p>}
    </div>
  );
};

export default Input;
