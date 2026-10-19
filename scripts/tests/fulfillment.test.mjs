import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  FULFILLMENT_STATUSES,
  canMoveFulfillment,
  filterFulfillment,
  formatFulfillmentAddress,
  fulfillmentCounts,
  fulfillmentStatusLabel,
  hasOpenFulfillment,
  initialFulfillmentStatus,
  nextFulfillmentAction,
  parseFulfillmentAddress,
} from "../../src/lib/pickup/fulfillment.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

export default function suite(test) {
  test("every pickup status the database allows has a client label", () => {
    const migration = source("supabase/migrations/021_platform_features.sql");
    const allowed = /status in \(([^)]+)\)/.exec(migration.slice(migration.indexOf("pickup_requests")))[1];
    const dbStatuses = [...allowed.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    assert.deepEqual([...FULFILLMENT_STATUSES].sort(), [...dbStatuses].sort());
    for (const status of FULFILLMENT_STATUSES) {
      for (const mode of ["store", "shipping"]) {
        assert.notEqual(fulfillmentStatusLabel(status, mode), status);
      }
    }
    assert.equal(fulfillmentStatusLabel("completed", "shipping"), "Entregue");
    assert.equal(fulfillmentStatusLabel("completed", "store"), "Retirado");
    assert.equal(fulfillmentStatusLabel("in_transit", "shipping"), "Enviado");
  });

  test("a store pickup is not ready at the store before the team prepares it", () => {
    assert.equal(initialFulfillmentStatus("store"), "pending");
    assert.equal(initialFulfillmentStatus("shipping"), "pending");
    assert.equal(
      source("src/app/api/reservations/[id]/pickup/route.ts").includes('"ready_pickup"'),
      false,
    );
  });

  test("pickup and delivery follow their own steps and can be cancelled while open", () => {
    assert.deepEqual(nextFulfillmentAction("pending", "store"), { to: "approved", label: "Iniciar preparo" });
    assert.equal(nextFulfillmentAction("approved", "store").to, "ready_pickup");
    assert.equal(nextFulfillmentAction("ready_pickup", "store").to, "completed");
    assert.equal(nextFulfillmentAction("approved", "shipping").to, "in_transit");
    assert.equal(nextFulfillmentAction("in_transit", "shipping").to, "completed");
    assert.equal(nextFulfillmentAction("completed", "shipping"), null);

    assert.equal(canMoveFulfillment("pending", "completed", "store"), false);
    assert.equal(canMoveFulfillment("approved", "in_transit", "store"), false);
    assert.equal(canMoveFulfillment("approved", "ready_pickup", "store"), true);
    assert.equal(canMoveFulfillment("in_transit", "cancelled", "shipping"), true);
    assert.equal(canMoveFulfillment("completed", "cancelled", "shipping"), false);
  });

  test("a reservation cannot open a second pickup while one is in progress", () => {
    assert.equal(hasOpenFulfillment([{ status: "completed" }, { status: "cancelled" }]), false);
    assert.equal(hasOpenFulfillment([{ status: "cancelled" }, { status: "ready_pickup" }]), true);
    assert.match(source("src/app/api/reservations/[id]/pickup/route.ts"), /hasOpenFulfillment\(/);
  });

  test("the shipping address is formatted for the label and skips empty parts", () => {
    const address = parseFulfillmentAddress({
      street: "Rua Joaquim Floriano",
      number: "466",
      city: "São Paulo",
      state: "sp",
      zip: "04534002",
    });
    assert.equal(formatFulfillmentAddress(address), "Rua Joaquim Floriano, 466 · São Paulo/SP · CEP 04534-002");
    assert.equal(parseFulfillmentAddress({ street: " ", city: "" }), null);
    assert.equal(formatFulfillmentAddress(null), "");
  });

  test("the Retirada/Envio list filters by status, mode, store and search", () => {
    const rows = [
      { id: "a", mode: "store", status: "pending", storeId: "itaim", search: ["Ana Cliente", "+55 11 90000-0001"] },
      { id: "b", mode: "shipping", status: "in_transit", storeId: "sc", search: ["Bruno Lima", "AB123BR"] },
      { id: "c", mode: "store", status: "completed", storeId: "itaim", search: ["Carla Souza"] },
    ];
    const ids = (input) => filterFulfillment(rows, input).map((row) => row.id);
    assert.deepEqual(ids({ filter: "open", mode: "all", storeId: "", query: "" }), ["a", "b"]);
    assert.deepEqual(ids({ filter: "open", mode: "shipping", storeId: "", query: "" }), ["b"]);
    assert.deepEqual(ids({ filter: "all", mode: "all", storeId: "itaim", query: "" }), ["a", "c"]);
    assert.deepEqual(ids({ filter: "all", mode: "all", storeId: "", query: "carla" }), ["c"]);
    assert.deepEqual(ids({ filter: "all", mode: "all", storeId: "", query: "11 90000 0001" }), ["a"]);
    assert.deepEqual(fulfillmentCounts(rows), {
      open: 2,
      store: 1,
      shipping: 1,
      completed: 1,
      cancelled: 0,
      all: 3,
    });
  });

  test("Retirada/Envio is in the admin menu and opens the client screen", () => {
    assert.match(source("src/components/panels/panel-chrome-client.tsx"), /\/admin\/retirada-envio/);
    assert.match(source("src/components/admin/fulfillment-panel.tsx"), /<ClientDetailView/);
  });
}
