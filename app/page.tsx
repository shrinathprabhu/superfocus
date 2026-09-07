import SuperFocus from '@/components/superfocus';
import ProductGuide from '@/components/product-guide';
import { structuredData } from '@/lib/site-content';
export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c'),
        }}
      />
      <SuperFocus>
        <ProductGuide />
      </SuperFocus>
    </>
  );
}
