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
    if (e.target.files) setFiles(Array.from(e.target.files));
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
      <div className="contact__form-wrap" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem', color: 'var(--color-accent)' }}>✓</div>
        <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Message Sent</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>We will get back to you shortly.</p>
      </div>
    );
  }

  return (
    <div className="contact__form-wrap" data-aos="fade-left" data-aos-delay={100}>
      <form className="contact__form" onSubmit={handleSubmit}>
        <div className="form__group">
          <input
            type="text"
            id="contact-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            required
            placeholder=" "
          />
          <label htmlFor="contact-name">{t('contact.fullName')}</label>
        </div>

        <div className="form__group">
          <input
            type="email"
            id="contact-email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            placeholder=" "
          />
          <label htmlFor="contact-email">{t('contact.email')}</label>
        </div>

        <div className="form__group">
          <input
            type="tel"
            id="contact-phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder=" "
          />
          <label htmlFor="contact-phone">{t('contact.phonePlaceholder')}</label>
        </div>

        <div className="form__group">
          <select
            id="contact-service"
            name="service"
            value={formData.service}
            onChange={handleChange}
            required
            aria-label={t('contact.serviceNeeded')}
          >
            <option value="" disabled></option>
            <option value="predesign">{t('option.predesign')}</option>
            <option value="structural">{t('option.structural')}</option>
            <option value="review">{t('option.review')}</option>
            <option value="post-tension">{t('option.postTension')}</option>
            <option value="bim">{t('option.bim')}</option>
            <option value="digital">{t('option.digital')}</option>
            <option value="other">{t('option.other')}</option>
          </select>
          <label htmlFor="contact-service">{t('contact.serviceNeeded')}</label>
        </div>

        <div className="form__group form__group--full">
          <textarea
            id="contact-message"
            name="message"
            value={formData.message}
            onChange={handleChange}
            required
            rows={5}
            placeholder=" "
          />
          <label htmlFor="contact-message">{t('contact.projectDetails')}</label>
        </div>

        <div className="form__group form__group--full form__group--file">
          <label htmlFor="contact-files" className="file-upload">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
            <span>{t('contact.attachFiles')}</span>
            <small>{t('contact.fileTypes')}</small>
          </label>
          <input
            ref={fileRef}
            id="contact-files"
            type="file"
            multiple
            accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.doc,.docx,.zip"
            onChange={handleFiles}
          />
          {files.length > 0 && (
            <div className="file-list">
              {files.map((f, i) => (
                <div key={i} className="file-list__item">
                  <span>{f.name}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="form__group--full" style={{ color: 'var(--color-error)', fontSize: '0.875rem' }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className="btn btn--primary btn--full" data-magnetic>
          {submitting ? '...' : t('contact.sendMessage')}
        </button>
      </form>
    </div>
  );
}
