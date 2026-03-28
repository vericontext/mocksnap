export const API_PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
export const WEB_PORT = Number(process.env.WEB_PORT || 3000);
export const API_BASE_URL = process.env.API_BASE_URL || `http://localhost:${API_PORT}`;
