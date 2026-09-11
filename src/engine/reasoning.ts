/**
 * SharFlow Website Watchdog - Gemini AI Reasoning Contract & Schema
 *
 * ARCHITECTURAL MANDATE:
 * Gemini does NOT detect anomalies from raw metrics.
 * Gemini receives a strictly validated DeterministicSignal with quantified evidence
 * and synthesizes business context, probable causes, concrete actions, and monitoring advice.
 */

import { DeterministicSignal, FindingExplanation } from '../types/domain';

export const GEMINI_EXPLANATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: {
      type: 'STRING',
      description: 'Clear, concise headline summarizing the exact change and magnitude.'
    },
    whyItMatters: {
      type: 'STRING',
      description: 'Why this matters to a small e-commerce business owner in terms of sales, traffic, or margins.'
    },
    likelyCauses: {
      type: 'ARRAY',
      description: 'Up to 2 grounded hypotheses explaining why this change is occurring based strictly on the provided evidence.',
      items: {
        type: 'OBJECT',
        properties: {
          cause: { type: 'STRING' },
          confidence: { type: 'NUMBER', description: 'Confidence between 0.0 and 1.0' },
          evidence: { type: 'STRING', description: 'Factual metric or observation supporting this cause' }
        },
        required: ['cause', 'confidence', 'evidence']
      }
    },
    recommendedActions: {
      type: 'ARRAY',
      description: 'At most 2 concrete, prioritized, step-by-step tasks the owner or their team should take.',
      items: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING' },
          priority: { type: 'STRING', enum: ['critical', 'high', 'medium'] },
          reason: { type: 'STRING' }
        },
        required: ['action', 'priority', 'reason']
      }
    },
    whatToMonitor: {
      type: 'STRING',
      description: 'Specific metrics, pages, or search queries to watch closely over the next 7 days.'
    }
  },
  required: ['headline', 'whyItMatters', 'likelyCauses', 'recommendedActions', 'whatToMonitor']
};

export interface IGeminiReasoningService {
  explainSignal(signal: DeterministicSignal, siteDomain: string): Promise<FindingExplanation>;
}

/**
 * Builds the strictly grounded prompt payload for Gemini.
 */
export function buildSignalExplanationPrompt(signal: DeterministicSignal, siteDomain: string): string {
  return `
You are the intelligence engine for SharFlow Website Watchdog, an AI monitoring system for e-commerce website owners.
Website: ${siteDomain}

You are provided with a verified mathematical anomaly signal detected by our deterministic rules engine:
Signal Type: ${signal.signalType}
Category: ${signal.category}
Severity: ${signal.severity}
Calculated Detection Confidence: ${signal.confidence}

QUANTIFIED EVIDENCE:
- Primary Metric: ${signal.evidence.metricName}
- Baseline Value: ${signal.evidence.baselineValue} (${signal.evidence.periodBaselineLabel})
- Observed Value: ${signal.evidence.observedValue} (${signal.evidence.periodObservedLabel})
- Delta Change: ${signal.evidence.deltaPercent}%
- Total Sample Size: ${signal.evidence.sampleSize}
${signal.evidence.supportingData ? `- Context Details: ${JSON.stringify(signal.evidence.supportingData)}` : ''}

CRITICAL RULES:
1. Ground your explanation exclusively in the metrics above. Do NOT invent phantom Google algorithm updates, competitor actions, or server outages unless directly supported by the data.
2. Use precise, non-alarmist phrasing: "likely", "suggests", "consistent with", "worth checking".
3. Provide at most 2 likely causes and at most 2 actionable steps.
4. Keep actions clear and specific to e-commerce (e.g. "Review meta title and description of product page", "Check if checkout button script was updated").
5. Return strictly valid JSON adhering to the provided schema.
`.trim();
}
