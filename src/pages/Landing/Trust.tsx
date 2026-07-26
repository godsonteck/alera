import { ArrowRight, BadgeCheck, Clock3, HeartHandshake, LockKeyhole, ShieldCheck, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type TrustPoint = {
  icon: LucideIcon;
  title: string;
  description: string;
};

const trustPoints: TrustPoint[] = [
  {
    icon: BadgeCheck,
    title: 'Verified people and teams',
    description: 'The people behind each account are reviewed so care stays grounded in trusted connections.',
  },
  {
    icon: LockKeyhole,
    title: 'Private by design',
    description: 'Sensitive information stays protected and only shared where it should be.',
  },
  {
    icon: Clock3,
    title: 'Clear updates',
    description: 'Important changes are easier to see, so the next step feels obvious.',
  },
  {
    icon: ShieldCheck,
    title: 'Support that feels safe',
    description: 'Every part of the experience is built to feel dependable and calm.',
  },
  {
    icon: HeartHandshake,
    title: 'Built for real care',
    description: 'The experience stays human, simple, and focused on people first.',
  },
];

const Trust = () => {
  return (
    <section className="alera-navy-backdrop min-h-screen px-4 py-12 text-[#223127] sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="rounded-[2rem] border border-[#dfe8e0] bg-white/95 p-8 shadow-[0_12px_35px_rgba(20,30,24,0.08)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">Built for trust</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#14211a] sm:text-4xl">
            A care experience that feels steady, clear, and safe.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#45564d]">
            Alera is designed to make support feel calm and dependable, right from sign-in to everyday updates.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trustPoints.map((point) => {
            const Icon = point.icon;
            return (
              <div key={point.title} className="rounded-[1.5rem] border border-[#dce5dd] bg-[#fdfcf8] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)]">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f4faf4] text-[#4a785c]">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#223127]">{point.title}</h3>
                <p className="mt-2 text-sm leading-7 text-[#506057]">{point.description}</p>
              </div>
            );
          })}
        </div>

        <div className="rounded-[2rem] border border-[#dfe8e0] bg-[#f4faf4] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)] sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">Peace of mind</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#223127]">The details stay protected while the experience stays easy.</h2>
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

export default Trust;
