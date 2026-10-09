import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { SettingsProvider } from './contexts/SettingsContext';
import { ModelProvider } from './contexts/ModelContext';
import './styles.css';
import './history.css';
import './reports.css';
import './settings.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><SettingsProvider><ModelProvider><App /></ModelProvider></SettingsProvider></React.StrictMode>,
);
