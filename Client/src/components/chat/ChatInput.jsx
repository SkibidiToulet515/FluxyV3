import { useState, useRef } from 'react';
import { Send, Image, Plus } from 'lucide-react';
import GifPicker from './GifPicker';

export default function ChatInput({ onSend, onGif, disabled, channelName }) {
  const [text, setText] = useState('');
  const [gifOpen, setGifOpen] = useState(false);
  const inputRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleGifSelect(gif) {
    const pending = text.trim();
    onGif({ gif, text: pending });
    setText('');
    setGifOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="dc-input-wrapper">
      <GifPicker
        open={gifOpen}
        onSelect={handleGifSelect}
        onClose={() => setGifOpen(false)}
      />
      <form className="dc-input-area" onSubmit={handleSubmit}>
        <button type="button" className="dc-input-icon-btn" title="More" disabled>
          <Plus size={20} />
        </button>
        <div className="dc-input-box">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            maxLength={2000}
            disabled={disabled}
            autoFocus
          />
          <div className="dc-input-actions">
            <button
              type="button"
              className={`dc-input-icon-btn ${gifOpen ? 'active' : ''}`}
              title="GIFs"
              onClick={() => setGifOpen((p) => !p)}
            >
              <Image size={18} />
            </button>
          </div>
        </div>
        <button
          type="submit"
          className="dc-send-btn"
          disabled={!text.trim() || disabled}
          title="Send"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
