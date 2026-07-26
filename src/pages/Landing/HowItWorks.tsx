import { ArrowRight, CalendarDays, CheckCircle2, HeartHandshake, MessageCircle, ShieldCheck, Stethoscope, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type Step = {
  icon: LucideIcon;
  title: string;
  description: string;
  detail: string;
};

const steps: Step[] = [
  {
    icon: CalendarDays,
    title: 'Start with one simple place',
    description: 'Bring appointments, reminders, and updates into one calm view so nothing feels scattered.',
    detail: 'A clear starting point for each care journey.',
  },
  {
    icon: MessageCircle,
    title: 'Keep conversations easy',
    description: 'Send a message, share a note, or ask for help without calling around or repeating yourself.',
    detail: 'Helpful updates that stay easy to follow.',
  },
  {
    icon: ShieldCheck,
    title: 'Stay informed and protected',
    description: 'Your details stay private, organized, and ready when you need them.',
    detail: 'Support that feels steady and safe.',
  },
  {
    icon: Stethoscope,
    title: 'Move from step to step with clarity',
    description: 'Each next step is easier to see when the plan is simple and shared.',
    detail: 'Less confusion, more confidence.',
  },
];

const HowItWorks = () => {
  return (
    <section className="alera-navy-backdrop min-h-screen px-4 py-12 text-[#223127] sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="rounded-[2rem] border border-[#dfe8e0] bg-white/95 p-8 shadow-[0_12px_35px_rgba(20,30,24,0.08)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">How Alera works</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#14211a] sm:text-4xl">
            A calmer way to move through care.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#45564d]">
            Alera brings the important parts of care into one easy space so people can focus on what matters most.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="rounded-[1.5rem] border border-[#dce5dd] bg-[#fdfcf8] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)]">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4faf4] text-[#4a785c]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="rounded-full border border-[#dce5dd] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#4a785c]">
                    Step {index + 1}
                  </div>
                </div>
                <h3 className="mt-5 text-xl font-semibold text-[#223127]">{step.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#506057]">{step.description}</p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#edf7ef] px-3 py-1.5 text-sm text-[#2f6b4f]">
                  <CheckCircle2 className="h-4 w-4" />
                  {step.detail}
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-[2rem] border border-[#dfe8e0] bg-[#f4faf4] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)] sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">Ready to try it?</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#223127]">A simple way to begin with Alera.</h2>
            </div>
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-[#2f6b4f] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#285c43]">
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
