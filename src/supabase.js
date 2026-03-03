import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key) : null

// ── Push helpers (fire-and-forget) ──

export async function pushSale(sale) {
  if (!supabase) return
  try {
    await supabase.from('sales').upsert({
      id: sale.id,
      items: sale.items,
      total: sale.total,
      cost: sale.cost,
      time: sale.time,
      customer: sale.customer || null,
      day_id: sale.dayId,
      payment_method: sale.paymentMethod || null,
    })
  } catch (e) { console.warn('pushSale error', e) }
}

export async function deleteSale(id) {
  if (!supabase) return
  try {
    await supabase.from('sales').delete().eq('id', id)
  } catch (e) { console.warn('deleteSale error', e) }
}

export async function pushMenuItem(item) {
  if (!supabase) return
  try {
    await supabase.from('menu_items').upsert({
      id: item.id,
      name: item.name,
      price: item.price,
      cost: item.cost,
      category: item.category,
      emoji: item.emoji,
      updated_at: new Date().toISOString(),
    })
  } catch (e) { console.warn('pushMenuItem error', e) }
}

export async function deleteMenuItem(id) {
  if (!supabase) return
  try {
    await supabase.from('menu_items').delete().eq('id', id)
  } catch (e) { console.warn('deleteMenuItem error', e) }
}

export async function pushClosedDay(dayId) {
  if (!supabase) return
  try {
    await supabase.from('closed_days').upsert({
      day_id: dayId,
      closed_at: new Date().toISOString(),
    })
  } catch (e) { console.warn('pushClosedDay error', e) }
}

export async function deleteClosedDay(dayId) {
  if (!supabase) return
  try {
    await supabase.from('closed_days').delete().eq('day_id', dayId)
  } catch (e) { console.warn('deleteClosedDay error', e) }
}

// ── Pull all data on cold start ──

export async function pullAll() {
  if (!supabase) return null
  try {
    const [menuRes, salesRes, daysRes] = await Promise.all([
      supabase.from('menu_items').select('*'),
      supabase.from('sales').select('*').order('time', { ascending: false }),
      supabase.from('closed_days').select('*'),
    ])

    const menu = (menuRes.data || []).map(r => ({
      id: r.id, name: r.name, price: Number(r.price), cost: Number(r.cost),
      category: r.category, emoji: r.emoji,
    }))

    const sales = (salesRes.data || []).map(r => ({
      id: r.id, items: r.items, total: Number(r.total), cost: Number(r.cost),
      time: r.time, customer: r.customer || '', dayId: r.day_id,
      paymentMethod: r.payment_method || null,
    }))

    const closedDays = (daysRes.data || []).map(r => r.day_id)

    return { menu, sales, closedDays }
  } catch (e) {
    console.warn('pullAll error', e)
    return null
  }
}

// ── Bulk push (for import) ──

export async function pushAllMenu(items) {
  if (!supabase) return
  try {
    await supabase.from('menu_items').delete().neq('id', '')
    if (items.length) {
      await supabase.from('menu_items').upsert(items.map(item => ({
        id: item.id, name: item.name, price: item.price, cost: item.cost,
        category: item.category, emoji: item.emoji,
        updated_at: new Date().toISOString(),
      })))
    }
  } catch (e) { console.warn('pushAllMenu error', e) }
}

export async function pushAllSales(sales) {
  if (!supabase) return
  try {
    await supabase.from('sales').delete().neq('id', '')
    if (sales.length) {
      const rows = sales.map(s => ({
        id: s.id, items: s.items, total: s.total, cost: s.cost,
        time: s.time, customer: s.customer || null, day_id: s.dayId,
        payment_method: s.paymentMethod || null,
      }))
      // Supabase has a row limit per upsert, batch in 500s
      for (let i = 0; i < rows.length; i += 500) {
        await supabase.from('sales').upsert(rows.slice(i, i + 500))
      }
    }
  } catch (e) { console.warn('pushAllSales error', e) }
}

export async function pushAllClosedDays(dayIds) {
  if (!supabase) return
  try {
    await supabase.from('closed_days').delete().neq('day_id', '')
    if (dayIds.length) {
      await supabase.from('closed_days').upsert(
        dayIds.map(d => ({ day_id: d, closed_at: new Date().toISOString() }))
      )
    }
  } catch (e) { console.warn('pushAllClosedDays error', e) }
}
