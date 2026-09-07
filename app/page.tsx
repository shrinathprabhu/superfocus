import SuperFocus from '@/components/superfocus';
import ProductGuide from '@/components/product-guide';
import { structuredData } from '@/lib/site-content';
import { headers } from 'next/headers';
import { CSPProvider } from '@base-ui/react/csp-provider';
export default async function Home() {
  const nonce = (await headers()).get('x-nonce') ?? undefined;
  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        // Browsers hide nonce attributes in the DOM after parsing the response.
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c'),
        }}
      />
      <CSPProvider nonce={nonce}>
        <SuperFocus>
          <ProductGuide />
        </SuperFocus>
      </CSPProvider>
    </>
  );
}
