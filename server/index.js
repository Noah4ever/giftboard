import express from "express";
import cors from "cors";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import crypto from "node:crypto";
import multer from "multer";
import { Server as SocketServer } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_PATH = path.join(DATA_DIR, "data.json");
const UPLOAD_DIR =
  process.env.UPLOAD_DIR || path.join(path.dirname(__dirname), "uploads");
const PORT = process.env.PORT || 4000;
const META_SOURCES_PATH = path.join(__dirname, "meta-sources.json");

const SOCKET_PATH =
  process.env.SOCKET_PATH ||
  (process.env.NODE_ENV === "production"
    ? "/giftboard/api/socket.io"
    : "/socket.io");

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  path: SOCKET_PATH,
  cors: {
    origin: "*",
  },
});
app.use(cors());
app.use(express.json());
ensureUploadDir().catch((error) => {
  console.error("Upload dir init failed", error);
});
app.use("/uploads", express.static(UPLOAD_DIR));

async function ensureDataFile() {
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await readFile(DATA_PATH, "utf-8");
  } catch (error) {
    if (error && error.code === "ENOENT") {
      await writeFile(
        DATA_PATH,
        JSON.stringify({ lists: [] }, null, 2),
        "utf-8"
      );
    } else {
      throw error;
    }
  }
}

async function enrichWishMeta(listCode, wishId) {
  try {
    const data = await readData();
    const list = findList(data, listCode);
    if (!list) return;
    const wish = list.wishes.find((w) => w.id === wishId);
    if (!wish || !wish.link) return;

    const hostname = new URL(wish.link).hostname;
    const sources = await loadMetaSources();
    const source = chooseMetaSource(hostname, sources);
    if (!source) return;

    const resp = await fetch(wish.link, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    const html = await resp.text();

    const price = extractPriceFromHtml(html, source);
    const image = extractImageFromSource(html, source);

    const updated = {};
    if (price !== null && wish.price === null) updated.price = price;
    if (image && !wish.image) updated.image = image;

    if (Object.keys(updated).length === 0) return;

    Object.assign(wish, updated);
    await writeData(data);
    io.to(list.code).emit("wish:update", { code: list.code, wish });
  } catch (err) {
    console.error("enrichWishMeta error", err);
  }
}

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    throw error;
  }
}

function normalizePrice(value) {
  if (value === undefined || value === null || value === "") return null;
  const str = String(value).replace(/,/g, ".");
  const num = Number(str);
  return Number.isNaN(num) ? null : num;
}

let metaSourcesCache = null;
async function loadMetaSources() {
  if (metaSourcesCache) return metaSourcesCache;
  try {
    const raw = await readFile(META_SOURCES_PATH, "utf-8");
    metaSourcesCache = JSON.parse(raw);
  } catch (_err) {
    metaSourcesCache = [
      {
        name: "amazon",
        domains: ["amazon.com", "amazon.de", "amazon.co.uk", "amazon.fr"],
        selectors: {
          whole: { type: "classText", value: "a-price-whole" },
          fraction: { type: "classText", value: "a-price-fraction" },
          symbol: { type: "classText", value: "a-price-symbol" },
          image: { type: "attr", selector: "#landingImage", attr: "src" },
          dynamicImage: {
            type: "attr",
            selector: "#landingImage",
            attr: "data-a-dynamic-image",
            parse: "jsonKey",
          },
          altImage: {
            type: "attr",
            selector: "#landingImage",
            attr: "data-old-hires",
          },
        },
        fallbackRegexes: [
          '"price"\\s*:\\s*"([0-9.,]+)"',
          'price":"([0-9.,]+)"',
          "\\$(\\d+[\\d.,]*)",
        ],
      },
    ];
  }
  return metaSourcesCache;
}

function getFirstMatch(html, regex) {
  const match = html.match(regex);
  return match ? match[1] : null;
}

function extractByClass(html, className) {
  const regex = new RegExp(`class=["']${className}["'][^>]*>([^<]+)`, "i");
  return getFirstMatch(html, regex);
}

function chooseMetaSource(hostname, sources) {
  return (
    sources.find((source) =>
      (source.domains || []).some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      )
    ) || null
  );
}

function extractPriceFromHtml(html, source) {
  if (!source) return null;
  const selectors = source.selectors || {};
  const whole =
    selectors.whole?.type === "classText"
      ? extractByClass(html, selectors.whole.value)
      : null;
  const fraction =
    selectors.fraction?.type === "classText"
      ? extractByClass(html, selectors.fraction.value)
      : null;

  if (whole) {
    const wholeNum = Number(whole.replace(/[,]/g, ""));
    const fracNum = fraction ? Number(fraction.replace(/[,]/g, "")) / 100 : 0;
    const priceNum = wholeNum + fracNum;
    if (!Number.isNaN(priceNum)) return priceNum;
  }

  for (const pattern of source.fallbackRegexes || []) {
    const match = getFirstMatch(html, new RegExp(pattern));
    if (match) {
      const num = Number(match.replace(/[,]/g, ""));
      if (!Number.isNaN(num)) return num;
    }
  }

  return null;
}

function normalizeWish(wish) {
  if (!wish.quantity || wish.quantity < 1) wish.quantity = 1;
  if (!Array.isArray(wish.reservations)) {
    wish.reservations = wish.ticked
      ? [
          {
            userName: wish.tickedBy || "",
            at: wish.tickedAt || new Date().toISOString(),
          },
        ]
      : [];
  }
  wish.ticked = wish.reservations.length > 0;
  wish.tickedBy = wish.reservations.at(-1)?.userName || null;
  wish.tickedAt = wish.reservations.at(-1)?.at || null;
  if (wish.price === undefined) wish.price = null;
  if (wish.priceRange === undefined) wish.priceRange = "";
  if (wish.reservedCount === undefined)
    wish.reservedCount = wish.reservations.length;
  return wish;
}

function normalizeList(list) {
  if (!list.description) list.description = "";
  return list;
}

async function readData() {
  await ensureDataFile();
  const content = await readFile(DATA_PATH, "utf-8");
  const parsed = JSON.parse(content);
  parsed.lists = (parsed.lists || []).map((list) => ({
    ...normalizeList(list),
    wishes: (list.wishes || []).map((wish) => normalizeWish(wish)),
  }));
  return parsed;
}

async function writeData(data) {
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf-8");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function uniqueCode(title, existingCodes) {
  const base = slugify(title) || "list";
  let code = base;
  let counter = 1;
  while (existingCodes.has(code)) {
    code = `${base}-${counter}`;
    counter += 1;
  }
  return code;
}

function escapeHtml(text = "") {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function findList(data, code) {
  return data.lists.find((list) => list.code === code);
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/lists", async (req, res) => {
  const ownerName = req.query.ownerName;
  if (!ownerName || typeof ownerName !== "string") {
    return res.status(400).json({ message: "ownerName is required" });
  }
  const data = await readData();
  const lists = data.lists.filter(
    (l) => l.owner.toLowerCase() === ownerName.toLowerCase()
  );
  res.json(lists);
});

app.get("/share/:code", async (req, res) => {
  const data = await readData();
  const list = findList(data, req.params.code);
  if (!list) return res.status(404).send("Not found");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderShareHtml(list));
});

function renderShareHtml(list) {
  const title = `${escapeHtml(list.title)} · ${escapeHtml(list.owner)}`;
  const description = escapeHtml(list.description || "Giftboard wishlist");
  return `<!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${description}" />
      <meta property="og:type" content="website" />
      <meta property="twitter:card" content="summary" />
      <meta property="twitter:title" content="${title}" />
      <meta property="twitter:description" content="${description}" />
      <title>${title}</title>
    </head>
    <body>
      <p>Shared list: ${title}</p>
    </body>
  </html>`;
}

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image uploads are allowed"));
  },
});

app.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: "No file uploaded" });
  const url = `${req.protocol}://${req.get("host")}/uploads/${
    req.file.filename
  }`;
  res.json({ url });
});

function extractAmazonImage(html) {
  const imgTag = html.match(/<img[^>]+id=["']landingImage["'][^>]*>/i);
  if (!imgTag) return null;
  const tag = imgTag[0];
  const getAttr = (attr) => {
    const match = tag.match(new RegExp(`${attr}=["']([^"']+)["']`, "i"));
    return match ? match[1] : null;
  };

  const dynamicImage = getAttr("data-a-dynamic-image");
  if (dynamicImage) {
    try {
      const parsed = JSON.parse(dynamicImage.replace(/&quot;/g, '"'));
      const first = Object.keys(parsed)[0];
      if (first) return first;
    } catch (_err) {
      // ignore JSON parse issues
    }
  }

  const dataOldHires = getAttr("data-old-hires");
  if (dataOldHires) return dataOldHires;

  const src = getAttr("src");
  if (src) return src;

  return null;
}

function extractImageFromSource(html, source) {
  let image = extractAmazonImage(html);
  const selectors = source?.selectors || {};

  if (!image && selectors.image?.type === "attr") {
    const match = html.match(
      new RegExp(
        `${selectors.image.selector}[^>]+${selectors.image.attr}=["']([^"']+)["']`,
        "i"
      )
    );
    if (match) image = match[1];
  }

  if (!image && selectors.dynamicImage?.parse === "jsonKey") {
    const match = html.match(
      new RegExp(
        `${selectors.dynamicImage.selector}[^>]+${selectors.dynamicImage.attr}=["']([^"']+)["']`,
        "i"
      )
    );
    if (match) {
      try {
        const parsed = JSON.parse(match[1].replace(/&quot;/g, '"'));
        const first = Object.keys(parsed)[0];
        if (first) image = first;
      } catch (_err) {
        // ignore
      }
    }
  }

  if (!image && selectors.altImage?.type === "attr") {
    const match = html.match(
      new RegExp(
        `${selectors.altImage.selector}[^>]+${selectors.altImage.attr}=["']([^"']+)["']`,
        "i"
      )
    );
    if (match) image = match[1];
  }

  return image || null;
}

app.get("/price", async (req, res) => {
  const url = req.query.url;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ message: "url is required" });
  }
  try {
    const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await resp.text();
    const hostname = new URL(resp.url || url).hostname;
    const sources = await loadMetaSources();
    const source = chooseMetaSource(hostname, sources);
    let derivedPrice = extractPriceFromHtml(html, source);

    if (derivedPrice === null) {
      // Last-resort generic regex
      const match =
        html.match(/"price"\s*:\s*"([0-9.,]+)"/) ||
        html.match(/price":"([0-9.,]+)"/) ||
        html.match(/\$(\d+[\d.,]*)/);
      if (match && match[1]) {
        const num = Number(match[1].replace(/[,]/g, ""));
        if (!Number.isNaN(num)) derivedPrice = num;
      }
    }

    const image = extractImageFromSource(html, source);

    return res.json({ price: derivedPrice, image: image || null });
  } catch (error) {
    return res.json({ price: null, image: null });
  }
});

app.get("/lists/:code", async (req, res) => {
  const data = await readData();
  const list = findList(data, req.params.code);
  if (!list) return res.status(404).json({ message: "List not found" });
  const accept = req.headers.accept || "";
  if (accept.includes("text/html")) {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(renderShareHtml(list));
  }
  res.json(list);
});

app.post("/lists", async (req, res) => {
  const { title, ownerName, code, description } = req.body;
  if (!title || !ownerName) {
    return res
      .status(400)
      .json({ message: "title and ownerName are required" });
  }

  const data = await readData();
  const codes = new Set(data.lists.map((item) => item.code));
  const resolvedCode =
    code && !codes.has(code) ? code : uniqueCode(title, codes);

  const list = {
    id: crypto.randomUUID(),
    title,
    code: resolvedCode,
    owner: ownerName,
    description: description || "",
    createdAt: new Date().toISOString(),
    wishes: [],
  };

  data.lists.push(list);
  await writeData(data);
  res.status(201).json(list);
});

app.put("/lists/:code", async (req, res) => {
  const data = await readData();
  const list = findList(data, req.params.code);
  if (!list) return res.status(404).json({ message: "List not found" });

  const { title, description, ownerName } = req.body;
  if (!ownerName || ownerName.toLowerCase() !== list.owner.toLowerCase()) {
    return res.status(403).json({ message: "Only owner can update list" });
  }

  if (title) list.title = title;
  if (description !== undefined) list.description = description;

  await writeData(data);
  res.json(list);
});

app.delete("/lists/:code", async (req, res) => {
  const data = await readData();
  const idx = data.lists.findIndex((item) => item.code === req.params.code);
  if (idx === -1) return res.status(404).json({ message: "List not found" });

  const { ownerName } = req.body;
  if (
    !ownerName ||
    data.lists[idx].owner.toLowerCase() !== ownerName.toLowerCase()
  ) {
    return res.status(403).json({ message: "Only owner can delete list" });
  }

  data.lists.splice(idx, 1);
  await writeData(data);
  res.status(204).send();
});

app.post("/lists/:code/wishes", async (req, res) => {
  const {
    title,
    priority,
    description,
    link,
    image,
    price,
    priceRange,
    quantity,
  } = req.body;
  if (!title) return res.status(400).json({ message: "title is required" });

  const data = await readData();
  const list = findList(data, req.params.code);
  if (!list) return res.status(404).json({ message: "List not found" });

  const wish = {
    id: crypto.randomUUID(),
    title,
    priority: priority || "medium",
    description: description || "",
    link: link || "",
    image: image || "",
    price: normalizePrice(price),
    priceRange: priceRange || "",
    quantity: quantity && quantity > 0 ? Number(quantity) : 1,
    reservations: [],
    reservedCount: 0,
    ticked: false,
    tickedBy: null,
    tickedAt: null,
    createdAt: new Date().toISOString(),
  };

  list.wishes.push(wish);
  await writeData(data);
  io.to(list.code).emit("wish:add", { code: list.code, wish });
  res.status(201).json(wish);

  setImmediate(() => {
    enrichWishMeta(list.code, wish.id).catch((err) =>
      console.error("Meta enrich failed", err)
    );
  });
});

app.put("/lists/:code/wishes/:wishId", async (req, res) => {
  const data = await readData();
  const list = findList(data, req.params.code);
  if (!list) return res.status(404).json({ message: "List not found" });

  const wish = list.wishes.find((item) => item.id === req.params.wishId);
  if (!wish) return res.status(404).json({ message: "Wish not found" });

  const {
    title,
    priority,
    description,
    link,
    image,
    price,
    priceRange,
    quantity,
  } = req.body;
  if (title !== undefined) wish.title = title;
  if (priority !== undefined) wish.priority = priority;
  if (description !== undefined) wish.description = description;
  if (link !== undefined) wish.link = link;
  if (image !== undefined) wish.image = image;
  if (price !== undefined) wish.price = normalizePrice(price);
  if (priceRange !== undefined) wish.priceRange = priceRange;
  if (quantity !== undefined && Number(quantity) > 0)
    wish.quantity = Number(quantity);
  if (wish.reservedCount > wish.quantity) {
    wish.reservations = wish.reservations.slice(0, wish.quantity);
    wish.reservedCount = wish.reservations.length;
  }
  wish.ticked = wish.reservedCount > 0;
  wish.tickedBy = wish.reservations.at(-1)?.userName || null;
  wish.tickedAt = wish.reservations.at(-1)?.at || null;

  await writeData(data);
  io.to(list.code).emit("wish:update", { code: list.code, wish });
  res.json(wish);
});

app.patch("/lists/:code/wishes/:wishId/tick", async (req, res) => {
  const data = await readData();
  const list = findList(data, req.params.code);
  if (!list) return res.status(404).json({ message: "List not found" });

  const wish = list.wishes.find((item) => item.id === req.params.wishId);
  if (!wish) return res.status(404).json({ message: "Wish not found" });

  const { ticked, userName } = req.body;
  if (ticked === undefined || !userName) {
    return res
      .status(400)
      .json({ message: "ticked and userName are required" });
  }

  if (ticked) {
    if (wish.reservedCount >= wish.quantity) {
      return res.status(400).json({ message: "All reserved" });
    }
    wish.reservations.push({ userName, at: new Date().toISOString() });
    wish.reservedCount = wish.reservations.length;
  } else {
    const idx = wish.reservations.findIndex((r) => r.userName === userName);
    if (idx === -1) {
      return res
        .status(403)
        .json({ message: "Cannot release for another user" });
    }
    wish.reservations.splice(idx, 1);
    wish.reservedCount = wish.reservations.length;
  }

  wish.ticked = wish.reservedCount > 0;
  wish.tickedBy = wish.reservations.at(-1)?.userName || null;
  wish.tickedAt = wish.reservations.at(-1)?.at || null;

  await writeData(data);
  io.to(list.code).emit("wish:update", { code: list.code, wish });
  res.json(wish);
});

app.delete("/lists/:code/wishes/:wishId", async (req, res) => {
  const data = await readData();
  const list = findList(data, req.params.code);
  if (!list) return res.status(404).json({ message: "List not found" });

  const idx = list.wishes.findIndex((item) => item.id === req.params.wishId);
  if (idx === -1) return res.status(404).json({ message: "Wish not found" });

  list.wishes.splice(idx, 1);
  await writeData(data);
  io.to(list.code).emit("wish:delete", {
    code: list.code,
    wishId: req.params.wishId,
  });
  res.status(204).send();
});

io.on("connection", (socket) => {
  socket.on("join:list", (code) => {
    socket.join(code);
  });
});

server.listen(PORT, () => {
  console.log(`API ready on http://localhost:${PORT}`);
});
