import { AxiosError } from 'axios';

export interface ApiError {
  status?: number;
  message: string;
  details?: unknown;
  code?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const getMessageField = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;

  const message = value.message;
  return typeof message === 'string' ? message : undefined;
};

const getDetailField = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;

  const detail = value.detail;
  return typeof detail === 'string' ? detail : undefined;
};

/**
 * Extract error message from various error types
 */
export const getErrorMessage = (error: unknown): string => {
  // Handle AxiosError
  if (error instanceof Error) {
    const axiosError = error as AxiosError;
    
    if (axiosError.response) {
      // Server responded with error status
      const status = axiosError.response.status;
      const data = axiosError.response.data as unknown;
      const message = getMessageField(data);
      const detail = getDetailField(data);

      if (status === 400) {
        return detail || message || 'Invalid request. Please check your input.';
      }

      if (status === 401) {
        return detail || message || 'Session expired. Please log in again.';
      }

      if (status === 403) {
        return detail || message || 'You do not have permission to perform this action.';
      }

      if (status === 404) {
        return detail || message || 'The requested resource was not found.';
      }

      if (status === 409) {
        return detail || message || 'This resource already exists. Please use a different value.';
      }

      if (status === 422) {
        return detail || 'Validation error. Please check your input.';
      }

      if (status === 500) {
        return detail || message || 'Server error. Please try again later.';
      }

      if (status >= 500) {
        return 'Server error. Our team has been notified. Please try again later.';
      }

      return message || detail || 'An error occurred.';
    }

    if (axiosError.request) {
      // Request made but no response
      return 'Unable to reach the server. Please check your connection.';
    }

    // Error in request setup
    return axiosError.message || 'An error occurred.';
  }

  // Handle custom API error objects
  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === 'string') {
      return message;
    }
  }

  // Fallback to string representation
  return String(error) || 'An unknown error occurred.';
};

/**
 * Get structured error information for logging
 */
export const getErrorDetails = (error: unknown): ApiError => {
  if (error instanceof AxiosError) {
    return {
      status: error.response?.status,
      message: getErrorMessage(error),
      details: error.response?.data,
      code: error.code,
    };
  }

  return {
    message: getErrorMessage(error),
    details: error,
  };
};

/**
 * Determine if error is a network error
 */
export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return !error.response && !error.code?.includes('ERR_');
  }
  return false;
};

/**
 * Determine if error is authentication related
 */
export const isAuthError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return error.response?.status === 401;
  }
  return false;
};

/**
 * Determine if error is authorization related
 */
export const isAuthorizationError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return error.response?.status === 403;
  }
  return false;
};

/**
 * Determine if error is validation related
 */
export const isValidationError = (error: unknown): boolean => {
  if (error instanceof AxiosError) {
    return error.response?.status === 422 || error.response?.status === 400;
  }
  return false;
};

/**
 * Extract validation errors in key-value format
 */
export const getValidationErrors = (error: unknown): Record<string, string> => {
  if (error instanceof AxiosError && error.response?.status === 422) {
    const data = error.response.data as unknown;
    const errors: Record<string, string> = {};

    if (isRecord(data) && Array.isArray(data.detail)) {
      data.detail.forEach((err) => {
        if (!isRecord(err)) return;

        const loc = err.loc;
        const field = Array.isArray(loc) && typeof loc[1] === 'string' ? loc[1] : 'unknown';
        const msg = typeof err.msg === 'string' ? err.msg : 'Invalid value';
        errors[field] = msg;
      });
    }

    return errors;
  }

  return {};
};

/**
 * Format error for user display
 */
export const formatErrorMessage = (error: unknown): string => {
  const message = getErrorMessage(error);

  // Capitalize first letter
  if (message.length > 0) {
    return message.charAt(0).toUpperCase() + message.slice(1);
  }

  return message;
};

/**
 * Create user-friendly error message from API error
 */
export const createFriendlyErrorMessage = (error: unknown, context?: string): string => {
  let message = formatErrorMessage(error);

  if (context) {
    message = `Failed to ${context}. ${message}`;
  }

  // Remove duplicate periods
  message = message.replace(/\.+$/, '.');

  return message;
};

/**
 * Log error for debugging
 */
export const logError = (error: unknown, context?: string): void => {
  const details = getErrorDetails(error);

  console.error(`[API Error${context ? ` - ${context}` : ''}]`, {
    message: details.message,
    status: details.status,
    code: details.code,
    details: details.details,
  });
};

/**
 * Handle API error with appropriate actions
 */
export const handleApiError = (
  error: unknown,
  context?: string,
  onAuthError?: () => void,
  onAuthorizationError?: () => void
): string => {
  logError(error, context);

  if (isAuthError(error)) {
    onAuthError?.();
    return getErrorMessage(error) || 'Your session has expired. Please log in again.';
  }

  if (isAuthorizationError(error)) {
    onAuthorizationError?.();
    return getErrorMessage(error) || 'You do not have permission to perform this action.';
  }

  return createFriendlyErrorMessage(error, context);
};
