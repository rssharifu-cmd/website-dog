import React, { useState, useMemo } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ExternalLink,
  ChevronRight,
  TrendingDown,
  Sparkles,
  Inbox,
  Filter,
  CheckSquare,
  Clock
} from 'lucide-react';
import { DeterministicDetectionEngine, DetectionInput } from './engine/detector';
import { DailyReportCompiler } from './engine/reporter';
import { FindingLifecycleManager } from './engine/lifecycle';
import {
  Finding,
  Task,
  DeterministicSignal
} from './types/domain';
import {
  MOCK_WEBSITE_ID,
  MOCK_DOMAIN,
  MOCK_SITE_BASELINES,
  MOCK_MONITORED_ASSETS,
  MOCK_GSC_BASELINE,
  MOCK_GA4_BASELINE,
  MOCK_GSC_OBSERVED_ANOMALY,
  MOCK_GA4_OBSERVED_ANOMALY,
  MOCK_GSC_PAGE_BASELINE,
  MOCK_GSC_PAGE_OBSERVED,
  MOCK_GSC_QUERY_BASELINE,
  MOCK_GSC_QUERY_OBSERVED
} from './engine/fixtures';

export default function App() {
  const [scenario, setScenario] = useState<'anomaly' | 'healthy'>('anomaly');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'acknowledged' | 'resolved'>('all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeTab, setActiveTab] = useState<'watch' | 'tasks' | 'email_preview'>('watch');

  // Instantiate deterministic engine & compiler
  const detector = useMemo(() => new DeterministicDetectionEngine(), []);
  const reporter = useMemo(() => new DailyReportCompiler(), []);
  const lifecycleManager = useMemo(() => new FindingLifecycleManager(), []);

  // Run deterministic detection based on active scenario
  const detectionResult = useMemo(() => {
    const input: DetectionInput = {
      websiteId: MOCK_WEBSITE_ID,
      reportDate: '2026-09-11',
      gscBaseline: MOCK_GSC_BASELINE,
      gscObserved: scenario === 'anomaly' ? MOCK_GSC_OBSERVED_ANOMALY : MOCK_GSC_BASELINE,
      gscPageBaseline: MOCK_GSC_PAGE_BASELINE,
      gscPageObserved: scenario === 'anomaly' ? MOCK_GSC_PAGE_OBSERVED : MOCK_GSC_PAGE_BASELINE,
      gscQueryBaseline: MOCK_GSC_QUERY_BASELINE,
      gscQueryObserved: scenario === 'anomaly' ? MOCK_GSC_QUERY_OBSERVED : MOCK_GSC_QUERY_BASELINE,
      ga4Baseline: MOCK_GA4_BASELINE,
      ga4Observed: scenario === 'anomaly' ? MOCK_GA4_OBSERVED_ANOMALY : MOCK_GA4_BASELINE,
      monitoredAssets: MOCK_MONITORED_ASSETS,
      siteBaselines: MOCK_SITE_BASELINES
    };

    const rawSignals = detector.evaluateAll(input);

    // Form structured findings with Phase 1 explanatory baseline (Gemini contract format)
    const findings: Finding[] = rawSignals.map((signal: DeterministicSignal) => {
      let headline = '';
      let whyItMatters = '';
      let action = '';

      if (signal.signalType === 'organic_click_drop') {
        headline = `Organic search clicks dropped ${Math.abs(signal.evidence.deltaPercent)}% over the past 7 days`;
        whyItMatters = `Google organic traffic dropped from an average of ${signal.evidence.baselineValue} clicks/day down to ${signal.evidence.observedValue} clicks/day.`;
        action = `Review Search Console index status and top ranking queries to pinpoint which collections lost ranking.`;
      } else if (signal.signalType === 'important_page_drop') {
        headline = `Clicks to important product page '${signal.targetEntity?.value}' dropped ${Math.abs(signal.evidence.deltaPercent)}%`;
        whyItMatters = `This is one of your pinned top-revenue products. Clicks decreased from ${signal.evidence.baselineValue} to ${signal.evidence.observedValue}.`;
        action = `Check product stock status, canonical tags, and search appearance for this URL.`;
      } else if (signal.signalType === 'ranking_loss') {
        headline = `Search query '${signal.targetEntity?.value}' slipped ${signal.evidence.supportingData?.positionsLost} positions in Google`;
        whyItMatters = `Average position deteriorated from ${signal.evidence.baselineValue} to ${signal.evidence.observedValue}, causing a ${Math.abs(signal.evidence.deltaPercent)}% drop in clicks.`;
        action = `Inspect SERP competitors who overtook this query to see if new buyer guides or product comparison pages were published.`;
      } else if (signal.signalType === 'ctr_opportunity') {
        headline = `Untapped CTR opportunity on '${signal.targetEntity?.value}' (Position ${signal.evidence.supportingData?.avgPosition})`;
        whyItMatters = `Ranking in top 4 with ${signal.evidence.sampleSize} impressions, but current CTR is ${signal.evidence.observedValue}% vs your site's typical ${signal.evidence.baselineValue}% for this position tier.`;
        action = `Test a stronger title tag and meta description mentioning free shipping or guarantee to capture ~${signal.evidence.supportingData?.estimatedMissedClicks} missed clicks.`;
      } else if (signal.signalType === 'conversion_drop') {
        headline = `E-commerce checkout conversion rate dropped ${Math.abs(signal.evidence.deltaPercent)}%`;
        whyItMatters = `Conversion rate dropped from ${signal.evidence.baselineValue}% to ${signal.evidence.observedValue}%, resulting in approximately ${signal.evidence.supportingData?.lostOrdersEstimate} fewer orders.`;
        action = `Verify that payment gateway, shipping calculators, and mobile checkout scripts are functioning smoothly.`;
      }

      return {
        id: `fnd_${signal.id}`,
        websiteId: signal.websiteId,
        reportDate: input.reportDate,
        signalType: signal.signalType,
        category: signal.category,
        severity: signal.severity,
        confidence: signal.confidence,
        status: 'new',
        headline,
        whyItMatters,
        likelyCauses: [
          {
            cause: `Observed metric shift of ${signal.evidence.deltaPercent}% during recent 7-day monitoring window.`,
            confidence: signal.confidence,
            evidence: `${signal.evidence.metricName}: ${signal.evidence.baselineValue} -> ${signal.evidence.observedValue}`
          }
        ],
        recommendedActions: [
          {
            action,
            priority: signal.severity === 'critical' ? 'critical' : 'high',
            reason: whyItMatters
          }
        ],
        whatToMonitor: `Watch daily ${signal.evidence.metricName} over next 7 calendar days.`,
        fingerprint: signal.fingerprint,
        evidence: signal.evidence,
        firstDetectedAt: new Date().toISOString(),
        lastDetectedAt: new Date().toISOString()
      };
    });

    const dailyReport = reporter.compile(MOCK_DOMAIN, input.reportDate, MOCK_WEBSITE_ID, findings);

    return { rawSignals, findings, dailyReport };
  }, [scenario, detector, reporter]);

  const handleCreateTask = (finding: Finding) => {
    if (finding.recommendedActions.length === 0) return;
    const newTask: Task = {
      id: `tsk_${Date.now()}`,
      websiteId: finding.websiteId,
      findingId: finding.id,
      title: finding.recommendedActions[0].action,
      description: `Recommended for: ${finding.headline}`,
      priority: finding.severity === 'critical' ? 'critical' : 'high',
      status: 'todo',
      createdAt: new Date().toISOString()
    };
    setTasks((prev) => [newTask, ...prev]);
    setActiveTab('tasks');
  };

  const handleToggleTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: t.status === 'done' ? 'todo' : 'done',
              completedAt: t.status === 'done' ? undefined : new Date().toISOString()
            }
          : t
      )
    );
  };

  return (
    <div id="sharflow-watchdog-app" className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <header id="main-header" className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm">
              SW
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-slate-900">SharFlow Website Watchdog</h1>
                <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded font-medium border border-slate-200">
                  Phase 1 Architecture
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Watching: <span className="font-semibold text-slate-700">{MOCK_DOMAIN}</span> (Shopify Store)
              </p>
            </div>
          </div>

          {/* Test Scenario Switcher */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <span className="text-slate-500 px-2 font-medium">Deterministic Engine Test:</span>
            <button
              id="btn-scenario-anomaly"
              onClick={() => setScenario('anomaly')}
              className={`px-3 py-1.5 rounded font-medium transition-all ${
                scenario === 'anomaly'
                  ? 'bg-white text-rose-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              5 Core Anomaly Signals
            </button>
            <button
              id="btn-scenario-healthy"
              onClick={() => setScenario('healthy')}
              className={`px-3 py-1.5 rounded font-medium transition-all ${
                scenario === 'healthy'
                  ? 'bg-white text-emerald-700 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Quiet Day ("Nothing Changed")
            </button>
          </div>
        </div>
      </header>

      {/* Primary Navigation */}
      <div id="subnav-bar" className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex gap-6">
            <button
              id="nav-tab-watch"
              onClick={() => setActiveTab('watch')}
              className={`py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'watch'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              Today's Watch
              {detectionResult.findings.length > 0 && (
                <span className="bg-rose-100 text-rose-700 text-xs px-1.5 py-0.2 rounded-full font-semibold">
                  {detectionResult.findings.length}
                </span>
              )}
            </button>

            <button
              id="nav-tab-tasks"
              onClick={() => setActiveTab('tasks')}
              className={`py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'tasks'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Action Queue
              {tasks.filter((t) => t.status === 'todo').length > 0 && (
                <span className="bg-slate-200 text-slate-700 text-xs px-1.5 py-0.2 rounded-full font-semibold">
                  {tasks.filter((t) => t.status === 'todo').length}
                </span>
              )}
            </button>

            <button
              id="nav-tab-email"
              onClick={() => setActiveTab('email_preview')}
              className={`py-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
                activeTab === 'email_preview'
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Inbox className="w-4 h-4" />
              Daily Email Preview
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden sm:flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span>Scheduled Daily Delivery: 8:00 AM America/New_York</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto p-6 flex-1">
        {/* TAB 1: TODAY'S WATCH */}
        {activeTab === 'watch' && (
          <div id="view-todays-watch" className="space-y-6">
            {/* Status Summary Banner */}
            <div
              id="watch-status-banner"
              className={`p-5 rounded-xl border ${
                detectionResult.findings.length === 0
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                  : 'bg-white border-slate-200 text-slate-900 shadow-xs'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {detectionResult.findings.length === 0 ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-rose-600" />
                    )}
                    <h2 className="text-base font-bold">
                      {detectionResult.findings.length === 0
                        ? 'Nothing important changed today.'
                        : `Your Website Watch: ${detectionResult.findings.length} findings require attention`}
                    </h2>
                  </div>
                  <p className="text-xs text-slate-600">
                    {detectionResult.findings.length === 0
                      ? 'All monitored organic search clicks, ranking positions, and e-commerce conversions are within normal baseline ranges.'
                      : 'Deterministic engine detected validated statistical shifts against your store’s 7-day rolling baseline.'}
                  </p>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md">
                    <span className="text-slate-500 block">Baseline Window</span>
                    <span className="font-semibold text-slate-800">7 Days (Aug 20–26)</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-md">
                    <span className="text-slate-500 block">Observed Window</span>
                    <span className="font-semibold text-slate-800">7 Days (Aug 27–Sep 02)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Findings List */}
            {detectionResult.findings.length === 0 ? (
              <div id="empty-state-quiet-day" className="bg-white border border-slate-200 rounded-xl p-12 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-1">Zero False Alerts</h3>
                <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
                  SharFlow never manufactures insights. When traffic fluctuations are within statistical noise thresholds, the watchdog reports peace of mind.
                </p>
                <button
                  id="btn-trigger-anomaly-demo"
                  onClick={() => setScenario('anomaly')}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                >
                  Switch to 5 Core Anomaly Scenario to inspect findings
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                    Prioritized Findings ({detectionResult.findings.length})
                  </h3>
                  <span className="text-xs text-slate-500">Sorted by business impact & confidence</span>
                </div>

                {detectionResult.findings.map((f: Finding) => (
                  <div
                    key={f.id}
                    id={`finding-card-${f.signalType}`}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2">
                        {f.category === 'problem' ? (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wider flex items-center gap-1">
                            <TrendingDown className="w-3 h-3" /> Problem
                          </span>
                        ) : (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2 py-0.5 rounded font-semibold uppercase tracking-wider flex items-center gap-1">
                            <Lightbulb className="w-3 h-3" /> Opportunity
                          </span>
                        )}
                        <span className="text-xs text-slate-500 font-mono">
                          {f.signalType}
                        </span>
                        <span className="text-xs text-slate-400">
                          Confidence: {Math.round(f.confidence * 100)}%
                        </span>
                      </div>

                      <div className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 self-start">
                        Severity: {f.severity.toUpperCase()}
                      </div>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 mb-2">
                      {f.headline}
                    </h4>

                    {/* Evidence Box */}
                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-100 mb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Baseline Value</span>
                        <span className="font-semibold text-slate-800">{f.evidence.baselineValue}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Observed Value</span>
                        <span className="font-semibold text-slate-800">{f.evidence.observedValue}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Delta</span>
                        <span
                          className={`font-bold ${
                            f.evidence.deltaPercent < 0 ? 'text-rose-600' : 'text-emerald-600'
                          }`}
                        >
                          {f.evidence.deltaPercent > 0 ? `+${f.evidence.deltaPercent}%` : `${f.evidence.deltaPercent}%`}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Sample Size</span>
                        <span className="font-semibold text-slate-800">{f.evidence.sampleSize}</span>
                      </div>
                    </div>

                    {/* Explanation details */}
                    <div className="space-y-2 mb-4 text-xs">
                      <div>
                        <strong className="text-slate-700">Why it matters:</strong>{' '}
                        <span className="text-slate-600">{f.whyItMatters}</span>
                      </div>
                      <div>
                        <strong className="text-slate-700">Recommended action:</strong>{' '}
                        <span className="text-slate-900 font-medium">{f.recommendedActions[0]?.action}</span>
                      </div>
                      <div>
                        <strong className="text-slate-700">What to monitor:</strong>{' '}
                        <span className="text-slate-500">{f.whatToMonitor}</span>
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400 font-mono">
                        Fingerprint: {f.fingerprint}
                      </span>
                      <button
                        id={`btn-act-${f.id}`}
                        onClick={() => handleCreateTask(f)}
                        className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                        Add to Action Queue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TASKS & ACTIONS */}
        {activeTab === 'tasks' && (
          <div id="view-action-queue" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Action Queue</h3>
                <p className="text-xs text-slate-500">Concrete tasks generated from watchdog findings.</p>
              </div>
              <span className="text-xs text-slate-500">
                {tasks.filter((t) => t.status === 'done').length} of {tasks.length} completed
              </span>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500">
                No active tasks in queue. Review Today's Watch and click "Add to Action Queue" on any finding.
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    id={`task-item-${task.id}`}
                    className={`bg-white rounded-lg border p-4 flex items-start justify-between gap-3 transition-all ${
                      task.status === 'done' ? 'border-slate-200 opacity-60 bg-slate-50' : 'border-slate-200 shadow-xs'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        id={`btn-toggle-task-${task.id}`}
                        onClick={() => handleToggleTask(task.id)}
                        className={`w-5 h-5 rounded border mt-0.5 flex items-center justify-center transition-colors ${
                          task.status === 'done'
                            ? 'bg-slate-900 border-slate-900 text-white'
                            : 'border-slate-300 hover:border-slate-400 bg-white'
                        }`}
                      >
                        {task.status === 'done' && <CheckSquare className="w-3.5 h-3.5" />}
                      </button>
                      <div>
                        <h4
                          className={`text-sm font-semibold ${
                            task.status === 'done' ? 'line-through text-slate-500' : 'text-slate-900'
                          }`}
                        >
                          {task.title}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {task.priority.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DAILY EMAIL PREVIEW */}
        {activeTab === 'email_preview' && (
          <div id="view-email-preview" className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-slate-500 block">Subject Line</span>
                <span className="text-sm font-bold text-slate-900">{detectionResult.dailyReport.subjectLine}</span>
              </div>
              <span className="text-xs bg-slate-100 border border-slate-200 text-slate-600 px-2 py-1 rounded">
                HTML Email Render
              </span>
            </div>

            <div className="bg-slate-100 rounded-xl p-6 border border-slate-200 flex justify-center">
              <div
                className="w-full max-w-xl bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: detectionResult.dailyReport.htmlBody }}
              />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 text-xs text-slate-500 text-center">
        SharFlow Website Watchdog &bull; Core Promise: "You run your business. Your AI Website Watchdog watches your website."
      </footer>
    </div>
  );
}
