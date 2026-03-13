import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { Login } from './components/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import './styles.css';

function Root() {
  const { currentUser, loading } = useAuth();
  
  if (loading) {
    return <div style={{ padding: '32px', textAlign: 'center' }}>Laddar LexBill...</div>;
  }
  
  return currentUser ? <App /> : <Login />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </React.StrictMode>,
);
