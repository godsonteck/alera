import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, Clock3, MessageCircle, ShieldCheck } from "lucide-react";

const careHighlights = [
  {
    title: "Book before you go",
    text: "See available services and book an appointment instead of joining a long queue.",
    icon: CalendarDays,
  },
  {
    title: "Send the right request",
    text: "Doctors can send lab, scan, pharmacy, or specialist requests to the right place.",
    icon: MessageCircle,
  },
  {
    title: "Follow your care",
    text: "Check your results, prescriptions, referrals, and appointment updates in one account.",
    icon: ShieldCheck,
  },
];

const careSteps = [
  "Book an appointment or send a care request.",
  "The right clinic, lab, pharmacy, or ambulance team receives it.",
  "See updates and know what you need to do before you travel.",
];

const roleViews = [
  {
    id: "patients",
    title: "For patients",
    summary: "Book visits, view results, refill prescriptions, and follow your referrals.",
    detail: "You should not have to call different places just to find out what is happening with your care.",
    image: "/images/doctor_consultation.png",
  },
  {
    id: "clinicians",
    title: "For clinicians",
    summary: "Manage appointments, send referrals, write prescriptions, and check patient updates.",
    detail: "Your work stays in one place, so the next team has the information they need.",
    image: "/images/ambulance_fleet.png",
  },
  {
    id: "teams",
    title: "For care teams",
    summary: "Receive requests, update their status, and hand patients over to the next service.",
    detail: "Hospitals, labs, imaging centres, pharmacies, and ambulance teams can work from the same request.",
    image: "/images/hero_command_center.png",
  },
];

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [activeRole, setActiveRole] = useState<string>("patients");

  return (
    <div className="alera-care-backdrop relative min-h-screen overflow-hidden text-[var(--text-high)] transition-colors">
      <div
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-10"
        style={{ backgroundImage: 'url("/images/hero_command_center.png")' }}
      />

      <section className="alera-navy-backdrop relative z-20 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="max-w-2xl">
            <p className="border-l-2 border-[#8fd0af] pl-3 text-xs font-semibold uppercase tracking-[0.16em] text-[#b7e4ca]">One place for your care</p>

            <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              Stop waiting without knowing what is happening.
            </h1>

            <p className="mt-5 max-w-xl text-lg leading-8 text-[#d4e0e9]">
              Alera helps you book care, send referrals, get results, and see updates from the people helping you. It is built for the moments when a missed message or wasted trip matters.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 rounded-md bg-[#0b3d62] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#082f4c]">
                Go to dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
              <button onClick={() => navigate("/how-it-works")} className="inline-flex items-center gap-2 border border-white/35 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/20">
                See how it works
              </button>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 border-t border-white/20 pt-5 text-sm text-[#d4e0e9]">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#8fd0af]" />
                  Your health details stay protected
                </div>
                <div className="flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-[#8fd0af]" />
                  Know before you travel
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }} className="border border-slate-200 bg-white p-2 shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
            <img src="/images/hero_medical_team.png" alt="A clinician and patient discussing care" className="h-[420px] w-full object-cover" />
            <p className="border-l-2 border-[#0b3d62] px-3 py-3 text-sm text-slate-600">Patients and care teams can see the request, its status, and the next step.</p>
          </motion.div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="border-y border-slate-700/40 py-8 md:py-10">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">What you can do with Alera</p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {careHighlights.map((item) => {
              const Icon = item.icon;
              return (
                <motion.article key={item.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="border-l border-slate-700/40 px-5 py-2 first:border-l-0">
                  <div className="flex items-center gap-2 text-sky-400">
                    <Icon className="h-4 w-4" />
                    <h3 className="font-semibold text-[var(--text-high)]">{item.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--text-medium)]">{item.text}</p>
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 border-b border-slate-700/40 py-10 md:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">How it helps</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-[var(--text-high)] sm:text-4xl">
              Get the right care without the back and forth.
            </h2>
            <div className="mt-6 space-y-3">
              {careSteps.map((step) => (
                <div key={step} className="flex items-start gap-3 border-t border-slate-700/40 py-3 text-sm text-[var(--text-medium)] first:border-t-0">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" />
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden border border-slate-200 bg-white p-2">
            <img src="/images/consulting_patients.png" alt="A doctor speaking with a patient" className="h-[320px] w-full object-cover" />
          </div>
        </div>
      </section>

      <section className="relative z-20 mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">Made for every part of care</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-[var(--text-high)]">Each person sees the tools they need.</h2>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {roleViews.map((role) => (
              <button key={role.id} onClick={() => setActiveRole(role.id)} className={`border-b-2 px-3 py-2 text-sm font-medium transition-colors ${activeRole === role.id ? "border-sky-400 text-sky-400" : "border-transparent text-[var(--text-medium)] hover:border-slate-500 hover:text-[var(--text-high)]"}`}>
                {role.title}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
            <div className="overflow-hidden border border-slate-700/40 bg-[var(--surface-elevated)]">
              {roleViews.map((role) => {
                if (role.id !== activeRole) return null;
                return <img key={role.id} src={role.image} alt={role.title} className="h-[320px] w-full object-cover" />;
              })}
            </div>
            <div className="border border-slate-700/40 bg-[var(--surface-elevated)] p-6 md:p-8">
              {roleViews.map((role) => {
                if (role.id !== activeRole) return null;
                return (
                  <motion.div key={role.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="space-y-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-400">{role.title}</p>
                    <h3 className="font-display text-2xl font-semibold text-[var(--text-high)]">{role.summary}</h3>
                    <p className="text-base leading-8 text-[var(--text-medium)]">{role.detail}</p>
                    <button onClick={() => navigate("/dashboard")} className="inline-flex items-center gap-2 rounded-md bg-[#0b3d62] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#082f4c]">
                      Open dashboard
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
