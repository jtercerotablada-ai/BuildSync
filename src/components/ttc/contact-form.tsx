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
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData }),
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
        <p style={{ color: '#a3a3a3' }}>We will get back to you shortly.</p>
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
    color: '#8a8a8a',
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
          id="contact-name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          required
          placeholder=" "
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
        <label htmlFor="contact-name" style={formData.name ? activeLabelStyle : labelStyle}>
          {t('contact.fullName')}
        </label>
      </div>

      {/* Email */}
      <div style={{ position: 'relative' }}>
        <input
          type="email"
          id="contact-email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          required
          placeholder=" "
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
        <label htmlFor="contact-email" style={formData.email ? activeLabelStyle : labelStyle}>
          {t('contact.email')}
        </label>
      </div>

      {/* Phone */}
      <div style={{ position: 'relative' }}>
        <input
          type="tel"
          id="contact-phone"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          placeholder=" "
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = '#c9a84c')}
          onBlur={(e) => (e.target.style.borderColor = '#222')}
        />
        <label htmlFor="contact-phone" style={formData.phone ? activeLabelStyle : labelStyle}>
          {t('contact.phonePlaceholder')}
        </label>
      </div>

      {/* Service */}
      <div style={{ position: 'relative' }}>
        <select
          id="contact-service"
          name="service"
          value={formData.service}
          onChange={handleChange}
          required
          aria-label={t('contact.serviceNeeded')}
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
        <label htmlFor="contact-service" style={formData.service ? activeLabelStyle : labelStyle}>
          {t('contact.serviceNeeded')}
        </label>
      </div>

      {/* Message */}
      <div style={{ position: 'relative' }}>
        <textarea
          id="contact-message"
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
          htmlFor="contact-message"
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
          htmlFor="contact-files"
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
            aria-hidden="true"
          >
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          <span style={{ color: '#a3a3a3', fontSize: '0.875rem' }}>
            {t('contact.attachFiles')}
          </span>
          <small style={{ color: '#8a8a8a', fontSize: '0.75rem' }}>
            {t('contact.fileTypes')}
          </small>
        </label>
        <input
          ref={fileRef}
          id="contact-files"
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
                  color: '#a3a3a3',
                }}
              >
                <span>{f.name}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() =>
                    setFiles(files.filter((_, idx) => idx !== i))
                  }
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#8a8a8a',
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
        <p role="alert" style={{ color: '#e74c3c', fontSize: '0.875rem' }}>{error}</p>
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
