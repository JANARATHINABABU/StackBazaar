const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createInitialStore() {
  return {
    products: [],
    users: [],
    sessions: {},
    carts: {},
    orders: []
  };
}

function loadStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_FILE)) {
    const initial = createInitialStore();
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      products: Array.isArray(parsed.products) ? parsed.products : [],
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      carts: parsed.carts && typeof parsed.carts === 'object' ? parsed.carts : {},
      orders: Array.isArray(parsed.orders) ? parsed.orders : []
    };
  } catch {
    const initial = createInitialStore();
    fs.writeFileSync(STORE_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

let store = loadStore();

function saveStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !store.sessions[token]) return null;
  const userId = store.sessions[token];
  return store.users.find((u) => u.id === userId) || null;
}

function requireAuth(req, res, next) {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }
  req.user = user;
  if (!Array.isArray(store.carts[user.id])) {
    store.carts[user.id] = [];
    saveStore();
  }
  next();
}

// --- Auth & User Account Routes ---
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Name, valid email, and password (min 6 chars) are required.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (store.users.some((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }
  const newUser = {
    id: `user-${crypto.randomUUID().slice(0, 8)}`,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    role: 'customer'
  };
  store.users.push(newUser);
  store.carts[newUser.id] = [];

  const token = crypto.randomBytes(24).toString('hex');
  store.sessions[token] = newUser.id;
  saveStore();

  res.status(201).json({
    token,
    user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = (email || '').trim().toLowerCase();
  const user = store.users.find(
    (u) => u.email === normalizedEmail && u.passwordHash === hashPassword(password || '')
  );
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = crypto.randomBytes(24).toString('hex');
  store.sessions[token] = user.id;
  saveStore();

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: { id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role }
  });
});

// --- Product Catalog & Management Routes ---
app.get('/api/products', (req, res) => {
  const { search = '', category = '' } = req.query;
  const q = String(search).trim().toLowerCase();
  const cat = String(category).trim();

  const filtered = store.products.filter((p) => {
    const matchesCategory = !cat || cat === 'All' || p.category.toLowerCase() === cat.toLowerCase();
    const matchesQuery =
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q);
    return matchesCategory && matchesQuery;
  });

  res.json(filtered);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { name, category, price, stock, description, image } = req.body;
  const numericPrice = Number(price);
  const numericStock = Number(stock);

  if (!name || !category || Number.isNaN(numericPrice) || numericPrice <= 0) {
    return res.status(400).json({ error: 'Valid product name, category, and positive price are required.' });
  }

  const created = {
    id: `prod-${crypto.randomUUID().slice(0, 8)}`,
    name: String(name).trim(),
    category: String(category).trim(),
    price: Number(numericPrice.toFixed(2)),
    stock: Number.isInteger(numericStock) && numericStock >= 0 ? numericStock : 0,
    description: String(description || '').trim(),
    image: String(image || '').trim()
  };

  store.products.unshift(created);
  saveStore();
  res.status(201).json(created);
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const idx = store.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });

  const current = store.products[idx];
  const parsedPrice = req.body.price !== undefined ? Number(req.body.price) : current.price;
  const parsedStock = req.body.stock !== undefined ? Number(req.body.stock) : current.stock;

  const updated = {
    ...current,
    name: req.body.name !== undefined ? String(req.body.name).trim() : current.name,
    category: req.body.category !== undefined ? String(req.body.category).trim() : current.category,
    price: !Number.isNaN(parsedPrice) && parsedPrice > 0 ? Number(parsedPrice.toFixed(2)) : current.price,
    stock: !Number.isNaN(parsedStock) && parsedStock >= 0 ? Math.floor(parsedStock) : current.stock,
    description:
      req.body.description !== undefined ? String(req.body.description).trim() : current.description,
    image: req.body.image !== undefined ? String(req.body.image).trim() : current.image
  };

  store.products[idx] = updated;
  saveStore();
  res.json(updated);
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const idx = store.products.findIndex((p) => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Product not found.' });
  store.products.splice(idx, 1);
  saveStore();
  res.json({ deleted: true, id: req.params.id });
});

// --- Shopping Cart Routes ---
function buildCartResponse(userId) {
  const items = Array.isArray(store.carts[userId]) ? store.carts[userId] : [];
  const enriched = items
    .map((item) => {
      const product = store.products.find((p) => p.id === item.productId);
      if (!product) return null;
      return {
        productId: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        price: product.price,
        image: product.image,
        stock: product.stock,
        quantity: item.quantity,
        subtotal: Number((product.price * item.quantity).toFixed(2))
      };
    })
    .filter(Boolean);

  const totalItems = enriched.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = Number(enriched.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2));
  return { items: enriched, totalItems, totalAmount };
}

app.get('/api/cart', requireAuth, (req, res) => {
  res.json(buildCartResponse(req.user.id));
});

app.post('/api/cart', requireAuth, (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const qty = Number(quantity);
  const product = store.products.find((p) => p.id === productId);

  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive integer.' });
  }
  if (product.stock < qty) {
    return res.status(400).json({ error: `Only ${product.stock} units available in stock.` });
  }

  const cart = store.carts[req.user.id];
  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    if (existing.quantity + qty > product.stock) {
      return res.status(400).json({ error: 'Cannot exceed available product stock.' });
    }
    existing.quantity += qty;
  } else {
    cart.push({ productId, quantity: qty });
  }

  saveStore();
  res.status(201).json(buildCartResponse(req.user.id));
});

app.patch('/api/cart/:productId', requireAuth, (req, res) => {
  const qty = Number(req.body.quantity);
  const cart = store.carts[req.user.id];
  const idx = cart.findIndex((item) => item.productId === req.params.productId);
  if (idx === -1) return res.status(404).json({ error: 'Item not in cart.' });

  if (qty <= 0) {
    cart.splice(idx, 1);
  } else {
    const product = store.products.find((p) => p.id === req.params.productId);
    if (product && qty > product.stock) {
      return res.status(400).json({ error: `Only ${product.stock} units available.` });
    }
    cart[idx].quantity = qty;
  }

  saveStore();
  res.json(buildCartResponse(req.user.id));
});

app.delete('/api/cart/:productId', requireAuth, (req, res) => {
  const cart = store.carts[req.user.id] || [];
  store.carts[req.user.id] = cart.filter((item) => item.productId !== req.params.productId);
  saveStore();
  res.json(buildCartResponse(req.user.id));
});

// --- Orders Routes ---
app.get('/api/orders', requireAuth, (req, res) => {
  const userOrders = store.orders.filter((o) => o.userId === req.user.id);
  res.json(userOrders);
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { shippingAddress, upiId, securityVerified } = req.body;
  const trimmedAddress = String(shippingAddress || '').trim();
  const normalizedUpi = String(upiId || '').trim().toLowerCase();
  const upiRegex = /^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/;

  if (!trimmedAddress) {
    return res.status(400).json({ error: 'Shipping address is required to place an order.' });
  }
  if (!upiRegex.test(normalizedUpi)) {
    return res.status(400).json({ error: 'Please provide a valid UPI ID (for example: name@okaxis).' });
  }
  if (!securityVerified) {
    return res.status(400).json({ error: 'Please confirm the security verification check before placing the order.' });
  }

  const cartSummary = buildCartResponse(req.user.id);
  if (cartSummary.items.length === 0) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  for (const item of cartSummary.items) {
    const product = store.products.find((p) => p.id === item.productId);
    if (!product || product.stock < item.quantity) {
      return res.status(400).json({ error: `Insufficient stock for ${item.name}.` });
    }
  }
  for (const item of cartSummary.items) {
    const product = store.products.find((p) => p.id === item.productId);
    product.stock -= item.quantity;
  }

  const newOrder = {
    id: `ORD-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    userId: req.user.id,
    customerName: req.user.name,
    shippingAddress: trimmedAddress,
    paymentMethod: 'UPI',
    upiId: normalizedUpi,
    items: cartSummary.items,
    totalAmount: cartSummary.totalAmount,
    status: 'Confirmed',
    createdAt: new Date().toISOString()
  };

  store.orders.unshift(newOrder);
  store.carts[req.user.id] = [];
  saveStore();

  res.status(201).json(newOrder);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});