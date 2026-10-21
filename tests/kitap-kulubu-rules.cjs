const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");
const f = require("firebase/firestore"),
  fs = require("fs");
const {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  limit,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} = f;
(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.BOOK_RULES)
    throw Error("Yalnız emülatör ve açık kural dosyası ile çalışır.");
  const env = await initializeTestEnvironment({
    projectId: "demo-book-club",
    firestore: {
      host: "127.0.0.1",
      port: Number(process.env.FIRESTORE_EMULATOR_HOST.split(":")[1]),
      rules: fs.readFileSync(process.env.BOOK_RULES, "utf8"),
    },
  });
  let checks = 0;
  const ok = async (p) => {
      await assertSucceeds(p);
      checks++;
    },
    no = async (p) => {
      await assertFails(p);
      checks++;
    };
  const db = (id) =>
    env
      .authenticatedContext(id, {
        email: id === "admin" ? "emrahby@gmail.com" : id + "@example.test",
      })
      .firestore();
  try {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (c) => {
      const d = c.firestore();
      for (const [id, yakinlik, onaylandi] of [
        ["anne", "Anne", true],
        ["anne2", "Anne", true],
        ["baba", "Baba", true],
        ["unapproved", "Anne", false],
      ])
        await setDoc(doc(d, "veliler", id + "@example.test"), {
          yakinlik,
          onaylandi,
          ogrenciIds: ["child"],
        });
      for (const [id, rol, durum] of [
        ["pdr", "pdr", "aktif"],
        ["teacher", "ogretmen", "aktif"],
        ["inactive", "pdr", "pasif"],
      ])
        await setDoc(doc(d, "personeller", id + "@example.test"), {
          rol,
          durum,
        });
    });
    const book = {
      title: "Örnek Kitap",
      authors: "Yazar",
      leader: "PDR",
      date: "2026-10-22T19:00:00+03:00",
      status: "active",
      purpose: "Birlikte okuma",
      place: "Okul",
      updatedAt: serverTimestamp(),
    };
    await ok(setDoc(doc(db("pdr"), "kitapKulubu", "book"), book));
    for (const id of ["anne", "anne2", "teacher", "pdr", "admin"]) {
      await ok(getDoc(doc(db(id), "kitapKulubu", "book")));
      await ok(getDocs(query(collection(db(id), "kitapKulubu"), limit(100))));
    }
    for (const id of ["baba", "unapproved", "inactive", "outsider"]) {
      await no(getDoc(doc(db(id), "kitapKulubu", "book")));
      await no(getDocs(query(collection(db(id), "kitapKulubu"), limit(100))));
    }
    await no(
      getDoc(
        doc(env.unauthenticatedContext().firestore(), "kitapKulubu", "book"),
      ),
    );
    const membership = {
      uid: "anne",
      name: "Örnek Anne",
      status: "pending",
      updatedAt: serverTimestamp(),
    };
    await ok(setDoc(doc(db("anne"), "kitapKulubuUyeler", "anne"), membership));
    await no(
      setDoc(doc(db("baba"), "kitapKulubuUyeler", "baba"), {
        ...membership,
        uid: "baba",
      }),
    );
    await no(
      updateDoc(doc(db("anne"), "kitapKulubuUyeler", "anne"), {
        status: "approved",
        updatedAt: serverTimestamp(),
      }),
    );
    await no(getDoc(doc(db("anne2"), "kitapKulubuUyeler", "anne")));
    const post = {
      text: "Merhaba",
      image: "",
      authorUid: "anne",
      authorName: "Örnek Anne",
      createdAt: serverTimestamp(),
      deleted: false,
    };
    await no(
      setDoc(
        doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "pending"),
        post,
      ),
    );
    await ok(
      updateDoc(doc(db("pdr"), "kitapKulubuUyeler", "anne"), {
        status: "approved",
        updatedAt: serverTimestamp(),
      }),
    );
    await ok(
      setDoc(
        doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "one"),
        post,
      ),
    );
    await ok(
      getDocs(
        query(
          collection(db("anne2"), "kitapKulubu", "book", "paylasimlar"),
          limit(20),
        ),
      ),
    );
    await no(
      setDoc(
        doc(db("anne2"), "kitapKulubu", "book", "paylasimlar", "not-member"),
        { ...post, authorUid: "anne2" },
      ),
    );
    await ok(
      setDoc(
        doc(db("teacher"), "kitapKulubu", "book", "paylasimlar", "staff"),
        { ...post, authorUid: "teacher" },
      ),
    );
    await no(
      setDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "spoof"), {
        ...post,
        authorUid: "teacher",
      }),
    );
    await no(
      setDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "svg"), {
        ...post,
        image: "data:image/svg+xml,<svg/>",
      }),
    );
    await no(
      setDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "big"), {
        ...post,
        image: "data:image/jpeg;base64," + "A".repeat(280000),
      }),
    );
    await ok(
      setDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "photo"), {
        ...post,
        image: "data:image/jpeg;base64,/9j/AA==",
      }),
    );
    await no(
      setDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "empty"), {
        ...post,
        text: "",
      }),
    );
    await no(
      setDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "extra"), {
        ...post,
        email: "private@example.test",
      }),
    );
    await no(
      getDocs(collection(db("anne"), "kitapKulubu", "book", "paylasimlar")),
    );
    await no(
      updateDoc(doc(db("anne2"), "kitapKulubu", "book", "paylasimlar", "one"), {
        text: "",
        image: "",
        deleted: true,
      }),
    );
    await ok(
      updateDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "one"), {
        text: "",
        image: "",
        deleted: true,
      }),
    );
    await no(
      updateDoc(doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "one"), {
        text: "restore",
        deleted: false,
      }),
    );
    await no(deleteDoc(doc(db("admin"), "kitapKulubu", "book")));
    await no(
      setDoc(doc(db("admin"), "kitapKulubu", "invalid"), {
        ...book,
        unexpected: "not allowed",
      }),
    );
    await ok(
      updateDoc(doc(db("pdr"), "kitapKulubu", "book"), {
        status: "archived",
        updatedAt: serverTimestamp(),
      }),
    );
    await no(
      setDoc(
        doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "archive-write"),
        post,
      ),
    );
    await no(
      setDoc(
        doc(
          db("teacher"),
          "kitapKulubu",
          "book",
          "paylasimlar",
          "archive-staff",
        ),
        { ...post, authorUid: "teacher" },
      ),
    );
    await ok(
      getDocs(
        query(
          collection(db("anne2"), "kitapKulubu", "book", "paylasimlar"),
          limit(20),
        ),
      ),
    );
    await ok(
      updateDoc(doc(db("pdr"), "kitapKulubu", "book"), {
        status: "active",
        updatedAt: serverTimestamp(),
      }),
    );
    await ok(
      updateDoc(doc(db("pdr"), "kitapKulubuUyeler", "anne"), {
        status: "blocked",
        updatedAt: serverTimestamp(),
      }),
    );
    await no(
      setDoc(
        doc(db("anne"), "kitapKulubu", "book", "paylasimlar", "blocked-write"),
        post,
      ),
    );
    await no(setDoc(doc(db("anne"), "kitapKulubuUyeler", "anne"), membership));
    await ok(
      getDocs(query(collection(db("pdr"), "kitapKulubuUyeler"), limit(100))),
    );
    await no(
      getDocs(
        query(collection(db("teacher"), "kitapKulubuUyeler"), limit(100)),
      ),
    );
    // Account profile remapping: never fall back from an inactive/conflicting UID record.
    await env.withSecurityRulesDisabled(async (c) => {
      await setDoc(doc(c.firestore(), "kullaniciKimlikleri", "alias"), {
        aktif: true,
        primaryProfile: "veli",
        refEmail: "anne2@example.test",
      });
      await setDoc(doc(c.firestore(), "kullaniciKimlikleri", "disabled"), {
        aktif: false,
        primaryProfile: "veli",
        refEmail: "anne2@example.test",
      });
      await setDoc(doc(c.firestore(), "kullaniciKimlikleri", "conflict"), {
        aktif: true,
        primaryProfile: "veli",
        refEmail: "anne2@example.test",
        profiles: { veli: { refEmail: "baba@example.test" } },
      });
    });
    await ok(getDoc(doc(db("alias"), "kitapKulubu", "book")));
    await no(getDoc(doc(db("disabled"), "kitapKulubu", "book")));
    await no(getDoc(doc(db("conflict"), "kitapKulubu", "book")));
    const { createStore } = await import("../js/kitap-kulubu/store.mjs");
    for (const [id, read] of [
      ["anne2", true],
      ["baba", false],
      ["alias", true],
      ["disabled", false],
      ["teacher", true],
    ]) {
      const store = createStore(f, db(id), {
        currentUser: {
          uid: id,
          email: id + "@example.test",
          displayName: "Örnek Kullanıcı",
        },
      });
      const access = await store.identity();
      require("node:assert/strict").equal(access.read, read);
      checks++;
    }
    const teacherStore = createStore(f, db("teacher"), {
      currentUser: {
        uid: "teacher",
        email: "teacher@example.test",
        displayName: "Örnek Öğretmen",
      },
    });
    await ok(teacherStore.post("book", "retry-safe", "Tek paylaşım", ""));
    await ok(teacherStore.post("book", "retry-safe", "Tek paylaşım", ""));
    console.log(`PASS ${checks} Firestore izin ve veri doğrulaması`);
  } finally {
    await env.cleanup();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
