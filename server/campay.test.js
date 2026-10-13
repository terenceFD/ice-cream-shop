import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createCamPayPaymentLink,
  isCamPayMobileMoneyEnabled,
} from './campay.js'

test('CamPay stays disabled until enabled with both merchant credentials', () => {
  const original = {
    enabled: process.env.CAMPAY_MOBILE_MONEY_ENABLED,
    username: process.env.CAMPAY_APP_USERNAME,
    password: process.env.CAMPAY_APP_PASSWORD,
  }
  try {
    process.env.CAMPAY_MOBILE_MONEY_ENABLED = 'true'
    process.env.CAMPAY_APP_USERNAME = 'test-user'
    delete process.env.CAMPAY_APP_PASSWORD
    assert.equal(isCamPayMobileMoneyEnabled(), false)

    process.env.CAMPAY_APP_PASSWORD = 'test-password'
    assert.equal(isCamPayMobileMoneyEnabled(), true)
  } finally {
    if (original.enabled === undefined) delete process.env.CAMPAY_MOBILE_MONEY_ENABLED
    else process.env.CAMPAY_MOBILE_MONEY_ENABLED = original.enabled
    if (original.username === undefined) delete process.env.CAMPAY_APP_USERNAME
    else process.env.CAMPAY_APP_USERNAME = original.username
    if (original.password === undefined) delete process.env.CAMPAY_APP_PASSWORD
    else process.env.CAMPAY_APP_PASSWORD = original.password
  }
})

test('CamPay creates a hosted XAF Mobile Money link and returns its provider reference', async () => {
  const original = {
    environment: process.env.CAMPAY_ENVIRONMENT,
    username: process.env.CAMPAY_APP_USERNAME,
    password: process.env.CAMPAY_APP_PASSWORD,
    fetch: globalThis.fetch,
  }
  const requests = []
  process.env.CAMPAY_ENVIRONMENT = 'DEV'
  process.env.CAMPAY_APP_USERNAME = 'test-user'
  process.env.CAMPAY_APP_PASSWORD = 'test-password'
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options })
    return Response.json(requests.length === 1
      ? { token: 'test-token' }
      : { link: 'https://demo.campay.net/checkout/test', reference: 'remote-123' })
  }

  try {
    const checkout = await createCamPayPaymentLink({
      amount: 2500,
      externalReference: 'icy-12-order',
      redirectUrl: 'https://shop.example/payment?provider=campay',
      failureRedirectUrl: 'https://shop.example/payment?status=failed',
      phone: '237677123456',
      name: 'Test Customer',
      email: 'customer@example.com',
    })

    assert.deepEqual(checkout, {
      url: 'https://demo.campay.net/checkout/test',
      reference: 'remote-123',
    })
    assert.equal(requests[0].url, 'https://demo.campay.net/api/token/')
    assert.equal(requests[1].url, 'https://demo.campay.net/api/get_payment_link/')
    assert.equal(requests[1].options.headers.Authorization, 'Token test-token')
    assert.deepEqual(JSON.parse(requests[1].options.body), {
      amount: '2500',
      currency: 'XAF',
      description: 'Ice Cream Shop order icy-12-order',
      external_reference: 'icy-12-order',
      redirect_url: 'https://shop.example/payment?provider=campay',
      failure_redirect_url: 'https://shop.example/payment?status=failed',
      from: '237677123456',
      first_name: 'Test',
      last_name: 'Customer',
      email: 'customer@example.com',
      payment_options: 'MOMO',
    })
  } finally {
    globalThis.fetch = original.fetch
    if (original.environment === undefined) delete process.env.CAMPAY_ENVIRONMENT
    else process.env.CAMPAY_ENVIRONMENT = original.environment
    if (original.username === undefined) delete process.env.CAMPAY_APP_USERNAME
    else process.env.CAMPAY_APP_USERNAME = original.username
    if (original.password === undefined) delete process.env.CAMPAY_APP_PASSWORD
    else process.env.CAMPAY_APP_PASSWORD = original.password
  }
})

test('CamPay rejects checkout URLs outside its hosted payment domains', async () => {
  const original = {
    environment: process.env.CAMPAY_ENVIRONMENT,
    username: process.env.CAMPAY_APP_USERNAME,
    password: process.env.CAMPAY_APP_PASSWORD,
    fetch: globalThis.fetch,
  }
  process.env.CAMPAY_ENVIRONMENT = 'DEV'
  process.env.CAMPAY_APP_USERNAME = 'test-user'
  process.env.CAMPAY_APP_PASSWORD = 'test-password'
  let requestCount = 0
  globalThis.fetch = async () => Response.json(++requestCount === 1
    ? { token: 'test-token' }
    : { link: 'https://attacker.example/checkout', reference: 'remote-123' })

  try {
    await assert.rejects(
      createCamPayPaymentLink({
        amount: 2500,
        externalReference: 'icy-12-order',
        redirectUrl: 'https://shop.example/payment',
        failureRedirectUrl: 'https://shop.example/payment?status=failed',
        phone: '237677123456',
        name: 'Test Customer',
        email: 'customer@example.com',
      }),
      /valid hosted payment URL/,
    )
  } finally {
    globalThis.fetch = original.fetch
    if (original.environment === undefined) delete process.env.CAMPAY_ENVIRONMENT
    else process.env.CAMPAY_ENVIRONMENT = original.environment
    if (original.username === undefined) delete process.env.CAMPAY_APP_USERNAME
    else process.env.CAMPAY_APP_USERNAME = original.username
    if (original.password === undefined) delete process.env.CAMPAY_APP_PASSWORD
    else process.env.CAMPAY_APP_PASSWORD = original.password
  }
})
