import { useContext } from 'react';
import { AppDataContext } from './app-data-context';

export const useAppData = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used within AppDataProvider');
  return ctx;
};
