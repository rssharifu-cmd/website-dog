/**
 * SharFlow Website Watchdog - Finding Deduplication & Lifecycle Manager
 *
 * RULES:
 * 1. Do NOT repeatedly alert the user on identical issues across consecutive days.
 * 2. Fingerprints uniquely identify persistent conditions:
 *    - 'organic_click_drop:site_aggregate'
 *    - 'important_page_drop:/products/linen-shirt'
 *    - 'ranking_loss:linen shirt'
 * 3. Lifecycle state transition:
 *    - If new fingerprint -> status: 'new' -> include in daily brief
 *    - If active & unchanged -> status: 'active' -> do NOT re-alert as a new high-urgency issue; list under ongoing or suppress
 *    - If condition resolves -> status: 'resolved' -> record resolution
 */

import { Finding, FindingStatus, DeterministicSignal, FindingExplanation } from '../types/domain';

export class FindingLifecycleManager {
  /**
   * Determine whether a detected signal represents a fresh finding or an ongoing active condition.
   */
  public resolveFinding(
    signal: DeterministicSignal,
    explanation: FindingExplanation,
    reportDate: string,
    existingFindings: Finding[]
  ): { finding: Finding; isNewAlert: boolean } {
    const existing = existingFindings.find(
      (f) => f.fingerprint === signal.fingerprint && f.status !== 'resolved' && f.status !== 'dismissed'
    );

    const now = new Date().toISOString();

    if (!existing) {
      // Fresh new finding
      const newFinding: Finding = {
        id: `fnd_${Math.random().toString(36).substring(2, 10)}`,
        websiteId: signal.websiteId,
        reportDate,
        signalType: signal.signalType,
        category: signal.category,
        severity: signal.severity,
        confidence: signal.confidence,
        status: 'new',
        headline: explanation.headline,
        whyItMatters: explanation.whyItMatters,
        likelyCauses: explanation.likelyCauses,
        recommendedActions: explanation.recommendedActions,
        whatToMonitor: explanation.whatToMonitor,
        fingerprint: signal.fingerprint,
        evidence: signal.evidence,
        firstDetectedAt: now,
        lastDetectedAt: now
      };
      return { finding: newFinding, isNewAlert: true };
    }

    // Ongoing condition
    const updatedFinding: Finding = {
      ...existing,
      lastDetectedAt: now,
      evidence: signal.evidence,
      // If delta deteriorated by more than 15% further, keep alert active
      severity: signal.severity,
      status: existing.status === 'acknowledged' ? 'acknowledged' : 'active'
    };

    // Only alert if there was a material worsening
    const priorDelta = existing.evidence.deltaPercent;
    const currentDelta = signal.evidence.deltaPercent;
    const materiallyWorse = (currentDelta - priorDelta) <= -15.0;

    return { finding: updatedFinding, isNewAlert: materiallyWorse };
  }

  /**
   * Checks if previously active findings have now returned to normal baseline.
   */
  public checkResolvedFindings(
    activeFindings: Finding[],
    currentSignals: DeterministicSignal[]
  ): Finding[] {
    const activeFingerprints = new Set(currentSignals.map((s) => s.fingerprint));
    const now = new Date().toISOString();

    return activeFindings.map((f) => {
      if (!activeFingerprints.has(f.fingerprint) && f.status !== 'resolved' && f.status !== 'dismissed') {
        return {
          ...f,
          status: 'resolved' as FindingStatus,
          resolvedAt: now
        };
      }
      return f;
    });
  }
}
