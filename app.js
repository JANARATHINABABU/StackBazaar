const state = {
  token: localStorage.getItem('store_token') || '',
  user: null,
  cart: { items: [], totalItems: 0, totalAmount: 0 },
  allProducts: [],
  selectedProductId: null
};

const els = {
  promoAd: document.getElementById('promoAd'),
  adBrowseBtn: document.getElementById('adBrowseBtn'),
  closeAdBtn: document.getElementById('closeAdBtn'),
  banner: document.getElementById('bannerMessage'),
  views: {
    catalog: document.getElementById('viewCatalog'),
    detail: document.getElementById('viewProductDetail'),
    cart: document.getElementById('viewCart'),
    manage: document.getElementById('viewManage'),
    orders: document.getElementById('viewOrders'),
    account: document.getElementById('viewAccount')
  },
  navBtns: {
    catalog: document.getElementById('btnCatalog'),
    manage: document.getElementById('btnManage'),
    orders: document.getElementById('btnOrders'),
    account: document.getElementById('btnAccount'),
    cart: document.getElementById('btnCart')
  },
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  productGrid: document.getElementById('productGrid'),
  backToCatalogBtn: document.getElementById('backToCatalogBtn'),
  continueShoppingBtn: document.getElementById('continueShoppingBtn'),
  productDetailCard: document.getElementById('productDetailCard'),
  relatedProductsGrid: document.getElementById('relatedProductsGrid'),
  manageAuthHint: document.getElementById('manageAuthHint'),
  productForm: document.getElementById('productForm'),
  prodName: document.getElementById('prodName'),
  prodCategory: document.getElementById('prodCategory'),
  prodPrice: document.getElementById('prodPrice'),
  prodStock: document.getElementById('prodStock'),
  prodImage: document.getElementById('prodImage'),
  prodDesc: document.getElementById('prodDesc'),
  saveProductBtn: document.getElementById('saveProductBtn'),
  manageList: document.getElementById('manageList'),
  ordersList: document.getElementById('ordersList'),
  accountSignedOut: document.getElementById('accountSignedOut'),
  accountSignedIn: document.getElementById('accountSignedIn'),
  authFlipCard: document.getElementById('authFlipCard'),
  loginForm: document.getElementById('loginForm'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  registerForm: document.getElementById('registerForm'),
  regName: document.getElementById('regName'),
  regEmail: document.getElementById('regEmail'),
  regPassword: document.getElementById('regPassword'),
  flipToRegisterBtn: document.getElementById('flipToRegisterBtn'),
  flipToLoginBtn: document.getElementById('flipToLoginBtn'),
  profileName: document.getElementById('profileName'),
  profileEmail: document.getElementById('profileEmail'),
  logoutBtn: document.getElementById('logoutBtn'),
  cartCount: document.getElementById('cartCount'),
  cartItems: document.getElementById('cartItems'),
  cartSubtotal: document.getElementById('cartSubtotal'),
  cartDelivery: document.getElementById('cartDelivery'),
  cartTotal: document.getElementById('cartTotal'),
  startCheckoutBtn: document.getElementById('startCheckoutBtn'),
  checkoutStepAddress: document.getElementById('checkoutStepAddress'),
  checkoutStepUpi: document.getElementById('checkoutStepUpi'),
  checkoutStepSecurity: document.getElementById('checkoutStepSecurity'),
  cancelCheckoutBtn: document.getElementById('cancelCheckoutBtn'),
  shippingAddress: document.getElementById('shippingAddress'),
  toUpiStepBtn: document.getElementById('toUpiStepBtn'),
  upiIdInput: document.getElementById('upiIdInput'),
  backToAddressBtn: document.getElementById('backToAddressBtn'),
  toSecurityStepBtn: document.getElementById('toSecurityStepBtn'),
  reviewAddress: document.getElementById('reviewAddress'),
  reviewUpi: document.getElementById('reviewUpi'),
  reviewTotal: document.getElementById('reviewTotal'),
  securityConfirmCheck: document.getElementById('securityConfirmCheck'),
  backToUpiBtn: document.getElementById('backToUpiBtn'),
  checkoutBtn: document.getElementById('checkoutBtn')
};

function showBanner(msg, type = 'info') {
  els.banner.textContent = msg;
  els.banner.className = `banner ${type}`;
  clearTimeout(showBanner._timer);
  showBanner._timer = setTimeout(() => {
    els.banner.className = 'banner hidden';
  }, 3500);
}

function escapeAttr(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getDeliveryCharge(unitPrice, quantity = 1) {
  const subtotal = Number(unitPrice) * Math.max(1, Number(quantity) || 1);
  if (subtotal <= 0) return 0;
  return subtotal >= 100 ? 0 : 4.99;
}

function maskUpiId(upi) {
  const clean = String(upi || '').trim().toLowerCase();
  const [handle, provider] = clean.split('@');
  if (!handle || !provider) return clean;
  if (handle.length <= 2) return `${handle[0] || '*'}*@${provider}`;
  return `${handle.slice(0, 2)}${'*'.repeat(Math.min(4, handle.length - 2))}@${provider}`;
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function switchView(viewName) {
  Object.entries(els.views).forEach(([key, el]) => {
    el.classList.toggle('hidden', key !== viewName);
  });
  Object.entries(els.navBtns).forEach(([key, btn]) => {
    btn.classList.toggle('active', key === viewName || (viewName === 'detail' && key === 'catalog'));
  });

  if (viewName === 'catalog') loadProducts();
  if (viewName === 'detail') renderProductDetail(state.selectedProductId);
  if (viewName === 'cart') {
    if (state.token) {
      loadCart();
    } else {
      renderCartUI();
    }
  }
  if (viewName === 'manage') loadManageProducts();
  if (viewName === 'orders') loadOrders();
  if (viewName === 'account') renderAccountView();
}

function renderAccountView() {
  if (state.user) {
    els.navBtns.account.textContent = state.user.name.split(' ')[0];
    els.accountSignedOut.classList.add('hidden');
    els.accountSignedIn.classList.remove('hidden');
    els.profileName.textContent = state.user.name;
    els.profileEmail.textContent = state.user.email;
    if (els.manageAuthHint) els.manageAuthHint.classList.add('hidden');
  } else {
    els.navBtns.account.textContent = 'Sign In';
    els.accountSignedOut.classList.remove('hidden');
    els.accountSignedIn.classList.add('hidden');
    if (els.manageAuthHint) els.manageAuthHint.classList.remove('hidden');
  }
}

async function initSession() {
  if (!state.token) {
    renderAccountView();
    renderCartUI();
    return;
  }
  try {
    const { user } = await api('/api/auth/me');
    state.user = user;
    renderAccountView();
    await loadCart();
  } catch {
    state.token = '';
    state.user = null;
    localStorage.removeItem('store_token');
    renderAccountView();
    renderCartUI();
  }
}

function syncCategoryOptions(products) {
  const selected = els.categoryFilter.value || 'All';
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];
  els.categoryFilter.innerHTML =
    '<option value="All">All Categories</option>' +
    categories.map((c) => `<option value="${escapeAttr(c)}">${escapeAttr(c)}</option>`).join('');
  if ([...els.categoryFilter.options].some((o) => o.value === selected)) {
    els.categoryFilter.value = selected;
  }
}

function buildProductCardHtml(p, isRelated = false) {
  const delivery = getDeliveryCharge(p.price, 1);
  return `
    <article class="card product-card" data-product-card="${escapeAttr(p.id)}">
      <div class="product-card-body" data-open-detail="${escapeAttr(p.id)}">
        ${p.image ? `<img class="product-img" src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}" />` : ''}
        <span class="badge">${escapeAttr(p.category)}</span>
        <h3>${escapeAttr(p.name)}</h3>
        <p class="muted">${escapeAttr(p.description || 'No description provided.')}</p>
      </div>
      <div>
        <div class="price">$${Number(p.price).toFixed(2)}</div>
        <p class="muted">Delivery: ${delivery === 0 ? 'Free' : `$${delivery.toFixed(2)}`} · In stock: ${p.stock}</p>
        ${
          isRelated
            ? `<button type="button" class="btn btn-outline full-width" data-open-detail="${escapeAttr(p.id)}">View Details</button>`
            : `<button type="button" class="btn btn-primary full-width" data-add-cart="${escapeAttr(p.id)}" ${
                p.stock <= 0 ? 'disabled' : ''
              }>
                ${p.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
              </button>`
        }
      </div>
    </article>
  `;
}

async function loadProducts() {
  const allProducts = await api('/api/products');
  state.allProducts = allProducts;
  syncCategoryOptions(allProducts);

  const params = new URLSearchParams({
    search: els.searchInput.value,
    category: els.categoryFilter.value
  });
  const list = await api(`/api/products?${params.toString()}`);

  els.productGrid.innerHTML = list.length
    ? list.map((p) => buildProductCardHtml(p, false)).join('')
    : '<p class="muted">No products added yet.</p>';
}

function getRelatedProducts(product) {
  const others = state.allProducts.filter((item) => item.id !== product.id);
  const sameCategory = others.filter(
    (item) => item.category.toLowerCase() === product.category.toLowerCase()
  );
  const otherCategories = others.filter(
    (item) => item.category.toLowerCase() !== product.category.toLowerCase()
  );
  return [...sameCategory, ...otherCategories].slice(0, 4);
}

function updateDetailPricing(product) {
  const qtyInput = document.getElementById('detailQtyInput');
  const subtotalEl = document.getElementById('detailSubtotal');
  const deliveryEl = document.getElementById('detailDelivery');
  const grandTotalEl = document.getElementById('detailGrandTotal');
  if (!qtyInput || !subtotalEl || !deliveryEl || !grandTotalEl) return;

  const maxStock = Math.max(1, Number(product.stock) || 1);
  let qty = Math.floor(Number(qtyInput.value) || 1);
  if (qty < 1) qty = 1;
  if (product.stock > 0 && qty > maxStock) qty = maxStock;
  qtyInput.value = qty;

  const subtotal = Number(product.price) * qty;
  const delivery = getDeliveryCharge(product.price, qty);
  const grandTotal = subtotal + delivery;

  subtotalEl.textContent = `$${subtotal.toFixed(2)}`;
  deliveryEl.textContent = delivery === 0 ? 'Free' : `$${delivery.toFixed(2)}`;
  grandTotalEl.textContent = `$${grandTotal.toFixed(2)}`;
}

async function renderProductDetail(productId) {
  if (!state.allProducts.length) {
    state.allProducts = await api('/api/products');
  }
  const product = state.allProducts.find((p) => p.id === productId);
  if (!product) {
    els.productDetailCard.innerHTML = '<p class="muted">Product not found.</p>';
    els.relatedProductsGrid.innerHTML = '';
    return;
  }

  state.selectedProductId = product.id;
  const initialDelivery = getDeliveryCharge(product.price, 1);
  const initialTotal = Number(product.price) + initialDelivery;

  els.productDetailCard.innerHTML = `
    <div>
      ${
        product.image
          ? `<img class="detail-img" src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}" />`
          : `<div class="detail-placeholder">No Product Image</div>`
      }
    </div>
    <div class="detail-info">
      <span class="badge">${escapeAttr(product.category)}</span>
      <h2>${escapeAttr(product.name)}</h2>
      <p class="muted">${escapeAttr(product.description || 'No description provided.')}</p>

      <div class="detail-meta-box">
        <div class="detail-meta-row">
          <span>Unit Price</span>
          <strong>$${Number(product.price).toFixed(2)}</strong>
        </div>
        <div class="detail-meta-row">
          <span>Availability</span>
          <strong>${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}</strong>
        </div>
        <div class="detail-meta-row">
          <span>Subtotal</span>
          <strong id="detailSubtotal">$${Number(product.price).toFixed(2)}</strong>
        </div>
        <div class="detail-meta-row">
          <span>Delivery Charge</span>
          <strong id="detailDelivery">${initialDelivery === 0 ? 'Free' : `$${initialDelivery.toFixed(2)}`}</strong>
        </div>
        <div class="detail-meta-row detail-total-row">
          <span>Estimated Total</span>
          <span id="detailGrandTotal">$${initialTotal.toFixed(2)}</span>
        </div>
      </div>

      <div class="detail-purchase-row">
        <label for="detailQtyInput"><strong>Quantity:</strong></label>
        <input
          id="detailQtyInput"
          type="number"
          class="input qty-input"
          min="1"
          max="${Math.max(1, Number(product.stock) || 1)}"
          value="1"
          ${product.stock <= 0 ? 'disabled' : ''}
        />
        <button
          type="button"
          id="detailAddToCartBtn"
          class="btn btn-primary"
          ${product.stock <= 0 ? 'disabled' : ''}
        >
          ${product.stock > 0 ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  `;

  const qtyInput = document.getElementById('detailQtyInput');
  if (qtyInput) {
    qtyInput.addEventListener('input', () => updateDetailPricing(product));
  }

  const addBtn = document.getElementById('detailAddToCartBtn');
  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const qty = Math.max(1, Math.floor(Number(qtyInput?.value) || 1));
      await addToCart(product.id, qty);
    });
  }

  const related = getRelatedProducts(product);
  els.relatedProductsGrid.innerHTML = related.length
    ? related.map((item) => buildProductCardHtml(item, true)).join('')
    : '<p class="muted">No other products available yet.</p>';
}

function openProductDetail(productId) {
  state.selectedProductId = productId;
  switchView('detail');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function addToCart(productId, quantity = 1) {
  if (!state.token) {
    showBanner('Please sign in first to add items to your cart.', 'error');
    switchView('account');
    return;
  }
  try {
    state.cart = await api('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity })
    });
    renderCartUI();
    showBanner(`Added ${quantity} item${quantity > 1 ? 's' : ''} to cart.`);
  } catch (err) {
    showBanner(err.message, 'error');
  }
}

async function loadManageProducts() {
  const list = await api('/api/products');
  state.allProducts = list;
  els.manageList.innerHTML = list.length
    ? list
        .map(
          (p) => `
    <div class="card manage-item" data-product-row="${p.id}">
      <div class="manage-row">
        <div>
          <strong>${p.name}</strong> <span class="badge">${p.category}</span>
          <div class="muted">$${Number(p.price).toFixed(2)} · Stock: ${p.stock}</div>
        </div>
        <div class="form-buttons">
          <button type="button" class="btn btn-outline" data-edit="${p.id}">Edit</button>
          <button type="button" class="btn btn-danger" data-delete="${p.id}">Delete</button>
        </div>
      </div>
      <form class="inline-edit-form hidden" data-edit-form="${p.id}" autocomplete="off">
        <div>
          <label>Name</label>
          <input type="text" name="name" class="input" required value="${escapeAttr(p.name)}" />
        </div>
        <div>
          <label>Category</label>
          <input type="text" name="category" class="input" required value="${escapeAttr(p.category)}" />
        </div>
        <div>
          <label>Price</label>
          <input type="number" step="0.01" min="0.01" name="price" class="input" required value="${p.price}" />
        </div>
        <div>
          <label>Stock</label>
          <input type="number" min="0" name="stock" class="input" required value="${p.stock}" />
        </div>
        <div class="full-span">
          <label>Image URL</label>
          <input type="url" name="image" class="input" value="${escapeAttr(p.image || '')}" />
        </div>
        <div class="full-span">
          <label>Description</label>
          <input type="text" name="description" class="input" value="${escapeAttr(p.description || '')}" />
        </div>
        <div class="inline-edit-actions">
          <button type="submit" class="btn btn-primary">Save Changes</button>
          <button type="button" class="btn btn-ghost" data-cancel-inline="${p.id}">Cancel</button>
        </div>
      </form>
    </div>
  `
        )
        .join('')
    : '<p class="muted">No products in catalog yet. Use the form above to add one.</p>';

  els.manageList.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.edit;
      els.manageList.querySelectorAll('[data-edit-form]').forEach((form) => {
        form.classList.toggle('hidden', form.dataset.editForm !== id);
      });
    });
  });

  els.manageList.querySelectorAll('[data-cancel-inline]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const form = els.manageList.querySelector(`[data-edit-form="${btn.dataset.cancelInline}"]`);
      if (form) form.classList.add('hidden');
    });
  });

  els.manageList.querySelectorAll('[data-edit-form]').forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.token) {
        showBanner('Please sign in first to edit products.', 'error');
        switchView('account');
        return;
      }
      const id = form.dataset.editForm;
      const fd = new FormData(form);
      const payload = {
        name: fd.get('name'),
        category: fd.get('category'),
        price: Number(fd.get('price')),
        stock: Number(fd.get('stock')),
        image: fd.get('image'),
        description: fd.get('description')
      };
      try {
        await api(`/api/products/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        showBanner('Product updated.');
        await loadManageProducts();
        await loadProducts();
      } catch (err) {
        showBanner(err.message, 'error');
      }
    });
  });

  els.manageList.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!state.token) {
        showBanner('Please sign in first to delete products.', 'error');
        switchView('account');
        return;
      }
      const id = btn.dataset.delete;
      const prod = list.find((item) => item.id === id);
      const label = prod ? `"${prod.name}"` : 'this product';
      if (!window.confirm(`Are you sure to delete ${label}?`)) {
        return;
      }
      try {
        await api(`/api/products/${id}`, { method: 'DELETE' });
        showBanner('Product removed.');
        await loadManageProducts();
        await loadProducts();
      } catch (err) {
        showBanner(err.message, 'error');
      }
    });
  });
}

function renderCartUI() {
  els.cartCount.textContent = state.cart.totalItems;

  const itemsSubtotal = Number(state.cart.totalAmount || 0);
  const deliveryCharge =
    state.cart.items.length === 0 ? 0 : getDeliveryCharge(itemsSubtotal, 1);
  const grandTotal = Number((itemsSubtotal + deliveryCharge).toFixed(2));

  els.cartSubtotal.textContent = `$${itemsSubtotal.toFixed(2)}`;
  els.cartDelivery.textContent =
    state.cart.items.length === 0
      ? '$0.00'
      : deliveryCharge === 0
        ? 'Free'
        : `$${deliveryCharge.toFixed(2)}`;
  els.cartTotal.textContent = `$${grandTotal.toFixed(2)}`;

  if (!state.cart.items.length) {
    setCheckoutStep(null);
  }

  if (!state.token) {
    els.cartItems.innerHTML =
      '<div class="card"><p class="muted">Please sign in to view and manage your shopping cart.</p></div>';
    return;
  }

  els.cartItems.innerHTML = state.cart.items.length
    ? state.cart.items
        .map((item) => {
          const catalogMatch = state.allProducts.find((p) => p.id === item.productId) || {};
          const category = item.category || catalogMatch.category || 'General';
          const description =
            item.description || catalogMatch.description || 'No description provided.';
          const itemDelivery = getDeliveryCharge(item.price, item.quantity);

          return `
      <div class="cart-item">
        <div class="cart-item-top">
          ${
            item.image
              ? `<img class="cart-item-img" src="${escapeAttr(item.image)}" alt="${escapeAttr(item.name)}" />`
              : `<div class="cart-item-placeholder">No Image</div>`
          }
          <div class="cart-item-info">
            <span class="badge">${escapeAttr(category)}</span>
            <h4 class="cart-item-title">${escapeAttr(item.name)}</h4>
            <p class="cart-item-desc">${escapeAttr(description)}</p>
            <div class="cart-item-meta">
              <span><strong>$${Number(item.price).toFixed(2)}</strong> each</span>
              <span>· In stock: ${item.stock}</span>
              <span>· Delivery: ${itemDelivery === 0 ? 'Free' : `$${itemDelivery.toFixed(2)}`}</span>
            </div>
          </div>
        </div>
        <div class="cart-item-bottom">
          <div>
            <div class="muted">Qty: ${item.quantity}</div>
            <div class="cart-item-subtotal">Subtotal: $${Number(item.subtotal).toFixed(2)}</div>
          </div>
          <div class="form-buttons">
            <button type="button" class="btn btn-ghost" data-cart-detail="${escapeAttr(item.productId)}">Details</button>
            <button type="button" class="btn btn-outline" data-qty="${escapeAttr(item.productId)}" data-delta="-1">−</button>
            <button type="button" class="btn btn-outline" data-qty="${escapeAttr(item.productId)}" data-delta="1">+</button>
            <button type="button" class="btn btn-ghost" data-remove="${escapeAttr(item.productId)}">✕</button>
          </div>
        </div>
      </div>
    `;
        })
        .join('')
    : '<div class="card"><p class="muted">Your cart is empty. Browse the catalog to add products.</p></div>';

  els.cartItems.querySelectorAll('[data-cart-detail]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openProductDetail(btn.dataset.cartDetail);
    });
  });

  els.cartItems.querySelectorAll('[data-qty]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const current = state.cart.items.find((i) => i.productId === btn.dataset.qty);
      if (!current) return;
      try {
        state.cart = await api(`/api/cart/${btn.dataset.qty}`, {
          method: 'PATCH',
          body: JSON.stringify({ quantity: current.quantity + Number(btn.dataset.delta) })
        });
        renderCartUI();
      } catch (err) {
        showBanner(err.message, 'error');
      }
    });
  });

  els.cartItems.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        state.cart = await api(`/api/cart/${btn.dataset.remove}`, { method: 'DELETE' });
        renderCartUI();
      } catch (err) {
        showBanner(err.message, 'error');
      }
    });
  });
}

async function loadCart() {
  if (!state.token) return;
  state.cart = await api('/api/cart');
  renderCartUI();
}

async function loadOrders() {
  if (!state.token) {
    els.ordersList.innerHTML = '<p class="muted">Please sign in to view your orders.</p>';
    return;
  }
  const list = await api('/api/orders');
  els.ordersList.innerHTML = list.length
    ? list
        .map(
          (o) => `
      <div class="card">
        <div class="manage-row">
          <strong>Order ${escapeAttr(o.id)}</strong>
          <span class="badge">${escapeAttr(o.status)}</span>
        </div>
        <p class="muted">Ship to: ${escapeAttr(o.shippingAddress)}${
          o.upiId ? ` · Paid via UPI: ${escapeAttr(maskUpiId(o.upiId))}` : ''
        }</p>
        <ul>
          ${o.items.map((i) => `<li>${escapeAttr(i.name)} × ${i.quantity} ($${Number(i.subtotal).toFixed(2)})</li>`).join('')}
        </ul>
        <strong>Total: $${Number(o.totalAmount).toFixed(2)}</strong>
      </div>
    `
        )
        .join('')
    : '<p class="muted">No orders placed yet.</p>';
}

function setCheckoutStep(step) {
  const showStart = step === null;
  els.startCheckoutBtn.classList.toggle('hidden', !showStart);
  els.checkoutStepAddress.classList.toggle('hidden', step !== 'address');
  els.checkoutStepUpi.classList.toggle('hidden', step !== 'upi');
  els.checkoutStepSecurity.classList.toggle('hidden', step !== 'security');
}

function resetCheckoutFlow() {
  els.shippingAddress.value = '';
  els.upiIdInput.value = '';
  els.securityConfirmCheck.checked = false;
  document.querySelectorAll('[data-upi-preset]').forEach((chip) => chip.classList.remove('active'));
  setCheckoutStep(null);
}

els.adBrowseBtn.addEventListener('click', () => {
  switchView('catalog');
  els.searchInput.focus();
});

els.closeAdBtn.addEventListener('click', () => {
  els.promoAd.classList.add('hidden');
});

els.navBtns.catalog.addEventListener('click', () => switchView('catalog'));
els.navBtns.manage.addEventListener('click', () => switchView('manage'));
els.navBtns.orders.addEventListener('click', () => switchView('orders'));
els.navBtns.account.addEventListener('click', () => switchView('account'));
els.navBtns.cart.addEventListener('click', () => switchView('cart'));
els.backToCatalogBtn.addEventListener('click', () => switchView('catalog'));
els.continueShoppingBtn.addEventListener('click', () => switchView('catalog'));

els.searchInput.addEventListener('input', loadProducts);
els.categoryFilter.addEventListener('change', loadProducts);

function handleGridClick(e) {
  const addBtn = e.target.closest('[data-add-cart]');
  if (addBtn) {
    addToCart(addBtn.dataset.addCart, 1);
    return;
  }
  const detailTrigger = e.target.closest('[data-open-detail]');
  if (detailTrigger) {
    openProductDetail(detailTrigger.dataset.openDetail);
  }
}

els.productGrid.addEventListener('click', handleGridClick);
els.relatedProductsGrid.addEventListener('click', handleGridClick);

els.productForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!state.token) {
    showBanner('Please sign in first to add products.', 'error');
    switchView('account');
    return;
  }
  const payload = {
    name: els.prodName.value,
    category: els.prodCategory.value,
    price: Number(els.prodPrice.value),
    stock: Number(els.prodStock.value),
    image: els.prodImage.value,
    description: els.prodDesc.value
  };
  try {
    await api('/api/products', { method: 'POST', body: JSON.stringify(payload) });
    showBanner('Product added.');
    els.productForm.reset();
    await loadManageProducts();
    await loadProducts();
  } catch (err) {
    showBanner(err.message, 'error');
  }
});

els.flipToRegisterBtn.addEventListener('click', (e) => {
  e.preventDefault();
  els.authFlipCard.classList.add('is-flipped');
});

els.flipToLoginBtn.addEventListener('click', (e) => {
  e.preventDefault();
  els.authFlipCard.classList.remove('is-flipped');
});

async function handleAuthSuccess(res) {
  state.token = res.token;
  state.user = res.user;
  localStorage.setItem('store_token', res.token);
  els.loginForm.reset();
  els.registerForm.reset();
  els.authFlipCard.classList.remove('is-flipped');
  renderAccountView();
  await loadCart();
  showBanner(`Welcome, ${res.user.name}!`);
  switchView('catalog');
}

els.loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: els.loginEmail.value,
        password: els.loginPassword.value
      })
    });
    await handleAuthSuccess(res);
  } catch (err) {
    showBanner(err.message, 'error');
  }
});

els.registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const res = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: els.regName.value,
        email: els.regEmail.value,
        password: els.regPassword.value
      })
    });
    await handleAuthSuccess(res);
  } catch (err) {
    showBanner(err.message, 'error');
  }
});

document.querySelectorAll('.toggle-password').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';

    const closedIcon = btn.querySelector('.icon-closed');
    const openIcon = btn.querySelector('.icon-open');
    if (closedIcon) closedIcon.classList.toggle('hidden', isHidden);
    if (openIcon) openIcon.classList.toggle('hidden', !isHidden);

    btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  });
});

els.logoutBtn.addEventListener('click', () => {
  state.token = '';
  state.user = null;
  state.cart = { items: [], totalItems: 0, totalAmount: 0 };
  localStorage.removeItem('store_token');
  els.loginForm.reset();
  els.registerForm.reset();
  resetCheckoutFlow();
  renderCartUI();
  renderAccountView();
  showBanner('Signed out.');
});

els.startCheckoutBtn.addEventListener('click', () => {
  if (!state.token) {
    showBanner('Please sign in before placing an order.', 'error');
    switchView('account');
    return;
  }
  if (!state.cart.items.length) {
    showBanner('Your cart is empty.', 'error');
    return;
  }
  setCheckoutStep('address');
  els.shippingAddress.focus();
});

els.cancelCheckoutBtn.addEventListener('click', () => {
  setCheckoutStep(null);
});

els.toUpiStepBtn.addEventListener('click', () => {
  const addr = els.shippingAddress.value.trim();
  if (addr.length < 6) {
    showBanner('Please enter a valid shipping address.', 'error');
    els.shippingAddress.focus();
    return;
  }
  setCheckoutStep('upi');
  els.upiIdInput.focus();
});

document.querySelectorAll('[data-upi-preset]').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('[data-upi-preset]').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    els.upiIdInput.value = chip.dataset.upiPreset;
  });
});

els.upiIdInput.addEventListener('input', () => {
  const val = els.upiIdInput.value.trim().toLowerCase();
  document.querySelectorAll('[data-upi-preset]').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.upiPreset === val);
  });
});

els.backToAddressBtn.addEventListener('click', () => {
  setCheckoutStep('address');
});

els.toSecurityStepBtn.addEventListener('click', () => {
  const upi = els.upiIdInput.value.trim().toLowerCase();
  const upiRegex = /^[a-z0-9._-]{2,}@[a-z0-9.-]{2,}$/;
  if (!upiRegex.test(upi)) {
    showBanner('Please enter or select a valid UPI ID (e.g. name@okaxis).', 'error');
    els.upiIdInput.focus();
    return;
  }
  els.reviewAddress.textContent = els.shippingAddress.value.trim();
  els.reviewUpi.textContent = maskUpiId(upi);
  els.reviewTotal.textContent = els.cartTotal.textContent;
  els.securityConfirmCheck.checked = false;
  setCheckoutStep('security');
});

els.backToUpiBtn.addEventListener('click', () => {
  setCheckoutStep('upi');
});

els.checkoutBtn.addEventListener('click', async () => {
  if (!state.token) {
    showBanner('Please sign in before placing an order.', 'error');
    return;
  }
  if (!els.securityConfirmCheck.checked) {
    showBanner('Please tick the security verification checkbox first.', 'error');
    return;
  }
  try {
    const order = await api('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        shippingAddress: els.shippingAddress.value.trim(),
        upiId: els.upiIdInput.value.trim().toLowerCase(),
        securityVerified: true
      })
    });
    state.cart = { items: [], totalItems: 0, totalAmount: 0 };
    resetCheckoutFlow();
    renderCartUI();
    showBanner(`Order ${order.id} placed securely via UPI!`);
    loadProducts();
    switchView('orders');
  } catch (err) {
    showBanner(err.message, 'error');
  }
});

initSession();
loadProducts();