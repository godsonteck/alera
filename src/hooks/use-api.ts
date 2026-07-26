import { useState, useCallback, useEffect, useRef } from 'react';
import { getErrorMessage } from '@/lib/errorHandler';

export interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface UseApiOptions<T = unknown> {
  onSuccess?: (data: T) => void;
  onError?: (error: string) => void;
  throwError?: boolean;
}

type ParamsRecord = Record<string, unknown>;

/**
 * Hook for making API calls with automatic loading and error handling
 */
export const useApi = <T,>(
  apiCall: (signal?: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[] = [],
  options?: UseApiOptions<T>
) => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const depsKey = JSON.stringify(dependencies);

  useEffect(() => {
    const abortController = new AbortController();

    const executeApi = async () => {
      try {
        setState({ data: null, loading: true, error: null });
        const result = await apiCall(abortController.signal);
        setState({ data: result, loading: false, error: null });
        optionsRef.current?.onSuccess?.(result);
      } catch (error) {
        if (abortController.signal.aborted) return;

        const errorMessage = getErrorMessage(error);
        setState({ data: null, loading: false, error: errorMessage });
        optionsRef.current?.onError?.(errorMessage);

        if (optionsRef.current?.throwError) {
          throw error;
        }
      }
    };

    void executeApi();

    return () => abortController.abort();
  }, [apiCall, depsKey]);

  const refetch = useCallback(async () => {
    try {
      setState({ data: null, loading: true, error: null });
      const result = await apiCall();
      setState({ data: result, loading: false, error: null });
      optionsRef.current?.onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setState({ data: null, loading: false, error: errorMessage });
      optionsRef.current?.onError?.(errorMessage);

      if (optionsRef.current?.throwError) {
        throw error;
      }
    }
  }, [apiCall]);

  return {
    ...state,
    refetch,
  };
};

/**
 * Hook for mutations (POST, PUT, DELETE) with loading and error handling
 */
export const useMutation = <T, U = void>(
  apiCall: (params: U) => Promise<T>,
  options?: UseApiOptions<T>
) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(
    async (params: U) => {
      try {
        setLoading(true);
        setError(null);
        const result = await apiCall(params);
        optionsRef.current?.onSuccess?.(result);
        return result;
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setError(errorMessage);
        optionsRef.current?.onError?.(errorMessage);

        if (optionsRef.current?.throwError) {
          throw err;
        }
      } finally {
        setLoading(false);
      }
    },
    [apiCall]
  );

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    mutate,
    loading,
    error,
    reset,
  };
};

/**
 * Hook for query params (automatic refetch when params change)
 */
export const useApiWithParams = <T,>(
  apiCall: (params: ParamsRecord) => Promise<T>,
  params: ParamsRecord = {},
  options?: UseApiOptions<T>
) => {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const executeApi = async () => {
      try {
        setState({ data: null, loading: true, error: null });
        const result = await apiCall(paramsRef.current);
        setState({ data: result, loading: false, error: null });
        optionsRef.current?.onSuccess?.(result);
      } catch (error) {
        const errorMessage = getErrorMessage(error);
        setState({ data: null, loading: false, error: errorMessage });
        optionsRef.current?.onError?.(errorMessage);
      }
    };

    void executeApi();
  }, [apiCall, paramsKey]);

  const refetch = useCallback(async () => {
    try {
      setState({ data: null, loading: true, error: null });
      const result = await apiCall(paramsRef.current);
      setState({ data: result, loading: false, error: null });
      optionsRef.current?.onSuccess?.(result);
      return result;
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setState({ data: null, loading: false, error: errorMessage });
      optionsRef.current?.onError?.(errorMessage);
    }
  }, [apiCall]);

  return {
    ...state,
    refetch,
  };
};
