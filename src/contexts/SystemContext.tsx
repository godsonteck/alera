import React, { useState, useEffect, useCallback } from 'react';
import { api, SystemSettings } from '@/lib/apiService';
import { SystemContext, type SystemContextType } from './system-context';

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [bannerVisible, setBannerVisible] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await api.getSystemStatus();
      setSettings(response as SystemSettings);
      
      if (response.notification_banner_active) {
        setBannerVisible(true);
      }
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    // Poll every 5 minutes for updates
    const interval = setInterval(fetchSettings, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSettings]);

  const closeBanner = () => setBannerVisible(false);

  const value: SystemContextType = {
    settings,
    isLoading,
    isMaintenanceMode: settings?.is_maintenance_mode || false,
    bannerVisible,
    closeBanner,
    refreshSettings: fetchSettings,
  };

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
};
