'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { TemplateParamsForm } from '@/components/sequence/TemplateParamsForm';
import { TemplateSelector } from '@/components/sequence/TemplateSelector';
import { Modal } from '@/components/ui/Modal';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { useSequencer } from '@/hooks/useSequencer';
import { useTemplateParams } from '@/hooks/useTemplateParams';
import type { TemplateId } from '@/types/sequencer';

interface SequenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select a template on open */
  initialTemplate?: TemplateId;
  /** Pre-fill params from a position card */
  initialParams?: Partial<Record<string, string>>;
}

export function SequenceModal({
  isOpen,
  onClose,
  initialTemplate,
  initialParams,
}: SequenceModalProps) {
  const router = useRouter();
  const { createPlan } = useSequencer();
  const { values, setValue, hydrate, buildParams } = useTemplateParams();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset/hydrate parameters on open/change
  useEffect(() => {
    if (!isOpen) return;
    setSelectedTemplate(initialTemplate ?? null);
    setError(null);
    hydrate(initialParams ?? {}, initialTemplate);
  }, [isOpen, initialTemplate, initialParams, hydrate]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const plan = await createPlan(selectedTemplate, buildParams(selectedTemplate));
      if (plan) {
        router.push(`/sequence/${plan.id}`);
        onClose();
      }
    } catch (err) {
      console.error(err);
      // createPlan rethrows the server's message — surface it instead of a
      // native alert(), which reads as phishing inside a wallet app.
      setError(err instanceof Error ? err.message : 'Failed to create plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const showForm =
    selectedTemplate !== null && !(selectedTemplate === 'exitPendle' && !values.ptAddress);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Choose a sequence"
      eyebrow="Transaction sequence"
      size="lg"
      footer={
        showForm ? (
          <div className="space-y-3">
            {error && <WarningBanner message={error} variant="error" />}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn btn-primary w-full"
            >
              {isSubmitting ? 'Creating Plan…' : 'Create Sequence Plan'}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <TemplateSelector
          selectedTemplate={selectedTemplate}
          onSelect={(templateId) => {
            setSelectedTemplate(templateId);
            setError(null);
          }}
          filter={['exitPendle']}
        />

        {selectedTemplate === 'exitPendle' && !values.ptAddress ? (
          <div className="rounded-xl border border-verdant-loss/20 bg-verdant-surface-accent p-8 text-center">
            <p className="text-verdant-loss">
              Please use the Exit button from your Pendle position.
            </p>
          </div>
        ) : (
          selectedTemplate && (
            <div className="space-y-4 rounded-xl border border-verdant-rule bg-verdant-surface-accent p-6">
              <h3 className="fl-serif mb-4 text-lg text-verdant-pine">Configure Parameters</h3>
              <TemplateParamsForm
                templateId={selectedTemplate}
                values={values}
                setValue={setValue}
              />
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
