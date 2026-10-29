import { LegalPage } from './LegalPage'
import { useLanguage } from '../../language/useLanguage'

export function CookiePolicyPage() {
  const { t } = useLanguage()

  return (
    <LegalPage
      title={t('Cookie policy')}
      updated={t('Last updated: 29 October 2026')}
      intro={t(
        'Short version: this website does not use advertising or tracking cookies, so there is no cookie banner. Everything stored on your device is there to make the site work, and you can clear it whenever you like.',
      )}
      sections={[
        {
          heading: t('What we store and why'),
          bullets: [
            t('Shopping cart: so your bag survives a page refresh or a dropped connection. Stored on your device only.'),
            t('Language choice: so the site opens in the language you picked.'),
            t('Login session: an encrypted token so you stay signed in until you log out.'),
          ],
        },
        {
          heading: t('What we do not use'),
          bullets: [
            t('No Google Analytics, Meta pixel, or any other analytics or advertising service.'),
            t('No cookies that follow you to other websites or build a profile of you.'),
            t('No cookies are shared with third parties.'),
          ],
        },
        {
          heading: t('Clearing what we store'),
          paragraphs: [
            t('Clearing your browser storage for this website removes your cart, your saved language and your login. Nothing else depends on it. If we ever add optional cookies in future, we will ask for your consent with a banner before they load and update this page.'),
          ],
        },
      ]}
    />
  )
}
