import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBearerAuthorization } from "../../src/lib/auth/bearer.ts";
import { magicLinkRedirect, nativeAuthFields } from "../../src/lib/auth/native-client.ts";

const source = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

export default function suite(test) {
  test("a bearer user token is a JWT and other Authorization values stay on cookies", () => {
    const jwt = "aaa.bbb.ccc";
    assert.equal(parseBearerAuthorization(`Bearer ${jwt}`), jwt);
    assert.equal(parseBearerAuthorization(`bearer ${jwt}`), jwt);
    assert.equal(parseBearerAuthorization(`  Bearer   ${jwt}  `), jwt);
    assert.equal(parseBearerAuthorization(null), null);
    assert.equal(parseBearerAuthorization(""), null);
    assert.equal(parseBearerAuthorization("Bearer"), null);
    assert.equal(parseBearerAuthorization("Bearer not-a-jwt"), null);
    assert.equal(parseBearerAuthorization("Bearer one.two"), null);
    assert.equal(parseBearerAuthorization("Bearer .bbb.ccc"), null);
    assert.equal(parseBearerAuthorization("Basic aaa.bbb.ccc"), null);
  });

  test("the server client validates the bearer JWT and keeps the cookie path", () => {
    const server = source("src/lib/supabase/server.ts");
    const session = source("src/lib/auth/session.ts");
    assert.match(server, /parseBearerAuthorization/);
    assert.match(server, /Authorization: `Bearer \$\{accessToken\}`/);
    assert.match(server, /if \(accessToken\) return \[\]/);
    assert.match(session, /supabase\.auth\.getUser\(accessToken\)/);
    assert.match(session, /supabase\.auth\.getUser\(\)/);
    assert.equal(server.includes("SUPABASE_SERVICE_ROLE"), false);
  });

  test("native clients receive session tokens and the website response does not", () => {
    const session = { access_token: "a.b.c", refresh_token: "refresh", expires_at: 10 };
    assert.deepEqual(nativeAuthFields("native", session), {
      access_token: "a.b.c",
      refresh_token: "refresh",
      expires_at: 10,
    });
    assert.deepEqual(nativeAuthFields(undefined, session), {});
    assert.deepEqual(nativeAuthFields("native", null), {});
    assert.equal(
      source("src/app/api/auth/login/route.ts").includes("...nativeAuthFields(body.client, data.session)"),
      true,
    );
  });

  test("magic link keeps the website path unless the app callback or same origin is requested", () => {
    assert.equal(magicLinkRedirect("https://www.iplanetpay.com.br", undefined), "https://www.iplanetpay.com.br/app");
    assert.equal(
      magicLinkRedirect("https://www.iplanetpay.com.br/", "iplanetpay://auth-callback"),
      "iplanetpay://auth-callback",
    );
    assert.equal(
      magicLinkRedirect("https://www.iplanetpay.com.br", "https://www.iplanetpay.com.br/auth/callback"),
      "https://www.iplanetpay.com.br/auth/callback",
    );
    assert.equal(
      magicLinkRedirect("https://www.iplanetpay.com.br", "https://evil.example/app"),
      "https://www.iplanetpay.com.br/app",
    );
    assert.equal(magicLinkRedirect("https://www.iplanetpay.com.br", "javascript:alert(1)"), "https://www.iplanetpay.com.br/app");
  });
}
