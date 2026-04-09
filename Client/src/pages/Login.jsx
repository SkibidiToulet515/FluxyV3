import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Eye, EyeOff, AlertCircle, Mail, User, Loader2 } from 'lucide-react';
import { useAuth } from '../utils/AuthContext';
import './Login.css';

function formatFirebaseError(code) {
  const map = {
    'auth/email-already-in-use': 'That username is already taken.',
    'auth/invalid-email': 'Invalid username or email.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with that username.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential':
      'Wrong password, or that username is not registered. Try signing in with your email if you added one.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}

export default function Login() {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!username.trim() || username.trim().length < 3) {
      return setError('Username must be 3+ characters');
    }
    if (!password) return setError('Password is required');
    if (password.length < 6) return setError('Password must be 6+ characters');
    if (showEmail && email.trim() && !email.includes('@')) {
      return setError('Enter a valid email or leave it blank');
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, email.trim() || undefined);
      }
      navigate('/');
    } catch (err) {
      setError(err.message || formatFirebaseError(err.code));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card glass-card animate-slide-up">
        <div className="login-logo">
          <span className="login-logo-icon">F</span>
          <span className="login-logo-text">Fluxy</span>
        </div>

        <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
        <p className="login-subtitle">
          {mode === 'login'
            ? 'Log in to continue to Fluxy'
            : 'Sign up to start playing'}
        </p>

        {error && (
          <div className="login-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <label className="login-label">
            <span>Username</span>
            <div className="login-input-wrap">
              <User size={16} className="login-input-icon" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'login' ? 'Enter your username' : 'Choose a username'}
                maxLength={32}
                autoFocus
                disabled={submitting}
              />
            </div>
          </label>

          {mode === 'register' && (
            <>
              {!showEmail ? (
                <button
                  type="button"
                  className="login-optional-toggle"
                  onClick={() => setShowEmail(true)}
                >
                  <Mail size={13} /> Add email (optional)
                </button>
              ) : (
                <label className="login-label">
                  <span>Email <span className="login-optional">(optional)</span></span>
                  <div className="login-input-wrap">
                    <Mail size={16} className="login-input-icon" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      maxLength={128}
                      disabled={submitting}
                    />
                  </div>
                </label>
              )}
            </>
          )}

          <label className="login-label">
            <span>Password</span>
            <div className="login-pw-wrap">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                maxLength={64}
                disabled={submitting}
              />
              <button
                type="button"
                className="login-pw-toggle"
                onClick={() => setShowPw((p) => !p)}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button
            type="submit"
            className="btn btn-primary login-submit"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 size={18} className="spin" />
            ) : mode === 'login' ? (
              <LogIn size={18} />
            ) : (
              <UserPlus size={18} />
            )}
            {mode === 'login' ? 'Log In' : 'Create Account'}
          </button>
        </form>

        <div className="login-switch">
          {mode === 'login' ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => { setMode('register'); setError(''); }}>
                Register
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); }}>
                Log in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
