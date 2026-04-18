import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const AlertsContext = createContext(null);

export function AlertsProvider({ children }) {
  const { user } = useAuth();
  const [alerts,    setAlerts]    = useState([]);
  const [loading,   setLoading]   = useState(false);

  const alertsEnabled = user?.alertSettings?.deficiencyAlerts === true;

  const fetchAlerts = useCallback(async () => {
    if (!alertsEnabled) { setAlerts([]); return; }
    setLoading(true);
    try {
      const { data } = await axios.get('/api/alerts');
      setAlerts(data);
    } catch {
      // silently fail — alerts are non-critical
    } finally {
      setLoading(false);
    }
  }, [alertsEnabled]);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, fetchAlerts]);

  const triggerAnalysis = useCallback(async () => {
    if (!alertsEnabled) return;
    try {
      const { data } = await axios.post('/api/alerts/analyze');
      if (data.alerts) setAlerts(data.alerts);
    } catch {}
  }, [alertsEnabled]);

  const markRead = useCallback(async (id) => {
    try {
      await axios.put(`/api/alerts/${id}/read`);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  }, []);

  const dismiss = useCallback(async (id) => {
    try {
      await axios.delete(`/api/alerts/${id}`);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  }, []);

  const unreadCount = alerts.length;

  return (
    <AlertsContext.Provider value={{
      alerts,
      unreadCount,
      loading,
      fetchAlerts,
      triggerAnalysis,
      markRead,
      dismiss,
    }}>
      {children}
    </AlertsContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertsContext);
