import { useQuery } from '@tanstack/react-query';
import { luxPowerService } from '../services/luxpower';

export function useRealtime(serialNum: string) {
  return useQuery({
    queryKey: ['runtime', serialNum],
    queryFn: async () => {
      const data = await luxPowerService.getRuntime(serialNum);
      console.log('[Realtime] Dados recebidos:', JSON.stringify(data));
      return data ?? {};
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
    retry: 3,
    enabled: !!serialNum,
    initialData: {},
  });
}