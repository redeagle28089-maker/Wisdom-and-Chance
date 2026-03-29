import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AppConfig } from "@shared/models/config";

const ConfigContext = createContext<AppConfig | null>(null);

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery<AppConfig>({
    queryKey: ["/api/config"],
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <ConfigContext.Provider value={data ?? null}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useAppConfig(): AppConfig | null {
  return useContext(ConfigContext);
}

export function useFeatureFlag(key: string): boolean {
  const config = useAppConfig();
  return config?.features?.[key] ?? false;
}
