import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { mapOpenWeather, type ExternalWeather } from "@/lib/goals/journey";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, source: "fallback" }, { status: 401 });
  }

  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (!key) {
    return NextResponse.json({ ok: true, source: "fallback" });
  }

  const url = new URL(request.url);
  const lat = readCoord(url.searchParams.get("lat"), -90, 90);
  const lon = readCoord(url.searchParams.get("lon"), -180, 180);
  if (lat == null || lon == null) {
    return NextResponse.json({ ok: true, source: "needs_location" });
  }

  try {
    const endpoint = new URL("https://api.openweathermap.org/data/2.5/weather");
    endpoint.searchParams.set("lat", String(lat));
    endpoint.searchParams.set("lon", String(lon));
    endpoint.searchParams.set("appid", key);
    endpoint.searchParams.set("units", "metric");
    const response = await fetch(endpoint, { next: { revalidate: 600 } });
    if (!response.ok) {
      return NextResponse.json({ ok: true, source: "fallback" });
    }
    const body = (await response.json()) as {
      weather?: { id?: number }[];
      wind?: { speed?: number };
    };
    const code = body.weather?.[0]?.id;
    if (typeof code !== "number") {
      return NextResponse.json({ ok: true, source: "fallback" });
    }
    const kind: ExternalWeather = mapOpenWeather({
      code,
      windSpeed: typeof body.wind?.speed === "number" ? body.wind.speed : 0,
    });
    return NextResponse.json({ ok: true, source: "openweather", kind });
  } catch {
    return NextResponse.json({ ok: true, source: "fallback" });
  }
}

function readCoord(value: string | null, min: number, max: number): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}
