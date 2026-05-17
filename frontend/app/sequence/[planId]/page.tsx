"use client";

import { useEffect, useState, useRef } from 'react';
import { useSequencer } from '@/hooks/useSequencer';
import { SequencePlanView } from '@/components/sequence/SequencePlanView';
import { SequenceComplete } from '@/components/sequence/SequenceComplete';
import { useRouter } from 'next/navigation';
import { useWallet } from '@/hooks/useWallet';
import { fetchWithTimeout } from '@/lib/utils/fetch';

export default function SequenceExecutionPage({ params }: { params: { planId: string } }) {
  const router = useRouter();
  const { address } = useWallet();
  const { plan, currentStep, simulateStep, executeStep, setPlan } = useSequencer();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const simulatingStepId = useRef<string | null>(null);

  useEffect(() => {
    if (!address) return;
    
    fetchWithTimeout(`/api/sequencer/plan/${params.planId}?wallet=${address}`)
      .then(res => {
        if (!res.ok) throw new Error('Plan not found or unauthorized');
        return res.json();
      })
      .then(data => {
        setPlan(data.plan);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [params.planId, address, setPlan]);

  useEffect(() => {
    if (
      plan && 
      currentStep && 
      currentStep.status === 'pending' && 
      simulatingStepId.current !== currentStep.id
    ) {
      simulatingStepId.current = currentStep.id;
      simulateStep(currentStep.id).catch(console.error);
    }
  }, [plan?.id, currentStep?.id, currentStep?.status, simulateStep, plan]);

  if (!address) return <div className="p-8 text-center">Please connect your wallet.</div>;
  if (loading) return <div className="p-8 text-center">Loading plan...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
  if (!plan) return <div className="p-8 text-center">Plan not found.</div>;

  if (plan.status === 'complete') {
    return <SequenceComplete plan={plan} />;
  }

  return (
    <SequencePlanView
      plan={plan}
      currentStepId={currentStep?.id || null}
      onSimulate={simulateStep}
      onSign={executeStep}
      onEdit={() => router.back()}
    />
  );
}
