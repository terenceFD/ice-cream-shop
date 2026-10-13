import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  createCamPayPaymentLink,
  getCamPayTransaction,
  isCamPayMobileMoneyEnabled,
} from './campay.js'

const originalFetch = globalThis.fetch
const originalEnvironment = {
  CAMPAY_APP_USERNAME: process.env.CAMPAY_APP_USERNAME,
  CAMPAY_APP_PASSWORD: process.env.CAMPAY_APP_PASSWORD,
  CAMPAY_ENVIRONMENT: process.env.CAMPAY_ENVIRONMENT,
  CAMPAY_MOBILE_MONEY_ENABLED: process.env.CAMPAY_MOBILE_MONEY_ENABLED,
}

function configureCamPay(environment = 'DEV') {
  process.env.CAMPAY_APP_USERNAME = 'sandbox-user'
  process.env.CAMPAY_APP_PASSWORD = 'sandbox-password'
  process.env.CAMPAY_ENVIRONMENT = environment
  process.env.CAMPAY_MOBILE_MONEY_ENABLED = 'true'
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
})

test('CamPay is not exposed until enabled with application credentials', () => {
  configureCamPay()
  assert.equal(isCamPayMobileMoneyEnabled(), true)
  delete process.env.CAMPAY_APP_PASSWORD
  assert.equal(isCamPayMobileMoneyEnabled(), false)
})

test('CamPay hosted checkout obtains a token and creates an XAF Mobile Money link', async () => {
  configureCamPay()
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options })
    return requests.length === 1
      ? jsonResponse({ token: 'sandbox-token' })
      : jsonResponse({ link: 'https://www.campay.com/pay/with/link/abc', reference: 'remote-reference' })
  }

  const result = await createCamPayPaymentLink({
    amount: 1950,
    externalReference: 'icy-42-test',
    redirectUrl: 'https://shop.example/payment?provider=campay&reference=icy-42-test',
    failureRedirectUrl: 'https://shop.example/payment?provider=campay&reference=icy-42-test&status=failed',
    phone: '237690000000',
    name: 'Test Customer',
    email: 'customer@example.com',
  })

  assert.deepEqual(result, {
    url: 'https://www.campay.com/pay/with/link/abc',
    reference: 'remote-reference',
  })
  assert.equal(requests[0].url, 'https://demo.campay.net/api/token/')
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    username: 'sandbox-user',
    password: 'sandbox-password',
  })
  assert.equal(requests[1].url, 'https://demo.campay.net/api/get_payment_link/')
  assert.equal(requests[1].options.headers.Authorization, 'Token sandbox-token')
  assert.deepEqual(JSON.parse(requests[1].options.body), {
    amount: '1950',
    currency: 'XAF',
    description: 'Ice Cream Shop order icy-42-test',
    external_reference: 'icy-42-test',
    redirect_url: 'https://shop.example/payment?provider=campay&reference=icy-42-test',
    failure_redirect_url: 'https://shop.example/payment?provider=campay&reference=icy-42-test&status=failed',
    from: '237690000000',
    first_name: 'Test',
    last_name: 'Customer',
    email: 'customer@example.com',
    payment_options: 'MOMO',
  })
})

test('CamPay transaction status uses production endpoint and token authorization', async () => {
  configureCamPay('PROD')
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options })
    return requests.length === 1
      ? jsonResponse({ token: 'production-token' })
      : jsonResponse({
        reference: 'remote-reference',
        external_reference: 'icy-42-test',
        status: 'SUCCESSFUL',
        amount: 1950,
        currency: 'XAF',
      })
  }

  const transaction = await getCamPayTransaction('remote-reference')

  assert.equal(transaction.status, 'SUCCESSFUL')
  assert.equal(requests[0].url, 'https://www.campay.net/api/token/')
  assert.equal(requests[1].url, 'https://www.campay.net/api/transaction/remote-reference/')
  assert.equal(requests[1].options.headers.Authorization, 'Token production-token')
})

test('CamPay rejects invalid references and untrusted checkout URLs', async () => {
  configureCamPay()
  await assert.rejects(getCamPayTransaction('../other'), /reference is invalid/)
  globalThis.fetch = async (url) => String(url).endsWith('/api/token/')
    ? jsonResponse({ token: 'sandbox-token' })
    : jsonResponse({ link: 'https://attacker.example/pay', reference: 'remote-reference' })

  await assert.rejects(createCamPayPaymentLink({
    amount: 1,
    externalReference: 'icy-1-test',
    redirectUrl: 'https://shop.example/payment',
    failureRedirectUrl: 'https://shop.example/payment?status=failed',
    phone: '237690000000',
    name: 'Test Customer',
    email: 'customer@example.com',
  }), /valid hosted payment URL/)
})
