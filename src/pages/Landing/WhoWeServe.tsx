import { ArrowRight, Ambulance, Building2, FlaskConical, Pill, ScanLine, ShieldCheck, Stethoscope, Users, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type Stakeholder = {
  icon: LucideIcon;
  role: string;
  tagline: string;
  description: string;
};

const stakeholders: Stakeholder[] = [
  {
    icon: Users,
    role: 'Patients',
    tagline: 'A simple place to stay on track',
    description: 'See appointments, check updates, and follow the next step with less effort.',
  },
  {
    icon: Stethoscope,
    role: 'Doctors',
    tagline: 'A calmer way to coordinate care',
    description: 'Keep plans and notes clear so support can move along smoothly.',
  },
  {
    icon: Building2,
    role: 'Hospitals',
    tagline: 'Support across the wider care team',
    description: 'Bring together people and updates in one steady place.',
  },
  {
    icon: Pill,
    role: 'Pharmacies',
    tagline: 'Clear medication support',
    description: 'Make each handoff easier to track and understand.',
  },
  {
    icon: FlaskConical,
    role: 'Laboratories',
    tagline: 'A clearer flow for results',
    description: 'Keep lab updates moving without confusion or delay.',
  },
  {
    icon: ScanLine,
    role: 'Imaging centers',
    tagline: 'Easy follow-through for scans',
    description: 'Share updates and next steps in a simple, familiar way.',
  },
  {
    icon: Ambulance,
    role: 'Ambulance services',
    tagline: 'Support when timing matters',
    description: 'Bring urgent updates together so response stays clear.',
  },
  {
    icon: ShieldCheck,
    role: 'Care teams',
    tagline: 'Shared visibility',
    description: 'Make sure everyone sees the same important information.',
  },
];

const WhoWeServe = () => {
  return (
    <section className="alera-navy-backdrop min-h-screen px-4 py-12 text-[#223127] sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="rounded-[2rem] border border-[#dfe8e0] bg-white/95 p-8 shadow-[0_12px_35px_rgba(20,30,24,0.08)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">Who it helps</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#14211a] sm:text-4xl">
            Designed for the people supporting care each day.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#45564d]">
            Alera works for patients, doctors, care teams, and service partners who all need a simple way to stay connected.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {stakeholders.map((stakeholder) => {
            const Icon = stakeholder.icon;
            return (
              <div key={stakeholder.role} className="rounded-[1.5rem] border border-[#dce5dd] bg-[#fdfcf8] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4faf4] text-[#4a785c]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#223127]">{stakeholder.role}</h3>
                <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#4a785c]">{stakeholder.tagline}</p>
                <p className="mt-3 text-sm leading-7 text-[#506057]">{stakeholder.description}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-[2rem] border border-[#dfe8e0] bg-[#f4faf4] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)] sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">Ready to get started?</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#223127]">Bring your care team into one calmer place.</h2>
            </div>
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-[#2f6b4f] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#285c43]">
              Create your profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WhoWeServe;
