import { useEffect } from 'react'
import { PublicShell } from './PublicShell'
import { LEGAL, PRIVACY, TERMS } from './legalContent'
import { setPageMeta } from '../lib/seo'

const PAGES = { privacy: PRIVACY, terms: TERMS }

/** /privacy and /terms: real, indexable pages instead of the app shell. */
export function Legal({ page, onHome, onSignIn, onStart }) {
  const doc = PAGES[page] ?? PRIVACY
  useEffect(() => {
    setPageMeta({ title: `${doc.title} | ${LEGAL.product}`, description: doc.intro, path: page === 'terms' ? '/terms' : '/privacy' })
  }, [doc, page])

  return (
    <PublicShell onHome={onHome} onSignIn={onSignIn} onStart={onStart}>
      <article className="pub-doc">
        <h1>{doc.title}</h1>
        <p className="pub-doc-meta">Last updated {LEGAL.updated}</p>
        <p>{doc.intro}</p>
        {doc.sections.map(([heading, paragraphs]) => (
          <section key={heading} aria-labelledby={`h-${heading.replace(/\W+/g, '-')}`}>
            <h2 id={`h-${heading.replace(/\W+/g, '-')}`}>{heading}</h2>
            {paragraphs.length > 2
              ? <ul>{paragraphs.map((p) => <li key={p}>{p}</li>)}</ul>
              : paragraphs.map((p) => <p key={p}>{p}</p>)}
          </section>
        ))}
        <section aria-labelledby="h-contact">
          <h2 id="h-contact">Contact us</h2>
          <p>
            {LEGAL.company}{LEGAL.registration ? `, registration number ${LEGAL.registration}` : ''}{LEGAL.address ? `, ${LEGAL.address}` : ''}.
            {' '}Email <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>
            {LEGAL.officer ? `. Information Officer: ${LEGAL.officer}` : ''}.
          </p>
        </section>
      </article>
    </PublicShell>
  )
}
