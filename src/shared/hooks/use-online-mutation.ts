import {
  useMutation,
  type UseMutationOptions,
  type UseMutationResult,
} from '@tanstack/react-query';

import { AppError } from '@/shared/lib/app-error';
import {
  isConnectivityFailure,
  reportRequestFailure,
  reportRequestSuccess,
  useConnectivity,
} from '@/shared/hooks/use-connectivity';

export type OnlineMutationOptions<
  Data,
  ErrorType = Error,
  Variables = void,
  Context = unknown,
> = Omit<
  UseMutationOptions<Data, ErrorType, Variables, Context>,
  'mutationFn' | 'networkMode' | 'retry'
> & {
  mutationFn: (variables: Variables) => Promise<Data>;
};

export function useOnlineMutation<Data, ErrorType = Error, Variables = void, Context = unknown>(
  options: OnlineMutationOptions<Data, ErrorType, Variables, Context>,
): UseMutationResult<Data, ErrorType, Variables, Context> {
  const connectivity = useConnectivity();
  const { mutationFn, ...mutationOptions } = options;

  return useMutation<Data, ErrorType, Variables, Context>({
    ...mutationOptions,
    gcTime: 0,
    mutationFn: async (variables) => {
      if (!connectivity.isOnline) {
        throw new AppError('OFFLINE');
      }

      try {
        const result = await mutationFn(variables);
        reportRequestSuccess();
        return result;
      } catch (error) {
        reportRequestFailure(error);
        if (isConnectivityFailure(error)) throw new AppError('OFFLINE');
        throw error;
      }
    },
    networkMode: 'always',
    retry: false,
  });
}
