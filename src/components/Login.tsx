import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../utils/firebase';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // context will pick up change automatically
    } catch (err: any) {
      setError(err.message || 'Ett fel uppstod vid inloggning.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="panel" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="section-heading" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1>LexBill</h1>
          <p>Logga in för att komma åt kostnadsräkningen.</p>
        </div>
        
        {error && (
          <div style={{ padding: '12px', background: '#ffebee', color: '#c62828', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="form-panel" style={{ gap: '16px' }}>
          <label>
            <span>E-post</span>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="din.epost@example.com"
            />
          </label>
          <label>
            <span>Lösenord</span>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="lösenord"
            />
          </label>
          <button 
            type="submit" 
            className="primary-button" 
            disabled={loading}
            style={{ marginTop: '8px', width: '100%' }}
          >
            {loading ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
      </div>
    </div>
  );
}
