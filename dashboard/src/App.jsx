import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, Droplets, Thermometer, Battery, BatteryCharging, 
  Sun, Wifi, Server, Monitor, Play, Square, RotateCcw, 
  Menu, Settings, BarChart2, Clock, ShieldAlert, CheckCircle,
  AlertTriangle, Link2, Link2Off
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { format } from 'date-fns';

// Configuration thresholds
const THRESHOLDS = {
  TDS_NORMAL: 300,
  TDS_ATTENTION: 600,
  TURBIDITY_NORMAL: 10,
  TURBIDITY_ATTENTION: 30,
  TEMP_MIN: 10,
  TEMP_MAX: 35
};

const INITIAL_DATA = {
  tds: 0,
  turbidity: 0,
  temperature: 0,
  battery: 100,
  solarCharging: true,
  esp32Status: "OFFLINE",
  timestamp: new Date().toISOString()
};

const getTdsStatus = (tds) => {
  if (tds <= THRESHOLDS.TDS_NORMAL) return { label: 'NORMAL', class: 'normal', icon: CheckCircle };
  if (tds <= THRESHOLDS.TDS_ATTENTION) return { label: 'ATTENTION', class: 'attention', icon: AlertTriangle };
  return { label: 'HIGH TDS', class: 'high', icon: ShieldAlert };
};

const getTurbidityStatus = (turbidity) => {
  if (turbidity < THRESHOLDS.TURBIDITY_NORMAL) return { label: 'CLEAR', class: 'normal', icon: CheckCircle };
  if (turbidity < THRESHOLDS.TURBIDITY_ATTENTION) return { label: 'CLOUDY', class: 'attention', icon: AlertTriangle };
  return { label: 'DIRTY', class: 'high', icon: ShieldAlert };
};

const getTempStatus = (temp) => {
  if (temp >= THRESHOLDS.TEMP_MIN && temp <= THRESHOLDS.TEMP_MAX) return 'NORMAL';
  return 'OUT OF RANGE';
};

const SensorCard = ({ title, value, unit, icon: Icon, status, trend }) => (
  <div className="glass-panel">
    <div className="panel-header">
      <div className="panel-title">
        <Icon size={18} />
        {title}
      </div>
      {status && (
        <span className={`badge badge-${status.class || status.toLowerCase()}`}>
          {status.label || status}
        </span>
      )}
    </div>
    <div className="sensor-value-container">
      <span className="sensor-value">{value}</span>
      <span className="sensor-unit">{unit}</span>
    </div>
    <div className={`trend-indicator trend-${trend}`}>
      {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '▬'} 
      <span style={{ marginLeft: '4px' }}>
        {trend === 'up' ? 'Increasing' : trend === 'down' ? 'Decreasing' : 'Stable'}
      </span>
    </div>
  </div>
);

const PowerMonitor = ({ battery, solarCharging }) => (
  <div className="glass-panel">
    <div className="panel-header">
      <div className="panel-title">
        <Sun size={18} />
        Power System
      </div>
    </div>
    <div className="power-grid">
      <div className="power-item">
        <span className="power-label">Source</span>
        <span className="power-val">{solarCharging ? 'Solar + Battery' : 'Battery Only'}</span>
      </div>
      <div className="power-item">
        <span className="power-label">Battery Level</span>
        <span className="power-val" style={{ display: 'flex', alignItems: 'center', gap: '8px'}}>
          {solarCharging ? <BatteryCharging size={18} color="var(--status-green)"/> : <Battery size={18} />}
          {battery}%
        </span>
      </div>
      <div className="power-item">
        <span className="power-label">Solar Panel</span>
        <span className="power-val" style={{ color: solarCharging ? 'var(--status-green)' : 'var(--text-secondary)'}}>
          {solarCharging ? 'CHARGING' : 'NOT CHARGING'}
        </span>
      </div>
      <div className="power-item">
        <span className="power-label">Voltage</span>
        <span className="power-val">{(3.2 + (battery / 100) * 1.0).toFixed(2)} V</span>
      </div>
    </div>
  </div>
);

export default function App() {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [esp32Ip, setEsp32Ip] = useState('192.168.41.147');
  const [currentData, setCurrentData] = useState(INITIAL_DATA);
  const [history, setHistory] = useState([INITIAL_DATA]);
  const [activeGraph, setActiveGraph] = useState('tds');
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let interval;
    if (isMonitoring) {
      interval = setInterval(async () => {
        if (esp32Ip.trim()) {
          // Fetch from actual ESP32
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500); // 2.5s timeout
            
            const response = await fetch(`http://${esp32Ip}/data`, {
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            if (response.ok) {
              const data = await response.json();
              const newData = {
                ...data,
                timestamp: new Date().toISOString()
              };
              
              setCurrentData(newData);
              setHistory(h => {
                const newHistory = [...h, newData];
                return newHistory.length > 20 ? newHistory.slice(1) : newHistory;
              });
              setFetchError(false);
            } else {
              setFetchError(true);
            }
          } catch (error) {
            console.error("Failed to fetch from ESP32:", error);
            setFetchError(true);
            setCurrentData(prev => ({ ...prev, esp32Status: "OFFLINE" }));
          }
        } else {
          // No IP configured
          setFetchError(false);
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isMonitoring, esp32Ip]);

  const handleReset = () => {
    setCurrentData(INITIAL_DATA);
    setHistory([INITIAL_DATA]);
  };

  const tdsStatus = getTdsStatus(currentData.tds);
  const turbidityStatus = getTurbidityStatus(currentData.turbidity);
  const tempStatus = getTempStatus(currentData.temperature);
  
  // Overall status based on worst condition
  const overallStatusClass = (tdsStatus.class === 'high' || turbidityStatus.class === 'high') ? 'high' : 
                             (tdsStatus.class === 'attention' || turbidityStatus.class === 'attention') ? 'attention' : 'normal';
  const overallStatusLabel = overallStatusClass === 'normal' ? 'SAFE & CLEAR' : 'ATTENTION REQUIRED';
  const StatusIcon = overallStatusClass === 'normal' ? CheckCircle : overallStatusClass === 'attention' ? AlertTriangle : ShieldAlert;

  const graphData = useMemo(() => {
    return history.map(item => ({
      time: format(new Date(item.timestamp), 'HH:mm:ss'),
      TDS: item.tds,
      Turbidity: item.turbidity,
      Temperature: item.temperature
    }));
  }, [history]);

  const getTrend = (key) => {
    if (history.length < 2) return 'stable';
    const current = history[history.length - 1][key];
    const prev = history[history.length - 2][key];
    if (current > prev) return 'up';
    if (current < prev) return 'down';
    return 'stable';
  };

  const isConfigured = !!esp32Ip.trim();

  return (
    <div className="dashboard-container">
      <main className="main-content" style={{ marginLeft: 0 }}>
        {!isConfigured ? (
           <div className="demo-banner" style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)', color: 'var(--status-orange)'}}>
             ENTER ESP32 IP TO CONNECT TO HARDWARE
           </div>
        ) : fetchError ? (
           <div className="demo-banner" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: 'var(--status-red)'}}>
             CONNECTION ERROR: CANNOT REACH ESP32 AT {esp32Ip}
           </div>
        ) : null}

        <header className="top-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="header-title">
              <h1>Solar-Powered Water Quality Monitoring System</h1>
              <p>{format(new Date(), 'EEEE, MMMM do yyyy | HH:mm a')}</p>
            </div>
          </div>
          
          <div className="header-actions">
            <input 
              type="text" 
              placeholder="ESP32 IP (e.g. 192.168.1.100)"
              value={esp32Ip}
              onChange={(e) => setEsp32Ip(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--panel-border)',
                color: 'white',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                outline: 'none',
                width: '220px'
              }}
            />
            <div className={`status-badge ${currentData.esp32Status === 'ONLINE' ? 'status-online' : 'status-offline'}`}>
              <div className="status-dot"></div>
              {currentData.esp32Status === 'ONLINE' ? 'ONLINE' : 'OFFLINE'}
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
             <button 
                className={`btn ${isMonitoring ? 'btn-active' : 'btn-primary'}`}
                onClick={() => setIsMonitoring(!isMonitoring)}
             >
                {isMonitoring ? <Square size={16} /> : <Play size={16} />}
                {isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}
             </button>
             <button className="btn" onClick={handleReset}>
                <RotateCcw size={16} /> Reset Data
             </button>
          </div>

          <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <SensorCard 
              title="TDS Level"
              value={currentData.tds}
              unit="ppm"
              icon={Droplets}
              status={tdsStatus}
              trend={getTrend('tds')}
            />
            <SensorCard 
              title="Turbidity"
              value={currentData.turbidity}
              unit="NTU"
              icon={Activity}
              status={turbidityStatus}
              trend={getTrend('turbidity')}
            />
            <SensorCard 
              title="Water Temp"
              value={currentData.temperature}
              unit="°C"
              icon={Thermometer}
              status={{ label: tempStatus, class: tempStatus === 'NORMAL' ? 'normal' : 'attention' }}
              trend={getTrend('temperature')}
            />
            <PowerMonitor battery={currentData.battery} solarCharging={currentData.solarCharging} />
          </div>

          <div className="cards-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
            <div className="glass-panel status-panel">
              <div className="status-info">
                <div className="panel-title">WATER QUALITY STATUS</div>
                <div className={`status-large-badge ${overallStatusClass}`}>
                  <StatusIcon size={32} />
                  {overallStatusLabel}
                </div>
                <div className="status-disclaimer">
                  * Note: TDS and Turbidity indicate basic water quality. Additional biological testing is required to confirm if water is safe to drink.
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', textAlign: 'right' }}>
                 <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>TDS / Turbidity</span>
                 <span style={{ fontSize: '1.5rem', fontWeight: 600 }}>{currentData.tds} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>ppm</span></span>
                 <span style={{ fontSize: '1.5rem', fontWeight: 600 }}>{currentData.turbidity} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>NTU</span></span>
              </div>
            </div>

            <div className="glass-panel">
              <div className="panel-header">
                <div className="panel-title"><Server size={18} /> System Info</div>
              </div>
              <div className="system-info-list">
                <div className="info-row">
                  <span className="info-label">ESP32 Status</span>
                  <span className="info-value" style={{ color: currentData.esp32Status === 'ONLINE' ? 'var(--status-green)' : 'var(--status-red)'}}>
                    {currentData.esp32Status === 'ONLINE' ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
                <div className="info-row">
                  <span className="info-label">TDS Sensor</span>
                  <span className="info-value" style={{ color: 'var(--status-green)'}}>Active</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Turbidity Sensor</span>
                  <span className="info-value" style={{ color: 'var(--status-green)'}}>Active</span>
                </div>
                <div className="info-row">
                  <span className="info-label">DS18B20 Sensor</span>
                  <span className="info-value" style={{ color: 'var(--status-green)'}}>Active</span>
                </div>
                <div className="info-row">
                  <span className="info-label">OLED Display</span>
                  <span className="info-value" style={{ color: 'var(--status-green)'}}>Active</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Data Source</span>
                  <span className="info-value" style={{ color: 'var(--accent-light)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                    {!isConfigured ? <Link2Off size={14}/> : <Link2 size={14} />}
                    {!isConfigured ? 'Not Configured' : esp32Ip}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header" style={{ marginBottom: 0 }}>
              <div className="panel-title"><Activity size={18} /> Real-Time Monitoring</div>
              <div className="graph-controls">
                <button 
                  className={`btn ${activeGraph === 'tds' ? 'btn-active' : ''}`}
                  onClick={() => setActiveGraph('tds')}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                >
                  TDS
                </button>
                <button 
                  className={`btn ${activeGraph === 'turbidity' ? 'btn-active' : ''}`}
                  onClick={() => setActiveGraph('turbidity')}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Turbidity
                </button>
                <button 
                  className={`btn ${activeGraph === 'temp' ? 'btn-active' : ''}`}
                  onClick={() => setActiveGraph('temp')}
                  style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}
                >
                  Temperature
                </button>
              </div>
            </div>
            <div className="graph-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={graphData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis 
                    dataKey="time" 
                    stroke="var(--text-secondary)" 
                    fontSize={12} 
                    tickMargin={10} 
                  />
                  <YAxis 
                    stroke="var(--text-secondary)" 
                    fontSize={12}
                    domain={activeGraph === 'tds' ? [0, 'auto'] : activeGraph === 'turbidity' ? [0, 'auto'] : [0, 50]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(11, 15, 25, 0.9)', 
                      borderColor: 'rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: 'white'
                    }}
                    itemStyle={{ color: 'var(--accent-light)' }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={activeGraph === 'tds' ? 'TDS' : activeGraph === 'turbidity' ? 'Turbidity' : 'Temperature'} 
                    stroke={activeGraph === 'tds' ? 'var(--accent-blue)' : activeGraph === 'turbidity' ? 'var(--status-green)' : 'var(--status-orange)'} 
                    strokeWidth={3}
                    dot={{ fill: 'var(--bg-color)', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: 'var(--accent-light)' }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel">
            <div className="panel-header">
              <div className="panel-title"><Clock size={18} /> Recent Readings</div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>TDS (ppm)</th>
                    <th>Turbidity (NTU)</th>
                    <th>Temperature (°C)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((item, idx) => {
                    const tdsStat = getTdsStatus(item.tds);
                    const turbStat = getTurbidityStatus(item.turbidity);
                    const isHigh = tdsStat.class === 'high' || turbStat.class === 'high';
                    const isAtt = tdsStat.class === 'attention' || turbStat.class === 'attention';
                    const sClass = isHigh ? 'high' : isAtt ? 'attention' : 'normal';
                    const sLabel = sClass === 'normal' ? 'SAFE' : 'ALERT';
                    
                    return (
                      <tr key={idx}>
                        <td>{format(new Date(item.timestamp), 'yyyy-MM-dd HH:mm:ss')}</td>
                        <td style={{ fontWeight: 500 }}>{item.tds}</td>
                        <td>{item.turbidity}</td>
                        <td>{item.temperature}</td>
                        <td>
                          <span className={`badge badge-${sClass}`}>{sLabel}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
