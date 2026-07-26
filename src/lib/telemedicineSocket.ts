import { buildSocketUrl } from './socketUrl';

export const getTelemedicineSocketUrl = () => buildSocketUrl('/telemedicine/ws');
