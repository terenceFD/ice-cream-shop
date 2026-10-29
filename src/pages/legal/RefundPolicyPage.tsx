import { LegalPage } from './LegalPage'
import { useLanguage } from '../../language/useLanguage'

export function RefundPolicyPage() {
  const { t } = useLanguage()

  return (
    <LegalPage
      title={t('Refund policy')}
      updated={t('Last updated: 29 October 2026')}
      intro={t(
        'Ice cream and cakes are fresh food, so most orders cannot be returned once delivered. When something goes wrong on our side, we make it right. Here is exactly when and how.',
      )}
      sections={[
        {
          heading: t('When you get a refund or replacement'),
          bullets: [
            t('Your order arrives wrong: different items, missing items, or the wrong cake design.'),
            t('Your order arrives damaged, melted or unusable because of how we packed or delivered it.'),
            t('You paid twice for the same order, or you were charged an amount you did not order.'),
            t('We cancel your order (for example an item runs out), and you prefer money back instead of a swap.'),
          ],
        },
        {
          heading: t('When we cannot refund'),
          bullets: [
            t('You changed your mind after preparation started — fresh items cannot be restocked.'),
            t('You chose the wrong pickup time or address and we made the order as requested.'),
            t('The order was collected or received in good condition; storage afterwards is up to you.'),
          ],
        },
        {
          heading: t('How to ask for one'),
          paragraphs: [
            t('Contact us within 24 hours of receiving the order, through the contact form or the WhatsApp chat, with your order number and a photo if the problem is visible. We reply and, when approved, refund through the same payment method you used. Card refunds usually reach your account within 5 working days; Mobile Money refunds within 48 hours.'),
          ],
        },
        {
          heading: t('Custom cakes and event orders'),
          paragraphs: [
            t('Custom cakes are made to your design and confirmed with you before we bake, so design changes after confirmation cannot be refunded. If we make the cake different from the confirmed design, or it arrives damaged, we remake it or refund it in full — your choice.'),
          ],
        },
      ]}
    />
  )
}
