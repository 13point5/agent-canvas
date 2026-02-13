import type { AppSettings } from "@agent-canvas/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { settingsApi, settingsMutations } from "@/api/client";
import { queryKeys } from "@/api/queryClient";

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: settingsApi.get,
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: settingsMutations.update,
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      const previous = queryClient.getQueryData<AppSettings>(
        queryKeys.settings,
      );
      queryClient.setQueryData<AppSettings>(queryKeys.settings, (old) => ({
        ...old,
        ...patch,
      }));
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.settings, context.previous);
      }
    },
  });
}
