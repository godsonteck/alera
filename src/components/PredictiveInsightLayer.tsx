import { Sparkles, AlertTriangle, ArrowUpRight, BookOpen } from "lucide-react";

export const PredictiveInsightLayer: React.FC = () => {
  const insights = [
    {
      id: "ins-1",
      severity: "high",
      type: "Pharmacogenomic Interaction Warning",
      title: "Clopidogrel Efficacy Reduction Risk",
      description: "Patient carries loss-of-function CYP2C19 *2 variant (*1/*2 phenotype). Standard Clopidogrel dosing yields reduced active metabolite formation.",
      recommendation: "Switch to Prasugrel 10mg daily or Ticagrelor 90mg twice daily as first-line antiplatelet option.",
      confidence: "99.2% AI Confidence Score",
      citation: "Clinical Pharmacogenetics Implementation Consortium (CPIC) Guidelines 2026"
    },
    {
      id: "ins-2",
      severity: "medium",
      type: "Cardiovascular Optimization Vector",
      title: "ApoB Target Biomarker Realignment",
      description: "Continuous metabolic tracking indicates ApoB at 65 mg/dL. Reaching <50 mg/dL will reduce 10-year ASCVD risk profile by an estimated 28%.",
      recommendation: "Add Ezetimibe 10mg daily to current low-dose Rosuvastatin protocol.",
      confidence: "94.8% AI Predictive Accuracy",
      citation: "Alera BioMetrix Longitudinal Clinical Model"
    }
  ];

  return (
    <div className="phoenix-card rounded-2xl p-6 border border-purple-500/30 bg-[#090D14]/90 text-white shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-white font-display flex items-center gap-2">
              <span>Predictive Intelligence Layer</span>
              <span className="text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded">
                Alera Neural Core
              </span>
            </h3>
            <p className="text-xs text-slate-400">Real-time clinical decision support & pharmacogenomic intelligence.</p>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-4 relative z-10">
        {insights.map((item) => (
          <div
            key={item.id}
            className={`p-4 rounded-xl border transition-all ${
              item.severity === "high"
                ? "bg-purple-950/20 border-purple-500/40 hover:border-purple-400"
                : "bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-400"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono font-semibold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                {item.type}
              </span>
              <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                {item.confidence}
              </span>
            </div>

            <h4 className="text-sm font-semibold text-white mb-1.5">{item.title}</h4>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.description}</p>

            <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-cyan-200">
              <strong className="text-white block font-mono mb-1">Recommended Action:</strong>
              {item.recommendation}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3 text-slate-400" />
                {item.citation}
              </span>
              <button className="text-purple-300 hover:text-white flex items-center gap-1">
                <span>Apply Protocol</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PredictiveInsightLayer;
