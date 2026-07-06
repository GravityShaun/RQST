export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Email is required.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validateDisplayName(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return "Display name must be at least 2 characters.";
  }

  if (trimmed.length > 120) {
    return "Display name must be 120 characters or fewer.";
  }

  return null;
}

export function validatePassword(value: string): string | null {
  if (value.length < 8) {
    return "Password must be at least 8 characters.";
  }

  if (value.length > 128) {
    return "Password must be 128 characters or fewer.";
  }

  return null;
}

export function validateConfirmPassword(password: string, confirmPassword: string): string | null {
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }

  return null;
}
