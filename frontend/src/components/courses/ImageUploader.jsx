import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toImageUrl } from '../../api';

export default function ImageUploader({ value, onChange, maxSizeMB = 2, disabled }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [objectUrl, setObjectUrl] = useState('');

  function pick() {
    if (disabled) return;
    inputRef.current?.click();
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const typeOk = ['image/jpeg','image/jpg','image/png'].includes(file.type);
    if (!typeOk) {
      const msg = 'Only JPG and PNG images are allowed.';
      setError(msg);
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } }));
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      const msg = `Image too large. Max ${maxSizeMB} MB.`;
      setError(msg);
      window.dispatchEvent(new CustomEvent('toast', { detail: { type: 'error', message: msg } }));
      return;
    }
    setError('');
    onChange?.(file);
  }

  const preview = useMemo(() => {
    if (!value) return objectUrl || '';
    if (value instanceof File) {
      // generate object URL for immediate preview
      return objectUrl || '';
    }
    if (typeof value === 'string') return toImageUrl(value);
    return '';
  }, [value, objectUrl]);

  // Manage object URL lifecycle when value is a File
  useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value);
      setObjectUrl(url);
      return () => { try { URL.revokeObjectURL(url); } catch(_) {} setObjectUrl(''); };
    }
    // if value not a File, clear any previous object URL
    setObjectUrl('');
    return () => {};
  }, [value]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 72, height: 72, borderRadius: 8, overflow: 'hidden', background: '#f5f5f5', border: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {preview ? (<img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />) : (<span role="img" aria-label="image">🖼️</span>)}
      </div>
      <button type="button" onClick={pick} disabled={disabled} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: '#6c63ff', color: '#fff', fontWeight: 700 }}>Choose Image</button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png" style={{ display: 'none' }} onChange={onFile} />
      {error && <span style={{ color: '#b71c1c', fontSize: 12 }}>{error}</span>}
    </div>
  );
}
