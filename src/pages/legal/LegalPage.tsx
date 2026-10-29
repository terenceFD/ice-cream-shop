import { Footer, Header } from '../../components/Layout'
import { useLanguage } from '../../language/useLanguage'

// Shared chrome for the four legal pages: Privacy, Terms, Refunds, Cookies.
// Content is passed in as plain sections so every page keeps the same
// readable, consistent layout without duplicating markup.
export function LegalPage({ title, updated, intro, sections }) {
  const { t } = useLanguage()

  return (
    <div className="min-h-svh bg-white text-brand-navy">
      <Header />
      <main className="mx-auto max-w-[820px] px-5 py-12 sm:px-8 sm:py-16" id="main" tabIndex={-1}>
        <p className="text-sm font-bold uppercase tracking-wide text-brand-muted">
          {updated}
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 text-base leading-7 text-brand-muted sm:text-lg sm:leading-8">
          {intro}
        </p>
        <div className="mt-10 flex flex-col gap-9">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-2xl font-extrabold leading-tight sm:text-[1.7rem]">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p
                  className="mt-3 text-base leading-7 text-[#44526a]"
                  key={paragraph.slice(0, 48)}
                >
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-1.5 pl-6 text-base leading-7 text-[#44526a]">
                  {section.bullets?.map((bullet) => (
                    <li key={bullet.slice(0, 48)}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <p className="mt-12 rounded-xl bg-brand-surface px-5 py-4 text-sm leading-6 text-brand-muted">
          {t('Questions about this page? Contact us and we will help.')}
        </p>
      </main>
      <Footer />
    </div>
  )
}
