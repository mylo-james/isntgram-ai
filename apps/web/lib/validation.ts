export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  const normalized = email.trim();
  if (!normalized) {
    return { isValid: false, message: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) {
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

  if (password.length > 128) {
    return {
      isValid: false,
      message: "Password must not exceed 128 characters",
    };
  }

  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
  if (!passwordRegex.test(password)) {
    return {
      isValid: false,
      message: "Password must contain at least one lowercase letter, one uppercase letter, and one number",
    };
  }

  return { isValid: true };
};

export const validateFullName = (fullName: string): ValidationResult => {
  const normalized = fullName.trim();
  if (!normalized) {
    return { isValid: false, message: "Full name is required" };
  }

  if (normalized.length < 2) {
    return {
      isValid: false,
      message: "Full name must be at least 2 characters",
    };
  }

  if (normalized.length > 100) {
    return {
      isValid: false,
      message: "Full name must not exceed 100 characters",
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
  const normalized = username.trim();
  if (!normalized) {
    return { isValid: false, message: "Username is required" };
  }

  if (normalized.length < 3) {
    return {
      isValid: false,
      message: "Username must be at least 3 characters",
    };
  }

  if (normalized.length > 30) {
    return {
      isValid: false,
      message: "Username must not exceed 30 characters",
    };
  }

  const usernameRegex = /^[a-z0-9_]+$/;
  if (!usernameRegex.test(normalized)) {
    return {
      isValid: false,
      message: "Username can only contain lowercase letters, numbers, and underscores",
    };
  }

  return { isValid: true };
};
