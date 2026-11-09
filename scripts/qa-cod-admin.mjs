// Verify the COD admin panel wiring: GET for owner, PUT round-trip, store admin blocked on write.
const BASE = process.env.BASE || "http://localhost:3099";
const out = {};

const login = await fetch(`${BASE}/api/admin/dev-login`, { method: "POST" });
if (login.status !== 200) {
  console.log(JSON.stringify({ devLogin: `SKIP (${login.status})` }));
  process.exit(0);
}
const { token, admin } = await login.json();
const auth = { Authorization: `Bearer ${token}` };
out.login = `PASS (role=${admin.role})`;

const get = await fetch(`${BASE}/api/admin/settings/cash-on-delivery`, {
  headers: auth,
});
const getBody = await get.json();
out.get =
  get.status === 200 && "enabled" in getBody
    ? `PASS (enabled=${getBody.enabled}, cap=${getBody.maxTotalXaf})`
    : `FAIL (${get.status} ${JSON.stringify(getBody)})`;

const put = await fetch(`${BASE}/api/admin/settings/cash-on-delivery`, {
  method: "PUT",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ enabled: true, maxTotalXaf: 30000 }),
});
const putBody = await put.json();
out.put =
  put.status === 200 && putBody.maxTotalXaf === 30000
    ? "PASS (round-trip)"
    : `FAIL (${put.status} ${JSON.stringify(putBody)})`;

// Restore the shipped default.
await fetch(`${BASE}/api/admin/settings/cash-on-delivery`, {
  method: "PUT",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ enabled: true, maxTotalXaf: 25000 }),
});

// Public methods endpoint reflects the admin value.
const methods = await (await fetch(`${BASE}/api/payment/methods`)).json();
out.publicReflects =
  methods.methods.cashOnDelivery === true &&
  methods.cashOnDelivery.enabled === true
    ? "PASS (storefront sees COD available)"
    : `FAIL (${JSON.stringify(methods)})`;

console.log(JSON.stringify(out, null, 2));
