import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import {
  CheckCircle2, XCircle, ArrowRight,
  Users, Stethoscope, Building2, Pill, FlaskConical, ScanLine, Ambulance, BadgeCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const sectionReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};
const groupReveal: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

const comparisonItems = [
  'End-to-end patient care records within a single login',
  'Real-time laboratory and diagnostic report distribution',
  'e-Prescriptions sent directly to patient-selected pharmacies',
  'Emergency fleet telemetry and direct trauma department coordinates',
  'Cryptographically append-only audit logs with full security coverage',
  'Role-specific command dashboards matching clinical tasks',
  'Automated professional credential verification en route',
];

const withoutAlera = [
  'Vague separate portals for every medical facility type',
  'Results physically faxed or telephoned between laboratories',
  'Paper prescriptions high in data transcription error rates',
  'Manual phone coordination for ambulance arrivals',
  'Fragmented patient data without a single timeline index',
  'Siloed billing settlement and complex audit queries',
  'Slow credential verification protocols taking weeks',
];

const testimonials = [
  {
    quote: 'Alera eliminated the delay between my clinical order and the laboratory accession. Results are returned on screen within minutes.',
    name: 'Dr. Kwame Mensah',
    role: 'Family Medicine Practitioner',
    icon: Stethoscope,
  },
  {
    quote: 'Handling imaging scans and radiologic findings used to require massive physical filing. Alera streams DICOM logs cleanly.',
    name: 'Amara Osei',
    role: 'Director, City Imaging Center',
    icon: ScanLine,
  },
  {
    quote: 'Emergency dispatch is finally coordinated. We stream trauma metrics directly to wards while patients are still en route.',
    name: 'Emeka Adeyemi',
    role: 'EMS Operations Manager',
    icon: Ambulance,
  },
  {
    quote: 'Electronic scripts arrive verified and structured with complete allergy histories. Transcription errors are eliminated.',
    name: 'Grace Otieno',
    role: 'Chief Pharmacist',
    icon: Pill,
  },
];

const stats = [
  { value: '8 Nodes', label: 'Ecosystem Alignment', sub: 'Unified operational consoles' },
  { value: '100%', label: 'Cipher Protection', sub: 'AES-256 standard encryption' },
  { value: '&lt; 15ms', label: 'Network Latency', sub: 'Instant status distribution' },
  { value: 'Full Log', label: 'Cryptographic Audit', sub: 'Chronological append-only events' },
];

const WhyAlera = () => {
  return (
    <div className="min-h-screen bg-background/80 text-foreground font-body">
      {/* Hero */}
      <section className="relative px-6 pb-16 pt-16 sm:px-8 lg:px-12 border-b border-border">
        <div className="mx-auto max-w-7xl">
          <motion.div variants={sectionReveal} initial="hidden" animate="visible" className="max-w-3xl">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-soft">Clinical Efficacy Report</p>
            <h1 className="mt-3 text-3xl font-normal tracking-tight text-foreground font-display sm:text-4xl">
              Eliminating Systemic Care Fragmentation
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-soft font-light">
              Healthcare portals are isolated. Providers coordinate over faxes, paper slips, and physical phone lists. Alera implements a standard, high-performance infrastructure layer linking every medical stakeholder inside a single, zero-trust ecosystem.
            </p>
          </motion.div>

          {/* Stats Bar */}
          <motion.div
            variants={groupReveal} initial="hidden" animate="visible"
            className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {stats.map((s) => (
              <motion.div key={s.label} variants={sectionReveal}
                className="rounded-surface border border-border bg-card p-5"
              >
                <div className="text-2xl font-bold tracking-tight text-foreground font-display" dangerouslySetInnerHTML={{ __html: s.value }} />
                <div className="mt-1.5 text-xs font-bold text-foreground font-mono">{s.label}</div>
                <div className="mt-0.5 text-xs text-ink-soft">{s.sub}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Comparison Grid */}
      <section className="px-6 py-16 sm:px-8 lg:px-12 border-b border-border">
        <div className="mx-auto max-w-7xl">
          <motion.div variants={sectionReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}>
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-soft">Operational Comparison Matrix</p>
            <h2 className="mt-3 text-2xl font-normal tracking-tight text-foreground font-display">
              The Analogue Pipeline vs. Alera Operating Layer
            </h2>
          </motion.div>

          <motion.div
            variants={sectionReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            className="mt-8 overflow-hidden rounded-surface border border-border bg-card shadow-xs"
          >
            <div className="grid lg:grid-cols-2">
              {/* Without */}
              <div className="p-8 sm:p-10 border-b lg:border-b-0 lg:border-r border-border bg-paper/40">
                <div className="mb-6 inline-flex items-center gap-2 rounded-control border border-border bg-paper px-3 py-1 text-[10px] font-mono font-bold uppercase text-ink-soft">
                  <XCircle className="h-3.5 w-3.5 text-acuity-1" />
                  Siloed Operations
                </div>
                <div className="space-y-4">
                  {withoutAlera.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs text-ink-soft leading-relaxed">
                      <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-acuity-1/60" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* With */}
              <div className="bg-card p-8 sm:p-10">
                <div className="mb-6 inline-flex items-center gap-2 rounded-control border border-acuity-3/40 bg-acuity-3/10 px-3 py-1 text-[10px] font-mono font-bold uppercase text-acuity-3">
                  <CheckCircle2 className="h-3.5 w-3.5 text-acuity-3" />
                  Alera Core Unified Layer
                </div>
                <div className="space-y-4">
                  {comparisonItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-3 text-xs font-semibold text-foreground leading-relaxed">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-acuity-3" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Flat Monospace Callout Bar */}
            <div className="border-t border-border bg-primary px-8 py-6 sm:px-10 text-primary-foreground">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-mono tracking-wider uppercase">
                  DEPLOYMENT PROTOCOL ESTABLISHES SECURE NETWORK INTEGRITY IN MINUTES.
                </p>
                <Button asChild className="rounded-control bg-primary-foreground px-4 py-2 text-xs font-mono font-bold uppercase tracking-wider text-primary hover:opacity-90 flex-shrink-0">
                  <Link to="/signup">
                    Initialize Core Node
                  </Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Editorial Testimonials */}
      <section className="px-6 py-16 sm:px-8 lg:px-12 border-b border-border">
        <div className="mx-auto max-w-7xl">
          <motion.div variants={sectionReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }} className="max-w-2xl">
            <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-ink-soft">Verified Clinical Accounts</p>
            <h2 className="mt-3 text-2xl font-normal tracking-tight text-foreground font-display">
              Integrated Performance Outcomes
            </h2>
            <p className="mt-4 text-xs leading-relaxed text-ink-soft font-light">
              Review verified evaluations from active medical networks running Alera core nodes daily.
            </p>
          </motion.div>

          <motion.div
            variants={groupReveal} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-60px' }}
            className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          >
            {testimonials.map((t) => {
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.name} variants={sectionReveal}
                  className="flex flex-col gap-4 rounded-surface border border-border bg-card p-5 shadow-xs"
                >
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-control border border-border bg-paper text-foreground">
                    <Icon className="h-4 w-4 text-acuity-3" />
                  </div>
                  <p className="flex-1 text-xs leading-relaxed text-ink-soft font-light">"{t.quote}"</p>
                  <div className="border-t border-border pt-3">
                    <p className="text-xs font-bold text-foreground font-display">{t.name}</p>
                    <p className="text-[10px] font-mono font-semibold text-ink-soft uppercase tracking-wider mt-0.5">{t.role}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="px-6 pb-20 pt-12 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <motion.div
            variants={sectionReveal} initial="hidden" whileInView="visible" viewport={{ once: true }}
            className="rounded-surface border border-border bg-primary p-8 text-primary-foreground sm:p-10 shadow-sm"
          >
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-primary-foreground/70">Deploy Operating Layer</p>
                <h2 className="mt-2 text-xl font-bold tracking-tight font-display">
                  Stop patching fragmented, non-compliant portals.
                </h2>
                <p className="mt-2 text-xs text-primary-foreground/80 max-w-xl font-light">
                  Unify your care team inside a zero-trust environment. Node authorization requires minutes to complete.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-shrink-0">
                <Button asChild size="lg" className="rounded-control bg-paper px-5 text-xs font-mono font-bold uppercase tracking-wider text-ink hover:opacity-90">
                  <Link to="/signup">Create Verified Account</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-control border border-paper/30 bg-transparent px-5 text-xs font-mono font-bold uppercase tracking-wider text-primary-foreground hover:bg-paper/10">
                  <Link to="/features">System Index</Link>
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
};

export default WhyAlera;
