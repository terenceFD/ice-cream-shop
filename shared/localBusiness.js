import { cameroonLocations } from './data.js'
import { DEFAULT_STORE_HOURS } from './storeHours.js'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

function clock(minutes) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
}

/** One ice cream shop per branch, for the locations page. */
export function locationGraph(pageUrl) {
  return {
    '@context': 'https://schema.org',
    '@graph': cameroonLocations.map((location) => {
      const shop = {
        '@type': 'IceCreamShop',
        name: `Cold Stone Creamery ${location.area}`,
        url: pageUrl,
        address: {
          '@type': 'PostalAddress',
          streetAddress: location.address,
          addressLocality: location.town,
          addressCountry: 'CM',
        },
        openingHoursSpecification: {
          '@type': 'OpeningHoursSpecification',
          dayOfWeek: WEEKDAYS,
          opens: clock(DEFAULT_STORE_HOURS.openMinutes),
          closes: clock(DEFAULT_STORE_HOURS.closeMinutes),
        },
      }
      if (location.phone) shop.telephone = location.phone
      if (location.source) shop.hasMap = location.source
      return shop
    }),
  }
}
