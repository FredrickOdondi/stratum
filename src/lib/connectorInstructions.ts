export function getConnectorInstructions(activeConnectorIds: string[]): string {
  if (!activeConnectorIds || activeConnectorIds.length === 0) return '';

  const instructions: string[] = [];

  // 1. E-Commerce & Storefronts
  const ecommerceIds = ['shopify', 'woocommerce', 'bigcommerce', 'tiktok_shop', 'amazon_seller'];
  if (activeConnectorIds.some(id => ecommerceIds.includes(id))) {
    instructions.push(`
E-COMMERCE & STOREFRONT DATA (Shopify/WooCommerce/etc.):
- Always analyze '/orders' for Average Order Value (AOV), purchase frequency, and seasonal trends.
- Use '/customers' to determine Customer Lifetime Value (CLV), new vs. returning segment ratios, and repeat purchase rates.
- Cross-reference '/products' and '/inventory_levels' to spot slow-moving SKUs vs. high-velocity items.
- Strategic Focus: Determine if growth is driven by acquisition volume or existing customer monetization (higher LTV).
    `.trim());
  }

  // 2. Payment Gateways
  const paymentIds = ['stripe', 'paystack', 'paypal', 'recharge'];
  if (activeConnectorIds.some(id => paymentIds.includes(id))) {
    instructions.push(`
PAYMENT GATEWAY DATA (Stripe/PayPal/Recharge/etc.):
- Reconcile gross revenue with '/charges' or '/transactions' to isolate net cash flow post-refunds.
- Actively scan '/disputes' and '/chargebacks' for underlying product quality or fraud issues.
- For recurring models, analyze '/subscriptions' to calculate MRR and cohort retention decay curves.
- Strategic Focus: Assess cash conversion cycles and whether churn is destroying enterprise value.
    `.trim());
  }

  // 3. Advertising & Acquisition
  const adIds = ['meta_ads', 'google_ads', 'tiktok_ads', 'pinterest_ads', 'amazon_ads'];
  if (activeConnectorIds.some(id => adIds.includes(id))) {
    instructions.push(`
ADVERTISING & ACQUISITION DATA (Meta/Google/TikTok/etc.):
- Review '/campaigns' and '/adsets' to understand spend allocation between prospecting (Top-of-Funnel) and retargeting (Bottom-of-Funnel).
- Extract CPC, CTR, and CPA from '/insights' to evaluate creative fatigue and audience saturation.
- Compare platform-reported ROAS vs. blended ROAS.
- Strategic Focus: Identify if CAC is scaling non-linearly with ad spend and find the most efficient marginal channel.
    `.trim());
  }

  // 4. Marketing CRM
  const crmIds = ['klaviyo', 'mailchimp', 'attentive', 'postscript', 'omnisend'];
  if (activeConnectorIds.some(id => crmIds.includes(id))) {
    instructions.push(`
MARKETING CRM & RETENTION DATA (Klaviyo/Mailchimp/etc.):
- Analyze '/metrics' for engagement decay over time.
- Evaluate '/profiles' or '/lists' for active list growth velocity and unsubscribe rates.
- Assess core '/flows' (Welcome Series, Abandoned Cart, Win-Back) for revenue contribution percentages.
- Strategic Focus: Measure the percentage of total revenue driven by owned (non-paid) channels to reduce dependency on paid acquisition.
    `.trim());
  }

  // 5. Analytics & Attribution
  const analyticsIds = ['ga4', 'triple_whale', 'northbeam'];
  if (activeConnectorIds.some(id => analyticsIds.includes(id))) {
    instructions.push(`
ANALYTICS & ATTRIBUTION DATA (Triple Whale/GA4/etc.):
- Extract Blended ROAS (MER), Total Net Profit, and Blended CAC as the primary sources of truth.
- Contrast first-click vs. last-click attribution paths to map the true customer journey.
- Look at on-site metrics (bounce rates, time on site) from GA4 to find UX bottlenecks.
- Strategic Focus: Ensure budget is not over-indexed on bottom-funnel conversion at the expense of top-funnel awareness.
    `.trim());
  }

  // 6. CX & Reviews
  const cxIds = ['zendesk', 'gorgias', 'yotpo', 'okendo', 'loox', 'smile'];
  if (activeConnectorIds.some(id => cxIds.includes(id))) {
    instructions.push(`
CUSTOMER EXPERIENCE & REVIEWS DATA (Zendesk/Gorgias/Okendo/etc.):
- Correlate '/tickets' volume and tag categorization (e.g. "Shipping Delay") with repeat purchase rates.
- Evaluate '/satisfaction_ratings' post-resolution.
- Analyze qualitative text from '/reviews' for sentiment analysis and product feedback.
- Strategic Focus: Determine if poor logistics or product quality is artificially capping LTV.
    `.trim());
  }

  // 7. Operations & Logistics
  const opsIds = ['shipstation', 'cin7', 'skio'];
  if (activeConnectorIds.some(id => opsIds.includes(id))) {
    instructions.push(`
OPERATIONS & LOGISTICS DATA (ShipStation/Cin7/etc.):
- Calculate unit economics using '/shipments' (average shipping cost per order).
- Use '/inventory' to determine inventory turnover ratios and capital tied up in dead stock.
- Analyze stock-out (OOS) rates to quantify lost revenue potential.
- Strategic Focus: Ensure rising 3PL/shipping costs aren't eroding Contribution Margin 3 (CM3).
    `.trim());
  }

  // 8. Custom Data Connectors
  const customIds = ['supabase', 'csv'];
  if (activeConnectorIds.some(id => customIds.includes(id))) {
    instructions.push(`
CUSTOM DATA SOURCES (CSV Uploads/Supabase DBs):
- Carefully inspect table schemas and CSV headers before generating analytics.
- Cross-reference custom UUIDs/foreign keys against operational metrics if present.
- Strategic Focus: Ensure data integrity and watch out for duplicate records or null-heavy columns that might skew aggregation.
    `.trim());
  }

  if (instructions.length === 0) return '';

  return `
MANDATORY STRATEGY INSTRUCTIONS FOR CONNECTED APPS:
You are analyzing live data from connected third-party platforms. You MUST apply the following analytical lenses to the extracted data:

${instructions.join('\n\n')}
`.trim();
}
