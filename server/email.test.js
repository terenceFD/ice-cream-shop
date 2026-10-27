import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { buildBrandedEmail } from './email.js'

test('brands email headers, html and text with the site name and logo', () => {
  const email = buildBrandedEmail({
    from: 'orders@example.test',
    subject: 'Order update',
    text: 'Your order is ready.',
  })

  assert.equal(email.from, 'Cold Stone Creamery <orders@example.test>')
  assert.match(email.text, /Your order is ready\.\n\nCold Stone Creamery$/)
  assert.match(email.html, /src="cid:cold-stone-logo"/)
  assert.match(email.html, /alt="Cold Stone Creamery"/)
  assert.match(email.html, /<strong[^>]*>Cold Stone Creamery<\/strong>/)
  assert.equal(email.attachments.length, 1)
  assert.equal(email.attachments[0].cid, 'cold-stone-logo')
  assert.equal(existsSync(email.attachments[0].path), true)
})

test('wraps existing html and escapes text-only email bodies', () => {
  const htmlEmail = buildBrandedEmail({
    from: 'Cold Stone Creamery <orders@example.test>',
    text: 'A verification code.',
    html: '<h1>Verify your email</h1>',
    attachments: [{ filename: 'receipt.pdf', content: 'receipt' }],
  })
  assert.equal((htmlEmail.from.match(/Cold Stone Creamery/g) || []).length, 1)
  assert.match(htmlEmail.html, /<h1>Verify your email<\/h1>/)
  assert.equal(htmlEmail.attachments.length, 2)

  const textEmail = buildBrandedEmail({
    from: 'orders@example.test',
    text: '<script>alert("no")</script>',
  })
  assert.match(textEmail.html, /&lt;script&gt;alert\(&quot;no&quot;\)&lt;\/script&gt;/)
  assert.doesNotMatch(textEmail.html, /<script>/)
})
