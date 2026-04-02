import React, { useState } from 'react';
import { ShopifyConnection } from './types';

const API = 'http://localhost:3007';

interface Props {
  onConnect: (connection: ShopifyConnection) => void;
  onClose: () => void;
}

const ShopifyConnect: React.FC<Props> = ({ onConnect, onClose }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [storeUrl, setStoreUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [error, setError] = useState('');
  const [testing, setTesting] = useState(false);

  const testConnection = async () => {
    setError('');
    setTesting(true);
    try {
      const res = await fetch(`${API}/api/shopify/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeUrl, accessToken }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        setTesting(false);
        return;
      }
      onConnect(data as ShopifyConnection);
    } catch (e: any) {
      setError(e.message || 'Connection failed');
    }
    setTesting(false);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: '#fff', borderRadius: 12, width: 520, maxHeight: '80vh', overflow: 'auto',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>Connect Shopify Store</div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Step {step} of 3</div>
          </div>
          <button onClick={onClose} style={{
            border: 'none', background: '#f3f4f6', borderRadius: 6, width: 28, height: 28,
            cursor: 'pointer', fontSize: 14, color: '#6b7280',
          }}>x</button>
        </div>

        {/* Steps */}
        <div style={{ padding: '20px 24px' }}>
          {step === 1 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>1. Enter your store URL</div>
              <input
                type="text"
                placeholder="your-store.myshopify.com"
                value={storeUrl}
                onChange={e => setStoreUrl(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                }}
              />
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                The .myshopify.com URL from your Shopify admin
              </div>
              <button
                onClick={() => { if (storeUrl.trim()) setStep(2); }}
                disabled={!storeUrl.trim()}
                style={{
                  marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: storeUrl.trim() ? '#6366f1' : '#d1d5db', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: storeUrl.trim() ? 'pointer' : 'default',
                }}
              >Next</button>
            </div>
          )}

          {step === 2 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>2. Create a Custom App</div>
              <div style={{
                background: '#f9fafb', borderRadius: 8, padding: 16, fontSize: 12, lineHeight: 1.7,
                color: '#374151', border: '1px solid #e5e7eb',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>In your Shopify Admin:</div>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>Go to <strong>Settings</strong> &rarr; <strong>Apps and sales channels</strong></li>
                  <li>Click <strong>Develop apps</strong> (top right)</li>
                  <li>Click <strong>Create an app</strong>, name it anything (e.g. "Wireframe Builder")</li>
                  <li>Go to <strong>Configuration</strong> tab</li>
                  <li>Under <strong>Admin API integration</strong>, click <strong>Configure</strong></li>
                  <li>Enable these scopes:
                    <ul style={{ marginTop: 4 }}>
                      <li><code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>read_themes</code></li>
                      <li><code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>write_themes</code></li>
                      <li><code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>read_products</code></li>
                      <li><code style={{ background: '#e5e7eb', padding: '1px 4px', borderRadius: 3 }}>read_content</code></li>
                    </ul>
                  </li>
                  <li>Click <strong>Save</strong>, then go to <strong>API credentials</strong> tab</li>
                  <li>Click <strong>Install app</strong>, then copy the <strong>Admin API access token</strong></li>
                </ol>
              </div>
              <button
                onClick={() => setStep(3)}
                style={{
                  marginTop: 16, padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: '#6366f1', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >I have the token</button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>3. Paste your access token</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
                Store: <strong>{storeUrl}</strong>
              </div>
              <input
                type="password"
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db',
                  fontSize: 14, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                }}
              />
              {error && (
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 6, background: '#fef2f2',
                  color: '#dc2626', fontSize: 12, border: '1px solid #fecaca',
                }}>{error}</div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <button onClick={() => setStep(2)} style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                  background: '#fff', color: '#374151', fontSize: 13, cursor: 'pointer',
                }}>Back</button>
                <button
                  onClick={testConnection}
                  disabled={!accessToken.trim() || testing}
                  style={{
                    padding: '8px 20px', borderRadius: 8, border: 'none',
                    background: accessToken.trim() && !testing ? '#22c55e' : '#d1d5db',
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: accessToken.trim() && !testing ? 'pointer' : 'default',
                  }}
                >{testing ? 'Testing...' : 'Test & Connect'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShopifyConnect;
