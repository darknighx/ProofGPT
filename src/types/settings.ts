export type StartupPage = 'home' | 'history' | 'reports' | 'settings';
export interface AppSettings {
  theme: 'dark';
  language: 'en';
  startPage: StartupPage;
  warnShortText: boolean;
  detailLevel: 'standard' | 'detailed';
  includeExplanations: boolean;
  saveHistory: boolean;
  defaultExportFormat: 'csv' | 'json';
  includeChartData: boolean;
}
