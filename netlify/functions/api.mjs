// Prince Enterprise portal API.
// Public:  GET  /api/products        -> product list without cost, stock totals or sales counts
// Admin:   POST /api/login           -> { password } -> { token }
//          GET  /api/admin/products  -> full list (needs token)
//          POST /api/admin/save      -> { rev, products } (needs token)
// Set ADMIN_PASSWORD (required) and TOKEN_SECRET (recommended) in Netlify environment variables.

import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

export const config = { path: "/api/*" };

const CATS = ["Kitchen", "Cleaning", "Storage", "Bedding & Bath", "Appliances", "Other"];
const store = () => getStore({ name: "prince-enterprise", consistency: "strong" });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const secret = () => process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "";
const sign = (exp) => crypto.createHmac("sha256", secret()).update(String(exp)).digest("base64url");
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();

function makeToken() {
  const exp = Date.now() + 12 * 3600 * 1000;
  return exp + "." + sign(exp);
}

function isAdmin(req) {
  if (!secret()) return false;
  const h = req.headers.get("authorization") || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [exp, sig] = t.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function load() {
  const d = await store().get("data", { type: "json" });
  return d && Array.isArray(d.products) ? d : { rev: 0, updated: null, products: [] };
}

function publicView(p) {
  const remaining = Math.max(0, p.stock - p.sold);
  return {
    id: p.id, name: p.name, cat: p.cat, price: p.price, img: p.img || "",
    added: p.added, lastSold: p.lastSold || "", remaining, hasSales: p.sold > 0,
  };
}

function clean(list) {
  if (!Array.isArray(list) || list.length > 500) throw new Error("Too many products.");
  const seen = new Set();
  return list.map((p) => {
    const id = String(p.id || "").slice(0, 40);
    if (!id || seen.has(id)) throw new Error("Bad product id.");
    seen.add(id);
    const name = String(p.name || "").trim().slice(0, 80);
    if (!name) throw new Error("A product has no name.");
    const price = Number(p.price), stock = Math.floor(Number(p.stock)), sold = Math.floor(Number(p.sold));
    if (!(price >= 0) || !(stock >= 0) || !(sold >= 0) || sold > stock) throw new Error("Bad numbers on " + name + ".");
    const img = typeof p.img === "string" && p.img.startsWith("data:image/") && p.img.length < 200000 ? p.img : "";
    const date = (v) => (/^\d{4}-\d{2}-\d{2}/.test(String(v || "")) ? String(v).slice(0, 10) : "");
    return {
      id, name, price, stock, sold, img,
      cat: CATS.includes(p.cat) ? p.cat : "Other",
      added: date(p.added) || date(new Date().toISOString()),
      lastSold: date(p.lastSold),
      ...(p.ex ? { ex: 1 } : {}),
    };
  });
}

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");

  try {
    if (req.method === "GET" && path === "/api/products") {
      const d = await load();
      return json({ updated: d.updated, products: d.products.map(publicView) });
    }

    if (req.method === "POST" && path === "/api/login") {
      if (!process.env.ADMIN_PASSWORD) return json({ error: "Admin password is not set on the server." }, 500);
      const body = await req.json().catch(() => ({}));
      const good = crypto.timingSafeEqual(sha(body.password || ""), sha(process.env.ADMIN_PASSWORD));
      if (!good) {
        await new Promise((r) => setTimeout(r, 800));
        return json({ error: "Wrong password." }, 401);
      }
      return json({ token: makeToken() });
    }

    if (path.startsWith("/api/admin/")) {
      if (!isAdmin(req)) return json({ error: "Sign in again." }, 401);

      if (req.method === "GET" && path === "/api/admin/products") {
        const d = await load();
        return json(d);
      }

      if (req.method === "POST" && path === "/api/admin/save") {
        const body = await req.json().catch(() => null);
        if (!body) return json({ error: "Bad request." }, 400);
        const cur = await load();
        if (Number(body.rev) !== cur.rev) return json({ error: "Out of date." }, 409);
        let products;
        try { products = clean(body.products); } catch (e) { return json({ error: e.message }, 400); }
        const next = { rev: cur.rev + 1, updated: new Date().toISOString(), products };
        await store().setJSON("data", next);
        return json({ rev: next.rev, updated: next.updated });
      }
    }

    return json({ error: "Not found." }, 404);
  } catch (e) {
    return json({ error: "Server error." }, 500);
  }
};
