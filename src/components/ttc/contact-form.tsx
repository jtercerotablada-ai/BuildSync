'use client';

import React, { useState, useRef } from 'react';
import { useTranslation } from './language-provider';

export function ContactForm() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    service: '',
    message: '',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const data = new FormData();
      data.append('name', formData.name);
      data.append('email', formData.email);
      data.append('phone', formData.phone);
      data.append('service', formData.service);
      data.append('message', formData.message);
      files.forEach((f) => data.append('files', f));

      const res = await fetch('/api/contact', {
        method: 'POST',
        body: data,
      });

      if (res.ok) {
        setSubmitted(true);
        setFormData({ name: '', email: '', phone: '', service: '', message: '' });
        setFiles([]);
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          padding: '3rem',
          background: '#141414',
          border: '1px solid #222',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#10003;</div>
        <h3
          style={{
            fontFamily: 'var(--ttc-font-heading)',
            fontSize: '1.5rem',
            color: '#fff',
            marginBottom: '0.5rem',
          }}
        >
          Message Sent
        </h3>
        <p style={{ color: '#999' }}>We will get back to you shortly.</p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '1.25rem 1rem 0.5rem',
    background: '#141414',
    border: '1px solid #222',
    color: '#fff',
    fontSize: '0.9375rem',
    outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.3s',
  };

  const labelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '1rem',
    transform: 'translateY(-50%)',
    color: '#666',
    fontSize: '0.9375rem',
    pointerEvents: 'none',
    transition: 'all 0.3s',
  };

  const activeLabelStyle: React.CSSProperties = {
    ...labelStyle,
    top: '0.5rem',
    transform: 'none',
    fontSize: '0.6875rem',
    color: '#c9a84c',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Name */}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder=" "
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
        <label style={formData.name ? activeLabelStyle : labelStyle}>
          {t('contact.fullName')}
        </label>
      </div>

      {/* Email */}
      <div style={{ position: 'relative' }}>
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          placeholder=" "
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
        <label style={formData.email ? activeLabelStyle : labelStyle}>
          {t('contact.email')}
        </label>
      </div>

      {/* Phone */}
      <div style={{ position: 'relative' }}>
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder=" "
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
        <label style={formData.phone ? activeLabelStyle : labelStyle}>
          {t('contact.phonePlaceholder')}
        </label>
      </div>

      {/* Service */}
      <div style={{ position: 'relative' }}>
        <select
          name="service"
          value={formData.service}
          onChange={handleChange}
          required
          style={{
            ...inputStyle,
            appearance: 'none',
            cursor: 'pointer',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        >
          <option value="" disabled />
          <option value="predesign">{t('option.predesign')}</option>
          <option value="structural">{t('option.structural')}</option>
          <option value="review">{t('option.review')}</option>
          <option value="post-tension">{t('option.postTension')}</option>
          <option value="bim">{t('option.bim')}</option>
          <option value="digital">{t('option.digital')}</option>
          <option value="other">{t('option.other')}</option>
        </select>
        <label style={formData.service ? activeLabelStyle : labelStyle}>
          {t('contact.serviceNeeded')}
        </label>
      </div>

      {/* Message */}
      <div style={{ position: 'relative' }}>
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          required
          rows={5}
          placeholder=" "
          style={{
            ...inputStyle,
            resize: 'vertical',
          }}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
        <label
          style={
            formData.message
              ? { ...activeLabelStyle }
              : { ...labelStyle, top: '1.25rem', transform: 'none' }
          }
        >
          {t('contact.projectDetails')}
        </label>
      </div>

      {/* File Upload */}
      <div>
        <label
          onClick={() => fileRef.current?.click()}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1.5rem',
            border: '1px dashed #333',
            background: '#141414',
            cursor: 'pointer',
            transition: 'border-color 0.3s',
            textAlign: 'center',
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLElement).style.borderColor = '#c9a84c')
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLElement).style.borderColor = '#333')
          }
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#999"
            strokeWidth="2"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span style={{ color: '#999', fontSize: '0.875rem' }}>
            {t('contact.attachFiles')}
          </span>
          <small style={{ color: '#666', fontSize: '0.75rem' }}>
            {t('contact.fileTypes')}
          </small>
        </label>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.doc,.docx,.zip"
          onChange={handleFiles}
          style={{ display: 'none' }}
        />
        {files.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            {files.map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '0.5rem',
                  background: '#1a1a1a',
                  marginBottom: '0.25rem',
                  fontSize: '0.8125rem',
                  color: '#999',
                }}
              >
                <span>{f.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    setFiles(files.filter((_, idx) => idx !== i))
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                  }}
                >
                  &#10005;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <p style={{ color: '#e74c3c', fontSize: '0.875rem' }}>{error}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={submitting}
        className="ttc-btn ttc-btn--primary ttc-btn--full"
        style={{
          opacity: submitting ? 0.6 : 1,
          cursor: submitting ? 'not-allowed' : 'pointer',
        }}
      >
        {submitting ? '...' : t('contact.sendMessage')}
      </button>
    </form>
  );
}
