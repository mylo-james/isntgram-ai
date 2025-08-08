import React from "react";

interface FormProps {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  errorMessage?: string;
  className?: string;
}

const Form: React.FC<FormProps> = ({ onSubmit, children, errorMessage, className = "" }) => {
  return (
    <form onSubmit={onSubmit} className={`space-y-6 ${className}`}>
      {errorMessage && (
        <div className="text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200">{errorMessage}</div>
      )}
      {children}
    </form>
  );
};

export default Form;
