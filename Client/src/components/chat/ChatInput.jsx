import { useState, useRef } from 'react';
import { Send, Image, Plus, Paperclip, X, Loader2 } from 'lucide-react';
import GifPicker from './GifPicker';
import { uploadChatAttachment, isImageFile } from '../../services/storage';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ChatInput({
  onSend,
  onGif,
  onAttachment,
  disabled,
  channelName,
  channelPath,
}) {
  const [text, setText] = useState('');
  const [gifOpen, setGifOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const cancelRef = useRef(null);

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed && !pendingFile) return;
    if (pendingFile) {
      handleUploadAndSend(trimmed);
    } else {
      onSend(trimmed);
      setText('');
    }
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

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('File too large. Maximum 10 MB.');
      return;
    }
    setPendingFile(file);
    setUploadError('');
    if (isImageFile(file)) {
      setPendingPreview(URL.createObjectURL(file));
    } else {
      setPendingPreview(null);
    }
    e.target.value = '';
  }

  function clearPending() {
    setPendingFile(null);
    setPendingPreview(null);
    setUploadError('');
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    setUploadProgress(null);
  }

  async function handleUploadAndSend(messageText) {
    if (!pendingFile || !channelPath) return;
    setUploadProgress(0);
    setUploadError('');
    try {
      const { promise, cancel } = uploadChatAttachment(
        channelPath,
        pendingFile,
        (pct) => setUploadProgress(pct),
      );
      cancelRef.current = cancel;
      const { url } = await promise;
      const attachment = {
        text: messageText || '',
        attachment: {
          url,
          name: pendingFile.name,
          type: pendingFile.type,
          size: pendingFile.size,
        },
      };
      if (isImageFile(pendingFile)) {
        attachment.image = url;
      }
      onAttachment(attachment);
      setText('');
      clearPending();
    } catch (err) {
      if (err.code !== 'storage/canceled') {
        setUploadError(err.message || 'Upload failed');
      }
      setUploadProgress(null);
    }
  }

  return (
    <div className="dc-input-wrapper">
      <GifPicker
        open={gifOpen}
        onSelect={handleGifSelect}
        onClose={() => setGifOpen(false)}
      />

      {pendingFile && (
        <div className="dc-pending-file">
          {pendingPreview && (
            <img src={pendingPreview} alt="" className="dc-pending-preview" />
          )}
          <div className="dc-pending-info">
            <span className="dc-pending-name">{pendingFile.name}</span>
            <span className="dc-pending-size">
              {(pendingFile.size / 1024).toFixed(0)} KB
            </span>
          </div>
          {uploadProgress !== null && (
            <div className="dc-upload-bar">
              <div className="dc-upload-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          <button className="dc-pending-remove" onClick={clearPending}>
            <X size={14} />
          </button>
        </div>
      )}
      {uploadError && (
        <div className="dc-upload-error">{uploadError}</div>
      )}

      <form className="dc-input-area" onSubmit={handleSubmit}>
        <button
          type="button"
          className="dc-input-icon-btn"
          title="Attach File"
          onClick={() => fileRef.current?.click()}
          disabled={uploadProgress !== null}
        >
          <Paperclip size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          onChange={handleFileSelect}
          hidden
        />
        <div className="dc-input-box">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${channelName || ''}`}
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
          disabled={(!text.trim() && !pendingFile) || disabled || uploadProgress !== null}
          title="Send"
        >
          {uploadProgress !== null ? (
            <Loader2 size={18} className="spin" />
          ) : (
            <Send size={18} />
          )}
        </button>
      </form>
    </div>
  );
}
