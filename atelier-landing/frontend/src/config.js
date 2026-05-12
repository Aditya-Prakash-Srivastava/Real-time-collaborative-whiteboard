/**
 * Application Configuration
 * Centralizes environment variables for easier deployment management.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
