/**
 * SharFlow Website Watchdog - Domain Types & Core Interfaces
 * Defines the strict schema for:
 * 1. Monitored Entities (User, Website, Monitored Assets)
 * 2. Raw Ingested Metrics (GSC and GA4 decoupled)
 * 3. Aggregated Windows & Rolling Baselines
 * 4. Deterministic Signals (Code-detected anomalies)
 * 5. Findings & Evidence (AI-explained intelligence)
 * 6. Daily Report & Task Contracts
 */

// ==========================================
// 1. MONITORED ENTITIES & WORKSPACE
// ==========================================

export type BusinessGoal = 'sales' | 'traffic' | 'leads';

export interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  timezone: string; // e.g. 'America/New_York'
  preferredReportTime: string; // 'HH:MM:SS', e.g. '08:00:00'
  emailEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MonitoredWebsite {
  id: string;
  userId: string;
  domain: string;
  siteUrl: string;
  primaryGoal: BusinessGoal;
  isActive: boolean;
  createdAt: string;
}

export interface MonitoredAsset {
  id: string;
  websiteId: string;
  assetType: 'page' | 'query';
  assetValue: string; // URL path e.g. '/products/linen-shirt' or search query e.g. 'linen shirt'
  label?: string;
  isUserPinned: boolean;
  createdAt: string;
}

export interface PropertyMapping {
  id: string;
  websiteId: string;
  connectionId: string;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
  isActive: boolean;
  lastGscSyncAt?: string;
  lastGa4SyncAt?: string;
}

// ==========================================
// 2. RAW & INGESTED METRIC MODELS (Decoupled)
// ==========================================

export interface GscDailyMetric {
  websiteId: string;
  date: string; // 'YYYY-MM-DD'
  clicks: number;
  impressions: number;
  ctr: number; // 0.0 to 1.0 (e.g. 0.042 = 4.2%)
  avgPosition: number;
}

export interface GscPageMetric {
  websiteId: string;
  date: string; // 'YYYY-MM-DD'
  pagePath: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export interface GscQueryMetric {
  websiteId: string;
  date: string; // 'YYYY-MM-DD'
  queryText: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
}

export interface Ga4DailyMetric {
  websiteId: string;
  date: string; // 'YYYY-MM-DD'
  sessions: number;
  activeUsers: number;
  bounceRate: number; // 0.0 to 1.0
  conversions: number;
  ecommercePurchases: number;
  ecommerceRevenue: number;
}

export interface Ga4LandingPageMetric {
  websiteId: string;
  date: string; // 'YYYY-MM-DD'
  landingPage: string;
  sessions: number;
  conversions: number;
  ecommercePurchases: number;
  ecommerceRevenue: number;
}

export interface Ga4ChannelMetric {
  websiteId: string;
  date: string; // 'YYYY-MM-DD'
  channelGroup: string; // 'Organic Search', 'Direct', 'Paid Search', etc.
  sessions: number;
  ecommercePurchases: number;
  ecommerceRevenue: number;
}

// ==========================================
// 3. COMPARISON WINDOWS & SITE BASELINES
// ==========================================

export interface MetricTimeWindow {
  startDate: string;
  endDate: string;
  daysCount: number;
}

export interface PositionTierCtrBaseline {
  tier1: number; // Avg CTR for positions 1.0 to 2.0 on this site
  tier2: number; // Avg CTR for positions 2.1 to 4.0 on this site
  tier3: number; // Avg CTR for positions 4.1 to 7.0 on this site
  tier4: number; // Avg CTR for positions 7.1 to 10.0 on this site
}

export interface SiteMetricBaselines {
  websiteId: string;
  calculatedAt: string;
  baselineWindow: MetricTimeWindow;
  avgDailyGscClicks: number;
  avgDailyGscImpressions: number;
  avgDailyGa4Sessions: number;
  avgDailyGa4Orders: number;
  avgDailyGa4Revenue: number;
  avgConversionRate: number;
  positionTierCtrs: PositionTierCtrBaseline;
}

// ==========================================
// 4. DETERMINISTIC SIGNAL ENGINE CONTRACTS
// ==========================================

export type CoreSignalType =
  | 'organic_click_drop'
  | 'important_page_drop'
  | 'ranking_loss'
  | 'ctr_opportunity'
  | 'conversion_drop';

export type SignalCategory = 'problem' | 'opportunity' | 'monitoring' | 'positive';
export type SignalSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface SignalEvidenceMetric {
  metricName: string;
  baselineValue: number;
  observedValue: number;
  deltaPercent: number;
  periodBaselineLabel: string;
  periodObservedLabel: string;
  sampleSize: number;
  supportingData?: Record<string, unknown>;
}

export interface DeterministicSignal {
  id: string;
  websiteId: string;
  signalType: CoreSignalType;
  category: SignalCategory;
  severity: SignalSeverity;
  confidence: number; // 0.00 to 1.00
  fingerprint: string; // Deduplication key (e.g. 'organic_click_drop:site_total')
  targetEntity?: {
    type: 'site' | 'page' | 'query';
    value: string; // Page path, query string, or 'site'
  };
  evidence: SignalEvidenceMetric;
}

// ==========================================
// 5. FINDINGS (AI-Interpreted Intelligence)
// ==========================================

export type FindingStatus =
  | 'new'
  | 'active'
  | 'acknowledged'
  | 'resolved'
  | 'dismissed';

export interface LikelyCause {
  cause: string;
  confidence: number; // 0.00 to 1.00
  evidence: string;
}

export interface RecommendedAction {
  action: string;
  priority: 'critical' | 'high' | 'medium';
  reason: string;
}

export interface FindingExplanation {
  headline: string;
  whyItMatters: string;
  likelyCauses: LikelyCause[];
  recommendedActions: RecommendedAction[];
  whatToMonitor: string;
}

export interface Finding {
  id: string;
  websiteId: string;
  reportDate: string; // 'YYYY-MM-DD'
  signalType: CoreSignalType;
  category: SignalCategory;
  severity: SignalSeverity;
  confidence: number;
  status: FindingStatus;
  headline: string;
  whyItMatters: string;
  likelyCauses: LikelyCause[];
  recommendedActions: RecommendedAction[];
  whatToMonitor?: string;
  fingerprint: string;
  evidence: SignalEvidenceMetric;
  firstDetectedAt: string;
  lastDetectedAt: string;
  resolvedAt?: string;
}

// ==========================================
// 6. TASKS & ACTIONS
// ==========================================

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'dismissed';

export interface Task {
  id: string;
  websiteId: string;
  findingId?: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium';
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
}

// ==========================================
// 7. DAILY REPORT & DELIVERY CONTRACT
// ==========================================

export interface DailyReport {
  id: string;
  websiteId: string;
  reportDate: string; // 'YYYY-MM-DD'
  subjectLine: string;
  summaryMarkdown: string;
  htmlBody: string;
  findingsCount: number;
  findings: Finding[];
  isQuietDay: boolean; // True when "Nothing important changed today"
  deliveredViaEmail: boolean;
  deliveredAt?: string;
  createdAt: string;
}

// ==========================================
// 8. CONNECTOR CONTRACTS (GSC & GA4 Stubs)
// ==========================================

export interface GscDataRequest {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: ('date' | 'page' | 'query')[];
  rowLimit?: number;
}

export interface Ga4DataRequest {
  propertyId: string;
  startDate: string;
  endDate: string;
}

export interface IGoogleSearchConsoleService {
  fetchDailyMetrics(req: GscDataRequest, accessToken: string): Promise<GscDailyMetric[]>;
  fetchPageMetrics(req: GscDataRequest, accessToken: string): Promise<GscPageMetric[]>;
  fetchQueryMetrics(req: GscDataRequest, accessToken: string): Promise<GscQueryMetric[]>;
}

export interface IGoogleAnalyticsService {
  fetchDailyMetrics(req: Ga4DataRequest, accessToken: string): Promise<Ga4DailyMetric[]>;
  fetchLandingPageMetrics(req: Ga4DataRequest, accessToken: string): Promise<Ga4LandingPageMetric[]>;
  fetchChannelMetrics(req: Ga4DataRequest, accessToken: string): Promise<Ga4ChannelMetric[]>;
}

export interface IEmailDeliveryService {
  sendDailyBrief(to: string, report: DailyReport): Promise<{ success: boolean; messageId?: string; error?: string }>;
}
