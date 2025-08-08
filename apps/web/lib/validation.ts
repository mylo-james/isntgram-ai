export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email) {
    return { isValid: false, message: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, message: "Please enter a valid email address" };
  }

  return { isValid: true };
};

export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, message: "Password is required" };
  }

  if (password.length < 8) {
    return {
      isValid: false,
      message: "Password must be at least 8 characters",
    };
  }

  return { isValid: true };
};

export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim() === "") {
    return { isValid: false, message: `${fieldName} is required` };
  }

  return { isValid: true };
};

export const validateUsername = (username: string): ValidationResult => {
  if (!username) {
    return { isValid: false, message: "Username is required" };
  }

  if (username.length < 3) {
    return {
      isValid: false,
      message: "Username must be at least 3 characters",
    };
  }

  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return {
      isValid: false,
      message: "Username can only contain letters, numbers, and underscores",
    };
  }

  return { isValid: true };
};
