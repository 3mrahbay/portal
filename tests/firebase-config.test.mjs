import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  firebaseConfigForHost,
  firebaseEnvironmentForHost
} from "../js/firebase-config.js";

test("staging alan adları yalnız staging Firebase projesini seçer", () => {
  for (const host of [
    "bcka-site-staging.web.app",
    "bcka-site-staging.firebaseapp.com"
  ]) {
    assert.equal(firebaseEnvironmentForHost(host), "staging");
    assert.equal(firebaseConfigForHost(host).projectId, "bcka-site-staging");
  }
});

test("canlı ve özel portal alan adları canlı Firebase projesinde kalır", () => {
  for (const host of [
    "portal.bircicekkoleji.com",
    "3mrahbay.github.io",
    "bcka-site.web.app"
  ]) {
    assert.equal(firebaseEnvironmentForHost(host), "production");
    assert.equal(firebaseConfigForHost(host).projectId, "bcka-site");
  }
});

test("alan adı karşılaştırması büyük harf ve boşluklardan etkilenmez", () => {
  assert.equal(
    firebaseConfigForHost(" BCKA-SITE-STAGING.WEB.APP ").projectId,
    "bcka-site-staging"
  );
});

test("e-posta şifre girişi yalnız staging ortamında etkinleşir", async () => {
  const portal = await readFile(new URL("../index.html", import.meta.url), "utf8");
  assert.match(portal, /id="stagingEmailLogin"/);
  assert.match(portal, /firebaseEnvironment !== "staging"/);
  assert.match(portal, /signInWithEmailAndPassword/);
  assert.doesNotMatch(portal, /Bcka-Demo-IK/);
});
