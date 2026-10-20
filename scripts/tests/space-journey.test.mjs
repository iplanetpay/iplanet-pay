import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import {
  SPACE_LABEL,
  SPACE_LANDSCAPE,
  SPACE_PORTRAIT,
  buildRoute,
  nebulaTint,
  planetRadius,
  rocketDuration,
  rocketProfile,
  sampleRocket,
  spaceCondition,
} from "../../src/lib/goals/climb/space-journey.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../../${path}`, import.meta.url));

export default function suite(test) {
  test("goal health picks the space condition like the iOS app", () => {
    assert.equal(spaceCondition("on_track"), "calm");
    assert.equal(spaceCondition("done"), "calm");
    assert.equal(spaceCondition("near_late"), "asteroid_field");
    assert.equal(spaceCondition("late"), "meteor_storm");
    assert.equal(SPACE_LABEL.calm, "Espaço calmo");
    assert.equal(SPACE_LABEL.asteroid_field, "Campo de asteroides");
    assert.equal(SPACE_LABEL.meteor_storm, "Chuva de meteoros");
  });

  test("the rocket is fastest on time and slower with wobble and turbulence when late", () => {
    const on = rocketProfile("on_track");
    const near = rocketProfile("near_late");
    const late = rocketProfile("late");
    assert.ok(on.pace > near.pace && near.pace > late.pace);
    assert.equal(on.wobble, 0);
    assert.ok(near.wobble > 0 && late.turbulence > near.turbulence);
    assert.ok(rocketDuration(late) > rocketDuration(on));
  });

  test("the rocket cruises at constant speed, eases to the paid percent and the flame follows speed", () => {
    const p = rocketProfile("on_track");
    const a = sampleRocket(p, 0.6, 0.5);
    const b = sampleRocket(p, 0.6, 1.5);
    assert.ok(Math.abs(a.speed - b.speed) < 1e-9, "constant cruise speed");
    assert.ok(Math.abs(b.progress - 3 * a.progress) < 1e-9);
    const easing = sampleRocket(p, 0.6, 2.4 + 0.6);
    assert.ok(easing.speed < a.speed && easing.flame < a.flame);
    assert.ok(easing.progress > 0.6 * 0.82 && easing.progress < 0.6);
    const end = sampleRocket(p, 0.6, rocketDuration(p) + 0.01);
    assert.deepEqual(end, { progress: 0.6, speed: 0, flame: 0 });
    // continuidade na troca cruzeiro → parada
    const before = sampleRocket(p, 1, 2.4 - 1e-6);
    const after = sampleRocket(p, 1, 2.4 + 1e-6);
    assert.ok(Math.abs(before.progress - after.progress) < 1e-4);
    assert.ok(Math.abs(before.speed - after.speed) < 1e-3);
    assert.equal(sampleRocket(p, 0, 1).progress, 0);
    assert.equal(sampleRocket(p, 1.4, 99).progress, 1);
  });

  test("the route goes from Earth to the planet edge with one station per aporte except the last", () => {
    for (const size of [SPACE_PORTRAIT, SPACE_LANDSCAPE]) {
      const route = buildRoute(size);
      const start = route.pointAt(0);
      const end = route.pointAt(1);
      assert.ok(Math.hypot(start.x - route.earth.x, start.y - route.earth.y) < 0.01);
      const toCenter = Math.hypot(end.x - route.planet.x, end.y - route.planet.y);
      assert.ok(Math.abs(toCenter - planetRadius(size) * 1.25) < 0.5, "stops at the planet edge");
      assert.ok(end.y < start.y, "travels upward");
      assert.equal(route.stations(5).length, 4);
      assert.deepEqual(route.stations(1), []);
      const half = route.pointAt(0.5);
      const mid = route.stations(2)[0];
      assert.ok(Math.abs(half.x - mid.x) < 1e-9);
      assert.match(route.pathTo(0.3), /^M[\d.]+,[\d.]+( L[\d.]+,[\d.]+)+$/);
    }
  });

  test("the nebula tint follows the local hour", () => {
    assert.equal(nebulaTint(10).period, "dia");
    assert.equal(nebulaTint(18).period, "entardecer");
    assert.equal(nebulaTint(23).period, "noite");
    assert.equal(nebulaTint(3).period, "noite");
    assert.equal(nebulaTint(-1).period, "noite");
  });

  test("the metas scene is the rocket trip and no longer calls weather services", () => {
    assert.equal(exists("src/components/goals/climb/mountain.tsx"), false);
    assert.equal(exists("src/lib/goals/climb/weather.ts"), false);
    assert.equal(exists("src/app/api/weather/route.ts"), false);
    const scene = source("src/components/goals/climb/metas-climb.tsx");
    assert.match(scene, /<RocketScene/);
    assert.equal(/open-meteo|geolocation/i.test(scene), false);
    assert.match(scene, /Meta conquistada/);
    assert.match(scene, /Prêmio conquistado/);
    assert.match(source("src/components/goals/climb/iplanet-planet.tsx"), /#1B2350/);
  });
}
