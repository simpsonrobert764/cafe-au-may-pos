import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  pushSale, pushMenuItem, deleteMenuItem,
  pushClosedDay, pullAll,
  pushAllMenu, pushAllSales, pushAllClosedDays,
} from './supabase.js'

// ═══════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════

const CATEGORIES = ['Drinks', 'Sweet', 'Savory', 'Add-Ons']

const DEFAULT_MENU = [
  { id: 'm1',  name: 'Drip Coffee',     price: 3.00, cost: 0.40, category: 'Drinks',  emoji: '☕' },
  { id: 'm2',  name: 'Iced Coffee',     price: 4.00, cost: 0.50, category: 'Drinks',  emoji: '🧊' },
  { id: 'm3',  name: 'Latte',           price: 5.00, cost: 0.80, category: 'Drinks',  emoji: '🥛' },
  { id: 'm4',  name: 'Cappuccino',      price: 5.00, cost: 0.80, category: 'Drinks',  emoji: '☕' },
  { id: 'm5',  name: 'Matcha Latte',    price: 5.50, cost: 1.00, category: 'Drinks',  emoji: '🍵' },
  { id: 'm6',  name: 'Hot Chocolate',   price: 4.50, cost: 0.70, category: 'Drinks',  emoji: '🍫' },
  { id: 'm7',  name: 'Tea',             price: 3.00, cost: 0.30, category: 'Drinks',  emoji: '🫖' },
  { id: 'm8',  name: 'Espresso',        price: 3.00, cost: 0.40, category: 'Drinks',  emoji: '⚡' },
  { id: 'm9',  name: 'Croissant',       price: 4.00, cost: 1.20, category: 'Sweet',   emoji: '🥐' },
  { id: 'm10', name: 'Muffin',          price: 3.50, cost: 0.90, category: 'Sweet',   emoji: '🧁' },
  { id: 'm11', name: 'Scone',           price: 3.50, cost: 0.80, category: 'Sweet',   emoji: '🍪' },
  { id: 'm12', name: 'Cookie',          price: 3.00, cost: 0.60, category: 'Sweet',   emoji: '🍪' },
  { id: 'm13', name: 'Banana Bread',    price: 4.00, cost: 1.00, category: 'Sweet',   emoji: '🍌' },
  { id: 'm14', name: 'Avocado Toast',   price: 8.00, cost: 2.50, category: 'Savory',  emoji: '🥑' },
  { id: 'm15', name: 'Egg Sandwich',    price: 7.00, cost: 2.00, category: 'Savory',  emoji: '🥚' },
  { id: 'm16', name: 'Bagel & Cream',   price: 5.00, cost: 1.20, category: 'Savory',  emoji: '🥯' },
  { id: 'm17', name: 'Quiche Slice',    price: 6.00, cost: 1.80, category: 'Savory',  emoji: '🥧' },
  { id: 'm18', name: 'Oat Milk',        price: 1.00, cost: 0.30, category: 'Add-Ons', emoji: '🥛' },
  { id: 'm19', name: 'Extra Shot',      price: 1.00, cost: 0.20, category: 'Add-Ons', emoji: '💉' },
  { id: 'm20', name: 'Syrup',           price: 0.75, cost: 0.10, category: 'Add-Ons', emoji: '🍯' },
]

const TABS = [
  { id: 'register', label: 'Register', icon: '☕' },
  { id: 'pnl',      label: 'P&L',      icon: '📊' },
  { id: 'customers', label: 'Customers', icon: '👥' },
  { id: 'menu',     label: 'Menu',     icon: '📋' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
]

// ═══════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key)
      return stored ? JSON.parse(stored) : defaultValue
    } catch { return defaultValue }
  })
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* noop */ }
  }, [key, value])
  return [value, setValue]
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e) => setMatches(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])
  return matches
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
const dayId = (d = new Date()) => d.toISOString().slice(0, 10)
const fmt = (n) => '$' + Number(n).toFixed(2)
const pct = (n) => (n * 100).toFixed(1) + '%'
function marginColor(price, cost) {
  const m = price > 0 ? (price - cost) / price : 0
  if (m >= 0.7) return '#4caf50'
  if (m >= 0.5) return '#c9a96e'
  return '#e57373'
}

// ═══════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════

export default function App() {
  // ── State ──
  const [menu, setMenu] = useLocalStorage('cam_menu', DEFAULT_MENU)
  const [sales, setSales] = useLocalStorage('cam_sales', [])
  const [closedDays, setClosedDays] = useLocalStorage('cam_closedDays', [])
  const [tab, setTab] = useState('register')
  const [category, setCategory] = useState('Drinks')
  const [order, setOrder] = useState([])          // [{ ...menuItem, qty }]
  const [customerName, setCustomerName] = useState('')
  const [paymentMethod, setPaymentMethod] = useState(null) // null | 'Cash' | 'Venmo'
  const [flashId, setFlashId] = useState(null)
  const [orderOpen, setOrderOpen] = useState(false)
  const [modal, setModal] = useState(null)
  const [editItem, setEditItem] = useState(null)
  const [newItem, setNewItem] = useState({ name: '', price: '', cost: '', category: 'Drinks', emoji: '☕' })
  const [pnlDay, setPnlDay] = useState(dayId())
  const [hydrated, setHydrated] = useState(false)

  const isLandscape = useMediaQuery('(min-width: 850px)')
  const today = dayId()
  const isDayClosed = closedDays.includes(today)

  // ── Supabase hydration: always pull remote and merge ──
  useEffect(() => {
    (async () => {
      const remote = await pullAll()
      if (remote) {
        // Menu: prefer remote if it exists, otherwise keep local
        if (remote.menu.length) setMenu(remote.menu)
        // Sales: merge local + remote by id, remote wins on conflict
        if (remote.sales.length) {
          setSales(prev => {
            const map = new Map()
            prev.forEach(s => map.set(s.id, s))
            remote.sales.forEach(s => map.set(s.id, s))
            return [...map.values()].sort((a, b) => new Date(b.time) - new Date(a.time))
          })
        }
        // Closed days: union of local + remote
        if (remote.closedDays.length) {
          setClosedDays(prev => [...new Set([...prev, ...remote.closedDays])])
        }
      }
      setHydrated(true)
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Customer autocomplete list ──
  const allCustomers = useMemo(() => {
    const names = new Set()
    sales.forEach(s => { if (s.customer) names.add(s.customer) })
    return [...names].sort()
  }, [sales])

  // ── Flash animation ──
  const flash = useCallback((id) => {
    setFlashId(id)
    setTimeout(() => setFlashId(null), 200)
  }, [])

  // ── Order actions ──
  const addToOrder = useCallback((item) => {
    if (isDayClosed) return
    flash(item.id)
    setOrder(prev => {
      const idx = prev.findIndex(o => o.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 }
        return next
      }
      return [...prev, { ...item, qty: 1 }]
    })
    if (!isLandscape) setOrderOpen(true)
  }, [isDayClosed, flash, isLandscape])

  const updateQty = useCallback((id, delta) => {
    setOrder(prev => {
      const next = prev.map(o => o.id === id ? { ...o, qty: o.qty + delta } : o).filter(o => o.qty > 0)
      if (next.length === 0 && !isLandscape) setOrderOpen(false)
      return next
    })
  }, [isLandscape])

  const clearOrder = useCallback(() => {
    setOrder([])
    setCustomerName('')
    if (!isLandscape) setOrderOpen(false)
  }, [isLandscape])

  const orderTotal = useMemo(() => order.reduce((s, o) => s + o.price * o.qty, 0), [order])
  const orderCost = useMemo(() => order.reduce((s, o) => s + o.cost * o.qty, 0), [order])

  const completeSale = useCallback(() => {
    if (order.length === 0 || isDayClosed || !customerName.trim()) return
    const sale = {
      id: uid(),
      items: order.map(o => ({ id: o.id, name: o.name, price: o.price, cost: o.cost, qty: o.qty, emoji: o.emoji })),
      total: orderTotal,
      cost: orderCost,
      time: new Date().toISOString(),
      customer: customerName.trim(),
      dayId: today,
      paymentMethod,
    }
    setSales(prev => [sale, ...prev])
    pushSale(sale)
    setOrder([])
    setCustomerName('')
    if (!isLandscape) setOrderOpen(false)
    // paymentMethod stays sticky
  }, [order, orderTotal, orderCost, customerName, today, paymentMethod, isDayClosed, isLandscape])

  // ── Day management ──
  const closeDay = useCallback(() => {
    if (!closedDays.includes(today)) {
      setClosedDays(prev => [...prev, today])
      pushClosedDay(today)
    }
    setModal(null)
  }, [closedDays, today])

  // ── P&L helpers ──
  const availableDays = useMemo(() => {
    const days = new Set()
    sales.forEach(s => days.add(s.dayId))
    days.add(today)
    return [...days].sort().reverse()
  }, [sales, today])

  const daySales = useMemo(() => sales.filter(s => s.dayId === pnlDay), [sales, pnlDay])

  const pnlStats = useMemo(() => {
    const revenue = daySales.reduce((s, o) => s + o.total, 0)
    const cost = daySales.reduce((s, o) => s + o.cost, 0)
    const profit = revenue - cost
    const margin = revenue > 0 ? profit / revenue : 0
    const cash = daySales.filter(s => s.paymentMethod === 'Cash').reduce((s, o) => s + o.total, 0)
    const venmo = daySales.filter(s => s.paymentMethod === 'Venmo').reduce((s, o) => s + o.total, 0)
    const unpaid = daySales.filter(s => !s.paymentMethod).reduce((s, o) => s + o.total, 0)
    return { revenue, cost, profit, margin, cash, venmo, unpaid, count: daySales.length }
  }, [daySales])

  // ── Customer leaderboard ──
  const leaderboard = useMemo(() => {
    const map = {}
    sales.forEach(s => {
      const name = s.customer || 'Anonymous'
      if (!map[name]) map[name] = { name, total: 0, visits: 0, items: {} }
      map[name].total += s.total
      map[name].visits += 1
      s.items.forEach(i => {
        map[name].items[i.name] = (map[name].items[i.name] || 0) + i.qty
      })
    })
    return Object.values(map)
      .map(c => ({
        ...c,
        avg: c.visits > 0 ? c.total / c.visits : 0,
        favorite: Object.entries(c.items).sort((a, b) => b[1] - a[1])[0]?.[0] || '—',
      }))
      .sort((a, b) => b.total - a.total)
  }, [sales])

  // ── Menu editor ──
  const saveMenuItem = useCallback((item) => {
    setMenu(prev => {
      const idx = prev.findIndex(m => m.id === item.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = item
        return next
      }
      return [...prev, item]
    })
    pushMenuItem(item)
    setEditItem(null)
  }, [])

  const removeMenuItem = useCallback((id) => {
    setMenu(prev => prev.filter(m => m.id !== id))
    deleteMenuItem(id)
    setModal(null)
  }, [])

  const addNewItem = useCallback(() => {
    const item = {
      id: uid(),
      name: newItem.name.trim(),
      price: parseFloat(newItem.price) || 0,
      cost: parseFloat(newItem.cost) || 0,
      category: newItem.category,
      emoji: newItem.emoji,
    }
    if (!item.name) return
    setMenu(prev => [...prev, item])
    pushMenuItem(item)
    setNewItem({ name: '', price: '', cost: '', category: 'Drinks', emoji: '☕' })
  }, [newItem])

  // ── Settings: export/import/clear ──
  const exportData = useCallback(() => {
    const data = {
      version: 1,
      exportedAt: new Date().toISOString(),
      menu, sales, closedDays,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `cafe-au-may-backup-${dayId()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [menu, sales, closedDays])

  const importFileRef = useRef(null)

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        setModal({
          type: 'import',
          data,
          summary: `${data.menu?.length || 0} menu items, ${data.sales?.length || 0} sales, ${data.closedDays?.length || 0} closed days`,
        })
      } catch { alert('Invalid JSON file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const confirmImport = useCallback((data) => {
    if (data.menu) { setMenu(data.menu); pushAllMenu(data.menu) }
    if (data.sales) { setSales(data.sales); pushAllSales(data.sales) }
    if (data.closedDays) { setClosedDays(data.closedDays); pushAllClosedDays(data.closedDays) }
    setModal(null)
  }, [])

  const clearAllData = useCallback(() => {
    setMenu(DEFAULT_MENU)
    setSales([])
    setClosedDays([])
    setOrder([])
    setCustomerName('')
    pushAllMenu(DEFAULT_MENU)
    pushAllSales([])
    pushAllClosedDays([])
    setModal(null)
  }, [])

  // ── CSV export helper ──
  const downloadCSV = useCallback((filename, headers, rows) => {
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportPnlCSV = useCallback(() => {
    const headers = ['Time', 'Customer', 'Items', 'Total', 'Cost', 'Profit', 'Payment']
    const rows = daySales.map(s => [
      new Date(s.time).toLocaleTimeString(),
      s.customer || '—',
      s.items.map(i => `${i.qty}x ${i.name}`).join('; '),
      s.total.toFixed(2),
      s.cost.toFixed(2),
      (s.total - s.cost).toFixed(2),
      s.paymentMethod || 'Unpaid',
    ])
    downloadCSV(`pnl-${pnlDay}.csv`, headers, rows)
  }, [daySales, pnlDay, downloadCSV])

  const exportCustomersCSV = useCallback(() => {
    const headers = ['Rank', 'Customer', 'Total Spent', 'Visits', 'Avg Order', 'Favorite']
    const rows = leaderboard.map((c, i) => [
      i + 1, c.name, c.total.toFixed(2), c.visits, c.avg.toFixed(2), c.favorite,
    ])
    downloadCSV('customers.csv', headers, rows)
  }, [leaderboard, downloadCSV])

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  if (!hydrated) {
    return <div style={S.loadingWrap}><div style={S.loadingText}>Cafe Au May</div></div>
  }

  return (
    <div style={S.root}>
      <style>{`
        .menu-card:hover { background: #f9f5ef !important; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.08) !important; }
        .menu-card:active { transform: scale(0.97) !important; }
        .cat-tab:hover { border-color: #c9a96e !important; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-secondary:hover { background: #f5f0e8 !important; }
        .settings-btn:hover { background: #faf6f1 !important; }
        .close-day-btn:hover { background: #f5f0e8 !important; }
        .qty-btn:hover { background: #e8e2da !important; }
        .cat-tabs::-webkit-scrollbar, .day-pills::-webkit-scrollbar { display: none; }
        .sheet-overlay-enter { animation: fadeIn 200ms ease-out; }
        .sheet-enter { animation: slideUp 250ms ease-out; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @media (hover: none) {
          .menu-card:hover { background: inherit !important; transform: none !important; box-shadow: 0 1px 3px rgba(0,0,0,0.04) !important; }
          .cat-tab:hover { border-color: inherit !important; }
          .btn-primary:hover { opacity: 1; }
          .btn-secondary:hover { background: inherit !important; }
          .settings-btn:hover { background: inherit !important; }
          .close-day-btn:hover { background: inherit !important; }
          .qty-btn:hover { background: inherit !important; }
        }
      `}</style>
      {/* ── Main content ── */}
      <div style={S.main}>
        {tab === 'register' && (
          <RegisterView
            menu={menu} category={category} setCategory={setCategory}
            addToOrder={addToOrder} flashId={flashId} isDayClosed={isDayClosed}
            order={order} orderTotal={orderTotal} orderOpen={orderOpen}
            setOrderOpen={setOrderOpen} updateQty={updateQty}
            customerName={customerName} setCustomerName={setCustomerName}
            allCustomers={allCustomers} paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod} clearOrder={clearOrder}
            completeSale={completeSale} isLandscape={isLandscape}
            today={today} setModal={setModal}
            sales={sales}
          />
        )}
        {tab === 'pnl' && (
          <PnlView
            availableDays={availableDays} pnlDay={pnlDay} setPnlDay={setPnlDay}
            pnlStats={pnlStats} daySales={daySales} exportCSV={exportPnlCSV}
            closedDays={closedDays}
          />
        )}
        {tab === 'customers' && (
          <CustomersView leaderboard={leaderboard} exportCSV={exportCustomersCSV} />
        )}
        {tab === 'menu' && (
          <MenuView
            menu={menu} editItem={editItem} setEditItem={setEditItem}
            saveMenuItem={saveMenuItem}
            newItem={newItem} setNewItem={setNewItem} addNewItem={addNewItem}
            setModal={setModal}
          />
        )}
        {tab === 'settings' && (
          <SettingsView
            menu={menu} sales={sales} closedDays={closedDays}
            exportData={exportData} importFileRef={importFileRef}
            setModal={setModal}
          />
        )}
      </div>

      {/* ── Bottom tab bar ── */}
      <div style={S.tabBar}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...S.tabBtn, ...(tab === t.id ? S.tabBtnActive : {}) }}
          >
            <span style={S.tabIcon}>{t.icon}</span>
            <span style={{ ...S.tabLabel, ...(tab === t.id ? S.tabLabelActive : {}) }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── Modal overlay ── */}
      {modal && (
        <div style={S.modalOverlay} onClick={() => setModal(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            {modal.type === 'closeDay' && (
              <>
                <h3 style={S.modalTitle}>Close Day?</h3>
                <p style={S.modalText}>This will prevent new orders for today ({today}). You cannot undo this.</p>
                <div style={S.modalActions}>
                  <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                  <button style={S.btnDanger} onClick={closeDay}>Close Day</button>
                </div>
              </>
            )}
            {modal.type === 'deleteMenuItem' && (
              <>
                <h3 style={S.modalTitle}>Delete Item?</h3>
                <p style={S.modalText}>Remove "{modal.name}" from the menu?</p>
                <div style={S.modalActions}>
                  <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                  <button style={S.btnDanger} onClick={() => removeMenuItem(modal.id)}>Delete</button>
                </div>
              </>
            )}
            {modal.type === 'import' && (
              <>
                <h3 style={S.modalTitle}>Import Data?</h3>
                <p style={S.modalText}>This will replace ALL current data with: {modal.summary}</p>
                <div style={S.modalActions}>
                  <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                  <button style={S.btnPrimary} onClick={() => confirmImport(modal.data)}>Import</button>
                </div>
              </>
            )}
            {modal.type === 'clearAll' && (
              <>
                <h3 style={S.modalTitle}>Clear All Data?</h3>
                <p style={S.modalText}>This will delete all sales, reset the menu to defaults, and clear closed days. This cannot be undone.</p>
                <div style={S.modalActions}>
                  <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                  <button style={S.btnDanger} onClick={() => setModal({ type: 'clearAllConfirm' })}>Yes, Clear Everything</button>
                </div>
              </>
            )}
            {modal.type === 'clearAllConfirm' && (
              <>
                <h3 style={S.modalTitle}>Are you absolutely sure?</h3>
                <p style={S.modalText}>Type "DELETE" in your mind and click to confirm.</p>
                <div style={S.modalActions}>
                  <button style={S.btnSecondary} onClick={() => setModal(null)}>Cancel</button>
                  <button style={S.btnDanger} onClick={clearAllData}>Permanently Delete All</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input for import */}
      <input
        ref={importFileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// REGISTER VIEW
// ═══════════════════════════════════════════════════════════

function RegisterView({
  menu, category, setCategory, addToOrder, flashId, isDayClosed,
  order, orderTotal, orderOpen, setOrderOpen, updateQty,
  customerName, setCustomerName, allCustomers, paymentMethod,
  setPaymentMethod, clearOrder, completeSale, isLandscape,
  today, setModal, sales,
}) {
  const todaySales = useMemo(() => sales.filter(s => s.dayId === today), [sales, today])
  const todayRevenue = useMemo(() => todaySales.reduce((s, o) => s + o.total, 0), [todaySales])

  const filteredMenu = useMemo(() => menu.filter(m => m.category === category), [menu, category])

  return (
    <div style={{ ...S.registerWrap, flexDirection: isLandscape ? 'row' : 'column' }}>
      {/* ── Menu grid side ── */}
      <div style={S.menuSide}>
        {/* Header */}
        <div style={S.registerHeader}>
          <div>
            <h1 style={S.brandTitle}>Cafe Au May</h1>
            <p style={S.brandSub}>{today} &middot; {todaySales.length} orders &middot; {fmt(todayRevenue)}</p>
          </div>
          {!isDayClosed ? (
            <button className="close-day-btn" style={S.closeDayBtn} onClick={() => setModal({ type: 'closeDay' })}>Close Day</button>
          ) : (
            <span style={S.dayClosedBadge}>Day Closed</span>
          )}
        </div>

        {/* Category tabs */}
        <div className="cat-tabs" style={S.catTabs}>
          {CATEGORIES.map(c => (
            <button
              key={c}
              className="cat-tab"
              onClick={() => setCategory(c)}
              style={{ ...S.catTab, ...(category === c ? S.catTabActive : {}) }}
            >{c}</button>
          ))}
        </div>

        {/* Menu grid */}
        <div style={S.menuGrid}>
          {filteredMenu.map(item => (
            <button
              key={item.id}
              className="menu-card"
              style={{
                ...S.menuCard,
                ...(flashId === item.id ? S.menuCardFlash : {}),
                ...(isDayClosed ? { opacity: 0.5 } : {}),
              }}
              onClick={() => addToOrder(item)}
              disabled={isDayClosed}
            >
              <span style={S.menuEmoji}>{item.emoji}</span>
              <span style={S.menuName}>{item.name}</span>
              <span style={S.menuPrice}>{fmt(item.price)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Order panel ── */}
      {isLandscape ? (
        <div style={S.orderSidebar}>
          <OrderPanel
            order={order} orderTotal={orderTotal} updateQty={updateQty}
            customerName={customerName} setCustomerName={setCustomerName}
            allCustomers={allCustomers} paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod} clearOrder={clearOrder}
            completeSale={completeSale} isDayClosed={isDayClosed}
          />
        </div>
      ) : (
        <>
          {/* Floating bottom bar */}
          {order.length > 0 && !orderOpen && (
            <button style={S.floatingBar} onClick={() => setOrderOpen(true)}>
              <span>{order.reduce((s, o) => s + o.qty, 0)} items</span>
              <span style={S.floatingTotal}>{fmt(orderTotal)}</span>
            </button>
          )}
          {/* Slide-up sheet */}
          {orderOpen && (
            <div className="sheet-overlay-enter" style={S.sheetOverlay} onClick={() => setOrderOpen(false)}>
              <div className="sheet-enter" style={S.sheet} onClick={e => e.stopPropagation()}>
                <div style={S.sheetHandle} />
                <OrderPanel
                  order={order} orderTotal={orderTotal} updateQty={updateQty}
                  customerName={customerName} setCustomerName={setCustomerName}
                  allCustomers={allCustomers} paymentMethod={paymentMethod}
                  setPaymentMethod={setPaymentMethod} clearOrder={clearOrder}
                  completeSale={completeSale} isDayClosed={isDayClosed}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// ORDER PANEL
// ═══════════════════════════════════════════════════════════

function OrderPanel({
  order, orderTotal, updateQty, customerName, setCustomerName,
  allCustomers, paymentMethod, setPaymentMethod, clearOrder,
  completeSale, isDayClosed,
}) {
  return (
    <div style={S.orderPanel}>
      <h2 style={S.orderTitle}>Current Order</h2>

      {order.length === 0 ? (
        <p style={S.orderEmpty}>Tap items to add them</p>
      ) : (
        <div style={S.orderList}>
          {order.map(item => (
            <div key={item.id} style={S.orderItem}>
              <span style={S.orderItemEmoji}>{item.emoji}</span>
              <div style={S.orderItemInfo}>
                <span style={S.orderItemName}>{item.name}</span>
                <span style={S.orderItemPrice}>{fmt(item.price * item.qty)}</span>
              </div>
              <div style={S.qtyControls}>
                <button className="qty-btn" style={S.qtyBtn} onClick={() => updateQty(item.id, -1)}>−</button>
                <span style={S.qtyNum}>{item.qty}</span>
                <button className="qty-btn" style={S.qtyBtn} onClick={() => updateQty(item.id, 1)}>+</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer */}
      <div style={S.orderField}>
        <label style={S.fieldLabel}>Customer</label>
        <input
          style={{ ...S.input, ...(order.length > 0 && !customerName.trim() ? { borderColor: '#e57373' } : {}) }}
          value={customerName}
          onChange={e => setCustomerName(e.target.value)}
          placeholder="Name (required)"
          list="customer-list"
        />
        <datalist id="customer-list">
          {allCustomers.map(c => <option key={c} value={c} />)}
        </datalist>
      </div>

      {/* Payment */}
      <div style={S.orderField}>
        <label style={S.fieldLabel}>Payment</label>
        <div style={S.paymentRow}>
          {['Cash', 'Venmo', null].map(m => (
            <button
              key={String(m)}
              style={{ ...S.paymentBtn, ...(paymentMethod === m ? S.paymentBtnActive : {}) }}
              onClick={() => setPaymentMethod(m)}
            >
              {m || 'Unpaid'}
            </button>
          ))}
        </div>
      </div>

      {/* Total + actions */}
      <div style={S.orderFooter}>
        <div style={S.totalRow}>
          <span style={S.totalLabel}>Total</span>
          <span style={S.totalAmount}>{fmt(orderTotal)}</span>
        </div>
        <div style={S.orderActions}>
          <button style={S.btnSecondary} onClick={clearOrder}>Clear</button>
          <button
            className="btn-primary"
            style={{ ...S.btnPrimary, ...(order.length === 0 || isDayClosed || !customerName.trim() ? { opacity: 0.5 } : {}) }}
            onClick={completeSale}
            disabled={order.length === 0 || isDayClosed || !customerName.trim()}
          >
            Complete Sale
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// P&L VIEW
// ═══════════════════════════════════════════════════════════

function PnlView({ availableDays, pnlDay, setPnlDay, pnlStats, daySales, exportCSV, closedDays }) {
  return (
    <div style={S.viewWrap}>
      <div style={S.viewHeader}>
        <h1 style={S.viewTitle}>Profit & Loss</h1>
        <button style={S.btnSmall} onClick={exportCSV}>Export CSV</button>
      </div>

      {/* Day pills */}
      <div className="day-pills" style={S.dayPills}>
        {availableDays.map(d => (
          <button
            key={d}
            onClick={() => setPnlDay(d)}
            style={{ ...S.dayPill, ...(pnlDay === d ? S.dayPillActive : {}) }}
          >
            {d}{closedDays.includes(d) ? ' ✓' : ''}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div style={S.summaryGrid}>
        <div style={S.summaryCard}>
          <span style={S.summaryLabel}>Revenue</span>
          <span style={S.summaryValue}>{fmt(pnlStats.revenue)}</span>
        </div>
        <div style={S.summaryCard}>
          <span style={S.summaryLabel}>Cost</span>
          <span style={S.summaryValue}>{fmt(pnlStats.cost)}</span>
        </div>
        <div style={S.summaryCard}>
          <span style={{ ...S.summaryLabel, color: pnlStats.profit >= 0 ? '#4caf50' : '#e57373' }}>Profit</span>
          <span style={{ ...S.summaryValue, color: pnlStats.profit >= 0 ? '#4caf50' : '#e57373' }}>{fmt(pnlStats.profit)}</span>
        </div>
        <div style={S.summaryCard}>
          <span style={S.summaryLabel}>Margin</span>
          <span style={S.summaryValue}>{pct(pnlStats.margin)}</span>
        </div>
      </div>

      {/* Payment breakdown */}
      <div style={S.paymentBreakdown}>
        <span style={S.breakdownItem}>💵 Cash: {fmt(pnlStats.cash)}</span>
        <span style={S.breakdownItem}>📱 Venmo: {fmt(pnlStats.venmo)}</span>
        <span style={S.breakdownItem}>⏳ Unpaid: {fmt(pnlStats.unpaid)}</span>
        <span style={S.breakdownItem}>📦 Orders: {pnlStats.count}</span>
      </div>

      {/* Orders list */}
      <div style={S.ordersList}>
        {daySales.length === 0 && <p style={S.emptyText}>No orders for this day</p>}
        {daySales.map(sale => (
          <div key={sale.id} style={S.saleRow}>
            <div style={S.saleTop}>
              <span style={S.saleTime}>{new Date(sale.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              {sale.customer && <span style={S.customerBadge}>{sale.customer}</span>}
              <span style={{
                ...S.paymentBadge,
                background: sale.paymentMethod === 'Cash' ? '#e8f5e9' : sale.paymentMethod === 'Venmo' ? '#e3f2fd' : '#fff3e0',
                color: sale.paymentMethod === 'Cash' ? '#2e7d32' : sale.paymentMethod === 'Venmo' ? '#1565c0' : '#e65100',
              }}>
                {sale.paymentMethod || 'Unpaid'}
              </span>
              <span style={S.saleTotal}>{fmt(sale.total)}</span>
              <span style={S.saleProfit}>+{fmt(sale.total - sale.cost)}</span>
            </div>
            <div style={S.saleItems}>
              {sale.items.map((item, i) => (
                <span key={i} style={S.saleItemChip}>{item.emoji} {item.qty > 1 ? `${item.qty}x ` : ''}{item.name}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// CUSTOMERS VIEW
// ═══════════════════════════════════════════════════════════

function CustomersView({ leaderboard, exportCSV }) {
  const medals = ['🥇', '🥈', '🥉']

  return (
    <div style={S.viewWrap}>
      <div style={S.viewHeader}>
        <h1 style={S.viewTitle}>Customer Leaderboard</h1>
        <button style={S.btnSmall} onClick={exportCSV}>Export CSV</button>
      </div>

      {leaderboard.length === 0 && <p style={S.emptyText}>No sales yet</p>}

      {/* Top 3 medal cards */}
      {leaderboard.length > 0 && (
        <div style={S.medalGrid}>
          {leaderboard.slice(0, 3).map((c, i) => (
            <div key={c.name} style={S.medalCard}>
              <span style={S.medalIcon}>{medals[i]}</span>
              <span style={S.medalName}>{c.name}</span>
              <span style={S.medalTotal}>{fmt(c.total)}</span>
              <span style={S.medalSub}>{c.visits} visits &middot; avg {fmt(c.avg)}</span>
              <span style={S.medalFav}>Fav: {c.favorite}</span>
            </div>
          ))}
        </div>
      )}

      {/* Remaining list */}
      {leaderboard.length > 3 && (
        <div style={S.leaderList}>
          {leaderboard.slice(3).map((c, i) => (
            <div key={c.name} style={S.leaderRow}>
              <span style={S.leaderRank}>#{i + 4}</span>
              <div style={S.leaderInfo}>
                <span style={S.leaderName}>{c.name}</span>
                <span style={S.leaderSub}>{c.visits} visits &middot; avg {fmt(c.avg)} &middot; fav: {c.favorite}</span>
              </div>
              <span style={S.leaderTotal}>{fmt(c.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MENU VIEW
// ═══════════════════════════════════════════════════════════

function MenuView({ menu, editItem, setEditItem, saveMenuItem, newItem, setNewItem, addNewItem, setModal }) {
  return (
    <div style={S.viewWrap}>
      <h1 style={S.viewTitle}>Menu Editor</h1>

      {CATEGORIES.map(cat => {
        const items = menu.filter(m => m.category === cat)
        if (items.length === 0) return null
        return (
          <div key={cat} style={S.menuSection}>
            <h3 style={S.menuSectionTitle}>{cat}</h3>
            {items.map(item => (
              <div key={item.id} style={S.menuEditRow}>
                {editItem?.id === item.id ? (
                  <MenuItemForm
                    item={editItem}
                    onChange={setEditItem}
                    onSave={() => saveMenuItem(editItem)}
                    onCancel={() => setEditItem(null)}
                  />
                ) : (
                  <>
                    <span style={S.menuEditEmoji}>{item.emoji}</span>
                    <span style={S.menuEditName}>{item.name}</span>
                    <span style={S.menuEditPrice}>{fmt(item.price)}</span>
                    <span style={S.menuEditCost}>cost {fmt(item.cost)}</span>
                    <span style={{ ...S.menuEditMargin, color: marginColor(item.price, item.cost) }}>
                      {pct(item.price > 0 ? (item.price - item.cost) / item.price : 0)}
                    </span>
                    <button style={S.btnIcon} onClick={() => setEditItem({ ...item })}>✏️</button>
                    <button style={S.btnIcon} onClick={() => setModal({ type: 'deleteMenuItem', id: item.id, name: item.name })}>🗑️</button>
                  </>
                )}
              </div>
            ))}
          </div>
        )
      })}

      {/* Add new item */}
      <div style={S.addItemSection}>
        <h3 style={S.menuSectionTitle}>Add New Item</h3>
        <div style={S.addItemForm}>
          <input style={S.inputSm} placeholder="Emoji" value={newItem.emoji} onChange={e => setNewItem(p => ({ ...p, emoji: e.target.value }))} maxLength={2} />
          <input style={{ ...S.inputSm, flex: 2 }} placeholder="Name" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} />
          <input style={S.inputSm} placeholder="Price" type="number" step="0.25" value={newItem.price} onChange={e => setNewItem(p => ({ ...p, price: e.target.value }))} />
          <input style={S.inputSm} placeholder="Cost" type="number" step="0.25" value={newItem.cost} onChange={e => setNewItem(p => ({ ...p, cost: e.target.value }))} />
          <select style={S.inputSm} value={newItem.category} onChange={e => setNewItem(p => ({ ...p, category: e.target.value }))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button style={S.btnPrimary} onClick={addNewItem}>Add</button>
        </div>
      </div>
    </div>
  )
}

function MenuItemForm({ item, onChange, onSave, onCancel }) {
  return (
    <div style={S.editFormRow}>
      <input style={S.inputSm} value={item.emoji} onChange={e => onChange({ ...item, emoji: e.target.value })} maxLength={2} />
      <input style={{ ...S.inputSm, flex: 2 }} value={item.name} onChange={e => onChange({ ...item, name: e.target.value })} />
      <input style={S.inputSm} type="number" step="0.25" value={item.price} onChange={e => onChange({ ...item, price: parseFloat(e.target.value) || 0 })} />
      <input style={S.inputSm} type="number" step="0.25" value={item.cost} onChange={e => onChange({ ...item, cost: parseFloat(e.target.value) || 0 })} />
      <select style={S.inputSm} value={item.category} onChange={e => onChange({ ...item, category: e.target.value })}>
        {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <button style={S.btnSmall} onClick={onSave}>Save</button>
      <button style={S.btnSecondary} onClick={onCancel}>Cancel</button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// SETTINGS VIEW
// ═══════════════════════════════════════════════════════════

function SettingsView({ menu, sales, closedDays, exportData, importFileRef, setModal }) {
  return (
    <div style={S.viewWrap}>
      <h1 style={S.viewTitle}>Settings</h1>

      {/* Data summary */}
      <div style={S.summaryGrid}>
        <div style={S.summaryCard}>
          <span style={S.summaryLabel}>Menu Items</span>
          <span style={S.summaryValue}>{menu.length}</span>
        </div>
        <div style={S.summaryCard}>
          <span style={S.summaryLabel}>Total Sales</span>
          <span style={S.summaryValue}>{sales.length}</span>
        </div>
        <div style={S.summaryCard}>
          <span style={S.summaryLabel}>Closed Days</span>
          <span style={S.summaryValue}>{closedDays.length}</span>
        </div>
        <div style={S.summaryCard}>
          <span style={S.summaryLabel}>Total Revenue</span>
          <span style={S.summaryValue}>{fmt(sales.reduce((s, o) => s + o.total, 0))}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={S.settingsActions}>
        <button className="settings-btn" style={S.settingsBtn} onClick={exportData}>
          <span style={S.settingsBtnIcon}>📦</span>
          <div>
            <span style={S.settingsBtnLabel}>Export Backup</span>
            <span style={S.settingsBtnSub}>Download JSON with all data</span>
          </div>
        </button>

        <button className="settings-btn" style={S.settingsBtn} onClick={() => importFileRef.current?.click()}>
          <span style={S.settingsBtnIcon}>📥</span>
          <div>
            <span style={S.settingsBtnLabel}>Import Backup</span>
            <span style={S.settingsBtnSub}>Replace all data from JSON file</span>
          </div>
        </button>

        <button className="settings-btn" style={{ ...S.settingsBtn, borderColor: '#e57373' }} onClick={() => setModal({ type: 'clearAll' })}>
          <span style={S.settingsBtnIcon}>🗑️</span>
          <div>
            <span style={{ ...S.settingsBtnLabel, color: '#e57373' }}>Clear All Data</span>
            <span style={S.settingsBtnSub}>Reset everything to defaults</span>
          </div>
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const C = {
  primary: '#2b2118',
  bg: '#faf6f1',
  muted: '#9a8b7c',
  gold: '#c9a96e',
  border: '#f0ebe4',
  card: '#ffffff',
  danger: '#e57373',
}

const S = {
  // Layout
  root: {
    display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden',
  },
  main: {
    flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column',
  },

  // Loading
  loadingWrap: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg,
  },
  loadingText: {
    fontFamily: "'Instrument Serif', serif", fontSize: 32, color: C.primary,
  },

  // Tab bar
  tabBar: {
    display: 'flex', borderTop: `1px solid ${C.border}`, background: C.card,
    paddingBottom: 'env(safe-area-inset-bottom)', flexShrink: 0,
  },
  tabBtn: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '8px 0', border: 'none', background: 'transparent', cursor: 'pointer',
    fontFamily: 'inherit',
  },
  tabBtnActive: { borderTop: '2px solid #c9a96e' },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 11, color: C.muted, fontWeight: 500 },
  tabLabelActive: { color: C.primary, fontWeight: 700 },

  // Register
  registerWrap: {
    display: 'flex', flex: 1, overflow: 'hidden', position: 'relative',
  },
  menuSide: {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '16px 16px 0', maxWidth: 720,
  },
  registerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  brandTitle: {
    fontFamily: "'Instrument Serif', serif", fontSize: 24, fontWeight: 400, color: C.primary,
  },
  brandSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  closeDayBtn: {
    padding: '8px 16px', borderRadius: 8, border: `1px solid ${C.border}`,
    background: C.card, fontSize: 13, fontWeight: 600, color: C.primary, cursor: 'pointer',
  },
  dayClosedBadge: {
    padding: '8px 16px', borderRadius: 8, background: '#e8f5e9', color: '#2e7d32',
    fontSize: 13, fontWeight: 600,
  },

  // Category tabs
  catTabs: {
    display: 'flex', gap: 8, marginBottom: 12, flexShrink: 0,
    overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
  },
  catTab: {
    padding: '8px 16px', borderRadius: 20, border: `1px solid ${C.border}`,
    background: C.card, fontSize: 13, fontWeight: 500, color: C.muted, cursor: 'pointer',
    transition: 'all 150ms',
  },
  catTabActive: {
    background: C.primary, color: '#fff', borderColor: C.primary,
  },

  // Menu grid
  menuGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 160px))',
    gap: 10, overflow: 'auto', paddingBottom: 80, flex: 1, justifyContent: 'center',
  },
  menuCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    padding: 14, borderRadius: 12, border: `1px solid ${C.border}`,
    background: C.card, cursor: 'pointer', transition: 'all 150ms',
    WebkitTapHighlightColor: 'transparent', aspectRatio: '1 / 1',
    fontFamily: 'inherit', color: 'inherit', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  menuCardFlash: {
    transform: 'scale(0.95)', background: '#f5f0e8',
  },
  menuEmoji: { fontSize: 24, lineHeight: 1, overflow: 'hidden' },
  menuName: {
    fontSize: 12, fontWeight: 500, textAlign: 'center', lineHeight: 1.2,
    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', wordBreak: 'break-word',
  },
  menuPrice: { fontSize: 14, fontWeight: 700, color: C.primary },

  // Order sidebar (landscape)
  orderSidebar: {
    width: 340, borderLeft: `1px solid ${C.border}`, background: C.card,
    display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    boxShadow: '-2px 0 8px rgba(0,0,0,0.04)',
  },

  // Order panel
  orderPanel: {
    display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 16,
  },
  orderTitle: {
    fontFamily: "'Instrument Serif', serif", fontSize: 20, marginBottom: 12,
    paddingBottom: 12, borderBottom: `1px solid ${C.border}`,
  },
  orderEmpty: { color: C.muted, fontSize: 14, textAlign: 'center', padding: '32px 0' },
  orderList: { flex: 1, overflow: 'auto', marginBottom: 12 },
  orderItem: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
    borderBottom: `1px solid ${C.border}`,
  },
  orderItemEmoji: { fontSize: 20, width: 28 },
  orderItemInfo: { flex: 1 },
  orderItemName: { fontSize: 14, fontWeight: 500, display: 'block' },
  orderItemPrice: { fontSize: 13, color: C.muted, display: 'block' },
  qtyControls: { display: 'flex', alignItems: 'center', gap: 8 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: '50%', border: `1px solid ${C.border}`,
    background: C.bg, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', lineHeight: 1, fontFamily: 'inherit',
  },
  qtyNum: { fontSize: 14, fontWeight: 600, minWidth: 16, textAlign: 'center' },

  // Order fields
  orderField: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 4, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${C.border}`,
    fontSize: 14, background: C.bg, outline: 'none',
  },
  paymentRow: { display: 'flex', gap: 8 },
  paymentBtn: {
    flex: 1, padding: '8px 0', borderRadius: 8, border: `1px solid ${C.border}`,
    background: C.bg, fontSize: 13, fontWeight: 500, cursor: 'pointer', textAlign: 'center',
    transition: 'all 150ms',
  },
  paymentBtnActive: {
    background: C.primary, color: '#fff', borderColor: C.primary,
  },

  // Order footer
  orderFooter: { marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${C.border}` },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  totalLabel: { fontSize: 16, fontWeight: 600 },
  totalAmount: { fontSize: 24, fontWeight: 700, fontFamily: "'Instrument Serif', serif" },
  orderActions: { display: 'flex', gap: 8 },

  // Floating bar (portrait)
  floatingBar: {
    position: 'absolute', bottom: 16, left: 16, right: 16, padding: '14px 20px',
    borderRadius: 16, background: C.primary, color: '#fff', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 600,
    border: 'none', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    zIndex: 10, fontFamily: 'inherit',
  },
  floatingTotal: { fontFamily: "'Instrument Serif', serif", fontSize: 20 },

  // Sheet (portrait)
  sheetOverlay: {
    position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100,
    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
  },
  sheet: {
    background: C.card, borderRadius: '20px 20px 0 0', maxHeight: '70vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, background: C.border,
    margin: '10px auto',
  },

  // Buttons
  btnPrimary: {
    flex: 1, padding: '12px 20px', borderRadius: 10, border: 'none',
    background: C.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
    transition: 'all 150ms',
  },
  btnSecondary: {
    padding: '12px 20px', borderRadius: 10, border: `1px solid ${C.border}`,
    background: C.card, fontSize: 14, fontWeight: 500, cursor: 'pointer',
  },
  btnDanger: {
    padding: '12px 20px', borderRadius: 10, border: 'none',
    background: C.danger, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnSmall: {
    padding: '6px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
    background: C.card, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  btnIcon: {
    border: 'none', background: 'transparent', fontSize: 16, cursor: 'pointer', padding: 4,
  },

  // Modal
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 200,
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  modalCard: {
    background: C.card, borderRadius: 16, padding: 24, maxWidth: 400, width: '100%',
  },
  modalTitle: { fontFamily: "'Instrument Serif', serif", fontSize: 20, marginBottom: 8 },
  modalText: { fontSize: 14, color: C.muted, marginBottom: 20, lineHeight: 1.5 },
  modalActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },

  // View wrappers
  viewWrap: {
    flex: 1, overflow: 'auto', padding: 16,
    WebkitOverflowScrolling: 'touch', maxWidth: 960, margin: '0 auto', width: '100%',
  },
  viewHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  viewTitle: {
    fontFamily: "'Instrument Serif', serif", fontSize: 24, fontWeight: 400,
  },
  emptyText: { color: C.muted, textAlign: 'center', padding: '32px 0', fontSize: 14 },

  // P&L
  dayPills: {
    display: 'flex', gap: 8, overflow: 'auto', marginBottom: 16, paddingBottom: 4,
    scrollbarWidth: 'none', paddingRight: 20,
  },
  dayPill: {
    padding: '6px 14px', borderRadius: 20, border: `1px solid ${C.border}`,
    background: C.card, fontSize: 12, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  dayPillActive: { background: C.primary, color: '#fff', borderColor: C.primary },

  summaryGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  summaryCard: {
    padding: 16, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column', gap: 4, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  summaryLabel: { fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryValue: { fontSize: 22, fontWeight: 700, fontFamily: "'Instrument Serif', serif" },

  paymentBreakdown: {
    display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, padding: 12,
    background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
  },
  breakdownItem: { fontSize: 13, color: C.muted },

  ordersList: {},
  saleRow: {
    padding: 14, borderRadius: 10, background: C.card, border: `1px solid ${C.border}`,
    marginBottom: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  saleTop: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 },
  saleTime: { fontSize: 13, fontWeight: 600, color: C.primary },
  customerBadge: {
    fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#f3e8ff', color: '#7c3aed', fontWeight: 500,
  },
  paymentBadge: {
    fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
  },
  saleTotal: { fontSize: 14, fontWeight: 700, marginLeft: 'auto' },
  saleProfit: { fontSize: 12, color: '#4caf50', fontWeight: 600 },
  saleItems: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  saleItemChip: {
    fontSize: 12, padding: '2px 8px', borderRadius: 8, background: C.bg, color: C.muted,
  },

  // Customers
  medalGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 10, marginBottom: 16,
  },
  medalCard: {
    padding: 16, borderRadius: 12, background: C.card, border: `1px solid ${C.border}`,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  medalIcon: { fontSize: 32 },
  medalName: { fontSize: 15, fontWeight: 700 },
  medalTotal: { fontSize: 20, fontWeight: 700, fontFamily: "'Instrument Serif', serif", color: C.gold },
  medalSub: { fontSize: 12, color: C.muted },
  medalFav: { fontSize: 11, color: C.muted, fontStyle: 'italic' },

  leaderList: {},
  leaderRow: {
    display: 'flex', alignItems: 'center', gap: 12, padding: 12,
    borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, marginBottom: 8,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  leaderRank: { fontSize: 14, fontWeight: 700, color: C.muted, width: 30 },
  leaderInfo: { flex: 1 },
  leaderName: { fontSize: 14, fontWeight: 600, display: 'block' },
  leaderSub: { fontSize: 12, color: C.muted, display: 'block' },
  leaderTotal: { fontSize: 16, fontWeight: 700, fontFamily: "'Instrument Serif', serif" },

  // Menu editor
  menuSection: { marginBottom: 20 },
  menuSectionTitle: { fontSize: 14, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  menuEditRow: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 10, background: C.card, border: `1px solid ${C.border}`, marginBottom: 6,
    flexWrap: 'wrap',
  },
  menuEditEmoji: { fontSize: 20, width: 28 },
  menuEditName: { flex: 1, fontSize: 14, fontWeight: 500, minWidth: 80 },
  menuEditPrice: { fontSize: 14, fontWeight: 700 },
  menuEditCost: { fontSize: 12, color: C.muted },
  menuEditMargin: { fontSize: 12, fontWeight: 600, minWidth: 48 },

  editFormRow: { display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', width: '100%' },
  inputSm: {
    padding: '8px 10px', borderRadius: 8, border: `1px solid ${C.border}`,
    fontSize: 13, background: C.bg, outline: 'none', flex: 1, minWidth: 60,
  },

  addItemSection: { marginTop: 24, padding: 16, borderRadius: 12, background: C.card, border: `1px solid ${C.border}` },
  addItemForm: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },

  // Settings
  settingsActions: { display: 'flex', flexDirection: 'column', gap: 10 },
  settingsBtn: {
    display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 12,
    border: `1px solid ${C.border}`, background: C.card, cursor: 'pointer', textAlign: 'left',
    width: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  settingsBtnIcon: { fontSize: 24, flexShrink: 0 },
  settingsBtnLabel: { fontSize: 14, fontWeight: 600, display: 'block' },
  settingsBtnSub: { fontSize: 12, color: C.muted, display: 'block', marginTop: 2 },
}
