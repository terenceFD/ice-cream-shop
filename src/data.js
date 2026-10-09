export const cameroonLocations = [
  {
    town: 'Douala',
    area: 'Bonanjo',
    address: 'Centre Commercial L’Atrium',
    phone: '+237 681 25 55 55',
    mapQuery: 'Cold Stone Cameroon Centre Commercial L’Atrium Douala',
    source: 'https://www.google.com/maps/search/?api=1&query=Cold+Stone+Cameroon+Centre+Commercial+L%27Atrium+Douala',
  },
  {
    town: 'Douala',
    area: 'Bonamoussadi',
    address: '3PPM+296, Douala',
    mapQuery: 'Cold Stone Creamery Bonamoussadi Douala',
    source: 'https://www.google.com/maps/search/?api=1&query=Cold+Stone+Creamery+Bonamoussadi+Douala',
  },
  {
    town: 'Douala',
    area: 'Bonabéri',
    address: 'SPAR Bonabéri · 3MJ7+RM8',
    mapQuery: 'Cold Stone Creamery Bonaberi SPAR',
    source: 'https://www.google.com/maps/search/?api=1&query=Cold+Stone+Creamery+Bonaberi+SPAR',
  },
  {
    town: 'Douala',
    area: 'Ange Raphaël',
    address: 'Carrefour Ange Raphaël',
    mapQuery: 'Cold Stone Creamery Carrefour Ange Raphael Douala',
    source: 'https://www.facebook.com/ColdStoneCreameryCameroon/',
  },
  {
    town: 'Yaoundé',
    area: 'Bastos',
    address: 'STAR MALL · Nouvelle Route Bastos · VGJ7+M96',
    phone: '+237 681 47 39 23',
    mapQuery: 'Cold Stone Creamery Bastos STAR MALL Yaounde',
    source: 'https://www.google.com/maps/search/?api=1&query=Cold+Stone+Creamery+Bastos+STAR+MALL+Yaounde',
  },
]

export const cameroonDeliveryLocations = [
  ...new Map(
    cameroonLocations.map(({ town, area }) => [
      `${town} — ${area}`,
      { value: `${town} — ${area}`, town, area },
    ]),
  ).values(),
]

export const coldStoneMenuCategories = [
  {
    icon: '🍨',
    title: 'Ice Cream',
    description: 'Signature Creations, mix-in options and other ice cream treats.',
    image: '/menu-images/product-1.webp',
    items: [
      { name: 'Birthday Cake Remix', detail: 'Cake Batter Ice Cream with rainbow sprinkles, brownie and fudge.', image: '/menu-images/product-1.webp', priceXaf: 3500 },
      { name: 'Cheesecake Fantasy', detail: 'Cheesecake Ice Cream with graham crust, blueberries and strawberries.', image: '/menu-images/product-2.webp', priceXaf: 3500 },
      { name: 'Chocolate Devotion', detail: 'Chocolate Ice Cream with chocolate chips, brownie and fudge.', image: '/menu-images/product-3.webp', priceXaf: 3500 },
      { name: 'Cookie Doughn’t You Want Some', detail: 'French Vanilla Ice Cream with chocolate chips, cookie dough, fudge and caramel.', image: '/menu-images/product-4.webp', priceXaf: 3500 },
      { name: 'Founder’s Favorite', detail: 'Sweet Cream Ice Cream with pecans, brownie, fudge and caramel.', image: '/menu-images/product-5.webp', priceXaf: 3500 },
      { name: 'Mint Mint Chocolate Chocolate Chip', detail: 'Mint Ice Cream with chocolate chips, brownie and fudge.', image: '/menu-images/product-6.webp', priceXaf: 3500 },
      { name: 'Our Strawberry Blonde', detail: 'Strawberry Ice Cream with graham crust, strawberries, caramel and whipped topping.', image: '/menu-images/product-7.webp', priceXaf: 3500 },
      { name: 'Peanut Butter Cup Perfection', detail: 'Chocolate Ice Cream with peanut butter, a peanut butter cup and fudge.', image: '/menu-images/product-1.webp', priceXaf: 3500 },
      { name: 'Create Your Own Creation', detail: 'Choose an ice cream flavor and mix-ins.', image: '/menu-images/product-2.webp', priceXaf: 3000 },
      { name: 'Sundaes', detail: 'Ice cream served with toppings.', image: '/menu-images/product-3.webp', priceXaf: 3200 },
      { name: 'Mix & Go', detail: 'A prepared ice cream treat to take away.', image: '/menu-images/product-4.webp', priceXaf: 3000 },
      { name: 'Pre-Packed Ice Cream', detail: 'Packaged ice cream for enjoying later.', image: '/menu-images/product-5.webp', priceXaf: 2800 },
      { name: 'Cookie Crunch Cone', detail: 'Creamy ice cream with cookie pieces served in a waffle cone.', image: '/ice-images/ice-2.jpg', priceXaf: 3500 },
      { name: 'Caramel Crunch Cone', detail: 'Ice cream with caramel and crunchy mix-ins in a waffle cone.', image: '/ice-images/ice-4.webp', priceXaf: 3500 },
      { name: 'Chocolate Candy Cone', detail: 'Chocolate ice cream topped with candy and chocolate mix-ins.', image: '/ice-images/ice-6.webp', priceXaf: 3500 },
      { name: 'Candy Crunch Cone', detail: 'Ice cream topped with colorful candy and crunchy mix-ins.', image: '/ice-images/ice-7.webp', priceXaf: 3500 },
      { name: 'Signature Mix-In Cup', detail: 'A cup of ice cream finished with a crunchy mix-in topping.', image: '/ice-images/ice-3.webp', priceXaf: 3500 },
      { name: 'Cookie Crunch Cup', detail: 'Ice cream served in a cup with cookie pieces.', image: '/ice-images/ice-5.webp', priceXaf: 3500 },
      { name: 'Chocolate Candy Cup', detail: 'Chocolate ice cream topped with candy and chocolate pieces.', image: '/ice-images/ice-9.jpg', priceXaf: 3500 },
      { name: 'Classic Creamery Cup', detail: 'A classic cup of creamy ice cream to enjoy on the go.', image: '/ice-images/ice-10.jpg', priceXaf: 3200 },
      { name: 'Candy Mix-In Shake', detail: 'A blended ice cream shake topped with candy pieces and whipped topping.', image: '/ice-images/ice-1.jpg', priceXaf: 3500 },
      { name: 'Chocolate Crunch Shake', detail: 'A chocolate ice cream shake topped with crunchy mix-ins.', image: '/ice-images/ice-8.webp', priceXaf: 3500 },
    ],
  },
  {
    icon: '🎂',
    title: 'Cakes & Pies',
    description: 'Ice cream cakes for celebrations, custom designs and pies.',
    image: '/cake-images/cake-1.webp',
    items: [
      { name: 'Signature Cake Design 1', detail: 'Ready-made signature ice cream cake design.', image: '/cake-images/cake-1.webp', priceXaf: 18000 },
      { name: 'Signature Cake Design 2', detail: 'Ready-made signature ice cream cake design.', image: '/cake-images/cake-2.webp', priceXaf: 18000 },
      { name: 'Signature Cake Design 3', detail: 'Ready-made signature ice cream cake design.', image: '/cake-images/cake-3.webp', priceXaf: 18000 },
      { name: 'Birthday Cake Design 1', detail: 'Ice cream cake design for birthday celebrations.', image: '/cake-images/cake-4.webp', priceXaf: 22000 },
      { name: 'Birthday Cake Design 2', detail: 'Ice cream cake design for birthday celebrations.', image: '/cake-images/cake-5.webp', priceXaf: 22000 },
      { name: 'Birthday Cake Design 3', detail: 'Ice cream cake design for birthday celebrations.', image: '/cake-images/cake-6.webp', priceXaf: 22000 },
      { name: 'Custom Cake Design 1', detail: 'Customizable ice cream cake design.', image: '/cake-images/cake-7.webp', priceXaf: 25000 },
      { name: 'Custom Cake Design 2', detail: 'Customizable ice cream cake design.', image: '/cake-images/cake-8.webp', priceXaf: 25000 },
      { name: 'Custom Cake Design 3', detail: 'Customizable ice cream cake design.', image: '/cake-images/cake-9.webp', priceXaf: 25000 },
      { name: 'Kids’ Themed Cake Design 1', detail: 'Themed ice cream cake design for kids.', image: '/cake-images/cake-10.webp', priceXaf: 20000 },
      { name: 'Kids’ Themed Cake Design 2', detail: 'Themed ice cream cake design for kids.', image: '/cake-images/cake-11.webp', priceXaf: 20000 },
      { name: 'Ice Cream Pie Design 1', detail: 'Pie-style frozen dessert.', image: '/cake-images/cake-12.webp', priceXaf: 16000 },
      { name: 'Ice Cream Pie Design 2', detail: 'Pie-style frozen dessert.', image: '/cake-images/cake-13.webp', priceXaf: 16000 },
    ],
  },
  {
    icon: '🍧',
    title: 'Silk & Sorbet',
    description: 'Dairy-free alternatives listed on the global menu.',
    image: '/menu-images/product-5.webp',
    items: [
      { name: 'Silk Chocolate Almondmilk Frozen Dessert', detail: 'A chocolate frozen dessert made with almondmilk.', image: '/menu-images/product-5.webp', priceXaf: 3200 },
      { name: 'Sorbet', detail: 'Fruit sorbet flavors; varieties can vary.', image: '/menu-images/product-6.webp', priceXaf: 2800 },
    ],
  },
  {
    icon: '🥤',
    title: 'Milkshakes & Smoothies',
    description: 'Blended-to-order milkshakes and fruit smoothies.',
    image: '/milk/mk-1.webp',
    items: [
      { name: 'Milkshake 1', detail: 'Ice cream blended with milk; mix-ins may be available.', image: '/milk/mk-1.webp', priceXaf: 3500 },
      { name: 'Milkshake 2', detail: 'Ice cream blended with milk; mix-ins may be available.', image: '/milk/mk-2.webp', priceXaf: 3500 },
      { name: 'Milkshake 3', detail: 'Ice cream blended with milk; mix-ins may be available.', image: '/milk/mk-3.webp', priceXaf: 3500 },
      { name: 'Milkshake 4', detail: 'Ice cream blended with milk; mix-ins may be available.', image: '/milk/mk-4.webp', priceXaf: 3500 },
      { name: 'Milkshake 5', detail: 'Ice cream blended with milk; mix-ins may be available.', image: '/milk/mk-5.webp', priceXaf: 3500 },
      { name: 'Milkshake 6', detail: 'Ice cream blended with milk; mix-ins may be available.', image: '/milk/mk-6.webp', priceXaf: 3500 },
      { name: 'Fruit Smoothie 1', detail: 'Smoothie blended with whole fruit and fruit juice.', image: '/milk/mk-7.webp', priceXaf: 3200 },
      { name: 'Fruit Smoothie 2', detail: 'Smoothie blended with whole fruit and fruit juice.', image: '/milk/mk-8.webp', priceXaf: 3200 },
      { name: 'Fruit Smoothie 3', detail: 'Smoothie blended with whole fruit and fruit juice.', image: '/milk/mk-9.webp', priceXaf: 3200 },
      { name: 'Fruit Smoothie 4', detail: 'Smoothie blended with whole fruit and fruit juice.', image: '/milk/mk-10.webp', priceXaf: 3200 },
      { name: 'Fruit Smoothie 5', detail: 'Smoothie blended with whole fruit and fruit juice.', image: '/milk/mk-11.webp', priceXaf: 3200 },
      { name: 'Fruit Smoothie 6', detail: 'Smoothie blended with whole fruit and fruit juice.', image: '/milk/mk-12.webp', priceXaf: 3200 },
    ],
  },
  {
    icon: '🧁',
    title: 'Novelties',
    description: 'Portable frozen treats from the global menu.',
    image: '/cream/cream%201.webp',
    items: [
      { name: 'Cupcake Design 1', detail: 'Individual frozen treat in cupcake form.', image: '/cream/cream%201.webp', priceXaf: 2800 },
      { name: 'Cupcake Design 2', detail: 'Individual frozen treat in cupcake form.', image: '/cream/cream%202.webp', priceXaf: 2800 },
      { name: 'Ice Cream Cookie Sandwich 1', detail: 'Ice cream served between cookies.', image: '/cream/cream%203.webp', priceXaf: 3000 },
      { name: 'Ice Cream Cookie Sandwich 2', detail: 'Ice cream served between cookies.', image: '/cream/cream%204.webp', priceXaf: 3000 },
      { name: 'Ice Cream Cookie Sandwich 3', detail: 'Ice cream served between cookies.', image: '/cream/cream%205.webp', priceXaf: 3000 },
    ],
  },
  {
    icon: '✨',
    title: 'Limited-Time Favorites',
    description: 'Rotating seasonal and limited-time treats.',
    image: '/menu-images/product-3.webp',
    items: [
      { name: 'Seasonal Signature Creations', detail: 'Special creations that rotate; ask a local shop what is currently offered.', image: '/menu-images/product-3.webp', priceXaf: 3800 },
      { name: 'Limited-Time Treats', detail: 'Availability and dates vary by store and season.', image: '/menu-images/product-4.webp', priceXaf: 3500 },
    ],
  },
]

function menuIdPart(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function getMenuItemId(categoryTitle, itemName) {
  return `menu:${menuIdPart(categoryTitle)}:${menuIdPart(itemName)}`
}

export function findMenuItem(id) {
  for (const category of coldStoneMenuCategories) {
    const item = category.items.find((entry) => getMenuItemId(category.title, entry.name) === id)
    if (item) {
      return {
        ...item,
        id,
        itemType: 'menu',
        currency: 'xaf',
        price: item.priceXaf,
        categoryTitle: category.title,
        color: 'bg-[#f4f2f2]',
        availableQuantity: Number.MAX_SAFE_INTEGER,
      }
    }
  }
  return null
}
