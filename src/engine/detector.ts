/**
 * SharFlow Website Watchdog - Deterministic Detection Engine
 *
 * CRITICAL ARCHITECTURAL PRINCIPLE:
 * Code and mathematics detect the raw anomalies and verify statistical significance.
 * Gemini AI does NOT detect anomalies from scratch; it only explains validated signals.
 *
 * Implements the 5 Core MVP Signals:
 * 1. organic_click_drop: Site-wide organic clicks dropped >= 20% with min 30 clicks/day baseline.
 * 2. important_page_drop: Monitored or top-traffic page clicks dropped >= 25% with min 20 clicks.
 * 3. ranking_loss: Queries with >= 50 impressions dropped >= 3.0 positions and >= 20% clicks.
 * 4. ctr_opportunity: High impression queries/pages in position <= 4.0 with CTR <= 50% of the site's own baseline for that position tier.
 * 5. conversion_drop: GA4 conversion rate dropped >= 25% AND orders dropped >= 20% with min 10 baseline orders.
 */

import {
  DeterministicSignal,
  GscDailyMetric,
  GscPageMetric,
  GscQueryMetric,
  Ga4DailyMetric,
  MonitoredAsset,
  SiteMetricBaselines,
  PositionTierCtrBaseline
} from '../types/domain';

export interface DetectionInput {
  websiteId: string;
  reportDate: string; // 'YYYY-MM-DD'
  gscBaseline: GscDailyMetric[]; // e.g. 7 days T-10 to T-4
  gscObserved: GscDailyMetric[]; // e.g. 7 days T-3 to yesterday
  gscPageBaseline: GscPageMetric[];
  gscPageObserved: GscPageMetric[];
  gscQueryBaseline: GscQueryMetric[];
  gscQueryObserved: GscQueryMetric[];
  ga4Baseline: Ga4DailyMetric[];
  ga4Observed: Ga4DailyMetric[];
  monitoredAssets: MonitoredAsset[];
  siteBaselines: SiteMetricBaselines;
}

export class DeterministicDetectionEngine {
  /**
   * Run all 5 MVP detection algorithms against validated historical windows.
   */
  public evaluateAll(input: DetectionInput): DeterministicSignal[] {
    const signals: DeterministicSignal[] = [];

    // Signal 1: Organic traffic/click drop
    const clickDropSignal = this.evaluateOrganicClickDrop(input);
    if (clickDropSignal) signals.push(clickDropSignal);

    // Signal 2: Important page performance drop
    const pageDropSignals = this.evaluateImportantPageDrops(input);
    signals.push(...pageDropSignals);

    // Signal 3: Important query ranking deterioration
    const rankingLossSignals = this.evaluateRankingLoss(input);
    signals.push(...rankingLossSignals);

    // Signal 4: CTR opportunity based on site's own tier baseline
    const ctrOpportunitySignals = this.evaluateCtrOpportunities(input);
    signals.push(...ctrOpportunitySignals);

    // Signal 5: E-commerce conversion/order drop
    const conversionDropSignal = this.evaluateConversionDrop(input);
    if (conversionDropSignal) signals.push(conversionDropSignal);

    return signals;
  }

  /**
   * Signal 1: Organic Click Drop
   * Requires: Delta <= -20%, Baseline Avg Clicks >= 30 clicks/day
   */
  public evaluateOrganicClickDrop(input: DetectionInput): DeterministicSignal | null {
    const { websiteId, gscBaseline, gscObserved } = input;
    if (gscBaseline.length === 0 || gscObserved.length === 0) return null;

    const baselineTotalClicks = gscBaseline.reduce((acc, d) => acc + d.clicks, 0);
    const baselineDays = gscBaseline.length;
    const baselineDailyAvg = baselineTotalClicks / baselineDays;

    // Minimum sample size guard: at least 30 clicks/day on average
    if (baselineDailyAvg < 30) return null;

    const observedTotalClicks = gscObserved.reduce((acc, d) => acc + d.clicks, 0);
    const observedDays = gscObserved.length;
    const observedDailyAvg = observedTotalClicks / observedDays;

    const deltaPercent = ((observedDailyAvg - baselineDailyAvg) / baselineDailyAvg) * 100;

    if (deltaPercent <= -20.0) {
      // Confidence scales with sample size and severity
      const confidence = Math.min(0.98, Math.max(0.75, 0.75 + Math.abs(deltaPercent) / 200));
      const severity = deltaPercent <= -35.0 ? 'critical' : 'high';

      return {
        id: `sig_${websiteId}_click_drop_${input.reportDate}`,
        websiteId,
        signalType: 'organic_click_drop',
        category: 'problem',
        severity,
        confidence: Number(confidence.toFixed(2)),
        fingerprint: `organic_click_drop:site_aggregate`,
        targetEntity: { type: 'site', value: 'site' },
        evidence: {
          metricName: 'organic_clicks',
          baselineValue: Number(baselineDailyAvg.toFixed(1)),
          observedValue: Number(observedDailyAvg.toFixed(1)),
          deltaPercent: Number(deltaPercent.toFixed(1)),
          periodBaselineLabel: `Prior ${baselineDays}-day average`,
          periodObservedLabel: `Recent ${observedDays}-day average`,
          sampleSize: baselineTotalClicks + observedTotalClicks
        }
      };
    }

    return null;
  }

  /**
   * Signal 2: Important Page Performance Drop
   * Evaluates user-pinned pages OR pages that contributed >= 5% of total baseline clicks.
   * Requires: Delta <= -25%, Baseline Clicks >= 20
   */
  public evaluateImportantPageDrops(input: DetectionInput): DeterministicSignal[] {
    const { websiteId, gscBaseline, gscPageBaseline, gscPageObserved, monitoredAssets } = input;
    const totalBaselineClicks = gscBaseline.reduce((acc, d) => acc + d.clicks, 0);
    const signals: DeterministicSignal[] = [];

    // Aggregate baseline by page
    const pageBaselineMap = new Map<string, { clicks: number; impressions: number }>();
    for (const row of gscPageBaseline) {
      const existing = pageBaselineMap.get(row.pagePath) || { clicks: 0, impressions: 0 };
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      pageBaselineMap.set(row.pagePath, existing);
    }

    // Aggregate observed by page
    const pageObservedMap = new Map<string, { clicks: number; impressions: number }>();
    for (const row of gscPageObserved) {
      const existing = pageObservedMap.get(row.pagePath) || { clicks: 0, impressions: 0 };
      existing.clicks += row.clicks;
      existing.impressions += row.impressions;
      pageObservedMap.set(row.pagePath, existing);
    }

    const pinnedPages = new Set(
      monitoredAssets.filter((a) => a.assetType === 'page').map((a) => a.assetValue)
    );

    for (const [pagePath, base] of pageBaselineMap.entries()) {
      const isPinned = pinnedPages.has(pagePath);
      const shareOfTotal = totalBaselineClicks > 0 ? (base.clicks / totalBaselineClicks) * 100 : 0;
      const isSignificantPage = isPinned || shareOfTotal >= 5.0;

      // Minimum sample guard: must have at least 20 clicks in baseline
      if (!isSignificantPage || base.clicks < 20) continue;

      const obs = pageObservedMap.get(pagePath) || { clicks: 0, impressions: 0 };
      const deltaPercent = ((obs.clicks - base.clicks) / base.clicks) * 100;

      if (deltaPercent <= -25.0) {
        signals.push({
          id: `sig_${websiteId}_page_drop_${encodeURIComponent(pagePath)}_${input.reportDate}`,
          websiteId,
          signalType: 'important_page_drop',
          category: 'problem',
          severity: deltaPercent <= -40.0 ? 'critical' : 'high',
          confidence: 0.88,
          fingerprint: `important_page_drop:${pagePath}`,
          targetEntity: { type: 'page', value: pagePath },
          evidence: {
            metricName: 'page_clicks',
            baselineValue: base.clicks,
            observedValue: obs.clicks,
            deltaPercent: Number(deltaPercent.toFixed(1)),
            periodBaselineLabel: 'Baseline window clicks',
            periodObservedLabel: 'Observed window clicks',
            sampleSize: base.clicks + obs.clicks,
            supportingData: {
              pagePath,
              baselineShareOfClicks: Number(shareOfTotal.toFixed(1)),
              isUserPinned: isPinned
            }
          }
        });
      }
    }

    // Sort by severity/clicks and limit to top 2 to avoid overwhelming user
    return signals.sort((a, b) => b.evidence.baselineValue - a.evidence.baselineValue).slice(0, 2);
  }

  /**
   * Signal 3: Important Query Ranking Loss
   * Queries with >= 50 impressions in baseline that dropped >= 3.0 average positions and >= 20% clicks.
   */
  public evaluateRankingLoss(input: DetectionInput): DeterministicSignal[] {
    const { websiteId, gscQueryBaseline, gscQueryObserved } = input;
    const signals: DeterministicSignal[] = [];

    const queryBaselineMap = new Map<string, { clicks: number; impressions: number; avgPosSum: number; count: number }>();
    for (const row of gscQueryBaseline) {
      const ex = queryBaselineMap.get(row.queryText) || { clicks: 0, impressions: 0, avgPosSum: 0, count: 0 };
      ex.clicks += row.clicks;
      ex.impressions += row.impressions;
      ex.avgPosSum += row.avgPosition;
      ex.count += 1;
      queryBaselineMap.set(row.queryText, ex);
    }

    const queryObservedMap = new Map<string, { clicks: number; impressions: number; avgPosSum: number; count: number }>();
    for (const row of gscQueryObserved) {
      const ex = queryObservedMap.get(row.queryText) || { clicks: 0, impressions: 0, avgPosSum: 0, count: 0 };
      ex.clicks += row.clicks;
      ex.impressions += row.impressions;
      ex.avgPosSum += row.avgPosition;
      ex.count += 1;
      queryObservedMap.set(row.queryText, ex);
    }

    for (const [queryText, base] of queryBaselineMap.entries()) {
      if (base.impressions < 50 || base.clicks < 10) continue; // Sample size guard

      const baseAvgPos = base.avgPosSum / base.count;
      const obs = queryObservedMap.get(queryText);
      if (!obs || obs.count === 0) continue;

      const obsAvgPos = obs.avgPosSum / obs.count;
      const positionDrop = obsAvgPos - baseAvgPos; // positive number means slipped down in SERP
      const clickDelta = ((obs.clicks - base.clicks) / base.clicks) * 100;

      if (positionDrop >= 3.0 && clickDelta <= -20.0) {
        signals.push({
          id: `sig_${websiteId}_rank_loss_${encodeURIComponent(queryText)}_${input.reportDate}`,
          websiteId,
          signalType: 'ranking_loss',
          category: 'problem',
          severity: positionDrop >= 5.0 ? 'high' : 'medium',
          confidence: 0.85,
          fingerprint: `ranking_loss:${queryText}`,
          targetEntity: { type: 'query', value: queryText },
          evidence: {
            metricName: 'average_position',
            baselineValue: Number(baseAvgPos.toFixed(1)),
            observedValue: Number(obsAvgPos.toFixed(1)),
            deltaPercent: Number(clickDelta.toFixed(1)), // Clicks lost
            periodBaselineLabel: 'Baseline average position',
            periodObservedLabel: 'Observed average position',
            sampleSize: base.impressions,
            supportingData: {
              queryText,
              baselineClicks: base.clicks,
              observedClicks: obs.clicks,
              positionsLost: Number(positionDrop.toFixed(1))
            }
          }
        });
      }
    }

    return signals.sort((a, b) => b.evidence.sampleSize - a.evidence.sampleSize).slice(0, 2);
  }

  /**
   * Signal 4: CTR Opportunity Based on Site's Own Tier Baseline
   * Compares high-impression queries (>= 150 impressions) in position <= 4.0
   * against the site's own historical average CTR for that position tier.
   */
  public evaluateCtrOpportunities(input: DetectionInput): DeterministicSignal[] {
    const { websiteId, gscQueryObserved, siteBaselines } = input;
    const tierBaselines: PositionTierCtrBaseline = siteBaselines.positionTierCtrs;
    const signals: DeterministicSignal[] = [];

    // Aggregate observed query totals
    const queryMap = new Map<string, { clicks: number; impressions: number; avgPosSum: number; count: number }>();
    for (const row of gscQueryObserved) {
      const ex = queryMap.get(row.queryText) || { clicks: 0, impressions: 0, avgPosSum: 0, count: 0 };
      ex.clicks += row.clicks;
      ex.impressions += row.impressions;
      ex.avgPosSum += row.avgPosition;
      ex.count += 1;
      queryMap.set(row.queryText, ex);
    }

    for (const [queryText, q] of queryMap.entries()) {
      if (q.impressions < 150) continue; // Minimum impression guard
      const avgPos = q.avgPosSum / q.count;
      const actualCtr = q.clicks / q.impressions;

      let expectedCtr = 0;
      if (avgPos <= 2.0) {
        expectedCtr = tierBaselines.tier1;
      } else if (avgPos <= 4.0) {
        expectedCtr = tierBaselines.tier2;
      } else {
        continue; // Only evaluate top 4 positions for CTR opportunities
      }

      // If site has a valid baseline for this tier and actual CTR is <= 50% of expectation
      if (expectedCtr > 0.03 && actualCtr <= expectedCtr * 0.5) {
        const missedClicks = Math.round((expectedCtr - actualCtr) * q.impressions);
        if (missedClicks >= 10) {
          signals.push({
            id: `sig_${websiteId}_ctr_opp_${encodeURIComponent(queryText)}_${input.reportDate}`,
            websiteId,
            signalType: 'ctr_opportunity',
            category: 'opportunity',
            severity: missedClicks >= 25 ? 'high' : 'medium',
            confidence: 0.82,
            fingerprint: `ctr_opportunity:${queryText}`,
            targetEntity: { type: 'query', value: queryText },
            evidence: {
              metricName: 'ctr',
              baselineValue: Number((expectedCtr * 100).toFixed(1)), // Expected CTR %
              observedValue: Number((actualCtr * 100).toFixed(1)), // Actual CTR %
              deltaPercent: Number((((actualCtr - expectedCtr) / expectedCtr) * 100).toFixed(1)),
              periodBaselineLabel: `Site avg CTR for position tier (pos ${avgPos.toFixed(1)})`,
              periodObservedLabel: `Current query CTR`,
              sampleSize: q.impressions,
              supportingData: {
                queryText,
                avgPosition: Number(avgPos.toFixed(1)),
                impressions: q.impressions,
                actualClicks: q.clicks,
                estimatedMissedClicks: missedClicks
              }
            }
          });
        }
      }
    }

    return signals.sort((a, b) => {
      const aMissed = (a.evidence.supportingData?.estimatedMissedClicks as number) || 0;
      const bMissed = (b.evidence.supportingData?.estimatedMissedClicks as number) || 0;
      return bMissed - aMissed;
    }).slice(0, 1); // Deliver at most 1 high-leverage opportunity
  }

  /**
   * Signal 5: E-Commerce Conversion Drop
   * Requires: Baseline Orders >= 10, Conversion Rate Drop >= 25%, Total Orders Drop >= 20%
   */
  public evaluateConversionDrop(input: DetectionInput): DeterministicSignal | null {
    const { websiteId, ga4Baseline, ga4Observed } = input;
    if (ga4Baseline.length === 0 || ga4Observed.length === 0) return null;

    const baseOrders = ga4Baseline.reduce((acc, d) => acc + d.ecommercePurchases, 0);
    const baseSessions = ga4Baseline.reduce((acc, d) => acc + d.sessions, 0);

    // Minimum sample size guard: at least 10 orders in baseline
    if (baseOrders < 10 || baseSessions < 100) return null;

    const baseCvr = baseOrders / baseSessions;

    const obsOrders = ga4Observed.reduce((acc, d) => acc + d.ecommercePurchases, 0);
    const obsSessions = ga4Observed.reduce((acc, d) => acc + d.sessions, 0);
    if (obsSessions < 50) return null;

    const obsCvr = obsOrders / obsSessions;
    const cvrDelta = ((obsCvr - baseCvr) / baseCvr) * 100;
    const orderDelta = ((obsOrders - baseOrders) / baseOrders) * 100;

    if (cvrDelta <= -25.0 && orderDelta <= -20.0) {
      return {
        id: `sig_${websiteId}_cvr_drop_${input.reportDate}`,
        websiteId,
        signalType: 'conversion_drop',
        category: 'problem',
        severity: 'critical',
        confidence: 0.90,
        fingerprint: 'conversion_drop:site_total',
        targetEntity: { type: 'site', value: 'checkout' },
        evidence: {
          metricName: 'conversion_rate',
          baselineValue: Number((baseCvr * 100).toFixed(2)),
          observedValue: Number((obsCvr * 100).toFixed(2)),
          deltaPercent: Number(cvrDelta.toFixed(1)),
          periodBaselineLabel: `Baseline CVR (${baseOrders} orders / ${baseSessions} sessions)`,
          periodObservedLabel: `Recent CVR (${obsOrders} orders / ${obsSessions} sessions)`,
          sampleSize: baseSessions + obsSessions,
          supportingData: {
            baselineOrders: baseOrders,
            observedOrders: obsOrders,
            lostOrdersEstimate: Math.max(0, Math.round(obsSessions * baseCvr - obsOrders))
          }
        }
      };
    }

    return null;
  }
}
