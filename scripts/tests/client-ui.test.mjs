import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countFraction,
  createMonotonicPercent,
  documentStateFraction,
  loadPercent,
  weightedFraction,
} from "../../src/lib/navigation/load-progress.ts";
import {
  reservationKeyDelta,
  showReservationArrows,
  stepReservationIndex,
} from "../../src/lib/reservations/hero-carousel.ts";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

export default function suite(test) {
  test("preloader: document readyState maps to a load fraction", () => {
    assert.equal(documentStateFraction("loading"), 0);
    assert.equal(documentStateFraction("interactive"), 0.5);
    assert.equal(documentStateFraction("complete"), 1);
  });

  test("preloader: tracked media counts become a clamped fraction", () => {
    assert.equal(countFraction(0, 0), 1);
    assert.equal(countFraction(1, 4), 0.25);
    assert.equal(countFraction(5, 4), 1);
    assert.equal(countFraction(-1, 4), 0);
  });

  test("preloader: weighted tasks combine into one fraction", () => {
    assert.equal(weightedFraction([]), 0);
    assert.equal(
      weightedFraction([
        { weight: 1, fraction: 1 },
        { weight: 1, fraction: 0 },
        { weight: 2, fraction: 0.5 },
      ]),
      0.5,
    );
    assert.equal(weightedFraction([{ weight: 0, fraction: 1 }]), 0);
  });

  test("preloader: 100% is only shown once everything settled", () => {
    assert.equal(loadPercent(0, false), 0);
    assert.equal(loadPercent(0.426, false), 42);
    assert.equal(loadPercent(1, false), 99);
    assert.equal(loadPercent(Number.NaN, false), 0);
    assert.equal(loadPercent(0.1, true), 100);
  });

  test("preloader: percentage never moves backwards and ends at 100", () => {
    const seen = [];
    const meter = createMonotonicPercent((percent) => seen.push(percent));
    meter.update(0);
    meter.update(0.2);
    meter.update(0.1);
    meter.update(0.2);
    meter.update(1);
    meter.complete();
    meter.complete();
    meter.update(0.5);
    assert.deepEqual(seen, [0, 20, 99, 100]);
    assert.equal(meter.current(), 100);
  });

  test("preloader: the spinner shows the percentage and holds 100% before lifting", () => {
    const preloader = source("src/components/ui/experience-preloader.tsx");
    assert.match(preloader, /\{value\}%/);
    const ready = source("src/lib/navigation/wait-until-page-ready.ts");
    assert.match(ready, /createMonotonicPercent/);
    assert.match(ready, /progress\.complete\(\);[\s\S]*COMPLETE_HOLD_MS/);
    // Optional (poster) hero videos must keep going through videoBlocksBoot.
    assert.match(ready, /videoBlocksBoot\(readBootVideo\(video\)\)/);
  });

  test("home reservations: arrows only when there is another reservation", () => {
    assert.equal(showReservationArrows(0), false);
    assert.equal(showReservationArrows(1), false);
    assert.equal(showReservationArrows(2), true);
  });

  test("home reservations: stepping wraps in both directions", () => {
    assert.equal(stepReservationIndex(0, 1, 3), 1);
    assert.equal(stepReservationIndex(2, 1, 3), 0);
    assert.equal(stepReservationIndex(0, -1, 3), 2);
    assert.equal(stepReservationIndex(5, 0, 3), 2);
    assert.equal(stepReservationIndex(4, 1, 0), 0);
  });

  test("home reservations: arrow keys step the carousel", () => {
    assert.equal(reservationKeyDelta("ArrowLeft"), -1);
    assert.equal(reservationKeyDelta("ArrowRight"), 1);
    assert.equal(reservationKeyDelta("Enter"), 0);
  });

  test("home reservations: carousel renders Portuguese arrow buttons", () => {
    const carousel = source("src/components/reservations/active-hero-carousel.tsx");
    assert.match(carousel, /showReservationArrows\(count\)/);
    assert.match(carousel, /aria-label="Reserva anterior"/);
    assert.match(carousel, /aria-label="Próxima reserva"/);
    assert.match(carousel, /onKeyDown=\{onKeyDown\}/);
  });
}
