import { readFileSync, writeFileSync } from "node:fs";
export function prepare(source, snippet) {
  if (source.includes("function kkAnne()"))
    throw Error("Kitap Kulübü kuralları zaten mevcut.");
  const marker = "    // ========== VARSAYILAN ==========";
  if (source.split(marker).length !== 2)
    throw Error("Varsayılan kural sınırı değişmiş.");
  const fallback =
    /match \/\{collection\}\/\{document=\*\*\} \{\s*allow read, write: if /;
  if (!fallback.test(source))
    throw Error("Varsayılan joker izin doğrulanamadı.");
  return source
    .replace(
      fallback,
      (m) => m + "!(collection in ['kitapKulubu','kitapKulubuUyeler']) && ",
    )
    .replace(marker, () => snippet + "\n" + marker);
}
if (process.argv[2])
  writeFileSync(
    process.argv[3],
    prepare(
      readFileSync(process.argv[2], "utf8"),
      readFileSync(
        new URL("./kitap-kulubu.rules.snippet", import.meta.url),
        "utf8",
      ),
    ),
  );
