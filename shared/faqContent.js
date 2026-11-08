import {
  deliveryAreaSummary,
  deliveryAreaSummaryFr,
  fulfillmentWindowSummary,
  fulfillmentWindowSummaryFr,
} from './faqData.js'

// One list for the FAQ page and for the FAQ schema in the first HTML response.
export const FAQ_GROUPS = [
  {
    heading: 'Ordering & payment',
    items: [
      {
        question: 'How do I order?',
        answer:
          'Browse the menu or flavors, add what you want to your bag, then checkout. You can pay by card (Stripe) or Mobile Money (CamPay), and you can check out as a guest or with an account.',
      },
      {
        question: 'Do I need an account to order?',
        answer:
          'No. Tap “Continue as guest” at checkout and enter your name, email and phone. An account keeps your details saved, tracks loyalty points, and lets you reorder in one tap, but it is never required.',
      },
      {
        question: 'Can I add a note to my order?',
        answer:
          'Yes. On checkout there is an optional “Note for the store” field — use it for a gift message, allergies, or a landmark that helps the rider find you.',
      },
      {
        question: 'Do you take custom cakes and party orders?',
        answer:
          'Yes. Request a custom cake on the /custom-cake page, and bulk event orders on the /events page. You choose the details, we send a quote, and a 30% deposit books the date.',
      },
    ],
  },
  {
    heading: 'Delivery & pickup',
    items: [
      {
        question: 'Which areas do you deliver to?',
        answer: deliveryAreaSummary(),
      },
      {
        question: 'How much does delivery cost?',
        answer:
          'Each branch sets its own fee, shown on checkout before you pay. If a branch offers free delivery, that shows too. Pickup is always free.',
      },
      {
        question: 'How fast can I get my order?',
        answer: fulfillmentWindowSummary(),
      },
      {
        question: 'Can I pick up my order instead?',
        answer:
          'Yes — choose Pickup at checkout, pick the branch, a date and a time slot, and collect it there. You will get a notification when it is ready.',
      },
    ],
  },
  {
    heading: 'Discounts & loyalty',
    items: [
      {
        question: 'How do I use a discount code?',
        answer:
          'Enter it in the “Savings” step at checkout and tap Apply code. The discount is confirmed again on the server when you pay, so the final total is always correct.',
      },
      {
        question: 'How do loyalty points work?',
        answer:
          'Earn points when you order, then redeem 100 points for 1,000 FCFA off. Points cannot be combined with a discount code, and there is a buy-2-get-1-free offer on scoops as well.',
      },
      {
        question: 'My code says it is invalid. Why?',
        answer:
          'Codes can expire, run out of uses, need a minimum number of items, or be switched off by the store. The message at checkout says which one applies.',
      },
    ],
  },
  {
    heading: 'After you order',
    items: [
      {
        question: 'How do I track my order?',
        answer:
          'Every step (preparing, ready, out for delivery, delivered) is sent as a device notification, an email and a WhatsApp message. You can also look an order up on the Track order page with the order number and the email used at checkout.',
      },
      {
        question: 'What if something is wrong with my order?',
        answer:
          'Contact us within 24 hours with your order number (and a photo if the problem is visible). We replace or refund — the refund policy page has the details.',
      },
      {
        question: 'Can I cancel my order?',
        answer:
          'Once the store starts preparing, an order cannot be cancelled. If it has not started, message the branch quickly through the contact form or WhatsApp and we will help.',
      },
    ],
  },
]

const FAQ_FR = {
  'How do I order?': 'Comment commander ?',
  'Browse the menu or flavors, add what you want to your bag, then checkout. You can pay by card (Stripe) or Mobile Money (CamPay), and you can check out as a guest or with an account.':
    'Parcourez le menu ou les parfums, ajoutez ce qui vous plaît à votre panier, puis passez au paiement. Vous pouvez payer par carte (Stripe) ou par Mobile Money (CamPay), et commander en tant qu’invité ou avec un compte.',
  'Do I need an account to order?': 'Faut-il un compte pour commander ?',
  'No. Tap “Continue as guest” at checkout and enter your name, email and phone. An account keeps your details saved, tracks loyalty points, and lets you reorder in one tap, but it is never required.':
    'Non. Touchez « Continuer en tant qu’invité » au paiement et indiquez votre nom, votre e-mail et votre téléphone. Un compte enregistre vos informations, suit vos points de fidélité et vous permet de recommander en un geste, mais il n’est jamais obligatoire.',
  'Can I add a note to my order?': 'Puis-je ajouter une note à ma commande ?',
  'Yes. On checkout there is an optional “Note for the store” field — use it for a gift message, allergies, or a landmark that helps the rider find you.':
    'Oui. Au paiement, un champ facultatif « Note pour la boutique » vous permet d’ajouter un message cadeau, vos allergies ou un repère qui aide le livreur à vous trouver.',
  'Do you take custom cakes and party orders?': 'Prenez-vous les gâteaux personnalisés et les commandes de fête ?',
  'Yes. Request a custom cake on the /custom-cake page, and bulk event orders on the /events page. You choose the details, we send a quote, and a 30% deposit books the date.':
    'Oui. Demandez un gâteau personnalisé sur la page /custom-cake, et les commandes en gros pour événements sur la page /events. Vous choisissez les détails, nous envoyons un devis, et un acompte de 30 % réserve la date.',
  'Which areas do you deliver to?': 'Dans quelles zones livrez-vous ?',
  'How much does delivery cost?': 'Combien coûte la livraison ?',
  'Each branch sets its own fee, shown on checkout before you pay. If a branch offers free delivery, that shows too. Pickup is always free.':
    'Chaque boutique fixe ses propres frais, affichés au paiement avant de régler. Si une boutique offre la livraison, cela s’affiche aussi. Le retrait est toujours gratuit.',
  'How fast can I get my order?': 'En combien de temps puis-je recevoir ma commande ?',
  'Can I pick up my order instead?': 'Puis-je plutôt retirer ma commande ?',
  'Yes — choose Pickup at checkout, pick the branch, a date and a time slot, and collect it there. You will get a notification when it is ready.':
    'Oui — choisissez le retrait au paiement, sélectionnez la boutique, une date et un créneau, puis récupérez-la sur place. Vous recevrez une notification dès qu’elle est prête.',
  'How do I use a discount code?': 'Comment utiliser un code de réduction ?',
  'Enter it in the “Savings” step at checkout and tap Apply code. The discount is confirmed again on the server when you pay, so the final total is always correct.':
    'Saisissez-le à l’étape « Économies » du paiement et touchez Appliquer le code. La réduction est revérifiée sur le serveur au moment du paiement, le total final est donc toujours correct.',
  'How do loyalty points work?': 'Comment fonctionnent les points de fidélité ?',
  'Earn points when you order, then redeem 100 points for 1,000 FCFA off. Points cannot be combined with a discount code, and there is a buy-2-get-1-free offer on scoops as well.':
    'Gagnez des points à chaque commande, puis échangez 100 points contre 1 000 FCFA de réduction. Les points ne se cumulent pas avec un code de réduction, et une offre 2 achetées, 1 offerte s’applique aussi aux boules.',
  'My code says it is invalid. Why?': 'Mon code est refusé. Pourquoi ?',
  'Codes can expire, run out of uses, need a minimum number of items, or be switched off by the store. The message at checkout says which one applies.':
    'Un code peut expirer, être épuisé, exiger un nombre minimum d’articles ou avoir été désactivé par la boutique. Le message au paiement indique lequel s’applique.',
  'How do I track my order?': 'Comment suivre ma commande ?',
  'Every step (preparing, ready, out for delivery, delivered) is sent as a device notification, an email and a WhatsApp message. You can also look an order up on the Track order page with the order number and the email used at checkout.':
    'Chaque étape (en préparation, prête, en livraison, livrée) vous est envoyée par notification, par e-mail et par WhatsApp. Vous pouvez aussi retrouver une commande sur la page de suivi avec son numéro et l’e-mail utilisé au paiement.',
  'What if something is wrong with my order?': 'Et si quelque chose ne va pas avec ma commande ?',
  'Contact us within 24 hours with your order number (and a photo if the problem is visible). We replace or refund — the refund policy page has the details.':
    'Contactez-nous sous 24 heures avec votre numéro de commande (et une photo si le problème est visible). Nous remplaçons ou remboursons — la page de politique de remboursement donne les détails.',
  'Can I cancel my order?': 'Puis-je annuler ma commande ?',
  'Once the store starts preparing, an order cannot be cancelled. If it has not started, message the branch quickly through the contact form or WhatsApp and we will help.':
    'Dès que la boutique commence la préparation, une commande ne peut plus être annulée. Si elle n’a pas commencé, écrivez vite à la boutique via le formulaire de contact ou WhatsApp et nous vous aiderons.',
}

function frenchAnswer(item) {
  if (item.question === 'Which areas do you deliver to?') return deliveryAreaSummaryFr()
  if (item.question === 'How fast can I get my order?') return fulfillmentWindowSummaryFr()
  return FAQ_FR[item.answer] || item.answer
}

/** FAQPage structured data. French pages use the French questions and answers. */
export function faqSchema(language = 'en') {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: language === 'fr' ? 'fr' : 'en',
    mainEntity: FAQ_GROUPS.flatMap((group) => group.items.map((item) => ({
      '@type': 'Question',
      name: language === 'fr' ? (FAQ_FR[item.question] || item.question) : item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: language === 'fr' ? frenchAnswer(item) : item.answer,
      },
    }))),
  }
}
