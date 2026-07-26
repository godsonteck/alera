import React from 'react';
import { AlertCircle, X, Info, AlertTriangle, CheckCircle } from 'lucide-react';

interface MaintenanceBannerProps {
  message: string;
  type?: 'info' | 'warning' | 'success';
  onClose?: () => void;
}

const MaintenanceBanner: React.FC<MaintenanceBannerProps> = ({ 
  message, 
  type = 'info',
  onClose 
}) => {
  const getStyles = () => {
    switch (type) {
      case 'warning':
        return {
          bg: 'bg-acuity-2',
          icon: <AlertTriangle className="h-4 w-4 text-white" />
        };
      case 'success':
        return {
          bg: 'bg-acuity-3',
          icon: <CheckCircle className="h-4 w-4 text-white" />
        };
      default:
        return {
          bg: 'bg-sidebar',
          icon: <Info className="h-4 w-4 text-sidebar-foreground/70" />
        };
    }
  };

  const styles = getStyles();

  return (
    <div className={`${styles.bg} text-white py-3 px-4 shadow-md relative overflow-hidden`}>
      <div className="absolute inset-0 bg-white/5 pointer-events-none animate-pulse"></div>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3">
          {styles.icon}
          <p className="text-sm font-medium">
            {message}
          </p>
        </div>
        
        {onClose && (
          <button 
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default MaintenanceBanner;
