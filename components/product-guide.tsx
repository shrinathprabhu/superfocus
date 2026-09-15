/* oxlint-disable next/no-html-link-for-pages -- Resource links open static text/XML files; they must not use the app router. */
import { faqs, quickStart, relatedTools, site } from '@/lib/site-content';

// Server-rendered public content, passed as a slot into the local workspace.
export default function ProductGuide() {
  return (
    <aside className="product-guide" aria-labelledby="guide-title" id="about">
      <div className="guide-intro">
        <div>
          <span className="eyebrow">A LITTLE HELP TO FIND YOUR RHYTHM</span>
          <h2 id="guide-title">
            Your Pomodoro timer, with room for the whole plan.
          </h2>
          <p>{faqs[0].answer}</p>
        </div>
        <nav aria-label="SuperFocus guide" className="guide-links">
          <a href="#quick-start">Quick start</a>
          <a href="#faq">Questions & answers</a>
          <a href="#makers">Meet the makers</a>
        </nav>
      </div>
      <section id="quick-start" aria-labelledby="quick-start-title">
        <h3 id="quick-start-title">Start a focus session in three steps</h3>
        <ol className="quick-start-list">
          {quickStart.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section id="faq" aria-labelledby="faq-title">
        <h3 id="faq-title">Questions & answers</h3>
        <dl className="faq-grid">
          {faqs.map(({ id, question, answer }) => (
            <div key={id} id={id}>
              <dt>{question}</dt>
              <dd>{answer}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section
        className="makers-panel"
        id="makers"
        aria-labelledby="makers-title"
      >
        <div>
          <span className="eyebrow">SMALL TOOL. A LITTLE MORE HEADSPACE.</span>
          <h3 id="makers-title">The people behind your quiet corner.</h3>
          <p>
            Made by{' '}
            <a href={site.creator.url} rel="author">
              Shrinath Prabhu
            </a>
            , from the makers of{' '}
            <a href={site.publisher.url}>OwlEye Analytics</a>. SuperFocus is the
            place to slow down in the{' '}
            <a href="https://lowkey.tools">lowkey.tools</a> collection.
          </p>
        </div>
        <div className="maker-destinations">
          <a
            href={site.creatorSocial}
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow @shrinath_prabhu <span aria-hidden="true">↗</span>
          </a>
          <a
            href="https://lowkey.tools"
            target="_blank"
            rel="noopener noreferrer"
          >
            Find your next lowkey tool <span aria-hidden="true">↗</span>
          </a>
        </div>
      </section>
      {relatedTools.map((tool) => (
        <section
          className="companion-tool"
          key={tool.name}
          aria-labelledby="companion-title"
        >
          <div>
            <span className="eyebrow">BEFORE YOU LOSE THAT THOUGHT</span>
            <h3 id="companion-title">{tool.prompt}</h3>
            <p>{tool.description}</p>
          </div>
          <a href={tool.url} target="_blank" rel="noopener noreferrer">
            Open {tool.name} <span aria-hidden="true">↗</span>
          </a>
        </section>
      ))}
      <p className="guide-resources">
        <a href="/index.md">Plain-text app guide</a>
        <a href="/llms.txt">llms.txt</a>
        <a href="/sitemap.xml">Sitemap</a>
        <a href="/audio/LICENSE.txt">Music license</a>
      </p>
    </aside>
  );
}
