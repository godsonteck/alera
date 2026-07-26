import { ArrowRight, Bell, CalendarDays, FileText, FlaskConical, HeartPulse, MessageSquareText, Pill, ScanLine, ShieldCheck, Stethoscope, Video, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
};

type FeatureGroup = {
  title: string;
  description: string;
  features: Feature[];
};

const groups: FeatureGroup[] = [
  {
    title: 'Everyday support',
    description: 'Small things stay easy to manage when the plan is simple.',
    features: [
      { icon: CalendarDays, title: 'Appointments', description: 'See what is coming up and keep the next step clear.' },
      { icon: MessageSquareText, title: 'Helpful messages', description: 'Stay in touch without extra back-and-forth.' },
      { icon: ShieldCheck, title: 'Private updates', description: 'Keep important details safe and easy to find.' },
    ],
  },
  {
    title: 'Care coordination',
    description: 'Support teams can share updates without losing the human side of care.',
    features: [
      { icon: Video, title: 'Simple video check-ins', description: 'Talk through care in a calm, familiar space.' },
      { icon: HeartPulse, title: 'Care history', description: 'Follow what has happened without digging through notes.' },
      { icon: Bell, title: 'Helpful reminders', description: 'Know what needs attention next.' },
    ],
  },
  {
    title: 'Clinical tools',
    description: 'The behind-the-scenes work stays organized so care feels smoother.',
    features: [
      { icon: FileText, title: 'Clear records', description: 'Keep plans and notes in one steady place.' },
      { icon: Pill, title: 'Medication support', description: 'Make prescriptions and follow-up easier to track.' },
      { icon: FlaskConical, title: 'Lab and scan views', description: 'See results without confusion or delay.' },
      { icon: ScanLine, title: 'Shared care views', description: 'Help everyone stay on the same page.' },
      { icon: Stethoscope, title: 'Care team handoff', description: 'Pass updates along clearly when support changes.' },
    ],
  },
];

const Features = () => {
  return (
    <section className="alera-navy-backdrop min-h-screen px-4 py-12 text-[#223127] sm:px-6 lg:px-8 lg:py-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <div className="rounded-[2rem] border border-[#dfe8e0] bg-white/95 p-8 shadow-[0_12px_35px_rgba(20,30,24,0.08)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">What Alera helps with</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#14211a] sm:text-4xl">
            Simple tools for everyday care.
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-8 text-[#45564d]">
            Alera keeps the important parts of care clear and close at hand so people can move forward with less stress.
          </p>
        </div>

        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.title} className="rounded-[2rem] border border-[#dfe8e0] bg-[#fdfcf8] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)] sm:p-8">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold text-[#223127]">{group.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[#506057]">{group.description}</p>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.features.map((feature) => {
                  const Icon = feature.icon;
                  return (
                    <div key={feature.title} className="rounded-[1.25rem] border border-[#dce5dd] bg-white/95 p-5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4faf4] text-[#4a785c]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 font-semibold text-[#223127]">{feature.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[#506057]">{feature.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-[2rem] border border-[#dfe8e0] bg-[#f4faf4] p-6 shadow-[0_10px_24px_rgba(20,30,24,0.06)] sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#4a785c]">Made for care teams</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#223127]">A shared space that stays easy to use.</h2>
            </div>
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-[#2f6b4f] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#285c43]">
              Start with Alera
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
