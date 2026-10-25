import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer, Header } from '../../components/Layout'
import { photoSrcSet } from '../../lib/thumbnails'
import { useLanguage } from '../../language/useLanguage'
import { cameroonLocations } from '../../../shared/data'

const experienceSteps: { title: string; description: string; image: string }[] = [
  {
    title: 'Choose your favorite',
    description: 'Start with an ice cream flavor that sounds good to you.',
    image: '/ice-images/ice-5.webp',
  },
  {
    title: 'Make it your own',
    description: 'Explore mix-ins and combinations from the signature creations.',
    image: '/ice-images/ice-6.webp',
  },
  {
    title: 'Enjoy the moment',
    description: 'Savor a treat mixed to bring your chosen flavors together.',
    image: '/ice-images/ice-9.jpg',
  },
]

const locationGroups = cameroonLocations.reduce<{ town: string; areas: string[] }[]>((groups, location) => {
  const group = groups.find((item) => item.town === location.town)
  if (group) group.areas.push(location.area)
  else groups.push({ town: location.town, areas: [location.area] })
  return groups
}, [])

function ExperiencePhoto({
  activeIndex,
  className,
  t,
}: {
  activeIndex: number
  className: string
  t: (value: string) => string
}) {
  return (
    <figure className={`relative isolate overflow-hidden bg-[#f4f6f8] ${className}`}>
      {experienceSteps.map((step, index) => (
        <img
          alt={index === activeIndex ? t('Ice cream treats') : ''}
          aria-hidden={index !== activeIndex}
          className={`absolute inset-0 size-full object-cover transition-opacity duration-[1600ms] ease-linear motion-reduce:transition-none ${
            index === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
          decoding="async"
          fetchPriority={index === activeIndex ? 'high' : undefined}
          height={1200}
          key={step.image}
          loading={index === activeIndex ? 'eager' : 'lazy'}
          sizes="(min-width: 1024px) 50vw, 100vw"
          src={step.image}
          srcSet={photoSrcSet(step.image)}
          width={1200}
        />
      ))}
    </figure>
  )
}

export function AboutPage() {
  const { t } = useLanguage()
  const [activeStepIndex, setActiveStepIndex] = useState(0)
  const activeStep = experienceSteps[activeStepIndex]

  const changeStep = (offset: number) => {
    setActiveStepIndex((current) => (current + offset + experienceSteps.length) % experienceSteps.length)
  }

  return (
    <div className="min-h-svh bg-white text-[#092a53]">
      <Header />
      <main id="main" tabIndex={-1}>
        <div className="mx-auto grid max-w-[1320px] grid-cols-1 items-start lg:grid-cols-2 lg:gap-3 lg:pt-3">
          <section
            aria-labelledby="about-title"
            className="flex flex-col justify-center bg-white px-5 py-12 sm:px-8 sm:py-16 lg:col-start-1 lg:row-start-1 lg:min-h-[calc(100svh-104px)] lg:px-12 lg:py-16 xl:px-16"
          >
            <div className="max-w-[46rem]">
              <h1
                className="max-w-[11ch] font-display text-[clamp(3rem,5.4vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.035em] [text-wrap:balance]"
                id="about-title"
              >
                {t('Cold Stone Creamery')}
              </h1>
              <p className="mt-6 max-w-[42ch] text-base leading-7 text-[#334b68] sm:text-lg sm:leading-8">
                {t('Ice cream mixed to order on a frozen granite stone with the mix-ins you love, at our branches in Douala and Yaoundé.')}
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link
                  className="inline-flex min-h-12 items-center justify-center bg-[#092a53] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                  to="/menu"
                >
                  {t('Explore the menu')}
                </Link>
                <Link
                  className="inline-flex min-h-12 items-center text-sm font-bold text-[#092a53] transition-colors hover:text-[#65748a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                  to="/locations"
                >
                  {t('Available locations')}
                </Link>
              </div>
            </div>
          </section>

          <ExperiencePhoto
            activeIndex={activeStepIndex}
            className="mx-5 aspect-[4/3] sm:mx-8 lg:sticky lg:top-[92px] lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:mx-0 lg:aspect-auto lg:h-[calc(100svh-104px)] lg:self-start"
            t={t}
          />

          <div className="bg-white lg:col-start-1 lg:row-start-2">
            <section
              aria-labelledby="about-story-heading"
              className="bg-[#092a53] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12 lg:py-24 xl:px-16"
            >
              <div className="max-w-[46rem]">
                <h2
                  className="max-w-[12ch] font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
                  id="about-story-heading"
                >
                  {t('A treat made your way')}
                </h2>
                <p className="mt-6 text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
                  {t('Cold Stone is known internationally for ice cream mixed to order on a frozen granite stone. Its signature approach brings chosen mix-ins together with ice cream for a treat made to your taste.')}
                </p>
                <p className="mt-4 text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
                  {t('Choose your ice cream, pick your mix-ins and watch it all come together on the frozen stone. Visit us in Douala or Yaoundé, or order online for pickup or delivery.')}
                </p>
                <figure className="scroll-story-frame mt-8 bg-[#f4f6f8]">
                  <img
                    alt={t('A child enjoying ice cream')}
                    className="aspect-[4/3] w-full object-cover"
                    decoding="async"
                    height={736}
                    loading="lazy"
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    src="/ice-images/about-child.jpg"
                    srcSet={photoSrcSet('/ice-images/about-child.jpg')}
                    width={736}
                  />
                </figure>
              </div>
            </section>

            <section
              aria-labelledby="signature-experience-heading"
              className="px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24 xl:px-16"
            >
              <div className="max-w-[46rem]">
                <h2
                  className="max-w-[14ch] font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
                  id="signature-experience-heading"
                >
                  {t('The signature experience')}
                </h2>
                <p className="mt-5 text-base leading-7 text-[#334b68] sm:text-lg sm:leading-8">
                  {t('Discover the simple idea behind the signature mix-in experience.')}
                </p>

                <div className="mt-8 flex items-center justify-between gap-4">
                  <div aria-atomic="true" aria-live="polite">
                    <h3 className="font-display text-xl font-bold leading-snug sm:text-2xl">
                      {t(activeStep.title)}
                    </h3>
                    <p className="mt-3 text-base leading-7 text-[#334b68] sm:text-lg sm:leading-8">
                      {t(activeStep.description)}
                    </p>
                  </div>
                  <div aria-label={t('Change experience step')} className="flex shrink-0 gap-2" role="group">
                    <button
                      aria-label={t('Previous step')}
                      className="grid size-12 place-items-center bg-[#092a53] text-white transition-colors hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                      onClick={() => changeStep(-1)}
                      type="button"
                    >
                      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                        <path d="m14 5-7 7 7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </button>
                    <button
                      aria-label={t('Next step')}
                      className="grid size-12 place-items-center bg-[#092a53] text-white transition-colors hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2"
                      onClick={() => changeStep(1)}
                      type="button"
                    >
                      <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
                        <path d="m10 5 7 7-7 7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="mt-8 lg:hidden">
                  <ExperiencePhoto
                    activeIndex={activeStepIndex}
                    className="aspect-[4/3]"
                    t={t}
                  />
                </div>
              </div>
            </section>

            <section
              aria-labelledby="locations-heading"
              className="bg-[#f4f6f8] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24 xl:px-16"
            >
              <div className="max-w-[46rem]">
                <h2
                  className="font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl"
                  id="locations-heading"
                >
                  {t('Available locations')}
                </h2>
                <p className="mt-5 text-base leading-7 text-[#233c5b] sm:text-lg sm:leading-8">
                  {t('We are in Douala and Yaoundé. Open the Locations page for addresses, phone numbers and directions.')}
                </p>
                <div className="mt-8 grid gap-8 sm:grid-cols-2">
                  {locationGroups.map(({ town, areas }) => (
                    <div key={town}>
                      <h3 className="font-display text-xl font-bold">{t(town)}</h3>
                      <ul className="mt-3 list-none space-y-2 text-base leading-6 text-[#233c5b]">
                        {areas.map((area) => <li key={area}>{t(area)}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
                <Link
                  className="mt-8 inline-flex min-h-12 items-center justify-center bg-[#092a53] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#163e6b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#bd9c00] focus-visible:ring-offset-2 focus-visible:ring-offset-[#f4f6f8]"
                  to="/locations"
                >
                  {t('Browse locations')}
                </Link>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
