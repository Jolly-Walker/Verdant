'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { AppHeader } from '@/components/layout/AppHeader';
import { TemplateParamsForm } from '@/components/sequence/TemplateParamsForm';
import { TemplateSelector } from '@/components/sequence/TemplateSelector';
import { WarningBanner } from '@/components/ui/WarningBanner';
import { useSequencer } from '@/hooks/useSequencer';
import { useTemplateParams } from '@/hooks/useTemplateParams';
import type { TemplateId } from '@/types/sequencer';

function SequenceTemplatePicker() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { createPlan } = useSequencer();
  const { values, setValue, hydrate, buildParams } = useTemplateParams();
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from the deep link (position cards link here with pre-filled params).
  useEffect(() => {
    const raw: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      raw[key] = value;
    });

    // Cast to the named TemplateId union: URL params are untrusted strings, but
    // TemplateSelector ignores ids missing from TEMPLATE_REGISTRY and the server
    // re-validates templateId on POST /api/sequencer/plan.
    const template = raw.template ? (raw.template as TemplateId) : null;
    if (template) setSelectedTemplate(template);
    hydrate(raw, template);
  }, [searchParams, hydrate]);

  const handleSubmit = async () => {
    if (!selectedTemplate) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const plan = await createPlan(selectedTemplate, buildParams(selectedTemplate));
      if (plan) {
        router.push(`/sequence/${plan.id}`);
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

  return (
    <>
      <TemplateSelector
        selectedTemplate={selectedTemplate}
        onSelect={(templateId) => {
          setSelectedTemplate(templateId);
          setError(null);
        }}
        filter={['exitPendle']}
      />

      {selectedTemplate === 'exitPendle' && !values.ptAddress ? (
        <div className="mx-auto mt-8 max-w-xl rounded-xl border border-verdant-loss/25 bg-verdant-loss/10 p-8 text-center">
          <p className="font-semibold text-verdant-loss">
            Please use the Exit button from your Pendle position.
          </p>
        </div>
      ) : (
        selectedTemplate && (
          <div className="mx-auto mt-8 max-w-xl rounded-xl border border-verdant-rule bg-verdant-surface p-8 shadow-organic">
            <h2 className="fl-serif mb-6 text-xl text-verdant-pine">Configure Parameters</h2>

            <TemplateParamsForm templateId={selectedTemplate} values={values} setValue={setValue} />

            {error && (
              <div className="mt-6">
                <WarningBanner message={error} variant="error" />
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn btn-primary btn-lg mt-8 w-full"
            >
              {isSubmitting ? 'Creating Plan…' : 'Create Sequence Plan'}
            </button>
          </div>
        )
      )}
    </>
  );
}

export default function SequencePage() {
  return (
    <div className="min-h-screen text-verdant-text-primary">
      <AppHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* ---------- Ledger masthead ---------- */}
        <header className="mb-8">
          <p className="fl-eyebrow">Transaction sequence</p>
          <h1 className="fl-serif mt-2 text-3xl text-verdant-pine md:text-4xl">
            Choose a sequence
          </h1>
          <hr className="fl-double-rule mt-6" />
        </header>

        {/* useSearchParams() needs a Suspense boundary or the whole route
            deopts to client-side rendering and `next build` fails. */}
        <Suspense fallback={null}>
          <SequenceTemplatePicker />
        </Suspense>
      </main>
    </div>
  );
}
