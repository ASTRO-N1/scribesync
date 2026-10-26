// src/App.jsx
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './components/ui/Toast';
import Home from './pages/Home';

import './styles/index.css';
import './styles/animations.css';
import './styles/components.css';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Home />
      </ToastProvider>
    </AuthProvider>
  );
}
