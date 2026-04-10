// Email validation regex - matches the backend validation
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const validateEmail = (email: string): { isValid: boolean; error?: string } => {
  if (!email || email.trim().length === 0) {
    return { isValid: false, error: 'Email is required' }
  }

  const trimmedEmail = email.trim()
  
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return { isValid: false, error: 'Please enter a valid email address' }
  }

  return { isValid: true }
}

export const validatePassword = (password: string, mode: 'signIn' | 'signUp'): { isValid: boolean; error?: string } => {
  if (!password || password.length === 0) {
    return { isValid: false, error: 'Password is required' }
  }

  // Only enforce minimum length for sign up
  if (mode === 'signUp' && password.length < 6) {
    return { isValid: false, error: 'Password must be at least 6 characters' }
  }

  return { isValid: true }
}