import { LegalPage } from './LegalPage'
import { useLanguage } from '../../language/useLanguage'

export function TermsPage() {
  const { t } = useLanguage()

  return (
    <LegalPage
      title={t('Terms & conditions')}
      updated={t('Last updated: 29 October 2026')}
      intro={t(
        'These terms cover ordering, pickup, delivery and use of this website. By placing an order you accept them.',
      )}
      sections={[
        {
          heading: t('Orders'),
          bullets: [
            t('An order becomes confirmed once payment succeeds. We then prepare it for the branch and time you chose.'),
            t('Prices are shown in CFA francs and include the taxes shown at checkout.'),
            t('If an item runs out after you order, we contact you to agree a swap or a refund.'),
          ],
        },
        {
          heading: t('Pickup and delivery'),
          bullets: [
            t('Pickup: collect at the branch you chose during the time window shown. After the window we cannot guarantee the items stay fresh.'),
            t('Delivery: we deliver to the address you enter. If nobody is there, we contact you to rearrange; a second trip may carry a new fee.'),
            t('Delivery times are estimates, not promises. Traffic and weather in Douala and Yaoundé can slow us down.'),
          ],
        },
        {
          heading: t('Accounts'),
          bullets: [
            t('Keep your login details private. Orders placed through your account are treated as yours.'),
            t('We can suspend accounts used for fraud or abuse of our team.'),
          ],
        },
        {
          heading: t('Using this website'),
          bullets: [
            t('The website, its photos and its text belong to us or are used with permission. Do not copy them for your own business.'),
            t('Do not try to break, overload or scrape the website.'),
          ],
        },
        {
          heading: t('Liability'),
          paragraphs: [
            t('We prepare and handle every order with care, and we keep cold items cold to the moment of handover. Once you collect or receive an order, keeping it cool is up to you. Nothing in these terms removes rights that Cameroonian law gives you as a consumer.'),
          ],
        },
      ]}
    />
  )
}
