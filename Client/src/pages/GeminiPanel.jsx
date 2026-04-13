import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Send, Bot, Loader, Trash2, User } from 'lucide-react';
import Header from '../components/Header';
import { apiJson } from '../services/apiClient';
import './GeminiPanel.css';

export default function GeminiPanel() {
  const { onMenuToggle } = useOutletContext();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setError('');
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setLoading(true);

    try {
      const res = await apiJson('/api/gemini', {
        method: 'POST',
        body: { messages: next },
      });
      setMessages([...next, { role: 'model', text: res.text }]);
    } catch (err) {
      setError(err.message || 'Failed to get response');
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setMessages([]);
    setError('');
  }

  return (
    <div className="gemini-page animate-fade-in">
      <Header title="AI Assistant" onMenuClick={onMenuToggle} />

      <div className="gemini-container glass-card">
        <div className="gemini-messages">
          {messages.length === 0 && !loading && (
            <div className="gemini-empty">
              <Bot size={48} />
              <h3>Fluxy AI Assistant</h3>
              <p>Powered by Gemini. Ask me anything.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`gemini-msg gemini-msg-${m.role}`}>
              <div className="gemini-msg-icon">
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>
              <div className="gemini-msg-body">
                <div className="gemini-msg-text">{m.text}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="gemini-msg gemini-msg-model">
              <div className="gemini-msg-icon"><Bot size={16} /></div>
              <div className="gemini-msg-body">
                <Loader size={18} className="gemini-spinner" />
              </div>
            </div>
          )}

          {error && <div className="gemini-error">{error}</div>}
          <div ref={bottomRef} />
        </div>

        <form className="gemini-input-bar" onSubmit={handleSend}>
          {messages.length > 0 && (
            <button type="button" className="gemini-clear-btn" onClick={handleClear} title="Clear">
              <Trash2 size={16} />
            </button>
          )}
          <input
            type="text"
            className="gemini-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            disabled={loading}
          />
          <button type="submit" className="gemini-send-btn btn-primary" disabled={!input.trim() || loading}>
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
