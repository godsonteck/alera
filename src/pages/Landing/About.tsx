import { Link } from 'react-router-dom';
import {
  Activity,
  Ambulance,
  ArrowRight,
  Building2,
  FileText,
  FlaskConical,
  HeartPulse,
  LockKeyhole,
  Pill,
  ShieldCheck,
  Users,
} from 'lucide-react';

const audiences = [
  { icon: Users, title: 'Patients and families', text: 'Appointments, results, prescriptions, reminders, messages, and personal health information in one account.' },
  { icon: HeartPulse, title: 'Clinicians and therapists', text: 'Patient lists, clinical notes, referrals, scheduling, and the context needed to coordinate care.' },
  { icon: Building2, title: 'Hospitals and care organisations', text: 'Shared visibility across teams, referrals, service coordination, and operational oversight.' },
  { icon: FlaskConical, title: 'Laboratories and imaging centres', text: 'Diagnostic requests, results, report publication, and secure handoffs to the people involved in care.' },
  { icon: Pill, title: 'Pharmacies', text: 'Prescription queues, refill workflows, inventory, and pharmacist-facing referral information.' },
  { icon: Ambulance, title: 'Emergency services', text: 'Dispatch requests, vehicle status, live-location support, and relevant care coordination.' },
];

const foundations = [
  { icon: ShieldCheck, title: 'Role-aware access', text: 'Views and actions are tailored to a user’s role. Workforce access is verified and patient data is scoped to documented care relationships and consent.' },
  { icon: LockKeyhole, title: 'Privacy and accountability', text: 'The platform includes authenticated sessions, CSRF protections, audit logging, verification workflows, consent records, and controlled medical-record access.' },
  { icon: Activity, title: 'Continuity over fragmentation', text: 'Alera connects events across appointments, prescriptions, diagnostics, messages, records, and referrals so care can be understood as a sequence, not a collection of disconnected systems.' },
];

const capabilities = [
  ['Appointments and reminders', 'Schedule care, track status, send reminders, and support telehealth workflows.'],
  ['Medical records and history', 'Maintain structured health information, allergies, problems, clinical notes, consent, and history with controlled access.'],
  ['Diagnostics', 'Route laboratory and imaging requests, publish results, attach reports, and make the next action visible.'],
  ['Prescriptions and pharmacy', 'Create, route, review, and fulfil prescriptions while tracking refills and inventory.'],
  ['Referrals and handoffs', 'Move people and information between clinicians, organisations, diagnostics, pharmacy, and emergency services.'],
  ['Secure communication', 'Keep care conversations and notifications connected to the people and workflows they concern.'],
  ['Administration', 'Manage users, professional verification, system notices, billing views, audit activity, and system controls.'],
];

const About = () => (
  <div className="relative min-h-screen overflow-hidden bg-[#f5f7f8] text-[#1f2933]">
    <div className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.18]" style={{ backgroundImage: 'url("/images/hero_command_center.png")' }} />
    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,_rgba(245,247,248,0.82),_rgba(245,247,248,0.68)_55%,_rgba(245,247,248,0.84))]" />
    <section className="alera-navy-backdrop relative z-10 border-b border-[#23354c]">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:py-16">
        <div>
          <p className="border-l-2 border-[#8fd0af] pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#b7e4ca]">About Alera</p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-white sm:text-5xl">
            Care coordination should not depend on chasing information.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#d4e0e9]">
            Alera is a healthcare coordination platform for the people who receive care and the teams who provide it. It brings the information and workflows around care into a connected, role-aware account.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-md bg-[#0b3d62] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#082f4c]">
              Create account <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/how-it-works" className="inline-flex items-center gap-2 border border-white/35 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20">
              How it works
            </Link>
          </div>
        </div>
        <div className="border border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
          <img src="/images/consulting_patients.png" alt="A clinician and patient discussing care" className="h-[320px] w-full object-cover lg:h-full" />
        </div>
      </div>
    </section>

    <section className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b3d62]">Why Alera is needed</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Care should not feel like a long search for answers.</h2>
      <div className="mt-7 space-y-5 text-base leading-8 text-slate-700">
        <p>Imagine waiting at a hospital for hours, then finding out the specialist is not available. Or getting to an imaging centre only to meet several ambulances that arrived at the same time. Or being told you need another test before you can continue, after you have already spent time and money travelling.</p>
        <p>These are not small problems. They create stress for patients, families, doctors, nurses, ambulance teams, laboratories, pharmacies, and hospitals. Too often, people do not know what is needed, where to go, who is available, or what should happen next.</p>
        <p>Alera is built to reduce that confusion. It gives the right people one place to see appointments, requests, results, referrals, prescriptions, messages, and important updates. Instead of repeating the same information in different places, care teams can work from a clearer shared picture.</p>
        <p>For patients, that means less guessing and fewer wasted trips. For families, it means better updates. For doctors and nurses, it means quicker access to the information needed to make decisions. For laboratories, imaging centres, pharmacies, hospitals, and ambulance teams, it means smoother handoffs and better planning.</p>
        <p>Alera does not replace the people who give care. It helps them work together better. The goal is simple: help every person understand what is happening, what is needed next, and who is responsible for it.</p>
      </div>
      <div className="mt-8 border-l-2 border-[#0b3d62] bg-white/80 px-5 py-4 text-lg font-medium leading-8 text-slate-900">
        Better coordination means less waiting, less confusion, and more time for care.
      </div>
    </section>

    <section className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b3d62]">What Alera is for</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">One connected view of care.</h2>
        <p className="mt-4 leading-7 text-slate-600">Healthcare often involves separate systems for visits, results, prescriptions, referrals, messages, and emergency response. Alera is designed to make those handoffs clearer, while retaining the roles and permissions each part of care requires.</p>
      </div>
      <div className="mt-9 grid gap-px border border-slate-200 bg-slate-200 md:grid-cols-2 xl:grid-cols-3">
        {audiences.map(({ icon: Icon, title, text }) => (
          <article key={title} className="bg-white p-6">
            <Icon className="h-5 w-5 text-[#0b3d62]" />
            <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="relative z-10 border-y border-slate-200 bg-white/80">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b3d62]">Platform capabilities</p>
        <div className="mt-7 grid gap-x-10 md:grid-cols-2">
          {capabilities.map(([title, description]) => (
            <div key={title} className="border-t border-slate-200 py-5">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>

    <section className="relative z-10 mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0b3d62]">How it is built</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Trust is a product requirement.</h2>
          <p className="mt-4 leading-7 text-slate-600">Alera is a web application with role-specific dashboards and a backend API for identity, care data, operational workflows, and audit activity. The platform is designed around explicit access checks, meaningful consent, and operational resilience—not around exposing a generic directory of health information.</p>
        </div>
        <div className="grid gap-px border border-slate-200 bg-slate-200 md:grid-cols-3">
          {foundations.map(({ icon: Icon, title, text }) => (
            <article key={title} className="bg-white p-6">
              <Icon className="h-5 w-5 text-[#0b3d62]" />
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>

    <section className="relative z-10 border-t border-slate-200 bg-slate-900 text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-200">Alera</p>
          <h2 className="mt-2 text-2xl font-semibold">Care information should lead to the next useful action.</h2>
        </div>
        <Link to="/features" className="inline-flex w-fit items-center gap-2 border border-slate-500 px-4 py-3 text-sm font-semibold transition-colors hover:bg-white hover:text-slate-900">
          Explore features <FileText className="h-4 w-4" />
        </Link>
      </div>
    </section>
  </div>
);

export default About;
