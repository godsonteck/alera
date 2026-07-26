import { motion } from 'framer-motion';
import { FileText, UserCheck, AlertCircle, Scale, ShieldAlert } from 'lucide-react';

const sections = [
  {
    icon: UserCheck,
    title: '1. Acceptance of Terms',
    content: `By accessing or using the Alera healthcare platform ("Platform"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use the Platform.

These Terms apply to all users including patients, healthcare providers (doctors, hospitals, laboratories, imaging centers, pharmacies, ambulance services), and administrators.`,
  },
  {
    icon: FileText,
    title: '2. Account Registration & Eligibility',
    content: `To use the Platform, you must register for an account. You agree to provide accurate, current, and complete information during registration. You are responsible for maintaining the confidentiality of your login credentials.

Professional accounts (doctors, hospitals, labs, pharmacies, imaging centers, ambulance services) require submission of valid professional license information. Accounts remain in "pending" status until credentials are verified by a platform administrator. Misrepresentation of credentials is grounds for immediate account termination and may be reported to relevant licensing authorities.

You must be at least 18 years old to create an account.`,
  },
  {
    icon: AlertCircle,
    title: '3. Appropriate Use',
    content: `You agree to use the Platform only for lawful purposes related to healthcare delivery, management, and coordination. You must not:
• Use the Platform to transmit unauthorized or harmful content
• Attempt to gain unauthorized access to any part of the Platform or other users' data
• Use the Platform to provide false or misleading health information
• Use automated tools, bots, or scrapers to access the Platform without written authorization
• Share your account credentials with any other person

Patient health information accessed through the Platform may only be used for the purpose of providing or receiving healthcare services.`,
  },
  {
    icon: Scale,
    title: '4. Healthcare Disclaimer',
    content: `The Alera Platform is a healthcare coordination and communication tool. It does not replace the professional judgment of qualified healthcare providers.

Information presented on the Platform, including lab results, imaging reports, and prescription records, must be interpreted by a licensed healthcare professional. Patients should always consult their doctor or a qualified medical professional for medical advice, diagnosis, or treatment decisions.

Alera does not provide medical advice, and use of the Platform does not constitute a doctor-patient relationship with Alera itself.`,
  },
  {
    icon: ShieldAlert,
    title: '5. Termination & Governing Law',
    content: `We reserve the right to suspend or terminate your account at any time if you violate these Terms or engage in conduct that we determine is harmful to the Platform, other users, or third parties.

These Terms are governed by applicable laws. Any disputes arising from these Terms or your use of the Platform will be subject to binding arbitration, except where prohibited by law.

We may update these Terms from time to time. Continued use of the Platform after updates constitutes acceptance of the revised Terms. For questions about these Terms, contact legal@alera.health.`,
  },
];

const TermsOfService = () => (
  <div className="mx-auto min-h-screen max-w-4xl px-6 py-16 sm:px-8 font-body text-foreground">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="border-b border-border pb-8 mb-12">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-soft">Compliance & Governance</p>
        <h1 className="mt-2 text-3xl font-normal text-foreground font-display sm:text-4xl">Terms of Service</h1>
        <p className="mt-2 text-xs font-mono text-ink-soft">Effective Date: January 1, 2026 · Standard Version 2.4</p>
        <div className="mt-6 rounded-surface border border-border bg-paper p-4 text-xs text-ink-soft leading-relaxed">
          Please read these Terms carefully before using the Alera Platform. These Terms constitute a legally binding agreement between you and Alera.
        </div>
      </div>

      <div className="space-y-10">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title}>
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-control border border-border bg-paper text-foreground">
                  <Icon className="h-4 w-4 text-acuity-3" />
                </div>
                <h2 className="text-lg font-bold text-foreground font-display">{section.title}</h2>
              </div>
              <div className="text-xs leading-relaxed text-ink-soft font-light whitespace-pre-line pl-12">
                {section.content}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-12 border-t border-border pt-8 text-xs text-ink-soft">
        <p>Questions about these Terms? Contact us at <span className="text-acuity-3">legal@alera.health</span></p>
      </div>
    </motion.div>
  </div>
);

export default TermsOfService;
