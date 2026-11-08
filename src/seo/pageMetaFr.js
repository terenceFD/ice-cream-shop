// French titles and descriptions for the first HTML response.
// Product names stay as the shop sells them. The sentence around them is French,
// so a search for "glace Douala" can match the page Google stores.
import { clip } from './pageMeta.js'

export const PUBLIC_PAGES_FR = {
  '/': {
    title: 'Cold Stone Creamery Cameroon | Glace à Douala et Yaoundé',
    description:
      'Glace mélangée à la commande, créations signature, gâteaux et milk-shakes. Commandez en ligne, à emporter ou en livraison à Douala et Yaoundé.',
  },
  '/menu': {
    title: 'Menu et gourmandises',
    description:
      'Créations glacées, gâteaux, tartes, milk-shakes et smoothies. Parcourez le menu Cold Stone et commandez à Douala et Yaoundé.',
  },
  '/menu/all': {
    title: 'Tout le menu',
    description:
      'Toutes les glaces, gâteaux, milk-shakes et nouveautés Cold Stone, avec les prix en FCFA, à Douala et Yaoundé.',
  },
  '/flavors': {
    title: 'Parfums de glace',
    description:
      'Commandez des parfums de glace au Cameroun. Prix en FCFA, retrait ou livraison depuis les boutiques de Douala et Yaoundé.',
  },
  '/custom-cake': {
    title: 'Gâteau glacé sur mesure',
    description:
      'Demandez un gâteau glacé pour un anniversaire : taille, parfum, garnitures et date de retrait, à Douala et Yaoundé.',
  },
  '/events': {
    title: 'Glace pour fêtes et événements',
    description:
      'Commandez de la glace en quantité pour un anniversaire, un bureau ou un mariage au Cameroun. Devis, puis acompte.',
  },
  '/about': {
    title: 'À propos',
    description:
      'La glace Cold Stone, mélangée à la commande sur pierre froide, dans nos boutiques à Douala et Yaoundé.',
  },
  '/locations': {
    title: 'Boutiques Cold Stone au Cameroun',
    description:
      'Adresses, repères et téléphones des boutiques Cold Stone à Douala et Yaoundé.',
  },
  '/contact': {
    title: 'Écrire à une boutique',
    description: 'Une question pour une boutique ? Choisissez-la et envoyez un message à son équipe.',
  },
  '/privacy': {
    title: 'Politique de confidentialité',
    description:
      'Quelles informations personnelles nous recueillons lorsque vous commandez ou nous écrivez, et comment nous les protégeons.',
  },
  '/terms': {
    title: 'Conditions générales',
    description: 'Les conditions de commande, de retrait, de livraison et d’utilisation de ce site.',
  },
  '/refunds': {
    title: 'Politique de remboursement',
    description:
      'Quand et comment nous remboursons ou remplaçons une commande, y compris les gâteaux sur mesure.',
  },
  '/cookies': {
    title: 'Politique de cookies',
    description:
      'Ce site n’utilise pas de cookies publicitaires. Ce qui est enregistré sur votre appareil, et pourquoi.',
  },
  '/faq': {
    title: 'Questions fréquentes — commande, livraison et réductions',
    description:
      'Comment commander, zones et frais de livraison à Douala et Yaoundé, codes de réduction, points de fidélité et suivi de commande.',
  },
}

const CATEGORY_FR = {
  'Ice Cream': 'glace',
  'Cakes & Pies': 'gâteau glacé',
  'Silk & Sorbet': 'sorbet',
  'Milkshakes & Smoothies': 'milk-shake',
  Novelties: 'gourmandise glacée',
  'Limited-Time Favorites': 'glace du moment',
}

export const PRERENDER_HEADINGS_FR = {
  '/': 'Glace mélangée à la commande au Cameroun',
  '/menu/all': 'Tout le menu',
  '/menu': 'Le menu, par catégorie',
  '/flavors': 'Parfums de glace',
  '/custom-cake': 'Commander un gâteau glacé sur mesure',
  '/events': 'Glace pour les fêtes',
  '/locations': 'Nos boutiques à Douala et Yaoundé',
  '/contact': 'Contacter Cold Stone Creamery Cameroon',
  '/faq': 'Commande, livraison et réductions',
}

export const FALLBACK_LABELS_FR = {
  '/': 'Accueil',
  '/menu/all': 'Tout le menu',
  '/flavors': 'Parfums',
  '/custom-cake': 'Gâteaux sur mesure',
  '/events': 'Événements',
  '/locations': 'Boutiques',
  '/contact': 'Contact',
  '/faq': 'Questions',
}

/** French head tags for a page. English product names stay; the sentence around them is French. */
export function frenchMeta(meta) {
  const page = PUBLIC_PAGES_FR[meta.path]
  if (page) return { ...meta, title: page.title, description: page.description }
  if (meta.path.startsWith('/flavor/')) {
    const name = String(meta.title).replace(/ ice cream$/, '')
    return {
      ...meta,
      title: `${name}, glace`,
      description: clip(`${name}, glace à commander en FCFA, à emporter ou en livraison à Douala et Yaoundé.`),
    }
  }
  if (meta.path.startsWith('/treat/')) {
    const kind = CATEGORY_FR[meta.category] || 'glace'
    const price = meta.price ? `${Number(meta.price).toLocaleString('fr-FR')} FCFA. ` : ''
    return {
      ...meta,
      description: clip(`${meta.title}, ${kind}. ${price}À emporter ou en livraison à Douala et Yaoundé.`),
    }
  }
  return meta
}
