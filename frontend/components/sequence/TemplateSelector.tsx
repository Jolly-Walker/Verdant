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
          className={`border rounded-xl p-6 cursor-pointer hover:border-blue-500 transition-all ${
            selectedTemplate === template.id 
              ? 'border-blue-600 bg-blue-50/5' 
              : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-900'
          }`}
          onClick={() => onSelect(template.id)}
        >
          <h3 className={`font-semibold text-lg mb-2 ${selectedTemplate === template.id ? 'text-blue-400' : 'text-zinc-100'}`}>
            {template.displayName}
          </h3>
          <p className="text-zinc-400 text-sm">{template.description}</p>
        </div>
      ))}
    </div>
  );
}
