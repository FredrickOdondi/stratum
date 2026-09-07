# AI Strategy Agent: Connector Data Extraction Guide

To act as a "Senior Strategy Consultant", the AI agent requires access to high-fidelity, actionable data points across the brand's entire operational stack. Connecting an app (like PayPal or Shopify) is only the first step. The agent must be programmed to fetch the *right* endpoints to calculate strategic KPIs (Customer Acquisition Cost, Lifetime Value, Contribution Margins, Inventory Turnover, etc.).

Below is a breakdown of what the AI agent must fetch from each major category of connectors.

---

## 1. E-Commerce & Storefronts
*(Shopify, WooCommerce, BigCommerce, TikTok Shop)*

The core purpose of storefront connectors is to understand revenue composition, customer cohort behavior, and product mix.

**Key API Endpoints to Fetch:**
* **`/orders`**: Fetch historical order data to calculate Average Order Value (AOV), purchase frequency, and identify seasonal revenue trends.
* **`/customers`**: Aggregate data to calculate Customer Lifetime Value (CLV), segment new vs. returning customers, and calculate repeat purchase rates.
* **`/products` & `/inventory_levels`**: Extract product catalog, variant pricing, and current stock levels to calculate sell-through rates and identify slow-moving SKU drag.
* **`/checkouts` or `/draft_orders`**: Analyze cart abandonment rates and where friction exists in the funnel.

**Strategic Synthesis:** "Are we growing via acquisition of new customers, or extraction of higher LTV from existing customers?"

---

## 2. Payment Gateways
*(Stripe, PayPal, Paystack, Recharge)*

Payment gateways reveal the true financial health of the business, including subscription retention and actual realized cash flow (post-disputes/refunds).

**Key API Endpoints to Fetch:**
* **`/charges` or `/transactions`**: Reconcile gross revenue against storefront data to measure true net revenue after refunds.
* **`/disputes` & `/chargebacks`**: Identify risk factors or product quality issues leading to high chargeback rates.
* **`/subscriptions` (Stripe/Recharge)**: Vital for MRR (Monthly Recurring Revenue) calculations, churn rates, and cohort retention decay over time.
* **`/payouts`**: Analyze cash conversion cycles and working capital availability.

**Strategic Synthesis:** "Is our subscription churn destroying the enterprise value of the business, and are our refund rates sustainable?"

---

## 3. Advertising & Acquisition
*(Meta Ads, Google Ads, TikTok Ads, Amazon Ads)*

Ad platforms dictate the efficiency of the growth engine. The agent must extract spend, impressions, and attributed conversions.

**Key API Endpoints to Fetch:**
* **`/campaigns` & `/adsets`**: Spend allocation by channel, funnel stage (prospecting vs. retargeting), and demographic targeting.
* **`/insights` or `/metrics`**: Daily spend, Cost Per Click (CPC), Click-Through Rate (CTR), and Cost Per Acquisition (CPA).
* **`/conversions`**: Platform-reported Return on Ad Spend (ROAS).

**Strategic Synthesis:** "Is our Customer Acquisition Cost (CAC) scaling non-linearly with increased ad spend, and which channel provides the most efficient marginal return?"

---

## 4. Marketing CRM & Retention
*(Klaviyo, Mailchimp, Attentive, Postscript)*

CRM platforms hold the key to owned-audience monetization and dependency on paid media.

**Key API Endpoints to Fetch:**
* **`/metrics` or `/events`**: Open rates, click rates, and revenue attributed to specific campaigns and automated flows.
* **`/profiles` or `/lists`**: Active list growth rate, email/SMS list size, and churn/unsubscribe rates.
* **`/flows`**: Performance of key automated sequences (Welcome Series, Abandoned Cart, Win-Back).

**Strategic Synthesis:** "What percentage of overall revenue is driven by owned channels, and are we effectively recovering abandoned carts to lower our blended CAC?"

---

## 5. Analytics & Attribution
*(Google Analytics 4, Triple Whale, Northbeam)*

These platforms provide the "source of truth" by blending all channels into a unified attribution model, critical for overcoming iOS privacy limitations.

**Key API Endpoints to Fetch:**
* **`/summary` (Triple Whale/Northbeam)**: Blended ROAS (MER - Marketing Efficiency Ratio), Total Net Profit, and Blended CAC.
* **`/attribution`**: First-click, last-click, and linear attribution paths to understand the true customer journey across multiple touchpoints.
* **`/events` (GA4)**: On-site behavioral metrics like bounce rates, time on site, and conversion rate by device type.

**Strategic Synthesis:** "Are we over-indexing our budget on bottom-of-funnel conversion tactics at the expense of top-of-funnel brand awareness?"

---

## 6. Customer Experience & Support
*(Zendesk, Gorgias, Yotpo, Okendo, Loox)*

Post-purchase data is the strongest leading indicator of future retention and brand equity.

**Key API Endpoints to Fetch:**
* **`/tickets` (Zendesk/Gorgias)**: Ticket volume, average resolution time, and tag categorization (e.g., "Shipping Delay", "Defective Product").
* **`/satisfaction_ratings` (CSAT)**: Customer satisfaction scores post-resolution.
* **`/reviews` (Yotpo/Okendo)**: Average star ratings, review velocity, and qualitative text extraction for sentiment analysis.

**Strategic Synthesis:** "Is poor product quality or shipping logistics creating a bottleneck for repeat purchases and driving up customer support overhead?"

---

## 7. Operations & Logistics
*(ShipStation, Cin7, Skio)*

Fulfillment data determines unit economics and operational bottlenecks.

**Key API Endpoints to Fetch:**
* **`/shipments` (ShipStation)**: Average shipping cost per order, time-in-transit, and fulfillment latency.
* **`/inventory` (Cin7)**: Inventory turnover ratios, carrying costs, and out-of-stock (OOS) rates.
* **`/purchase_orders`**: Supply chain lead times and supplier pricing variance.

**Strategic Synthesis:** "Are rising 3PL and shipping costs eroding our contribution margin (CM3), and are stock-outs artificially capping our revenue growth?"
