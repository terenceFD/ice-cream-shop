import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "ice-cream-cake-count-"));
const originalBackend = process.env.DATABASE_BACKEND;
const originalPath = process.env.DATABASE_PATH;
process.env.DATABASE_BACKEND = "sqlite";
process.env.DATABASE_PATH = join(directory, "cake-count.sqlite");

const {
  createCakeRequest,
  countNewCakeRequests,
  database,
  listCakeRequests,
  setCakeRequestStatus,
} = await import("./database.js");

after(() => {
  database.close();
  rmSync(directory, { recursive: true, force: true });
  if (originalBackend === undefined) delete process.env.DATABASE_BACKEND;
  else process.env.DATABASE_BACKEND = originalBackend;
  if (originalPath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalPath;
});

const makeRequest = (storeId, name) =>
  createCakeRequest({
    customerId: null,
    storeId,
    customerName: name,
    customerEmail: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
    customerPhone: "000000000",
    size: "Medium",
    flavor: "Vanilla",
    message: "",
    toppings: [],
    pickupDate: "2026-12-01",
  });

test("countNewCakeRequests matches the list, and is not capped by its LIMIT 200", async () => {
  // Two stores in different towns: the first seeds all sit in Douala, so the town
  // filter can only be told apart from the store filter on another town.
  const stores = database
    .prepare("SELECT id, town FROM stores ORDER BY id")
    .all();
  const firstStore = stores[0];
  const otherTown = stores.find((store) => store.town !== firstStore.town);
  assert.ok(
    otherTown,
    "test database should seed stores in more than one town",
  );

  // 205 new requests: more than listCakeRequests()'s LIMIT, so a browser-side
  // .filter().length badge would have reported 200 at most.
  for (let index = 0; index < 205; index += 1) {
    await makeRequest(firstStore.id, `Cake ${index}`);
  }
  await makeRequest(otherTown.id, "Other Town Cake");

  assert.equal(await countNewCakeRequests(), 206);
  assert.equal(await countNewCakeRequests(firstStore.id), 205);
  assert.equal(await countNewCakeRequests(null, otherTown.town), 1);
  assert.equal(
    (await listCakeRequests(firstStore.id)).length,
    200,
    "the list itself is still capped at 200",
  );

  // Handling one drops the count, and it still agrees with the list's own status field.
  const first = (await listCakeRequests(firstStore.id))[0];
  await setCakeRequestStatus(first.id, "contacted", firstStore.id);
  assert.equal(await countNewCakeRequests(firstStore.id), 204);
  const stillNew = (await listCakeRequests(firstStore.id)).filter(
    (request) => request.status === "new",
  ).length;
  // The list only returns 200 rows, so it can show 199 new there; the count query is
  // the one that stays exact — this is the bug the old browser-side filter had.
  assert.equal(stillNew, 199);
  assert.equal(await countNewCakeRequests(firstStore.id), 204);
});
