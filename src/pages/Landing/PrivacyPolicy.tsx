import { motion } from 'framer-motion';
import { Shield, Lock, Eye, Database, Mail } from 'lucide-react';

const sections = [
  {
    icon: Database,
    title: '1. Information We Collect',
    content: `We collect information you provide directly, including your name, email address, phone number, professional license details, and health-related data where you explicitly provide it. We also collect technical data such as browser type, IP address, and usage logs to maintain system security and performance.

For healthcare providers (doctors, hospitals, labs, pharmacies, imaging centers, ambulance services), we collect and verify professional credentials including license numbers, jurisdiction information, and specialty designations.`,
  },
  {
    icon: Shield,
    title: '2. How We Use Your Information',
    content: `We use the information we collect to:
• Operate and maintain the Alera platform and all associated healthcare workflows
• Verify the credentials and professional status of healthcare providers
• Facilitate secure communication between patients and their healthcare team
• Process lab test requests, imaging orders, prescriptions, and appointment bookings
• Send notifications and appointment reminders
• Meet our legal obligations and comply with applicable healthcare regulations
• Detect, investigate, and prevent fraudulent transactions and other illegal activities`,
  },
  {
    icon: Lock,
    title: '3. Data Security & Encryption',
    content: `All data transmitted through the Alera platform is encrypted in transit using TLS 1.3. Sensitive health data stored on our servers is encrypted at rest using AES-256. We implement strict access controls, ensuring that only authorized parties can view protected health information.

All API endpoints are protected by secure, HTTP-only cookie-based authentication with CSRF protection. We maintain a comprehensive audit log of all access to patient data, which is retained for a minimum of 7 years as required by HIPAA.`,
  },
  {
    icon: Eye,
    title: '4. Information Sharing & Disclosure',
    content: `We do not sell, trade, or rent your personal or health information to third parties. We share health data only:
• With healthcare providers directly involved in your care (as authorized by you as part of the healthcare workflow)
• With administrators responsible for platform oversight and provider credentialing
• As required by applicable law, regulation, court order, or government request
• To enforce our Terms of Service or protect the rights, property, or safety of Alera, its users, or others`,
  },
  {
    icon: Mail,
    title: '5. Contact & Data Requests',
    content: `You have the right to access, correct, or request deletion of your personal data. To exercise any of these rights, or if you have any questions about this Privacy Policy, please contact our Data Protection Officer at:

Email: privacy@alera.health
Postal: Alera Healthcare Platform, Data Protection Office

We will respond to all requests within 30 days. For urgent healthcare-related data access requests, we may be able to expedite your request — please note this in your message.`,
  },
];

const PrivacyPolicy = () => (
  <div className="mx-auto min-h-screen max-w-4xl px-6 py-16 sm:px-8 font-body text-foreground">
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="border-b border-border pb-8 mb-12">
        <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-soft">Compliance & Governance</p>
        <h1 className="mt-2 text-3xl font-normal text-foreground font-display sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-xs font-mono text-ink-soft">Effective Date: January 1, 2026 · Standard Version 2.4</p>
        <div className="mt-6 rounded-surface border border-border bg-paper p-4 text-xs text-ink-soft leading-relaxed">
          Alera is a healthcare platform subject to applicable healthcare privacy laws including HIPAA. We take the protection of your health information extremely seriously. This policy explains what we collect, why, and how we protect it.
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
        <p>This policy may be updated periodically. We will notify registered users of material changes by email. Continued use of the Alera platform after changes constitutes acceptance of the updated policy.</p>
      </div>
    </motion.div>
  </div>
);

export default PrivacyPolicy;
