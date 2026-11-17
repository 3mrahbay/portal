import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = await readFile(new URL("../moduller/ogretmen-anasayfa.js", import.meta.url), "utf8");
const {kitapKulubuKisayollariKur} = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);

function fixture({teacher = true} = {}) {
  const quick = [], side = [];
  const node = () => ({
    attrs: {}, hidden: false, className: "", href: "", innerHTML: "",
    setAttribute(k, v) { this.attrs[k] = v; }
  });
  const grid = {
    querySelector: () => quick.find(x => Object.hasOwn(x.attrs, "data-bk-teacher-quick")) || null,
    appendChild: x => quick.push(x)
  };
  const page = { querySelector: s => s === ".ca-qbtn" ? {parentElement: grid} : null };
  const student = { closest: s => s === ".ca-page" ? page : null };
  const target = { insertAdjacentElement: (pos, x) => {
    assert.equal(pos, "afterend"); side.push(x);
  }};
  const menu = { querySelector: s =>
    s === "[data-bk-teacher-menu]" ? side[0] || null :
    s.includes("gorusmeNotlari") ? target : null
  };
  const document = {
    getElementById: id => id === "ogrHomeSinif" && teacher ? student :
      id === "modulBar" ? menu : null,
    createElement: node
  };
  return {document, quick, side};
}

test("öğretmen özet ve yan menüsünde mevcut kulüp için yetki-korumalı giriş", () => {
  const f = fixture(), previous = globalThis.document;
  globalThis.document = f.document;
  try {
    kitapKulubuKisayollariKur();
    kitapKulubuKisayollariKur(); // tekrar render, çift bağlantı oluşturmamalı
  } finally { globalThis.document = previous; }
  assert.equal(f.quick.length, 1);
  assert.equal(f.side.length, 1);
  for (const link of [...f.quick, ...f.side]) {
    assert.equal(link.href, "kitap-kulubu.html");
    assert.equal(link.hidden, true);
    assert(Object.hasOwn(link.attrs, "data-bk-host"));
    assert.match(link.innerHTML, /Kitap Kulübü/);
    assert.doesNotMatch(link.href, /yonetim/);
  }
  assert.match(source, /\.oak-kitap-giris\[hidden\], \.oak-kitap-menu\[hidden\] \{ display:none !important; \}/);
});

test("öğretmen özet ekranı yoksa menüye öğretmen bağlantısı eklenmez", () => {
  const f = fixture({teacher:false}), previous = globalThis.document;
  globalThis.document = f.document;
  try { kitapKulubuKisayollariKur(); } finally { globalThis.document = previous; }
  assert.equal(f.quick.length, 0);
  assert.equal(f.side.length, 0);
});
