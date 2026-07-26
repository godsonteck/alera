import { createContext } from 'react';
import type { SystemSettings } from '@/lib/apiService';

export interface SystemContextType {
  settings: SystemSettings | null;
  isLoading: boolean;
  isMaintenanceMode: boolean;
  bannerVisible: boolean;
  closeBanner: () => void;
  refreshSettings: () => Promise<void>;
}

export type MaintenanceBannerType = 'info' | 'warning' | 'success';

export const SystemContext = createContext<SystemContextType | undefined>(undefined);
