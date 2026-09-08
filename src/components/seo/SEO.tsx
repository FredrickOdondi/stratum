import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: string;
}

export function SEO({
  title = 'Stratum Advisory — AI Consulting Platform',
  description = 'AI-powered strategy consulting engagement platform. From intake to polished deliverable, powered by specialised AI agents.',
  image = 'https://website-v3-assets.s3.amazonaws.com/assets/img/hero/Stratum-og-image.png',
  url = 'https://stratumsys.online',
  type = 'website',
}: SEOProps) {
  return (
    <Helmet>
      {/* Standard Metadata */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Schema.org Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "name": "Stratum Advisory",
          "url": "https://stratumsys.online",
          "logo": "https://website-v3-assets.s3.amazonaws.com/assets/img/hero/Stratum-og-image.png",
          "sameAs": [
            "https://twitter.com/stratumadvisory",
            "https://linkedin.com/company/stratumadvisory"
          ]
        })}
      </script>
    </Helmet>
  );
}
