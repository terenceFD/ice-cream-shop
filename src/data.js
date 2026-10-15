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
    image: '/menu-official/ice-cream/signature-creations/founders-favorite.webp',
    items: [
      { name: 'Birthday Cake Remix', detail: 'Cake Batter Ice Cream with rainbow sprinkles, brownie and fudge.', image: '/menu-official/ice-cream/signature-creations/birthday-cake-remix.webp', gallery: ['/menu-official/ice-cream/signature-creations/birthday-cake-remix-2.webp'], priceXaf: 3500 },
      { name: 'Cheesecake Fantasy', detail: 'Cheesecake Ice Cream with graham crust, blueberries and strawberries.', image: '/menu-official/ice-cream/signature-creations/cheesecake-fantasy.webp', gallery: ['/menu-official/ice-cream/signature-creations/cheesecake-fantasy-2.webp'], priceXaf: 3500 },
      { name: 'Chocolate Devotion', detail: 'Chocolate Ice Cream with chocolate chips, brownie and fudge.', image: '/menu-official/ice-cream/signature-creations/chocolate-devotion.webp', gallery: ['/menu-official/ice-cream/signature-creations/chocolate-devotion-2.webp'], priceXaf: 3500 },
      { name: 'Cookie Doughn’t You Want Some', detail: 'French Vanilla Ice Cream with chocolate chips, cookie dough, fudge and caramel.', image: '/menu-official/ice-cream/signature-creations/cookie-doughnt-you-want-some.webp', gallery: ['/menu-official/ice-cream/signature-creations/cookie-doughnt-you-want-some-2.webp'], priceXaf: 3500 },
      { name: 'Founder’s Favorite', detail: 'Sweet Cream Ice Cream with pecans, brownie, fudge and caramel.', image: '/menu-official/ice-cream/signature-creations/founders-favorite.webp', gallery: ['/menu-official/ice-cream/signature-creations/founders-favorite-2.webp', '/menu-official/ice-cream/prepacked/founders-favorite.webp', '/menu-official/ice-cream/prepacked/founders-favorite-2.webp'], priceXaf: 3500 },
      { name: 'Mint Mint Chocolate Chocolate Chip', detail: 'Mint Ice Cream with chocolate chips, brownie and fudge.', image: '/menu-official/ice-cream/signature-creations/mint-mint-chocolate-chocolate-chip.webp', gallery: ['/menu-official/ice-cream/signature-creations/mint-mint-chocolate-chocolate-chip-2.webp'], priceXaf: 3500 },
      { name: 'Our Strawberry Blonde', detail: 'Strawberry Ice Cream with graham crust, strawberries, caramel and whipped topping.', image: '/menu-official/ice-cream/signature-creations/our-strawberry-blonde.webp', gallery: ['/menu-official/ice-cream/signature-creations/our-strawberry-blonde-2.webp'], priceXaf: 3500 },
      { name: 'Peanut Butter Cup Perfection', detail: 'Chocolate Ice Cream with peanut butter, a peanut butter cup and fudge.', image: '/menu-official/ice-cream/signature-creations/peanut-butter-cup-perfection.webp', gallery: ['/menu-official/ice-cream/signature-creations/peanut-butter-cup-perfection-2.webp'], priceXaf: 3500 },
      { name: 'Create Your Own Creation', detail: 'Choose an ice cream flavor and mix-ins.', image: '/ice-images/ice-3.webp', priceXaf: 3000 },
      { name: 'Banana Split Decision', idName: 'Sundaes', detail: 'Ice cream sundae with banana, strawberries, fudge and whipped topping.', image: '/menu-official/ice-cream/sundaes/banana-split-decision.webp', priceXaf: 3200 },
      { name: 'Mix & Go', detail: 'A prepared ice cream treat to take away.', image: '/menu-official/ice-cream/mix-and-go.webp', priceXaf: 3000 },
      { name: 'Pre-Packed Ice Cream', detail: 'Take-home pints of our signature creations, such as OREO Overload.', image: '/menu-official/ice-cream/prepacked/oreo-overload.webp', gallery: ['/menu-official/ice-cream/prepacked/oreo-overload-2.webp', '/menu-official/ice-cream/signature-creations/oreo-overload.webp', '/menu-official/ice-cream/signature-creations/oreo-overload-2.webp'], priceXaf: 2800 },
      { name: 'Cookies Make Everything Batter', idName: 'Cookie Crunch Cone', detail: 'Cake batter ice cream with OREO and golden sandwich cookies.', image: '/menu-official/ice-cream/signature-creations/cookies-make-everything-batter.webp', gallery: ['/menu-official/ice-cream/signature-creations/cookies-make-everything-batter-2.webp'], priceXaf: 3500 },
      { name: 'Banana Caramel Crunch', idName: 'Caramel Crunch Cone', detail: 'Banana ice cream with caramel and crunchy cookie pieces.', image: '/menu-official/ice-cream/signature-creations/banana-caramel-crunch.webp', gallery: ['/menu-official/ice-cream/signature-creations/banana-caramel-crunch-2.webp'], priceXaf: 3500 },
      { name: 'Mud Pie Mojo', idName: 'Chocolate Candy Cone', detail: 'Coffee ice cream with OREO cookies, peanut butter, almonds and fudge.', image: '/menu-official/ice-cream/signature-creations/mud-pie-mojo.webp', gallery: ['/menu-official/ice-cream/signature-creations/mud-pie-mojo-2.webp'], priceXaf: 3500 },
      { name: 'Cake Batter Batter Batter', idName: 'Candy Crunch Cone', detail: 'Cake batter ice cream with brownie, cookie dough and graham crumbs.', image: '/menu-official/ice-cream/signature-creations/cake-batter-batter-batter.webp', gallery: ['/menu-official/ice-cream/signature-creations/cake-batter-batter-batter-2.webp', '/menu-official/ice-cream/prepacked/cake-batter-batter-batter.webp', '/menu-official/ice-cream/prepacked/cake-batter-batter-batter-2.webp'], priceXaf: 3500 },
      { name: 'Beary Beary Blue', idName: 'Signature Mix-In Cup', detail: 'Blue ice cream topped with gummy bears.', image: '/menu-official/ice-cream/signature-creations/kids-creations/beary-beary-blue.webp', gallery: ['/menu-official/ice-cream/signature-creations/kids-creations/beary-beary-blue-2.webp'], priceXaf: 3500 },
      { name: 'Cookie Crunch Cup', detail: 'Ice cream served in a cup with cookie pieces.', image: '/ice-images/ice-5.webp', priceXaf: 3500 },
      { name: 'Delicious Dirt', idName: 'Chocolate Candy Cup', detail: 'Chocolate ice cream with OREO cookie pieces.', image: '/menu-official/ice-cream/signature-creations/kids-creations/delicious-dirt.webp', gallery: ['/menu-official/ice-cream/signature-creations/kids-creations/delicious-dirt-2.webp'], priceXaf: 3500 },
      { name: 'Sprinkleberry', idName: 'Classic Creamery Cup', detail: 'Strawberry ice cream with rainbow sprinkles.', image: '/menu-official/ice-cream/signature-creations/kids-creations/sprinkle-berry.webp', gallery: ['/menu-official/ice-cream/signature-creations/kids-creations/sprinkle-berry-2.webp'], priceXaf: 3200 },
      { name: 'Candy Mix-In Shake', detail: 'A blended ice cream shake topped with candy pieces and whipped topping.', image: '/ice-images/ice-1.jpg', priceXaf: 3500 },
      { name: 'Oh Fudge! Shake', idName: 'Chocolate Crunch Shake', detail: 'Chocolate ice cream shake with fudge and whipped topping.', image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/oh-fudge.webp', priceXaf: 3500 },
      { name: 'Apple Pie A La Cold Stone', detail: 'French Vanilla Ice Cream with apple pie filling, graham cracker crust, cinnamon and caramel.', image: '/menu-official/ice-cream/signature-creations/apple-pie-ala-coldstone.webp', gallery: ['/menu-official/ice-cream/signature-creations/apple-pie-ala-coldstone-2.webp'], priceXaf: 3500 },
      { name: 'Berry Berry Berry Good', detail: 'Sweet Cream Ice Cream with raspberries and blueberries.', image: '/menu-official/ice-cream/signature-creations/berry-berry-berry-good.webp', gallery: ['/menu-official/ice-cream/signature-creations/berry-berry-berry-good-2.webp'], priceXaf: 3500 },
      { name: 'Coffee Lovers Only', detail: 'Coffee Ice Cream with roasted almonds, chocolate candy pieces and caramel.', image: '/menu-official/ice-cream/signature-creations/coffee-lovers-only.webp', gallery: ['/menu-official/ice-cream/signature-creations/coffee-lovers-only-2.webp'], priceXaf: 3500 },
      { name: 'Cookie Mintster', detail: 'Mint Ice Cream with chocolate sandwich cookies and fudge.', image: '/menu-official/ice-cream/signature-creations/cookie-mintster.webp', gallery: ['/menu-official/ice-cream/signature-creations/cookie-mintster-2.webp'], priceXaf: 3500 },
      { name: 'Dough For It', detail: 'Cookie Dough Ice Cream with cookie dough bites and chocolate chips.', image: '/menu-official/ice-cream/signature-creations/dough-for-it.webp', gallery: ['/menu-official/ice-cream/signature-creations/dough-for-it-2.webp'], priceXaf: 3500 },
      { name: 'Doughlightful Peanut Butter', detail: 'Cookie Dough Ice Cream with peanut butter cups and a peanut butter swirl.', image: '/menu-official/ice-cream/signature-creations/doughlightful-peanut-butter.webp', gallery: ['/menu-official/ice-cream/signature-creations/doughlightful-peanut-butter-2.webp'], priceXaf: 3500 },
      { name: 'One Smart Brookie', detail: 'Sweet Cream Ice Cream with brownie pieces, cookie pieces and peanut butter cups.', image: '/menu-official/ice-cream/signature-creations/one-smart-brookie.webp', gallery: ['/menu-official/ice-cream/signature-creations/one-smart-brookie-2.webp'], priceXaf: 3500 },
      { name: 'Our Dubai Chocolate Creation', detail: 'Chocolate Ice Cream with chocolate shavings and a pistachio drizzle.', image: '/menu-official/ice-cream/signature-creations/our-dubai-chocolate-creation.webp', gallery: ['/menu-official/ice-cream/signature-creations/our-dubai-chocolate-creation-2.webp'], priceXaf: 3800 },
      { name: 'Reese’s Peanut Butter Awesome Sauce', detail: 'Sweet Cream Ice Cream with Reese’s peanut butter cups and peanut butter sauce.', image: '/menu-official/ice-cream/signature-creations/reeses-peanut-butter-awesome-sauce.webp', gallery: ['/menu-official/ice-cream/signature-creations/reeses-peanut-butter-awesome-sauce-2.webp'], priceXaf: 3500 },
      { name: 'Surrender to Strawberry', detail: 'Strawberry Ice Cream with fresh strawberries, yellow cake and whipped topping.', image: '/menu-official/ice-cream/signature-creations/surrender-to-strawberry.webp', gallery: ['/menu-official/ice-cream/signature-creations/surrender-to-strawberry-2.webp'], priceXaf: 3500 },
      { name: 'Who You Callin’ Shortcake?', detail: 'Strawberry Ice Cream sundae with yellow cake, strawberries and whipped topping.', image: '/menu-official/ice-cream/sundaes/who-you-callin-shortcake.webp', priceXaf: 3200 },
    ],
  },
  {
    icon: '🎂',
    title: 'Cakes & Pies',
    description: 'Ice cream cakes for celebrations, custom designs and pies.',
    image: '/menu-official/cakes/birthday-cakes.webp',
    items: [
      { name: 'Cake Batter Confetti Cake', idName: 'Signature Cake Design 1', detail: 'Cake batter ice cream and red velvet cake layers, finished with rainbow sprinkles.', image: '/menu-official/cakes/signature-cakes/cake-batter-confetti.webp', gallery: ['/menu-official/cakes/signature-cakes/cake-batter-confetti-2.webp', '/menu-official/cakes/petite-cakes/cake-batter-confetti.webp'], priceXaf: 18000 },
      { name: 'OREO Cookies & Cream Extreme Cake', idName: 'Signature Cake Design 2', detail: 'Cookies and cream ice cream with cake layers, topped with OREO cookies.', image: '/menu-official/cakes/signature-cakes/oreo-cookies-cream-extreme.webp', gallery: ['/menu-official/cakes/signature-cakes/oreo-cookies-cream-extreme-2.webp'], priceXaf: 18000 },
      { name: 'Tall, Dark & Delicious Cake', idName: 'Signature Cake Design 3', detail: 'Layers of chocolate cake and ice cream with a fudge drip and chocolate wafers on top.', image: '/menu-official/cakes/signature-cakes/tall-dark-delicious.webp', gallery: ['/menu-official/cakes/signature-cakes/tall-dark-delicious-2.webp'], priceXaf: 18000 },
      { name: 'Happy Birthday Cake', idName: 'Birthday Cake Design 1', detail: 'Classic ice cream birthday cake with a Happy Birthday message and a sprinkle border.', image: '/menu-official/cakes/birthday-cakes.webp', priceXaf: 22000 },
      { name: 'Cake Batter Layers Cake', idName: 'Birthday Cake Design 2', detail: 'Yellow cake and cake batter ice cream layers, decorated with chocolate pieces.', image: '/menu-official/cakes/signature-cakes/local-store-signature/cake-batter-layers.webp', priceXaf: 22000 },
      { name: 'Petite Cake Batter Confetti', idName: 'Birthday Cake Design 3', detail: 'Small cake batter ice cream cake with a rainbow sprinkle border and a chocolate wafer on top.', image: '/menu-official/cakes/petite-cakes/cake-batter-confetti.webp', gallery: ['/menu-official/cakes/signature-cakes/cake-batter-confetti.webp', '/menu-official/cakes/signature-cakes/cake-batter-confetti-2.webp'], priceXaf: 22000 },
      { name: 'Caramel Nut Nirvana Cake', idName: 'Custom Cake Design 1', detail: 'Chocolate cake and ice cream layers with caramel and nut candy, wrapped in fudge.', image: '/menu-official/cakes/signature-cakes/local-store-signature/caramel-nut-nirvana.webp', priceXaf: 25000 },
      { name: 'Raspberry Truffle Temptation Cake', idName: 'Custom Cake Design 2', detail: 'Red velvet cake and raspberry ice cream layers wrapped in fudge, topped with raspberries.', image: '/menu-official/cakes/signature-cakes/local-store-signature/raspberry-truffle-temptation.webp', priceXaf: 25000 },
      { name: 'Rich & Dreamy Cake', idName: 'Custom Cake Design 3', detail: 'Chocolate and yellow cake layers with cookies and cream ice cream, topped with OREO cookies and chocolate wafers.', image: '/menu-official/cakes/signature-cakes/local-store-signature/rich-and-dreamy.webp', priceXaf: 25000 },
      { name: 'Superhero Kids’ Cake', idName: 'Kids’ Themed Cake Design 1', detail: 'Blue and red superhero-themed ice cream cake for kids’ birthdays.', image: '/cake-images/cake-3.webp', priceXaf: 20000 },
      { name: 'Cookie Party Kids’ Cake', idName: 'Kids’ Themed Cake Design 2', detail: 'White frosted ice cream cake topped with cookie dough bites, perfect for kids’ parties.', image: '/cake-images/cake-7.webp', priceXaf: 20000 },
      { name: 'Cookie Dough Pie', idName: 'Ice Cream Pie Design 1', detail: 'Ice cream pie on a graham crust with cookie dough, a fudge drizzle and whipped topping.', image: '/menu-official/cakes/ice-cream-pies/local-pies/cookie-dough-pie.webp', priceXaf: 16000 },
      { name: 'S’more Some More Pie', idName: 'Ice Cream Pie Design 2', detail: 'Ice cream pie with marshmallows, chocolate pieces and whipped topping on a graham crust.', image: '/menu-official/cakes/ice-cream-pies/local-pies/smore-some-more-pie.webp', priceXaf: 16000 },
      { name: 'Cheesecake Named Desire', detail: 'Cheesecake Ice Cream and yellow cake layers with a graham crust, topped with raspberries.', image: '/menu-official/cakes/signature-cakes/cheesecake-named-desire.webp', gallery: ['/menu-official/cakes/signature-cakes/cheesecake-named-desire-2.webp', '/menu-official/cakes/petite-cakes/local-store-petite/cheesecake-named-desire.webp'], priceXaf: 18000 },
      { name: 'Chocolate Chipper', detail: 'Chocolate chip ice cream between red velvet cake layers, wrapped in fudge.', image: '/menu-official/cakes/signature-cakes/chocolate-chipper.webp', gallery: ['/menu-official/cakes/signature-cakes/chocolate-chipper-2.webp', '/menu-official/cakes/petite-cakes/local-store-petite/chocolate-chipper.webp'], priceXaf: 18000 },
      { name: 'Coffee House Crunch', detail: 'Coffee ice cream and chocolate cake layers with toffee pieces, wrapped in fudge.', image: '/menu-official/cakes/signature-cakes/coffee-house-crunch.webp', gallery: ['/menu-official/cakes/signature-cakes/coffee-house-crunch-2.webp', '/menu-official/cakes/petite-cakes/local-store-petite/coffee-house-crunch.webp'], priceXaf: 18000 },
      { name: 'Cookie Dough Delirium', detail: 'Cookie dough ice cream and yellow cake layers with cookie dough pieces, frosted in whipped topping.', image: '/menu-official/cakes/signature-cakes/cookie-dough-delirium.webp', gallery: ['/menu-official/cakes/signature-cakes/cookie-dough-delirium-2.webp', '/menu-official/cakes/petite-cakes/cookie-dough-delirium.webp'], priceXaf: 18000 },
      { name: 'Cookies & Creamery', detail: 'Sweet cream ice cream with chocolate sandwich cookies between chocolate cake layers.', image: '/menu-official/cakes/signature-cakes/cookies-and-creamery.webp', gallery: ['/menu-official/cakes/signature-cakes/cookies-and-creamery-2.webp', '/menu-official/cakes/petite-cakes/cookies-and-creamery.webp'], priceXaf: 18000 },
      { name: 'Midnight Delight', detail: 'Chocolate cake and chocolate ice cream layers wrapped in fudge, topped with chocolate curls.', image: '/menu-official/cakes/signature-cakes/midnight-delight.webp', gallery: ['/menu-official/cakes/signature-cakes/midnight-delight-2.webp', '/menu-official/cakes/petite-cakes/midnight-delight.webp'], priceXaf: 18000 },
      { name: 'Mint Chip', detail: 'Mint chocolate chip ice cream between chocolate cake layers, topped with chocolate cookies.', image: '/menu-official/cakes/signature-cakes/mint-chip.webp', gallery: ['/menu-official/cakes/signature-cakes/mint-chip-2.webp', '/menu-official/cakes/petite-cakes/local-store-petite/mint-chip.webp'], priceXaf: 18000 },
      { name: 'Peanut Butter Playground', detail: 'Chocolate and peanut butter ice cream with chocolate cake and peanut butter cups, wrapped in fudge.', image: '/menu-official/cakes/signature-cakes/peanut-butter-playground.webp', gallery: ['/menu-official/cakes/signature-cakes/peanut-butter-playground-2.webp', '/menu-official/cakes/petite-cakes/local-store-petite/peanut-butter-playground.webp'], priceXaf: 18000 },
      { name: 'Strawberry Passion', detail: 'Strawberry ice cream and red velvet cake layers, topped with fresh strawberries.', image: '/menu-official/cakes/signature-cakes/strawberry-passion.webp', gallery: ['/menu-official/cakes/signature-cakes/strawberry-passion-2.webp', '/menu-official/cakes/petite-cakes/strawberry-passion.webp'], priceXaf: 18000 },
      { name: 'Butterfinger Bonanza', detail: 'Yellow cake and ice cream layers with crunchy candy pieces, frosted in whipped topping.', image: '/menu-official/cakes/signature-cakes/local-store-signature/butterfinger-bonanza.webp', priceXaf: 18000 },
      { name: 'Neapolitan', detail: 'Strawberry, vanilla and chocolate ice cream layers with cake, topped with fresh berries.', image: '/menu-official/cakes/signature-cakes/local-store-signature/neapolitan.webp', priceXaf: 18000 },
      { name: 'Quilted Coffee Caramel', detail: 'Coffee ice cream and chocolate cake layers with a caramel drizzle and toffee-coated sides.', image: '/menu-official/cakes/signature-cakes/local-store-signature/quilted-coffee-caramel.webp', priceXaf: 18000 },
      { name: 'Caramel Apple Pie', detail: 'Ice cream pie with caramel apple flavor on a graham crust, finished with cinnamon and whipped topping.', image: '/menu-official/cakes/ice-cream-pies/local-pies/caramel-apple-pie.webp', priceXaf: 16000 },
      { name: 'Caramel Turtle Treat Pie', detail: 'Ice cream pie on a graham crust with caramel, fudge and pecans.', image: '/menu-official/cakes/ice-cream-pies/local-pies/caramel-turtle-treat-pie.webp', priceXaf: 16000 },
      { name: 'Pumpkin Pie', detail: 'Pumpkin ice cream pie on a graham crust, topped with chocolate leaves and whipped topping.', image: '/menu-official/cakes/ice-cream-pies/local-pies/pumpkin-pie.webp', priceXaf: 16000 },
    ],
  },
  {
    icon: '🍧',
    title: 'Silk & Sorbet',
    description: 'Dairy-free alternatives listed on the global menu.',
    image: '/menu-official/dairy-free-ice-cream-sorbet/sorbet.webp',
    items: [
      { name: 'Silk Chocolate Almondmilk Frozen Dessert', detail: 'A chocolate frozen dessert made with almondmilk.', image: '/menu-official/dairy-free-ice-cream-sorbet/silk.webp', priceXaf: 3200 },
      { name: 'Sorbet', detail: 'Fruit sorbet flavors; varieties can vary.', image: '/menu-official/dairy-free-ice-cream-sorbet/sorbet.webp', priceXaf: 2800 },
      { name: 'Don’t Cry Over Spilled Silk', detail: 'Silk Chocolate Almondmilk Frozen Dessert with banana and roasted nuts (dairy-free).', image: '/menu-official/ice-cream/signature-creations/dont-cry-over-spilled-silk.webp', gallery: ['/menu-official/ice-cream/signature-creations/dont-cry-over-spilled-silk-2.webp'], priceXaf: 3500 },
    ],
  },
  {
    icon: '🥤',
    title: 'Milkshakes & Smoothies',
    description: 'Blended-to-order milkshakes and fruit smoothies.',
    image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/very-vanilla.webp',
    items: [
      { name: 'Very Vanilla Shake', idName: 'Milkshake 1', detail: 'Vanilla ice cream blended with milk and topped with whipped topping.', image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/very-vanilla.webp', priceXaf: 3500 },
      { name: 'Savory Strawberry Shake', idName: 'Milkshake 2', detail: 'Strawberry ice cream blended with milk and topped with whipped topping.', image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/savory-strawberry.webp', priceXaf: 3500 },
      { name: 'Milk & OREO Cookies Shake', idName: 'Milkshake 3', detail: 'Sweet cream ice cream blended with OREO cookies and milk.', image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/milk-cookies.webp', priceXaf: 3500 },
      { name: 'Chocolate Peanut Butter Dream Shake', idName: 'Milkshake 4', detail: 'Chocolate ice cream and peanut butter blended with milk, with a peanut butter drizzle.', image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/chocolate-peanut-butter-dream-shake.webp', priceXaf: 3500 },
      { name: 'Chocolate Silk Shake', idName: 'Milkshake 5', detail: 'Dairy-free chocolate almondmilk shake.', image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/chocolate-silk-shake.webp', priceXaf: 3500 },
      { name: 'Cake Batter Shake', idName: 'Milkshake 6', detail: 'Cake batter ice cream blended with milk and topped with whipped topping.', image: '/menu-official/milkshakes-fruit-smoothies/milkshakes/cake-shake.webp', priceXaf: 3500 },
      { name: 'Strawberry Banana Smoothie', idName: 'Fruit Smoothie 1', detail: 'Strawberries and banana blended with fruit juice.', image: '/menu-official/milkshakes-fruit-smoothies/smoothies/strawberry-banana.webp', priceXaf: 3200 },
      { name: 'Blueberry Banana Smoothie', idName: 'Fruit Smoothie 2', detail: 'Blueberries and banana blended with fruit juice.', image: '/menu-official/milkshakes-fruit-smoothies/smoothies/blueberry-banana.webp', priceXaf: 3200 },
      { name: 'Pineapple Blueberry Smoothie', idName: 'Fruit Smoothie 3', detail: 'Pineapple and blueberries blended with fruit juice.', image: '/menu-official/milkshakes-fruit-smoothies/smoothies/pineapple-blueberry.webp', priceXaf: 3200 },
      { name: 'Mango Pineapple Smoothie', idName: 'Fruit Smoothie 4', detail: 'Mango and pineapple blended with fruit juice.', image: '/menu-official/milkshakes-fruit-smoothies/smoothies/mango-pineapple.webp', priceXaf: 3200 },
      { name: 'Strawberry Mango Smoothie', idName: 'Fruit Smoothie 5', detail: 'Strawberries and mango blended with fruit juice.', image: '/menu-official/milkshakes-fruit-smoothies/smoothies/strawberry-mango.webp', priceXaf: 3200 },
    ],
  },
  {
    icon: '🧁',
    title: 'Novelties',
    description: 'Portable frozen treats from the global menu.',
    image: '/menu-official/novelties/ice-cream-cupcakes/cake-batter-delux.webp',
    items: [
      { name: 'Sweet Cream Cupcake', idName: 'Cupcake Design 1', detail: 'Sweet cream ice cream in a chocolate cup, topped with whipped frosting and wafer rolls.', image: '/menu-official/novelties/ice-cream-cupcakes/sweet-cream.webp', priceXaf: 2800 },
      { name: 'Double Chocolate Devotion Cupcake', idName: 'Cupcake Design 2', detail: 'Chocolate ice cream and chocolate cake in a chocolate cup, topped with whipped frosting and an OREO cookie.', image: '/menu-official/novelties/ice-cream-cupcakes/double-chocolate-devotion.webp', priceXaf: 2800 },
      { name: 'Cake Batter Sprinkle Sandwich', idName: 'Ice Cream Cookie Sandwich 1', detail: 'Cake batter ice cream between chocolate chip cookies, rolled in rainbow sprinkles.', image: '/menu-official/novelties/ice-cream-cookie-sandwiches/cake-batter-sprinkle.webp', gallery: ['/menu-official/novelties/ice-cream-cookie-sandwiches/cake-batter-sprinkle-2.webp'], priceXaf: 3000 },
      { name: 'Cookie Crumb Yum Sandwich', idName: 'Ice Cream Cookie Sandwich 2', detail: 'Ice cream between chocolate chip cookies, rolled in chocolate cookie crumbs.', image: '/menu-official/novelties/ice-cream-cookie-sandwiches/cookie-crumb-yum.webp', priceXaf: 3000 },
      { name: 'Kiss & Tell Chocolate Sandwich', idName: 'Ice Cream Cookie Sandwich 3', detail: 'Chocolate ice cream between chocolate chip cookies, rolled in chocolate chips.', image: '/menu-official/novelties/ice-cream-cookie-sandwiches/kiss-and-tell-chocolate.webp', priceXaf: 3000 },
      { name: 'Perfect Duet', detail: 'Ice cream with chocolate chunks between two chocolate chip cookies.', image: '/menu-official/novelties/ice-cream-cookie-sandwiches/perfect-duet.webp', priceXaf: 3000 },
      { name: 'Cake Batter Delux Cupcake', detail: 'Cake batter ice cream on red velvet cake in a chocolate cup, topped with pink frosting and sprinkles.', image: '/menu-official/novelties/ice-cream-cupcakes/cake-batter-delux.webp', priceXaf: 2800 },
      { name: 'Reese’s Ice Cream Cups', detail: 'Chocolate cups filled with peanut butter ice cream and fudge, topped with a Reese’s cup.', image: '/menu-official/novelties/ice-cream-cupcakes/reeses-ice-cream-cups.webp', priceXaf: 2800 },
    ],
  },
  {
    icon: '✨',
    title: 'Limited-Time Favorites',
    description: 'Rotating seasonal and limited-time treats.',
    image: '/menu-official/limited-time-offers/the-cat-in-the-hats-cotton-candy-catastrophe.webp',
    items: [
      { name: 'Crumb & Get It', idName: 'Seasonal Signature Creations', detail: 'Sweet cream ice cream with graham cracker crumbs, chocolate pieces and caramel.', image: '/menu-official/limited-time-offers/crumb-and-get-it.webp', gallery: ['/menu-official/limited-time-offers/crumb-and-get-it-2.webp'], priceXaf: 3800 },
      { name: 'Going Bananas for JELL-O Pudding', idName: 'Limited-Time Treats', detail: 'Banana pudding ice cream with vanilla wafers and marshmallow pieces.', image: '/menu-official/limited-time-offers/going-bananas-for-jell-o-pudding.webp', gallery: ['/menu-official/limited-time-offers/going-bananas-for-jell-o-pudding-2.webp'], priceXaf: 3500 },
      { name: 'The Cat in the Hat’s Cotton Candy Catastrophe', detail: 'Cotton candy ice cream with chocolate sandwich cookies and red and white sprinkles.', image: '/menu-official/limited-time-offers/the-cat-in-the-hats-cotton-candy-catastrophe.webp', gallery: ['/menu-official/limited-time-offers/the-cat-in-the-hats-cotton-candy-catastrophe-2.webp'], priceXaf: 3800 },
      { name: 'Treat or Treat', detail: 'Black cocoa ice cream with candy-coated chocolates and chocolate candy bars in a waffle cone.', image: '/menu-official/limited-time-offers/treat-or-treat.webp', gallery: ['/menu-official/limited-time-offers/treat-or-treat-2.webp'], priceXaf: 3800 },
      { name: 'Witches’ Boo', detail: 'Black shake topped with whipped topping, chocolate cookie pieces and orange candies.', image: '/menu-official/limited-time-offers/witches-boo.webp', gallery: ['/menu-official/limited-time-offers/witches-boo-2.webp'], priceXaf: 3800 },
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

// Products renamed after launch keep their original name in idName, so the ID that bags, orders,
// favorites, reviews and stock were saved under still matches.
let renamedProducts = null
function idNameFor(categoryTitle, itemName) {
  renamedProducts ??= new Map(coldStoneMenuCategories.flatMap((category) => category.items
    .filter((item) => item.idName)
    .map((item) => [`${category.title}\n${item.name}`, item.idName])))
  return renamedProducts.get(`${categoryTitle}\n${itemName}`) || itemName
}

export function getMenuItemId(categoryTitle, itemName) {
  return `menu:${menuIdPart(categoryTitle)}:${menuIdPart(idNameFor(categoryTitle, itemName))}`
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
