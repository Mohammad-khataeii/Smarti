import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      "Dashboard": "Dashboard",
      "File Upload": "File Upload",
      "View All Files": "View All Files",
      "Change Language": "Change Language",
      "Dashboard Overview": "Dashboard Overview",
      "No errors in system": "No errors in system",
      "Overall Pass/Fail Counts": "Overall Pass/Fail Counts",
      "Pie Chart Placeholder": "Pie Chart Placeholder",
      "Most Fails Pareto Chart": "Most Fails Pareto Chart",
      "Pareto Chart Placeholder": "Pareto Chart Placeholder",
      "Total Production": "Total Production",
      "Loading Pie Chart...": "Loading Pie Chart...",
      "Loading Pareto Chart...": "Loading Pareto Chart...",
      "Fail Count": "Fail Count",
      "Cumulative Percentage": "Cumulative Percentage",
      "Logout": "Logout",
      "uut-status-summary": "UUT Status Summary",
      "Pie Chart": "Pie Chart",
      "Pareto Chart Analysis": "Pareto Chart Analysis",
      "Control Chart": "Control Chart",
    }
  },
  it: {
    translation: {
      "Dashboard": "Panello di Controllo",
      "File Upload": "Carica File",
      "View All Files": "Visualizza Tutti i File",
      "Change Language": "Cambia Lingua",
      "Dashboard Overview": "Panoramica del Panello di Controllo",
      "No errors in system": "Nessun errore nel sistema",
      "Overall Pass/Fail Counts": "Conteggi Totali di Superati/Falliti",
      "Pie Chart Placeholder": "Segnaposto Grafico a Torta",
      "Most Fails Pareto Chart": "Grafico Pareto Maggiori Fallimenti",
      "Pareto Chart Placeholder": "Segnaposto Grafico Pareto",
      "Total Production": "Produzione Totale",
      "Loading Pie Chart...": "Caricamento Grafico a Torta...",
      "Loading Pareto Chart...": "Caricamento Grafico Pareto...",
      "Fail Count": "Conteggio Fallimenti",
      "Cumulative Percentage": "Percentuale Cumulativa",
      "Logout": "Disconnetti",
      "uut-status-summary": "Riepilogo Stato UUT",
      "Pie Chart": "Grafico a Torta",
      "Pareto Chart Analysis": "Analisi del Grafico Pareto",
      "Control Chart": "Grafico di Controllo",
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en', // default language
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
