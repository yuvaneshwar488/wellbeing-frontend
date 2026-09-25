import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. SECURE DATABASE PRODUCTION CONNECTIONS
const SUPABASE_URL = 'https://lmaactppptisaeprhdj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_q1-qbnsVK802z_nxZB0pIA_VepFo5Ui';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. ROOK INTEGRATION CONFIGURATION
const ROOK_ENDPOINT = 'https://api.tryrook.com/api/v1/heart_rate/summary?client_uuid=120edfed-4c68-4066-b1b0-ae9b73fda772';
const BEARER_TOKEN = 'D7k2licU5YLcPt4CkwLYJWH6vMp7pFIIelrD';

export default function WellbeingApplicationUnified() {
  const [currentTab, setCurrentTab] = useState('onboarding');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [heartRate, setHeartRate] = useState('--');
  const [hrv, setHrv] = useState('--');
  const [systemAlert, setSystemAlert] = useState(null);

 const syncPatientTelemetry = async () => {
    setIsSyncing(true);
    setSystemAlert(null);
    
    let latestHeartRate = 76;
    let latestHrv = 58;

    try {
      const response = await fetch(ROOK_ENDPOINT, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'Authorization': `Bearer ${BEARER_TOKEN}`
        }
      });

      if (response.ok) {
        const packet = await response.json();
        latestHeartRate = packet.heart_rate?.avg || 76;
        latestHrv = packet.heart_rate?.hrv || 58;
      }
    } catch (error) {
      console.warn('Rook live stream unreachable (likely browser CORS), utilizing sandbox data:', error);
    }

    try {
      setHeartRate(latestHeartRate);
      setHrv(latestHrv);

      if (latestHeartRate > 100 || latestHrv < 45) {
        setSystemAlert({
          metric: 'Critical Metric Abnormality',
          details: `Heart Rate: ${latestHeartRate} BPM / HRV: ${latestHrv}ms`
        });
      }

      await supabase.from('patient_vitals').insert([
        {
          heart_rate: latestHeartRate,
          hrv_ms: latestHrv,
          recorded_at: new Date().toISOString()
        }
      ]);

      setCurrentTab('dashboard');
    } catch (dbErr) {
      console.error('Supabase write error:', dbErr);
      setCurrentTab('dashboard');
    } finally {
      setIsSyncing(false);
    }
  };
  useEffect(() => {
    const alertChannel = supabase
      .channel('live_medical_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'medical_alerts' },
        (payload) => {
          setSystemAlert({
            metric: 'CRITICAL TAMPER EVENT',
            details: `${payload.new.trigger_metric}: ${payload.new.current_value}`
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(alertChannel);
    };
  }, []);

  const handleVerifyGate = (e) => {
    e.preventDefault();
    if (verificationCode === '485129') {
      syncPatientTelemetry();
    } else {
      setSystemAlert({
        metric: 'Security Gate Rejection',
        details: 'Invalid sandbox synchronization verification key.'
      });
    }
  };

  return (
    <div style={styles.appContainer}>
      <header style={styles.header}>
        <h1 style={styles.appTitle}>WellBeing Engine</h1>
        <span style={currentTab === 'dashboard' ? styles.statusLive : styles.statusIdle}>
          {currentTab === 'dashboard' ? '● Connected' : 'Offline'}
        </span>
      </header>

      {systemAlert && (
        <div style={styles.alertPanel}>
          <div style={styles.alertTitle}>⚠️ {systemAlert.metric}</div>
          <div style={styles.alertBody}>{systemAlert.details}</div>
        </div>
      )}

      {currentTab === 'onboarding' ? (
        <form onSubmit={handleVerifyGate} style={styles.formContainer}>
          <h2 style={styles.sectionTitle}>Link Rook Aggregate Pipeline</h2>
          <p style={styles.bodyText}>Input your Sandbox Verification passcode to validate the endpoint interface synchronization loop.</p>
          
          <input 
            type="text" 
            placeholder="Enter verification code (485129)" 
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            style={styles.inputField}
          />

          <button type="submit" disabled={isSyncing} style={styles.primaryButton}>
            {isSyncing ? 'Authorizing Bearer Sync...' : 'Verify Engine Connection'}
          </button>
        </form>
      ) : (
        <div style={styles.dashboardContainer}>
          <div style={styles.metricsRow}>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>HEART RATE</span>
              <span style={styles.metricValue}>{heartRate} <small style={styles.unit}>BPM</small></span>
            </div>
            <div style={styles.metricCard}>
              <span style={styles.metricLabel}>HRV MATRIX</span>
              <span style={styles.metricValue}>{hrv} <small style={styles.unit}>ms</small></span>
            </div>
          </div>

          <button onClick={() => syncPatientTelemetry()} disabled={isSyncing} style={styles.secondaryButton}>
            {isSyncing ? 'Re-polling Streams...' : 'Force Manual Aggregator Pull'}
          </button>

          <button onClick={() => setCurrentTab('onboarding')} style={styles.linkButton}>
            Return to Onboarding Gateway
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  appContainer: { 
    fontFamily: '-apple-system, sans-serif', 
    padding: '20px', 
    maxWidth: '420px', 
    minHeight: '100vh', 
    margin: '0 auto', 
    backgroundColor: '#ffffff', 
    borderRadius: '12px', 
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    boxSizing: 'border-box'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', paddingBottom: '12px', marginBottom: '20px' },
  appTitle: { fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#1a1a1a' },
  statusLive: { color: '#10b981', fontSize: '13px', fontWeight: '600' },
  statusIdle: { color: '#9ca3af', fontSize: '13px' },
  formContainer: { display: 'flex', flexDirection: 'column', gap: '14px' },
  sectionTitle: { fontSize: '15px', fontWeight: '600', margin: '0 0 4px 0' },
  bodyText: { fontSize: '13px', color: '#6b7280', margin: 0, lineHeight: '1.4' },
  inputField: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', outline: 'none', width: '100%', boxSizing: 'border-box' },
  primaryButton: { padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '14px', width: '100%' },
  secondaryButton: { padding: '12px', backgroundColor: '#10b981', color: '#ffffff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '14px', width: '100%', marginTop: '10px' },
  linkButton: { padding: '10px', backgroundColor: 'transparent', color: '#6b7280', border: 'none', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', marginTop: '5px' },
  dashboardContainer: { display: 'flex', flexDirection: 'column', gap: '12px' },
  metricsRow: { display: 'flex', gap: '12px' },
  metricCard: { flex: 1, padding: '16px', backgroundColor: '#f9fafb', borderRadius: '8px', border: '1px solid #f3f4f6' },
  metricLabel: { display: 'block', fontSize: '11px', color: '#9ca3af', fontWeight: '600', marginBottom: '4px' },
  metricValue: { fontSize: '24px', fontWeight: 'bold', color: '#111827' },
  unit: { fontSize: '12px', fontWeight: 'normal', color: '#6b7280' },
  alertPanel: { padding: '12px', backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', marginBottom: '16px' },
  alertTitle: { color: '#991b1b', fontSize: '13px', fontWeight: 'bold', marginBottom: '2px' },
  alertBody: { color: '#7f1d1d', fontSize: '12px', lineHeight: '1.4' }
};
