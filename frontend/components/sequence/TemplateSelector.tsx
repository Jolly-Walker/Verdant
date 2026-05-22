"use client";

import React from 'react';
import { TEMPLATE_REGISTRY } from '@/hooks/useSequencer';
import { TemplateId } from '@/types/sequencer';

interface TemplateSelectorProps {
  selectedTemplate: TemplateId | null;
  onSelect: (templateId: TemplateId) => void;
  filter?: TemplateId[];
}

export function TemplateSelector({ selectedTemplate, onSelect, filter }: TemplateSelectorProps) {
  const templates = Object.values(TEMPLATE_REGISTRY).filter(t => !filter?.includes(t.id as TemplateId));

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
      {templates.map(template => (
        <div 
          key={template.id} 
          className={`border rounded-xl p-6 cursor-pointer hover:border-verdant-teak transition-all ${
            selectedTemplate === template.id 
              ? 'border-verdant-teak bg-verdant-surface-accent' 
              : 'border-[#E5E0D8] bg-verdant-surface hover:bg-verdant-surface-accent'
          }`}
          onClick={() => onSelect(template.id)}
        >
          <h3 className={`font-semibold text-lg mb-2 ${selectedTemplate === template.id ? 'text-verdant-teak' : 'text-verdant-text-primary'}`}>
            {template.displayName}
          </h3>
          <p className="text-verdant-text-muted text-sm">{template.description}</p>
        </div>
      ))}
    </div>
  );
}
