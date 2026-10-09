import defaults from '../../shared/settings-defaults.json';
import type { AppSettings } from '../types/settings';
export const defaultSettings = defaults as AppSettings;
function desktopSettings() {
  if (!window.desktop?.settings) throw new Error('Settings are available in the ProofGPT desktop application.');
  return window.desktop.settings;
}
export const settingsService = {
  async get() { const response = await desktopSettings().get(); if (!response.ok) throw new Error(response.error); return response; },
  async update(patch: Partial<AppSettings>) { const response = await desktopSettings().update(patch); if (!response.ok) throw new Error(response.error); return response.settings; },
  async restoreDefaults() { const response = await desktopSettings().restoreDefaults(); if (!response.ok) throw new Error(response.error); return response.settings; },
  async resetData() { const response = await desktopSettings().resetData(); if (!response.ok) throw new Error(response.error); return response; },
};
