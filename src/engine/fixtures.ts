/**
 * Mock & Verification Datasets for Phase 1 Validation
 * Represents real e-commerce store metrics (Shopify apparel retailer)
 *
 * Scenarios:
 * 1. Healthy baseline: 120 clicks/day, steady conversions
 * 2. Anomaly dataset triggering the 5 MVP signals:
 *    - Organic click drop: 120 clicks/day -> 84 clicks/day (-30%)
 *    - Important page drop: '/products/linen-shirt' drops from 150 to 92 clicks (-38.6%)
 *    - Ranking loss: query 'casual linen shirt' drops from pos 3.2 to 7.8 and -55% clicks
 *    - CTR opportunity: query 'summer button down shirt' pos 2.4, 450 impressions, CTR 1.8% vs site Tier 2 baseline 7.5%
 *    - Conversion drop: CVR dips from 2.4% to 1.4% (-41.6%) and orders from 28 to 16 (-42.8%)
 * 3. Quiet dataset: all metrics within ±3% baseline (triggers "Nothing important changed today")
 */

import {
  GscDailyMetric,
  GscPageMetric,
  GscQueryMetric,
  Ga4DailyMetric,
  MonitoredAsset,
  SiteMetricBaselines
} from '../types/domain';

export const MOCK_WEBSITE_ID = 'web_apex_threads';
export const MOCK_DOMAIN = 'apexthreads.com';

export const MOCK_SITE_BASELINES: SiteMetricBaselines = {
  websiteId: MOCK_WEBSITE_ID,
  calculatedAt: '2026-09-01T00:00:00Z',
  baselineWindow: { startDate: '2026-08-20', endDate: '2026-08-26', daysCount: 7 },
  avgDailyGscClicks: 120,
  avgDailyGscImpressions: 2800,
  avgDailyGa4Sessions: 450,
  avgDailyGa4Orders: 10,
  avgDailyGa4Revenue: 850,
  avgConversionRate: 0.022,
  positionTierCtrs: {
    tier1: 0.185, // 18.5% for pos 1-2
    tier2: 0.075, // 7.5% for pos 2.1-4
    tier3: 0.038, // 3.8% for pos 4.1-7
    tier4: 0.015  // 1.5% for pos 7.1-10
  }
};

export const MOCK_MONITORED_ASSETS: MonitoredAsset[] = [
  {
    id: 'ast_1',
    websiteId: MOCK_WEBSITE_ID,
    assetType: 'page',
    assetValue: '/products/linen-shirt',
    label: 'Hero Product: Men Linen Shirt',
    isUserPinned: true,
    createdAt: '2026-08-01T00:00:00Z'
  }
];

// Baseline 7 days (Aug 20 - Aug 26)
export const MOCK_GSC_BASELINE: GscDailyMetric[] = Array.from({ length: 7 }, (_, i) => ({
  websiteId: MOCK_WEBSITE_ID,
  date: `2026-08-${20 + i}`,
  clicks: 120 + (i % 2 === 0 ? 5 : -5),
  impressions: 2800,
  ctr: 0.042,
  avgPosition: 8.5
}));

export const MOCK_GA4_BASELINE: Ga4DailyMetric[] = Array.from({ length: 7 }, (_, i) => ({
  websiteId: MOCK_WEBSITE_ID,
  date: `2026-08-${20 + i}`,
  sessions: 450 + (i % 2 === 0 ? 10 : -10),
  activeUsers: 400,
  bounceRate: 0.42,
  conversions: 12,
  ecommercePurchases: 4, // Total 28 orders in 7 days
  ecommerceRevenue: 340
}));

// Anomaly Observed 7 days (Aug 27 - Sep 02)
export const MOCK_GSC_OBSERVED_ANOMALY: GscDailyMetric[] = Array.from({ length: 7 }, (_, i) => ({
  websiteId: MOCK_WEBSITE_ID,
  date: `2026-08-${27 + i}`,
  clicks: 84, // 30% drop
  impressions: 2500,
  ctr: 0.033,
  avgPosition: 10.2
}));

export const MOCK_GA4_OBSERVED_ANOMALY: Ga4DailyMetric[] = Array.from({ length: 7 }, (_, i) => ({
  websiteId: MOCK_WEBSITE_ID,
  date: `2026-08-${27 + i}`,
  sessions: 430,
  activeUsers: 390,
  bounceRate: 0.46,
  conversions: 6,
  ecommercePurchases: 2, // Total 14 orders in 7 days (CVR dropped to ~0.7%)
  ecommerceRevenue: 170
}));

export const MOCK_GSC_PAGE_BASELINE: GscPageMetric[] = [
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-20', pagePath: '/products/linen-shirt', clicks: 150, impressions: 1800, ctr: 0.083, avgPosition: 3.4 },
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-20', pagePath: '/collections/all', clicks: 200, impressions: 3000, ctr: 0.066, avgPosition: 4.5 }
];

export const MOCK_GSC_PAGE_OBSERVED: GscPageMetric[] = [
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-27', pagePath: '/products/linen-shirt', clicks: 92, impressions: 1750, ctr: 0.052, avgPosition: 5.8 }, // -38.6% drop
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-27', pagePath: '/collections/all', clicks: 195, impressions: 2900, ctr: 0.067, avgPosition: 4.6 }
];

export const MOCK_GSC_QUERY_BASELINE: GscQueryMetric[] = [
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-20', queryText: 'casual linen shirt', clicks: 45, impressions: 420, ctr: 0.107, avgPosition: 3.2 },
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-20', queryText: 'summer button down shirt', clicks: 10, impressions: 450, ctr: 0.022, avgPosition: 2.4 }
];

export const MOCK_GSC_QUERY_OBSERVED: GscQueryMetric[] = [
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-27', queryText: 'casual linen shirt', clicks: 18, impressions: 400, ctr: 0.045, avgPosition: 7.8 }, // Slipped 4.6 pos
  { websiteId: MOCK_WEBSITE_ID, date: '2026-08-27', queryText: 'summer button down shirt', clicks: 8, impressions: 450, ctr: 0.017, avgPosition: 2.4 } // Position 2.4, CTR 1.7% vs Tier 2 avg 7.5%
];
