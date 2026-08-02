import type { Metadata } from 'next';
import { company, contact } from '@/lib/ttc/site';
import { PageHero } from '@/components/ttc/mp/PageHero';
import { SectionHeading } from '@/components/ttc/mp/primitives';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${company.legalName} handles information submitted through this website.`,
  alternates: { canonical: '/privacy' },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        crumbs={[{ href: '/', label: 'Home' }, { label: 'Privacy Policy' }]}
        titleLines={['Privacy Policy']}
        plainTitle="Privacy Policy"
        sub="What we collect through this website, why we collect it, and what we do with it."
      />

      <section className="mp-section mp-surface--paper">
        <div className="mp-shell mp-shell--narrow">
          <SectionHeading n="01" label="Policy" />
          <div className="mp-prose">
            <h2>What we collect</h2>
            <p>
              The only personal information this website collects is what you
              type into the contact form: your name, email address, optional
              phone number and company, the service you selected, the project
              location and timeline if you provide them, and the description you
              write.
            </p>

            <h2>Why we collect it</h2>
            <p>
              We use it to respond to your inquiry and to understand the
              engineering scope you are asking about. We do not sell it, rent it,
              or share it for advertising.
            </p>

            <h2>How it is stored</h2>
            <p>
              Submissions are stored in our project database and a notification
              is emailed to the office through a transactional email provider so
              that we see your message. Access is limited to the people who need
              it to reply to you.
            </p>

            <h2>How long we keep it</h2>
            <p>
              Inquiries are retained while they are commercially relevant and
              for as long as any resulting engagement requires. You may ask us
              to delete your inquiry at any time.
            </p>

            <h2>Cookies and analytics</h2>
            <p>
              This site does not set advertising or tracking cookies. Cookies
              may be used by the authenticated project-management area of this
              domain for sign-in purposes; those are strictly necessary to keep
              a session active and are not used to profile visitors to the
              public site.
            </p>

            <h2>Your choices</h2>
            <p>
              You can ask us what we hold about you, ask for it to be corrected,
              or ask for it to be deleted. Write to{' '}
              <a href={`mailto:${contact.email}`}>{contact.email}</a> and we
              will respond.
            </p>

            <h2>Changes</h2>
            <p>
              If this policy changes we will update it on this page. Material
              changes will be reflected in the date shown to you when you next
              submit the form.
            </p>

            <h2>Contact</h2>
            <p>
              {company.legalName} — {contact.serviceAreaLabel}.{' '}
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
