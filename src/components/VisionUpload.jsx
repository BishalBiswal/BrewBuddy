import React, { useState, useRef, useCallback } from 'react';

async function sha256(data) {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function compressImage(file, maxDimension) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDimension) {
        height = Math.round(height * maxDimension / width);
        width = maxDimension;
      } else if (height > maxDimension) {
        width = Math.round(width * maxDimension / height);
        height = maxDimension;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Compression failed')); return; }
        resolve(blob);
      }, 'image/jpeg', 0.85);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

export default function VisionUpload({ onExtracted, onError }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);
  const cacheRef = useRef({});

  const processFile = useCallback(async (file) => {
    if (!file) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    try {
      const compressed = await compressImage(file, 1024);
      const arrayBuffer = await compressed.arrayBuffer();
      const hash = await sha256(arrayBuffer);

      if (cacheRef.current[hash]) {
        onExtracted(cacheRef.current[hash]);
        setUploading(false);
        return;
      }

      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mediaType = compressed.type || 'image/jpeg';

      const response = await fetch('/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64, mediaType, imageHash: hash }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Extraction failed' }));
        throw new Error(errData.detail ? `${errData.error}: ${errData.detail}` : (errData.error || `HTTP ${response.status}`));
      }

      const data = await response.json();
      cacheRef.current[hash] = data;
      onExtracted(data);
    } catch (err) {
      onError(err.message || 'Extraction failed');
    } finally {
      setUploading(false);
    }
  }, [onExtracted, onError]);

  const handleCamera = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = (e) => {
      if (e.target.files?.[0]) processFile(e.target.files[0]);
    };
    input.click();
  }, [processFile]);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="vision-upload">
      <p className="help-text">Optionally scan a coffee bag label to auto-fill the form.</p>
      <div className="vision-buttons">
        <button className="btn-secondary" onClick={handleCamera} disabled={uploading}>
          {uploading ? 'Scanning...' : 'Camera'}
        </button>
        <button className="btn-secondary" onClick={handleUpload} disabled={uploading}>
          Upload Image
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.[0]) processFile(e.target.files[0]); }}
      />
      {uploading && <p className="scanning-indicator">Processing image...</p>}
      {preview && !uploading && (
        <div className="vision-preview">
          <img src={preview} alt="Bag preview" />
        </div>
      )}
    </div>
  );
}




