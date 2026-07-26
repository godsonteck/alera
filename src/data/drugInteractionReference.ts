import type { DrugInteraction } from '@/data/mockData';

export const drugInteractionDatabase: DrugInteraction[] = [
  { id: 'di-001', drug1: 'Warfarin', drug2: 'Aspirin', severity: 'severe', description: 'Significantly increases bleeding risk', management: 'Monitor INR closely, consider alternative antiplatelet agent', evidenceLevel: 'Established' },
  { id: 'di-002', drug1: 'Metformin', drug2: 'Contrast dye', severity: 'severe', description: 'Risk of lactic acidosis', management: 'Hold metformin 48 hours before and after contrast procedures', evidenceLevel: 'Established' },
  { id: 'di-003', drug1: 'ACE Inhibitor', drug2: 'Potassium supplements', severity: 'moderate', description: 'Risk of hyperkalemia', management: 'Monitor potassium levels regularly', evidenceLevel: 'Probable' },
  { id: 'di-004', drug1: 'Statins', drug2: 'Clarithromycin', severity: 'moderate', description: 'Increased risk of myopathy', management: 'Consider alternative antibiotic or temporarily discontinue statin', evidenceLevel: 'Probable' },
  { id: 'di-005', drug1: 'SSRIs', drug2: 'MAOIs', severity: 'severe', description: 'Risk of serotonin syndrome', management: 'Wash-out period required; never use together', evidenceLevel: 'Established' },
  { id: 'di-006', drug1: 'Digoxin', drug2: 'Amiodarone', severity: 'severe', description: 'Increased digoxin toxicity', management: 'Reduce digoxin dose by 50%, monitor levels closely', evidenceLevel: 'Established' },
  { id: 'di-007', drug1: 'NSAIDs', drug2: 'ACE Inhibitor', severity: 'moderate', description: 'Risk of acute kidney injury', management: 'Monitor renal function, avoid in dehydrated patients', evidenceLevel: 'Probable' },
  { id: 'di-008', drug1: 'Alcohol', drug2: 'Benzodiazepines', severity: 'severe', description: 'Severe CNS depression risk', management: 'Advise against alcohol consumption', evidenceLevel: 'Established' },
];
