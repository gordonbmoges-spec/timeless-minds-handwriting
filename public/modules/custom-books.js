const STORAGE_KEY = "answering-library-custom-books-v1";
const TONES = new Set(["jade", "wine", "midnight", "obsidian", "parchment", "silver"]);

export function createCustomBookStore(storage = globalThis.localStorage) {
  return {
    load() {
      try {
        const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "[]");
        return Array.isArray(parsed) ? parsed.map(normalizeBook).filter(Boolean).slice(0, 18) : [];
      } catch {
        return [];
      }
    },
    add(input, idFactory = defaultId) {
      const book = normalizeBook({ ...input, id: `custom-${idFactory()}`, isCustom: true });
      if (!book) throw new Error("invalid_custom_book");
      const books = this.load();
      books.unshift(book);
      storage.setItem(STORAGE_KEY, JSON.stringify(books.slice(0, 18)));
      return book;
    },
    remove(id) {
      const books = this.load().filter((book) => book.id !== id);
      storage.setItem(STORAGE_KEY, JSON.stringify(books));
      return books;
    }
  };
}

export function normalizeBook(input) {
  const id = oneLine(input?.id, 72);
  const bookTitle = oneLine(input?.bookTitle, 36);
  const name = oneLine(input?.name, 36);
  const identity = oneLine(input?.identity, 180);
  const personality = oneLine(input?.personality, 260);
  if (!/^custom-[a-z0-9-]{6,64}$/.test(id) || !bookTitle || !name || !identity || !personality) return null;
  return {
    id,
    name,
    latinName: oneLine(input?.latinName, 50) || "A BOOK OF YOUR OWN",
    years: oneLine(input?.years, 32) || "由你写定",
    field: oneLine(input?.field, 40) || "自定义人物",
    medium: "自定义书页 · 墨水",
    keywords: ["身份", "性格", "记忆"],
    bookTitle,
    bookTone: TONES.has(input?.bookTone) ? input.bookTone : "midnight",
    sigil: Array.from(oneLine(input?.sigil, 2) || name)[0],
    openingLine: oneLine(input?.openingLine, 120) || `我是${name}。既然你打开了这本书，就写下你的问题吧。`,
    identity,
    personality,
    isCustom: true
  };
}

function oneLine(value, maxLength) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function defaultId() {
  return globalThis.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 16)
    || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
