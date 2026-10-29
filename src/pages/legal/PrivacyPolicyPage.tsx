import { LegalPage } from './LegalPage'
import { useLanguage } from '../../language/useLanguage'

export function PrivacyPolicyPage() {
  const { t } = useLanguage()

  return (
    <LegalPage
      title={t('Privacy policy')}
      updated={t('Last updated: 29 October 2026')}
      intro={t(
        'This policy explains what personal information we collect when you order from us or contact us, why we collect it, and how we protect it.',
      )}
      sections={[
        {
          heading: t('Information we collect'),
          bullets: [
            t('Contact details you give us: name, email address and, if you choose, phone number.'),
            t('Order details: the items you order, the branch, pickup or delivery choice, and the time.'),
            t('Delivery addresses you enter at checkout.'),
            t('Payment is handled by our payment partners. Your card or Mobile Money details are entered on their secure pages and never reach or stay on our website.'),
          ],
        },
        {
          heading: t('Why we collect it'),
          bullets: [
            t('To take, prepare and deliver your order.'),
            t('To contact you about that order (confirmations, delays, questions).'),
            t('To answer questions you send us through the contact form.'),
            t('To keep accounts you create working, such as your order history.'),
          ],
        },
        {
          heading: t('What we do not do'),
          bullets: [
            t('We do not sell or rent your personal information to anyone.'),
            t('We do not run advertising or tracking cookies, and we do not follow you across other websites.'),
            t('We do not collect more information than the forms ask for.'),
          ],
        },
        {
          heading: t('How long we keep it'),
          paragraphs: [
            t('Order and contact records are kept only as long as needed to serve you, handle any questions about an order, and meet accounting rules. You can ask us to delete your account and its data at any time.'),
          ],
        },
        {
          heading: t('Your choices'),
          bullets: [
            t('Ask us what we hold about you, correct it, or delete it: send a message through the contact form.'),
            t('Remove the website from your device any time: it works fine without storing anything beyond your cart and language choice.'),
          ],
        },
      ]}
    />
  )
}
