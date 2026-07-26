import { frontendEnv } from '@/config/env';

const toWebSocketBase = (value: string) => {
  if (value.startsWith('wss://') || value.startsWith('ws://')) {
    return value;
  }

  if (value.startsWith('https://')) {
    return value.replace('https://', 'wss://');
  }

  if (value.startsWith('http://')) {
    return value.replace('http://', 'ws://');
  }

  if (value.startsWith('/')) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${value}`;
  }

  return value;
};

export const resolveSocketBaseUrl = (configuredApiUrl?: string | null) => {
  const rawBaseUrl = configuredApiUrl?.trim()
    || frontendEnv.apiBaseUrl;

  return toWebSocketBase(rawBaseUrl.replace(/\/+$/, ''));
};

export const buildSocketUrl = (path: string, configuredApiUrl?: string | null) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${resolveSocketBaseUrl(configuredApiUrl)}${normalizedPath}`;
};
