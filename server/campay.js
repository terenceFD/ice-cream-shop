const environment = (process.env.CAMPAY_ENVIRONMENT || 'DEV').trim().toUpperCase()

function apiHost() {
  if (environment === 'DEV') return 'https://demo.campay.net'
  if (environment === 'PROD') return 'https://www.campay.net'
  throw new Error('CAMPAY_ENVIRONMENT must be either DEV or PROD.')
}

export function isCamPayMobileMoneyEnabled() {
  return process.env.CAMPAY_MOBILE_MONEY_ENABLED?.trim().toLowerCase() === 'true'
    && Boolean(process.env.CAMPAY_APP_USERNAME?.trim())
    && Boolean(process.env.CAMPAY_APP_PASSWORD?.trim())
}

async function requestCamPay(path, { method = 'GET', body } = {}) {
  let response
  try {
    response = await fetch(`${apiHost()}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body?.token ? { Authorization: `Token ${body.token}` } : {}),
      },
      ...(body?.payload ? { body: JSON.stringify(body.payload) } : {}),
      signal: AbortSignal.timeout(15000),
    })
  } catch (error) {
    throw new Error('Unable to reach CamPay.', { cause: error })
  }

  let result
  try {
    result = await response.json()
  } catch (error) {
    throw new Error(`CamPay returned an invalid response (${response.status}).`, { cause: error })
  }
  if (!response.ok) {
    throw new Error(`CamPay request failed (${response.status}).`)
  }
  return result
}

async function getCamPayToken() {
  const username = process.env.CAMPAY_APP_USERNAME?.trim()
  const password = process.env.CAMPAY_APP_PASSWORD?.trim()
  if (!username || !password) throw new Error('CamPay is not configured.')

  const result = await requestCamPay('/api/token/', {
    method: 'POST',
    body: { payload: { username, password } },
  })
  if (typeof result.token !== 'string' || !result.token) {
    throw new Error('CamPay did not return an access token.')
  }
  return result.token
}

export async function createCamPayPaymentLink({
  amount,
  externalReference,
  redirectUrl,
  failureRedirectUrl,
  phone,
  name,
  email,
}) {
  const token = await getCamPayToken()
  const [firstName, ...lastNames] = name.trim().split(/\s+/)
  const result = await requestCamPay('/api/get_payment_link/', {
    method: 'POST',
    body: {
      token,
      payload: {
        amount: String(amount),
        currency: 'XAF',
        description: `Ice Cream Shop order ${externalReference}`,
        external_reference: externalReference,
        redirect_url: redirectUrl,
        failure_redirect_url: failureRedirectUrl,
        from: phone,
        first_name: firstName,
        last_name: lastNames.join(' ') || firstName,
        email,
        payment_options: 'MOMO',
      },
    },
  })
  const url = typeof result.link === 'string' ? new URL(result.link) : null
  if (!url || url.protocol !== 'https:' || ![
    'campay.com',
    'www.campay.com',
    'campay.net',
    'www.campay.net',
    'demo.campay.net',
  ].includes(url.hostname)) {
    throw new Error('CamPay did not return a valid hosted payment URL.')
  }
  if (typeof result.reference !== 'string' || !result.reference) {
    throw new Error('CamPay did not return a payment reference.')
  }
  return { url: url.toString(), reference: result.reference }
}

export async function getCamPayTransaction(reference) {
  if (typeof reference !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(reference)) {
    throw new Error('CamPay transaction reference is invalid.')
  }
  const token = await getCamPayToken()
  return requestCamPay(`/api/transaction/${encodeURIComponent(reference)}/`, {
    body: { token },
  })
}
