/** Sample datasets for quick experimentation. All data is synthetic. */

export const SAMPLE_JSON = {
  name: "Acme Outfitters",
  version: 3,
  updatedAt: "2026-10-01T09:30:00Z",
  user: { id: 1, name: "Ada Lovelace", email: "ada@example.com", plan: "pro" },
  users: [
    { id: 1, name: "Ada Lovelace", email: "ada@example.com", age: 36, active: true, roles: ["admin", "editor"], address: { city: "London", country: "UK" } },
    { id: 2, name: "Alan Turing", email: "alan@example.com", age: 41, active: false, roles: ["editor"], address: { city: "Manchester", country: "UK" } },
    { id: 3, name: "Grace Hopper", email: "grace@example.com", age: 24, active: true, roles: ["viewer"], address: { city: "New York", country: "US" } },
    { id: 4, name: "Linus Torvalds", email: "linus@example.com", age: 29, active: true, roles: ["admin"], address: { city: "Portland", country: "US" } },
    { id: 5, name: "Margaret Hamilton", email: "margaret@example.com", age: 22, active: false, roles: [], address: null },
  ],
  items: [
    { id: "SKU-1001", name: "Mechanical Keyboard", category: "electronics", price: 129.99, stock: 42, rating: 4.7, tags: ["usb-c", "rgb"], discount: null },
    { id: "SKU-1002", name: "Trail Running Shoes", category: "apparel", price: 89.5, stock: 0, rating: 4.3, tags: ["outdoor"], discount: 0.1 },
    { id: "SKU-1003", name: "Noise Cancelling Headphones", category: "electronics", price: 249, stock: 12, rating: 4.8, tags: ["bluetooth"], discount: 0.15 },
    { id: "SKU-1004", name: "Wool Beanie", category: "apparel", price: 19.95, stock: 150, rating: 4.1, tags: [], discount: null },
    { id: "SKU-1005", name: "Cast Iron Skillet", category: "kitchen", price: 34, stock: 27, rating: 4.9, tags: ["cookware"], discount: null },
    { id: "SKU-1006", name: "USB-C Hub", category: "electronics", price: 45.25, stock: 8, rating: 3.9, tags: ["usb-c"], discount: 0.05 },
  ],
  meta: { version: "2.1.0", generated: true, source: "sample", nested: { depth: { level: 3, ok: true } } },
};

export const SAMPLE_JSON_TEXT = JSON.stringify(SAMPLE_JSON, null, 2);

// Small deterministic PRNG so generated datasets are reproducible.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Ada", "Alan", "Grace", "Linus", "Margaret", "Ken", "Barbara", "Dennis", "Radia", "Edsger", "Frances", "John", "Katherine", "Tim", "Hedy", "Donald"];
const LAST = ["Lovelace", "Turing", "Hopper", "Torvalds", "Hamilton", "Thompson", "Liskov", "Ritchie", "Perlman", "Dijkstra", "Allen", "Backus", "Johnson", "Berners-Lee", "Lamarr", "Knuth"];
const CITIES = [["London", "UK"], ["Berlin", "DE"], ["Pune", "IN"], ["Tokyo", "JP"], ["Austin", "US"], ["Toronto", "CA"], ["Lagos", "NG"], ["São Paulo", "BR"]];
const CATEGORIES = ["electronics", "apparel", "kitchen", "books", "garden", "toys", "sports"];
const ADJ = ["Compact", "Wireless", "Classic", "Ergonomic", "Smart", "Vintage", "Portable", "Premium"];
const NOUN = ["Lamp", "Backpack", "Kettle", "Notebook", "Speaker", "Chair", "Bottle", "Camera", "Jacket", "Drone"];

/** Generate a dataset with `count` users and `count` items. */
export function generateDataset(count: number, seed = 42): string {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)];
  const users = Array.from({ length: count }, (_, i) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const [city, country] = pick(CITIES);
    return {
      id: i + 1,
      name: `${first} ${last}`,
      email: `${first}.${last}${i + 1}@example.com`.toLowerCase(),
      age: 18 + Math.floor(rnd() * 60),
      active: rnd() > 0.3,
      roles: ["admin", "editor", "viewer"].filter(() => rnd() > 0.6),
      address: { city, country },
      createdAt: new Date(Date.UTC(2020, 0, 1) + Math.floor(rnd() * 2_000) * 86_400_000).toISOString(),
    };
  });
  const items = Array.from({ length: count }, (_, i) => ({
    id: `SKU-${String(10000 + i)}`,
    name: `${pick(ADJ)} ${pick(NOUN)}`,
    category: pick(CATEGORIES),
    price: Math.round(rnd() * 50000) / 100,
    stock: Math.floor(rnd() * 200),
    rating: Math.round((1 + rnd() * 4) * 10) / 10,
    tags: CATEGORIES.filter(() => rnd() > 0.8),
    discount: rnd() > 0.7 ? Math.round(rnd() * 30) / 100 : null,
  }));
  return JSON.stringify(
    {
      name: "Generated dataset",
      version: 1,
      user: users[0] ?? null,
      users,
      items,
      meta: { count, seed, generatedAt: new Date().toISOString() },
    },
    null,
    2,
  );
}
