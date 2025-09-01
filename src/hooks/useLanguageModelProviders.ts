import { useQuery } from "@tanstack/react-query";
import { IpcClient } from "@/ipc/ipc_client";
import type { LanguageModelProvider } from "@/ipc/ipc_types";
import { useSettings } from "./useSettings";
import { cloudProviders } from "@/lib/schemas";

export function useLanguageModelProviders() {
  const ipcClient = IpcClient.getInstance();
  const { settings, envVars } = useSettings();

  const queryResult = useQuery<LanguageModelProvider[], Error>({
    queryKey: ["languageModelProviders"],
    queryFn: async () => {
      return ipcClient.getLanguageModelProviders();
    },
  });

  const isProviderSetup = (provider: string) => {
    const providerSettings = settings?.providerSettings[provider];
    if (queryResult.isLoading) {
      return false;
    }
    if (provider === "vertexai") {
      const projectId = (providerSettings as any)?.projectId as
        | string
        | undefined;
      const location = (providerSettings as any)?.location as
        | string
        | undefined;
      const jsonPath = (providerSettings as any)?.serviceAccountJsonPath as
        | string
        | undefined;
      if (projectId && location && jsonPath) {
        return true;
      }
    }
    if (providerSettings?.apiKey?.value) {
      return true;
    }
    const providerData = queryResult.data?.find((p) => p.id === provider);
    if (providerData?.envVarName && envVars[providerData.envVarName]) {
      return true;
    }
    return false;
  };

  const isAnyProviderSetup = () => {
    return cloudProviders.some((provider) => isProviderSetup(provider));
  };

  return {
    ...queryResult,
    isProviderSetup,
    isAnyProviderSetup,
  };
}
