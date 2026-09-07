import { useState, useEffect, useCallback } from 'react';
import { AppShell } from '../../components/layout/AppShell';
import { Search, Link2, CheckCircle2, Plug, Unplug, Loader2 } from 'lucide-react';
import { ConnectModal, type ConnectorConfig } from '../../components/connectors/ConnectModal';
import { loadConnectors, deleteConnector, type ConnectorCredential } from '../../lib/connectorStorage';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { usePaystackPayment } from 'react-paystack';

// ─────────────────────────────────────────────────────────────
// Connector Configuration Registry
// ─────────────────────────────────────────────────────────────
const CONNECTOR_CONFIGS: Record<string, ConnectorConfig> = {
  shopify: {
    id: 'shopify', name: 'Shopify', domain: 'shopify.com', description: 'Connect your Shopify store to pull orders, products and customers.',
    authType: 'apikey',
    docsUrl: 'https://help.shopify.com/en/manual/apps/app-types/custom-apps',
    fields: [
      { key: 'store_url', label: 'Store URL', placeholder: 'myshop.myshopify.com', helpText: 'Your myshopify.com subdomain.' },
      { key: 'access_token', label: 'Admin API Access Token', placeholder: 'shpat_...', type: 'password', helpText: 'Shopify Admin → Settings → Apps → Develop apps → your app → Admin API access token.' },
    ],
  },
  woocommerce: {
    id: 'woocommerce', name: 'WooCommerce', domain: 'woocommerce.com', description: 'Connect your WooCommerce store via REST API.',
    authType: 'apikey',
    docsUrl: 'https://woo.com/document/woocommerce-rest-api/',
    fields: [
      { key: 'store_url', label: 'Store URL', placeholder: 'https://mystore.com' },
      { key: 'consumer_key', label: 'Consumer Key', placeholder: 'ck_...', type: 'password' },
      { key: 'consumer_secret', label: 'Consumer Secret', placeholder: 'cs_...', type: 'password' },
    ],
  },
  bigcommerce: {
    id: 'bigcommerce', name: 'BigCommerce', domain: 'bigcommerce.com', description: 'Connect your BigCommerce store.',
    authType: 'apikey',
    docsUrl: 'https://developer.bigcommerce.com/docs/start/authentication',
    fields: [
      { key: 'store_hash', label: 'Store Hash', placeholder: 'abc123', helpText: 'Found in your BigCommerce control panel URL.' },
      { key: 'access_token', label: 'Access Token', placeholder: 'your access token', type: 'password' },
    ],
  },
  amazon_seller: {
    id: 'amazon_seller', name: 'Amazon Seller Central', domain: 'amazon.com', description: 'Connect your Amazon Seller account.',
    authType: 'apikey',
    docsUrl: 'https://developer-docs.amazon.com/sp-api/docs/website-authorization-workflow',
    fields: [
      { key: 'seller_id', label: 'Seller ID', placeholder: 'AXXXXXXXXXX', helpText: 'Seller Central → Settings → Account Info → Merchant Token.' },
      { key: 'mws_auth_token', label: 'MWS Auth Token', placeholder: 'amzn.mws.xxxxx', type: 'password' },
      { key: 'marketplace_id', label: 'Marketplace ID', placeholder: 'ATVPDKIKX0DER', helpText: 'e.g. ATVPDKIKX0DER for US.' },
    ],
  },
  tiktok_shop: {
    id: 'tiktok_shop', name: 'TikTok Shop', domain: 'tiktok.com', description: 'Connect your TikTok Shop for social commerce data.',
    authType: 'apikey',
    docsUrl: 'https://partner.tiktokshop.com/doc/page/262774',
    fields: [
      { key: 'app_key', label: 'App Key', placeholder: 'your_app_key', helpText: 'TikTok Shop Partner Center → My Apps → App Key.' },
      { key: 'access_token', label: 'Access Token', placeholder: 'your_access_token', type: 'password', helpText: 'Generate via TikTok Shop authorization flow in Partner Center.' },
    ],
  },
  stripe: {
    id: 'stripe', name: 'Stripe', domain: 'stripe.com', description: 'Pull revenue, subscription and payment data from Stripe.',
    authType: 'apikey',
    docsUrl: 'https://dashboard.stripe.com/apikeys',
    fields: [
      { key: 'secret_key', label: 'Secret Key', placeholder: 'sk_live_...', type: 'password', helpText: 'Stripe Dashboard → Developers → API Keys. Use a Restricted Key with read-only access.' },
    ],
  },
  paypal: {
    id: 'paypal', name: 'PayPal', domain: 'paypal.com', description: 'Pull transaction and payment data from PayPal.',
    authType: 'apikey',
    docsUrl: 'https://developer.paypal.com/dashboard/',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'your_client_id', helpText: 'PayPal Developer Dashboard → My Apps → your app → Client ID.' },
      { key: 'client_secret', label: 'Client Secret', placeholder: 'your_client_secret', type: 'password' },
    ],
  },
  paystack: {
    id: 'paystack', name: 'Paystack', domain: 'paystack.com', description: 'Pull payment and transaction data from Paystack.',
    authType: 'apikey',
    iconUrl: 'https://website-v3-assets.s3.amazonaws.com/assets/img/hero/Paystack-mark-white-twitter.png',
    docsUrl: 'https://paystack.com/docs/api/#authentication',
    fields: [
      { key: 'test_secret_key', label: 'Test Secret Key', placeholder: 'sk_test_...', type: 'password', helpText: 'Paystack Dashboard → Settings → API Keys & Webhooks → Test Secret Key.' },
      { key: 'test_public_key', label: 'Test Public Key', placeholder: 'pk_test_...', helpText: 'Paystack Dashboard → Settings → API Keys & Webhooks → Test Public Key.' },
    ],
  },
  recharge: {
    id: 'recharge', name: 'Recharge / Bold', domain: 'rechargepayments.com', description: 'Pull subscription billing data from Recharge.',
    authType: 'apikey',
    docsUrl: 'https://developer.rechargepayments.com/#authentication',
    fields: [
      { key: 'api_token', label: 'API Token', placeholder: 'your_recharge_api_token', type: 'password', helpText: 'Recharge Admin → Integrations → API keys.' },
    ],
  },
  meta_ads: {
    id: 'meta_ads', name: 'Meta Ads', domain: 'meta.com', description: 'Pull Facebook & Instagram ad spend and ROAS data.',
    authType: 'apikey',
    docsUrl: 'https://business.facebook.com/settings/system-users',
    fields: [
      { key: 'access_token', label: 'System User Access Token', placeholder: 'EAAxxxxxxx...', type: 'password', helpText: 'Meta Business Manager → Business Settings → System Users → Generate token with ads_read permission.' },
      { key: 'ad_account_id', label: 'Ad Account ID', placeholder: 'act_123456789', helpText: 'Found in Meta Ads Manager URL, prefixed with act_.' },
    ],
  },
  google_ads: {
    id: 'google_ads', name: 'Google Ads', domain: 'google.com', description: 'Pull Google Ads spend and conversion data.',
    authType: 'apikey',
    docsUrl: 'https://ads.google.com/nav/selectaccount',
    fields: [
      { key: 'developer_token', label: 'Developer Token', placeholder: 'your_developer_token', type: 'password', helpText: 'Google Ads → Tools & Settings → API Center → Developer Token.' },
      { key: 'customer_id', label: 'Customer ID', placeholder: '123-456-7890', helpText: 'Your Google Ads account number shown in the top right.' },
    ],
  },
  tiktok_ads: {
    id: 'tiktok_ads', name: 'TikTok Ads', domain: 'tiktok.com', description: 'Pull TikTok Ads campaign performance data.',
    authType: 'apikey',
    docsUrl: 'https://business-api.tiktok.com/portal/docs',
    fields: [
      { key: 'access_token', label: 'Long-Lived Access Token', placeholder: 'your_access_token', type: 'password', helpText: 'TikTok for Business → Tools → Developer → generate a long-lived token.' },
      { key: 'advertiser_id', label: 'Advertiser ID', placeholder: '123456789', helpText: 'Found in TikTok Ads Manager URL.' },
    ],
  },
  pinterest_ads: {
    id: 'pinterest_ads', name: 'Pinterest Ads', domain: 'pinterest.com', description: 'Pull Pinterest Ads performance data.',
    authType: 'apikey',
    docsUrl: 'https://developers.pinterest.com/docs/getting-started/authentication/',
    fields: [
      { key: 'access_token', label: 'Access Token', placeholder: 'your_pinterest_access_token', type: 'password', helpText: 'Pinterest Developer Portal → My Apps → generate token with ads:read scope.' },
      { key: 'ad_account_id', label: 'Ad Account ID', placeholder: '123456789' },
    ],
  },
  amazon_ads: {
    id: 'amazon_ads', name: 'Amazon Ads', domain: 'amazon.com', description: 'Pull Amazon Advertising campaign data.',
    authType: 'apikey',
    docsUrl: 'https://advertising.amazon.com/API/docs',
    fields: [
      { key: 'client_id', label: 'Client ID', placeholder: 'amzn1.application-xxx', helpText: 'Amazon Ads Developer Console → your app → Client ID.' },
      { key: 'access_token', label: 'Access Token', placeholder: 'Atza|xxx...', type: 'password' },
      { key: 'profile_id', label: 'Profile ID', placeholder: '123456789' },
    ],
  },
  klaviyo: {
    id: 'klaviyo', name: 'Klaviyo', domain: 'klaviyo.com', description: 'Pull email/SMS performance, revenue attribution and lists.',
    authType: 'apikey',
    docsUrl: 'https://help.klaviyo.com/hc/en-us/articles/115005062267',
    fields: [
      { key: 'api_key', label: 'Private API Key', placeholder: 'pk_...', type: 'password', helpText: 'Settings → API Keys → Create Private API Key.' },
    ],
  },
  attentive: {
    id: 'attentive', name: 'Attentive', domain: 'attentive.com', description: 'Pull SMS marketing performance data.',
    authType: 'apikey',
    docsUrl: 'https://docs.attentivemobile.com/openapi/reference/api-overview/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_attentive_api_key', type: 'password', helpText: 'Attentive → Settings → Integrations → API.' },
    ],
  },
  postscript: {
    id: 'postscript', name: 'Postscript', domain: 'postscript.io', description: 'Pull SMS campaign data from Postscript.',
    authType: 'apikey',
    docsUrl: 'https://docs.postscript.io/',
    fields: [
      { key: 'public_key', label: 'Public Key', placeholder: 'your_public_key', helpText: 'Postscript → Settings → API keys.' },
      { key: 'private_key', label: 'Private Key', placeholder: 'your_private_key', type: 'password' },
    ],
  },
  omnisend: {
    id: 'omnisend', name: 'Omnisend', domain: 'omnisend.com', description: 'Pull omnichannel marketing data.',
    authType: 'apikey',
    docsUrl: 'https://api-docs.omnisend.com/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_omnisend_api_key', type: 'password', helpText: 'Omnisend → Store Settings → Integrations → API key.' },
    ],
  },
  mailchimp: {
    id: 'mailchimp', name: 'Mailchimp', domain: 'mailchimp.com', description: 'Pull email campaign and audience data.',
    authType: 'apikey',
    docsUrl: 'https://mailchimp.com/help/about-api-keys/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'xxxxxxxx-us12', type: 'password', helpText: 'Mailchimp → Profile → Extras → API keys.' },
      { key: 'server_prefix', label: 'Server Prefix', placeholder: 'us12', helpText: 'The suffix of your Mailchimp API key after the dash, e.g. us12.' },
    ],
  },
  ga4: {
    id: 'ga4', name: 'Google Analytics 4', domain: 'google.com', description: 'Pull web analytics and attribution from GA4.',
    authType: 'apikey',
    docsUrl: 'https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart-client-libraries',
    fields: [
      { key: 'property_id', label: 'GA4 Property ID', placeholder: '123456789', helpText: 'GA4 → Admin → Property Settings → Property ID.' },
      { key: 'api_secret', label: 'Measurement Protocol API Secret', placeholder: 'your_api_secret', type: 'password', helpText: 'GA4 → Admin → Data Streams → your stream → Measurement Protocol API secrets.' },
    ],
  },
  triple_whale: {
    id: 'triple_whale', name: 'Triple Whale', domain: 'triplewhale.com', description: 'Pull DTC attribution and blended ROAS data.',
    authType: 'apikey',
    docsUrl: 'https://developers.triplewhale.com/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_triple_whale_api_key', type: 'password', helpText: 'Triple Whale → Settings → Integrations → API.' },
      { key: 'store_url', label: 'Store URL', placeholder: 'myshop.myshopify.com' },
    ],
  },
  northbeam: {
    id: 'northbeam', name: 'Northbeam', domain: 'northbeam.io', description: 'Pull universal attribution data from Northbeam.',
    authType: 'apikey',
    docsUrl: 'https://www.northbeam.io/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_northbeam_api_key', type: 'password', helpText: 'Contact Northbeam support to generate your API key.' },
    ],
  },
  yotpo: {
    id: 'yotpo', name: 'Yotpo', domain: 'yotpo.com', description: 'Pull reviews, ratings and loyalty data.',
    authType: 'apikey',
    docsUrl: 'https://developer.yotpo.com/v2/docs/authentication',
    fields: [
      { key: 'app_key', label: 'App Key', placeholder: 'your_app_key', helpText: 'Yotpo → Settings → Store Integrations → App Key.' },
      { key: 'secret_key', label: 'Secret Key', placeholder: 'your_secret_key', type: 'password' },
    ],
  },
  okendo: {
    id: 'okendo', name: 'Okendo', domain: 'okendo.io', description: 'Pull customer reviews and UGC data.',
    authType: 'apikey',
    docsUrl: 'https://developers.okendo.io/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_okendo_api_key', type: 'password', helpText: 'Okendo → Settings → Integrations → API.' },
    ],
  },
  smile: {
    id: 'smile', name: 'Smile.io / LoyaltyLion', domain: 'smile.io', description: 'Pull loyalty and rewards program data.',
    authType: 'apikey',
    docsUrl: 'https://docs.smile.io/docs/api-overview',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_api_key', helpText: 'Smile Dashboard → Settings → API.' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'your_api_secret', type: 'password' },
    ],
  },
  loox: {
    id: 'loox', name: 'Loox', domain: 'loox.app', description: 'Pull visual review data from Loox.',
    authType: 'apikey',
    docsUrl: 'https://help.loox.app/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_loox_api_key', type: 'password', helpText: 'Loox → Settings → API.' },
    ],
  },
  shipstation: {
    id: 'shipstation', name: 'ShipStation / ShipBob', domain: 'shipstation.com', description: 'Pull fulfillment and shipping data.',
    authType: 'apikey',
    docsUrl: 'https://www.shipstation.com/docs/api/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_api_key', helpText: 'ShipStation → Account Settings → API Settings → API Key.' },
      { key: 'api_secret', label: 'API Secret', placeholder: 'your_api_secret', type: 'password' },
    ],
  },
  cin7: {
    id: 'cin7', name: 'Cin7', domain: 'cin7.com', description: 'Pull inventory and stock data from Cin7.',
    authType: 'apikey',
    docsUrl: 'https://cin7.com/developers/',
    fields: [
      { key: 'account_id', label: 'Account ID', placeholder: 'your_account_id', helpText: 'Cin7 → Integrations → API → Account ID.' },
      { key: 'api_key', label: 'API Key', placeholder: 'your_api_key', type: 'password' },
    ],
  },
  gorgias: {
    id: 'gorgias', name: 'Gorgias', domain: 'gorgias.com', description: 'Pull support ticket and CSAT data from Gorgias.',
    authType: 'apikey',
    docsUrl: 'https://developers.gorgias.com/reference/authentication',
    fields: [
      { key: 'subdomain', label: 'Subdomain', placeholder: 'myshop', helpText: 'The part before .gorgias.com in your URL.' },
      { key: 'email', label: 'Email', placeholder: 'admin@myshop.com' },
      { key: 'api_key', label: 'API Key', placeholder: 'your_api_key', type: 'password', helpText: 'Gorgias → Settings → You → REST API.' },
    ],
  },
  zendesk: {
    id: 'zendesk', name: 'Zendesk', domain: 'zendesk.com', description: 'Pull helpdesk and ticket data from Zendesk.',
    authType: 'apikey',
    docsUrl: 'https://developer.zendesk.com/documentation/ticketing/account-configuration/using-oauth-authentication-with-your-application/',
    fields: [
      { key: 'subdomain', label: 'Subdomain', placeholder: 'mycompany', helpText: 'The part before .zendesk.com in your URL.' },
      { key: 'email', label: 'Admin Email', placeholder: 'admin@mycompany.com' },
      { key: 'api_token', label: 'API Token', placeholder: 'your_api_token', type: 'password', helpText: 'Zendesk Admin Center → Apps and integrations → Zendesk API → API token.' },
    ],
  },
  skio: {
    id: 'skio', name: 'Skio', domain: 'skio.com', description: 'Pull subscription data from Skio.',
    authType: 'apikey',
    docsUrl: 'https://docs.skio.com/',
    fields: [
      { key: 'api_key', label: 'API Key', placeholder: 'your_skio_api_key', type: 'password', helpText: 'Skio → Settings → API.' },
    ],
  },
  supabase: {
    id: 'supabase', name: 'Supabase', domain: 'supabase.com', description: 'Connect directly to your Supabase PostgreSQL database.',
    authType: 'apikey',
    docsUrl: 'https://supabase.com/docs/guides/api',
    fields: [
      { key: 'project_url', label: 'Project URL', placeholder: 'https://xyzcompany.supabase.co' },
      { key: 'service_role_key', label: 'Service Role Key', placeholder: 'eyJhbG...', type: 'password', helpText: 'Project Settings → API → service_role secret.' },
    ],
  },
  csv: {
    id: 'csv', name: 'Upload CSV', domain: 'csv.com', description: 'Upload a CSV file directly to Stratum storage.',
    authType: 'apikey',
    fields: [
      { key: 'csv_url', label: 'CSV File', placeholder: '', type: 'file', helpText: 'Upload a local .csv file.' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────
// Category definitions
// ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'commerce', title: 'Commerce Platform', description: 'The spine of your operations. Pick these first.', priority: true,
    tools: [
      { id: 'shopify', name: 'Shopify', domain: 'shopify.com', description: 'Dominant for this segment' },
      { id: 'woocommerce', name: 'WooCommerce', domain: 'woocommerce.com', description: 'Open-source platform' },
      { id: 'bigcommerce', name: 'BigCommerce', domain: 'bigcommerce.com', description: 'Enterprise platform' },
      { id: 'amazon_seller', name: 'Amazon Seller Central', domain: 'amazon.com', description: 'Hybrid DTC + marketplace' },
      { id: 'tiktok_shop', name: 'TikTok Shop', domain: 'tiktok.com', description: 'Social commerce' },
    ],
  },
  {
    id: 'payments', title: 'Payments & Financial Data', description: 'Payment gateways and billing engines.', priority: false,
    tools: [
      { id: 'stripe', name: 'Stripe', domain: 'stripe.com', description: 'Payment infrastructure' },
      { id: 'paystack', name: 'Paystack', domain: 'paystack.com', description: 'African payment gateway' },
      { id: 'paypal', name: 'PayPal', domain: 'paypal.com', description: 'Digital wallet processing' },
      { id: 'recharge', name: 'Recharge / Bold', domain: 'rechargepayments.com', description: 'Subscription billing' },
    ],
  },
  {
    id: 'acquisition', title: 'Paid Acquisition', description: 'Ad networks and traffic sources.', priority: false,
    tools: [
      { id: 'meta_ads', name: 'Meta Ads', domain: 'meta.com', description: 'Facebook & Instagram' },
      { id: 'google_ads', name: 'Google Ads', domain: 'google.com', description: 'Search & Display' },
      { id: 'tiktok_ads', name: 'TikTok Ads', domain: 'tiktok.com', description: 'Short-form video ads' },
      { id: 'pinterest_ads', name: 'Pinterest Ads', domain: 'pinterest.com', description: 'Visual discovery' },
      { id: 'amazon_ads', name: 'Amazon Ads', domain: 'amazon.com', description: 'Marketplace advertising' },
    ],
  },
  {
    id: 'retention', title: 'Email, SMS & Retention', description: 'Lifecycle marketing and messaging.', priority: false,
    tools: [
      { id: 'klaviyo', name: 'Klaviyo', domain: 'klaviyo.com', description: 'Category leader for DTC' },
      { id: 'attentive', name: 'Attentive', domain: 'attentive.com', description: 'SMS marketing' },
      { id: 'postscript', name: 'Postscript', domain: 'postscript.io', description: 'SMS marketing' },
      { id: 'omnisend', name: 'Omnisend', domain: 'omnisend.com', description: 'Omnichannel marketing' },
      { id: 'mailchimp', name: 'Mailchimp', domain: 'mailchimp.com', description: 'Email marketing' },
    ],
  },
  {
    id: 'analytics', title: 'Analytics & Attribution', description: 'Data tracking and ROAS measurement.', priority: false,
    tools: [
      { id: 'ga4', name: 'Google Analytics 4', domain: 'google.com', description: 'Web analytics' },
      { id: 'triple_whale', name: 'Triple Whale', domain: 'triplewhale.com', description: 'DTC-specific attribution' },
      { id: 'northbeam', name: 'Northbeam', domain: 'northbeam.io', description: 'Universal attribution' },
    ],
  },
  {
    id: 'reviews', title: 'Reviews, Loyalty & UGC', description: 'Social proof and customer retention.', priority: false,
    tools: [
      { id: 'yotpo', name: 'Yotpo', domain: 'yotpo.com', description: 'Reviews & loyalty' },
      { id: 'okendo', name: 'Okendo', domain: 'okendo.io', description: 'Customer marketing' },
      { id: 'smile', name: 'Smile.io / LoyaltyLion', domain: 'smile.io', description: 'Rewards programs' },
      { id: 'loox', name: 'Loox', domain: 'loox.app', description: 'Visual reviews' },
    ],
  },
  {
    id: 'fulfillment', title: 'Fulfillment & Inventory', description: 'Logistics and stock management.', priority: false,
    tools: [
      { id: 'shipstation', name: 'ShipStation / ShipBob', domain: 'shipstation.com', description: 'Shipping & fulfillment' },
      { id: 'cin7', name: 'Cin7', domain: 'cin7.com', description: 'Inventory management' },
    ],
  },
  {
    id: 'support', title: 'Customer Support', description: 'Helpdesk and ticketing systems.', priority: false,
    tools: [
      { id: 'gorgias', name: 'Gorgias', domain: 'gorgias.com', description: 'DTC-native helpdesk' },
      { id: 'zendesk', name: 'Zendesk', domain: 'zendesk.com', description: 'Enterprise support' },
    ],
  },
  {
    id: 'subscriptions', title: 'Subscriptions', description: 'For subscription-model DTC brands.', priority: false,
    tools: [
      { id: 'recharge', name: 'Recharge', domain: 'rechargepayments.com', description: 'Subscription payments' },
      { id: 'skio', name: 'Skio', domain: 'skio.com', description: 'Subscription management' },
    ],
  },
  {
    id: 'data_sources', title: 'Custom Data Sources', description: 'Databases and flat files.', priority: false,
    tools: [
      { id: 'supabase', name: 'Supabase', domain: 'supabase.com', description: 'PostgreSQL database' },
      { id: 'csv', name: 'CSV URL', domain: 'google.com', description: 'Hosted CSV files' },
    ],
  },
];

// ─────────────────────────────────────────────────────────────
// Brand Icon
// ─────────────────────────────────────────────────────────────
function BrandIcon({ domain, name }: { domain: string; name: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--background)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Link2 size={18} color="var(--text-tertiary)" />
      </div>
    );
  }
  return (
    <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
      <img src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`} alt={`${name} logo`} style={{ width: 24, height: 24, objectFit: 'contain' }} onError={() => setError(true)} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────
export function ConnectorsPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [connectedIds, setConnectedIds] = useState<Set<string>>(new Set());
  const [connectorDetails, setConnectorDetails] = useState<Record<string, ConnectorCredential>>({});
  const [loadingInit, setLoadingInit] = useState(true);
  const [activeModal, setActiveModal] = useState<ConnectorConfig | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [tier, setTier] = useState<'free' | 'pro'>('free');

  const refreshConnectors = useCallback(async () => {
    const rows = await loadConnectors();
    const ids = new Set(rows.map(r => r.connector_id));
    const details: Record<string, ConnectorCredential> = {};
    rows.forEach(r => { details[r.connector_id] = r; });
    setConnectedIds(ids);
    setConnectorDetails(details);
    
    if (user) {
      const { data } = await supabase.from('user_subscriptions').select('tier').eq('user_id', user.id).single();
      if (data) setTier(data.tier);
    }
    setLoadingInit(false);
  }, [user]);

  useEffect(() => { refreshConnectors(); }, [refreshConnectors]);

  const paystackConfig = {
    reference: (new Date()).getTime().toString(),
    email: user?.email || 'test@stratum.com',
    amount: 10 * 100, // 10 KES
    publicKey: 'pk_live_82a92343e08ef9d76f653ae86e0664d098685e20',
    currency: 'KES',
  };

  const initializePayment = usePaystackPayment(paystackConfig);

  const onSuccess = async () => {
    const { error } = await supabase.rpc('upgrade_to_pro');
    if (error) {
      console.error('Failed to upgrade to pro:', error);
      alert('Payment successful, but failed to upgrade account. Please contact support.');
    } else {
      setTier('pro');
      alert('Successfully upgraded to Pro!');
      window.location.reload();
    }
  };

  async function handleDisconnect(connectorId: string) {
    setDisconnecting(connectorId);
    await deleteConnector(connectorId);
    await refreshConnectors();
    setDisconnecting(null);
  }

  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    tools: cat.tools.filter(t =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.tools.length > 0);

  const totalConnected = connectedIds.size;

  return (
    <AppShell>
      <div className="page" style={{ maxWidth: 1400, height: '100%', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="connectors-header">
          <div style={{ flex: '1 1 300px' }}>
            <h1 style={{ fontFamily: 'var(--font-sans)', fontSize: '2.5rem', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Connectors</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: 12, lineHeight: 1.5 }}>
              Connect your DTC/e-commerce stack to feed real-time data into Stratum's diagnostic models.
            </p>
            {!loadingInit && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: totalConnected > 0 ? 'var(--success)' : 'var(--text-tertiary)' }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {totalConnected === 0 ? 'No connectors active' : `${totalConnected} connector${totalConnected > 1 ? 's' : ''} active`}
                </span>
              </div>
            )}
          </div>
          <div className="connectors-search">
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
            <input
              type="text" placeholder="Search integrations..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
            />
          </div>
        </div>

        {/* Grid */}
        {loadingInit ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={32} color="var(--accent)" style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div className="connectors-grid">
            {filteredCategories.map(category => (
              <div key={category.id} style={{ breakInside: 'avoid', marginBottom: 24, background: 'var(--surface)', borderRadius: 12, border: category.priority ? '1px solid var(--accent)' : '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)', background: category.priority ? 'rgba(200, 169, 110, 0.06)' : 'transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '1.125rem', color: 'var(--text-primary)', margin: 0 }}>{category.title}</h3>
                    {category.priority && (
                      <span style={{ background: 'var(--accent)', color: '#1A2744', fontSize: '0.625rem', padding: '2px 8px', borderRadius: 100, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Priority</span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{category.description}</p>
                </div>

                <div style={{ padding: '8px' }}>
                  {category.tools.map((tool, idx) => {
                    const isConnected = connectedIds.has(tool.id);
                    const detail = connectorDetails[tool.id];
                    const isDisconnecting = disconnecting === tool.id;
                    return (
                      <div key={tool.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 12px', borderRadius: 8,
                        background: isConnected ? 'rgba(54, 97, 90, 0.06)' : 'transparent',
                        border: isConnected ? '1px solid rgba(54,97,90,0.2)' : '1px solid transparent',
                        marginBottom: idx !== category.tools.length - 1 ? 4 : 0,
                        transition: 'all 0.15s',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <BrandIcon domain={tool.domain} name={tool.name} />
                          <div>
                            <div style={{ color: 'var(--text-primary)', fontWeight: 500, fontSize: '0.9rem', marginBottom: 2 }}>{tool.name}</div>
                            <div style={{ color: isConnected ? 'var(--success)' : 'var(--text-secondary)', fontSize: '0.75rem' }}>
                              {isConnected && detail?.display_name ? detail.display_name : tool.description}
                            </div>
                          </div>
                        </div>

                        <div style={{ flexShrink: 0 }}>
                          {isConnected ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--success)', fontSize: '0.8rem', fontWeight: 500 }}>
                                <CheckCircle2 size={14} /> Connected
                              </div>
                              <button
                                onClick={() => handleDisconnect(tool.id)}
                                disabled={isDisconnecting}
                                title="Disconnect"
                                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', cursor: 'pointer', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}
                              >
                                {isDisconnecting ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Unplug size={13} />}
                              </button>
                            </div>
                          ) : tier === 'free' && connectedIds.size >= 5 ? (
                            <button
                              onClick={() => initializePayment({ onSuccess, onClose: () => {} })}
                              className="btn btn-outline btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8125rem', color: 'var(--gold)', borderColor: 'var(--gold)' }}
                            >
                              <Plug size={13} /> Upgrade
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveModal(CONNECTOR_CONFIGS[tool.id] ?? null)}
                              className="btn btn-outline btn-sm"
                              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', fontSize: '0.8125rem' }}
                            >
                              <Plug size={13} /> Connect
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {activeModal && (
        <ConnectModal
          config={activeModal}
          onClose={() => setActiveModal(null)}
          onConnected={refreshConnectors}
        />
      )}
    </AppShell>
  );
}
