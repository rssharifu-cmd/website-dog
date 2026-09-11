/**
 * SharFlow Website Watchdog - Daily Email Brief Generator
 *
 * CRITICAL PRODUCT PRINCIPLE:
 * The user should understand the report in under 2 minutes.
 * Structure:
 * 1. TODAY'S SUMMARY
 * 2. IMPORTANT PROBLEM (if any)
 * 3. OPPORTUNITY (if any)
 * 4. RECOMMENDED ACTIONS
 * 5. MONITORING / "Nothing important changed" when appropriate
 */

import { DailyReport, Finding } from '../types/domain';

export class DailyReportCompiler {
  /**
   * Compiles the findings into a structured daily report with clean HTML and Markdown formats.
   */
  public compile(websiteDomain: string, reportDate: string, websiteId: string, findings: Finding[]): DailyReport {
    const problems = findings.filter((f) => f.category === 'problem');
    const opportunities = findings.filter((f) => f.category === 'opportunity');
    const isQuietDay = findings.length === 0;

    let subjectLine = `Your Website Watch: All clear today (${websiteDomain})`;
    if (problems.length > 0 && opportunities.length > 0) {
      subjectLine = `Your Website Watch: ${problems.length} problem, ${opportunities.length} opportunity (${websiteDomain})`;
    } else if (problems.length > 0) {
      subjectLine = `Your Website Watch: ${problems.length} issue needs attention (${websiteDomain})`;
    } else if (opportunities.length > 0) {
      subjectLine = `Your Website Watch: ${opportunities.length} opportunity spotted (${websiteDomain})`;
    }

    const summaryMarkdown = this.buildMarkdown(websiteDomain, reportDate, problems, opportunities, isQuietDay);
    const htmlBody = this.buildHtml(websiteDomain, reportDate, problems, opportunities, isQuietDay);

    return {
      id: `rep_${websiteId}_${reportDate.replace(/-/g, '')}`,
      websiteId,
      reportDate,
      subjectLine,
      summaryMarkdown,
      htmlBody,
      findingsCount: findings.length,
      findings,
      isQuietDay,
      deliveredViaEmail: false,
      createdAt: new Date().toISOString()
    };
  }

  private buildMarkdown(
    domain: string,
    date: string,
    problems: Finding[],
    opportunities: Finding[],
    isQuietDay: boolean
  ): string {
    if (isQuietDay) {
      return `### TODAY'S WEBSITE WATCH — ${domain} (${date})\n\n**Nothing important changed today.**\nAll monitored organic traffic, key query rankings, and checkout metrics are operating within expected historical baseline ranges. No manual checks needed.`;
    }

    let md = `### TODAY'S WEBSITE WATCH — ${domain} (${date})\n\n`;

    if (problems.length > 0) {
      md += `#### 🔴 Problems\n`;
      problems.forEach((p) => {
        md += `**${p.headline}**\n- **Why it matters:** ${p.whyItMatters}\n`;
        if (p.recommendedActions.length > 0) {
          md += `- **Recommended action:** ${p.recommendedActions[0].action}\n`;
        }
        md += `\n`;
      });
    }

    if (opportunities.length > 0) {
      md += `#### 🟢 Opportunities\n`;
      opportunities.forEach((o) => {
        md += `**${o.headline}**\n- **Why it matters:** ${o.whyItMatters}\n`;
        if (o.recommendedActions.length > 0) {
          md += `- **Recommended action:** ${o.recommendedActions[0].action}\n`;
        }
        md += `\n`;
      });
    }

    return md;
  }

  private buildHtml(
    domain: string,
    date: string,
    problems: Finding[],
    opportunities: Finding[],
    isQuietDay: boolean
  ): string {
    const primaryColor = '#0F172A';
    const accentBorder = '#E2E8F0';

    if (isQuietDay) {
      return `
        <!DOCTYPE html>
        <html>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1E293B; margin: 0; padding: 24px; background: #F8FAFC;">
          <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid ${accentBorder}; padding: 32px;">
            <div style="font-size: 13px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">SharFlow Website Watchdog</div>
            <h1 style="font-size: 20px; font-weight: 700; color: ${primaryColor}; margin-top: 0; margin-bottom: 16px;">Today's Website Watch: ${domain}</h1>
            <div style="background: #F1F5F9; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
              <div style="font-size: 24px; margin-bottom: 8px;">⚪</div>
              <div style="font-size: 16px; font-weight: 600; color: #0F172A;">Nothing important changed today.</div>
              <div style="font-size: 14px; color: #64748B; margin-top: 4px;">All search traffic, rankings, and conversions are within their normal baseline ranges.</div>
            </div>
            <p style="font-size: 13px; color: #94A3B8; margin-top: 32px; border-top: 1px solid #F1F5F9; padding-top: 16px;">You run your business. Your AI Website Watchdog watches your website.</p>
          </div>
        </body>
        </html>
      `.trim();
    }

    const renderFindingCard = (f: Finding, icon: string, badgeBg: string, badgeColor: string) => `
      <div style="margin-bottom: 20px; padding: 18px; border-radius: 8px; border: 1px solid #E2E8F0; background: #FFFFFF;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 14px; margin-right: 8px;">${icon}</span>
          <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; padding: 2px 8px; border-radius: 4px; background: ${badgeBg}; color: ${badgeColor};">${f.signalType.replace(/_/g, ' ')}</span>
        </div>
        <h3 style="font-size: 16px; font-weight: 600; color: #0F172A; margin: 6px 0 10px 0;">${f.headline}</h3>
        <p style="font-size: 14px; color: #334155; margin: 0 0 10px 0;"><strong>Why it matters:</strong> ${f.whyItMatters}</p>
        ${f.recommendedActions.length > 0 ? `
          <div style="background: #F8FAFC; border-radius: 6px; padding: 12px; margin-top: 10px;">
            <div style="font-size: 12px; font-weight: 600; color: #475569; text-transform: uppercase;">Recommended Action:</div>
            <div style="font-size: 14px; color: #0F172A; margin-top: 2px;">${f.recommendedActions[0].action}</div>
          </div>
        ` : ''}
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1E293B; margin: 0; padding: 24px; background: #F8FAFC;">
        <div style="max-width: 600px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid ${accentBorder}; padding: 32px;">
          <div style="font-size: 12px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">SharFlow Website Watchdog</div>
          <h1 style="font-size: 22px; font-weight: 700; color: ${primaryColor}; margin-top: 0; margin-bottom: 20px;">Daily Watch: ${domain}</h1>
          
          ${problems.length > 0 ? `
            <div style="margin-top: 24px;">
              <div style="font-size: 13px; font-weight: 700; color: #DC2626; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Needs Attention (${problems.length})</div>
              ${problems.map((p) => renderFindingCard(p, '🔴', '#FEE2E2', '#991B1B')).join('')}
            </div>
          ` : ''}

          ${opportunities.length > 0 ? `
            <div style="margin-top: 24px;">
              <div style="font-size: 13px; font-weight: 700; color: #16A34A; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">Growth Opportunities (${opportunities.length})</div>
              ${opportunities.map((o) => renderFindingCard(o, '🟢', '#DCFCE7', '#166534')).join('')}
            </div>
          ` : ''}

          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #E2E8F0; text-align: center;">
            <p style="font-size: 13px; color: #64748B; margin: 0;">You run your business. Your AI Website Watchdog watches your website.</p>
          </div>
        </div>
      </body>
      </html>
    `.trim();
  }
}
