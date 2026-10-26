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

export function AboutPage() {
  const { t } = useLanguage()

  return (
    <div className="min-h-svh bg-white text-brand-navy">
      <Header />
      <main id="main" tabIndex={-1}>
        <section
          aria-labelledby="about-title"
          className="mx-auto grid max-w-[1320px] items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-16 lg:px-12 lg:py-20"
        >
          <div>
            <h1
              className="max-w-[12ch] font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl"
              id="about-title"
            >
              {t('Cold Stone Creamery')}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-[#65748a] sm:text-lg sm:leading-8">
              {t('Ice cream mixed to order on a frozen granite stone with the mix-ins you love, at our branches in Douala and Yaoundé.')}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-bold text-white transition-colors hover:bg-brand-blue"
                to="/menu"
              >
                {t('Explore the menu')}
              </Link>
              <Link
                className="inline-flex min-h-12 items-center text-sm font-bold text-brand-navy underline decoration-[#ffb84d] decoration-2 underline-offset-4"
                to="/locations"
              >
                {t('Available locations')}
              </Link>
            </div>
          </div>
          <img
            alt={t('Ice cream treats')}
            className="aspect-[4/3] w-full rounded-[20px] bg-[#f4f6f8] object-cover"
            decoding="async"
            fetchPriority="high"
            height={900}
            sizes="(min-width: 1024px) 42vw, 100vw"
            src="/ice-images/ice-9.jpg"
            srcSet={photoSrcSet('/ice-images/ice-9.jpg')}
            width={1200}
          />
        </section>

        <section
          aria-labelledby="about-story-heading"
          className="bg-[#f4f6f8]"
        >
          <div className="mx-auto grid max-w-[1320px] items-center gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.8fr)] lg:gap-16 lg:px-12 lg:py-24">
            <div>
              <h2
                className="max-w-[14ch] font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
                id="about-story-heading"
              >
                {t('A treat made your way')}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-brand-blue sm:text-lg sm:leading-8">
                {t('Cold Stone is known internationally for ice cream mixed to order on a frozen granite stone. Its signature approach brings chosen mix-ins together with ice cream for a treat made to your taste.')}
              </p>
              <p className="mt-4 max-w-xl text-base leading-7 text-brand-blue sm:text-lg sm:leading-8">
                {t('Choose your ice cream, pick your mix-ins and watch it all come together on the frozen stone. Visit us in Douala or Yaoundé, or order online for pickup or delivery.')}
              </p>
            </div>
            <img
              alt={t('A child enjoying ice cream')}
              className="aspect-[4/3] w-full rounded-[20px] bg-white object-cover lg:max-w-xl"
              decoding="async"
              height={736}
              loading="lazy"
              sizes="(min-width: 1024px) 36vw, 100vw"
              src="/ice-images/about-child.jpg"
              srcSet={photoSrcSet('/ice-images/about-child.jpg')}
              width={736}
            />
          </div>
        </section>

        <section
          aria-labelledby="signature-experience-heading"
          className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24"
        >
          <h2
            className="max-w-[16ch] font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
            id="signature-experience-heading"
          >
            {t('The signature experience')}
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#65748a]">
            {t('Discover the simple idea behind the signature mix-in experience.')}
          </p>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {experienceSteps.map((step, index) => (
              <li key={step.title}>
                <img
                  alt=""
                  className="aspect-[4/3] w-full rounded-[16px] bg-[#f4f6f8] object-cover"
                  decoding="async"
                  height={640}
                  loading="lazy"
                  sizes="(min-width: 640px) 30vw, 100vw"
                  src={step.image}
                  srcSet={photoSrcSet(step.image)}
                  width={800}
                />
                <div className="mt-4 flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-yellow font-display text-sm font-bold text-brand-navy"
                  >
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-lg font-bold leading-tight text-brand-navy">
                      {t(step.title)}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-[#65748a]">
                      {t(step.description)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section
          aria-labelledby="locations-heading"
          className="bg-[#f4f6f8]"
        >
          <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
            <h2
              className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl"
              id="locations-heading"
            >
              {t('Available locations')}
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#65748a]">
              {t('We are in Douala and Yaoundé. Open the Locations page for addresses, phone numbers and directions.')}
            </p>
            <div className="mt-10 grid gap-10 sm:grid-cols-2 sm:gap-16">
              {locationGroups.map(({ town, areas }) => (
                <div key={town}>
                  <h3 className="font-display text-2xl font-extrabold text-brand-navy">{t(town)}</h3>
                  <ul className="mt-4 space-y-2">
                    {areas.map((area) => (
                      <li className="flex items-center gap-3 text-base leading-7 text-brand-blue" key={area}>
                        <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-brand-yellow" />
                        {t(area)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Link
              className="mt-10 inline-flex min-h-12 items-center justify-center rounded-lg bg-brand-navy px-6 text-sm font-bold text-white transition-colors hover:bg-brand-blue"
              to="/locations"
            >
              {t('Browse locations')}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
