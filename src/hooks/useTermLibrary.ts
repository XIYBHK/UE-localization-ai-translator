import useSWR from 'swr';
import type { TermLibrary } from '../types/termLibrary';
import type { TauriKey } from '../services/swr';

const KEY: TauriKey = ['get_term_library'];

interface UseTermLibraryOptions {
  enabled?: boolean; // 是否启用请求
}

export function useTermLibrary(options?: UseTermLibraryOptions) {
  const { enabled = true } = options || {};

  const { data, error, isLoading, mutate } = useSWR<TermLibrary>(
    enabled ? KEY : null, // enabled=false 时不请求
    {
      revalidateOnFocus: false, // 术语库不需要聚焦刷新
      revalidateOnReconnect: false,
      dedupingInterval: 2000, // 2秒内去重
    }
  );

  return {
    termLibrary: data ?? null,
    error,
    isLoading: !!isLoading,
    refresh: () => mutate(),
    mutate,
  } as const;
}
