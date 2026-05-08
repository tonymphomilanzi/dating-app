// src/admin/pages/TicketPayments.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'

/* ================================================================
   CONSTANTS
   ================================================================ */
const STATUS_CONFIG = {
  pending: {
    label: 'Pending',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    dot: 'bg-amber-400',
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-green-500/10',
    text: 'text-green-400',
    border: 'border-green-500/20',
    dot: 'bg-green-400',
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    dot: 'bg-red-400',
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-gray-500/10',
    text: 'text-gray-400',
    border: 'border-gray-500/20',
    dot: 'bg-gray-400',
  },
}

const METHOD_LABELS = {
  crypto: 'Crypto',
  momo: 'Mobile Money',
  western_union: 'Western Union',
  bank: 'Bank Transfer',
  free: 'Free',
}

const METHOD_COLORS = {
  crypto: 'text-orange-400',
  momo: 'text-violet-400',
  western_union: 'text-yellow-400',
  bank: 'text-blue-400',
  free: 'text-green-400',
}

const priceFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
})

/* ================================================================
   HELPERS
   ================================================================ */
function fmtDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function timeAgo(iso) {
  if (!iso) return ''
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  } catch {
    return ''
  }
}

/* ================================================================
   STATUS BADGE
   ================================================================ */
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

/* ================================================================
   CONFIRM MODAL
   ================================================================ */
function ConfirmModal({ title, message, confirmText, onConfirm, onCancel, destructive = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-white text-sm font-bold transition-colors ${
              destructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   DETAIL MODAL
   ================================================================ */
function PurchaseDetailModal({ purchase, onClose, onConfirm, onCancel, onRefund, processing }) {
  if (!purchase) return null
  const method = purchase.payment_method
  const isFree = method === 'free'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-white">Ticket Purchase</h2>
            <p className="text-gray-400 text-sm mt-1 font-mono">{purchase.order_id}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={purchase.status} />
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-white transition-colors"
            >
              <XIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Event + Ticket */}
          <Section title="Event & Ticket">
            <Grid>
              <Field label="Event" value={purchase.event?.title || purchase.event_id} />
              <Field label="Ticket Type" value={purchase.ticket_type?.name || '—'} />
              <Field label="Ticket Description" value={purchase.ticket_type?.description || '—'} />
              <Field label="Quantity" value={purchase.quantity} />
              <Field label="Unit Price" value={priceFmt.format(purchase.unit_price || 0)} />
              <Field
                label="Total Amount"
                value={priceFmt.format(purchase.total_amount || 0)}
                highlight
              />
            </Grid>
          </Section>

          {/* Buyer */}
          <Section title="Buyer">
            <Grid>
              <Field label="Name" value={purchase.buyer?.display_name || '—'} />
              <Field label="Email" value={purchase.buyer?.email || '—'} />
              <Field label="User ID" value={purchase.user_id} mono />
            </Grid>
          </Section>

          {/* Payment */}
          {!isFree && (
            <Section title="Payment Details">
              <Grid>
                <Field
                  label="Method"
                  value={METHOD_LABELS[method] || method || '—'}
                  className={METHOD_COLORS[method]}
                />
                <Field
                  label="Reference / TX ID"
                  value={purchase.payment_reference || '—'}
                  mono
                  copyable
                />
                <Field label="Submitted" value={fmtDate(purchase.created_at)} />
                {purchase.proof_url && (
                  <div className="col-span-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Receipt / Screenshot
                    </span>
                    <div className="mt-1">
                      <a
                        href={purchase.proof_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 underline"
                      >
                        View Receipt
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                )}
                {purchase.note && (
                  <div className="col-span-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Note from buyer
                    </span>
                    <p className="mt-1 text-sm text-gray-300 bg-gray-700/50 rounded-lg p-3 leading-relaxed">
                      {purchase.note}
                    </p>
                  </div>
                )}
              </Grid>
            </Section>
          )}

          {/* Confirmation info */}
          {purchase.status === 'confirmed' && (
            <Section title="Confirmation">
              <Grid>
                <Field label="Confirmed At" value={fmtDate(purchase.confirmed_at)} />
                <Field label="Confirmed By" value={purchase.confirmed_by || 'System'} mono />
              </Grid>
            </Section>
          )}

          {/* Actions */}
          {purchase.status === 'pending' && (
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => onConfirm(purchase)}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                {processing ? (
                  <SpinnerIcon className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircleIcon className="w-4 h-4" />
                )}
                Confirm Payment
              </button>
              <button
                onClick={() => onCancel(purchase)}
                disabled={processing}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                <XIcon className="w-4 h-4" />
                Reject / Cancel
              </button>
            </div>
          )}

          {purchase.status === 'confirmed' && (
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => onRefund(purchase)}
                disabled={processing}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
              >
                <RefundIcon className="w-4 h-4" />
                Mark as Refunded
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* small helpers for the detail modal */
function Section({ title, children }) {
  return (
    <div>
      <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-3">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Grid({ children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {children}
    </div>
  )
}

function Field({ label, value, mono = false, highlight = false, copyable = false, className = '' }) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(String(value))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }
  return (
    <div className="bg-gray-700/40 rounded-xl p-3">
      <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 block mb-1">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span
          className={`text-sm break-all leading-snug ${
            highlight ? 'font-bold text-green-400' : 'text-gray-200'
          } ${mono ? 'font-mono text-xs' : ''} ${className}`}
        >
          {value ?? '—'}
        </span>
        {copyable && value && value !== '—' && (
          <button
            onClick={handleCopy}
            className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors"
          >
            {copied ? (
              <CheckIcon className="w-3.5 h-3.5 text-green-400" />
            ) : (
              <CopyIcon className="w-3.5 h-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  )
}

/* ================================================================
   MAIN PAGE
   ================================================================ */
const TicketPayments = () => {
  const { logAction } = useAuth()

  /* ── data ── */
  const [purchases, setPurchases] = useState([])
  const [filtered, setFiltered] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    confirmed: 0,
    revenue: 0,
  })

  /* ── filters ── */
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [methodFilter, setMethodFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all') // all | today | week | month

  /* ── UI ── */
  const [selectedPurchase, setSelectedPurchase] = useState(null)
  const [confirmModal, setConfirmModal] = useState(null)
  const [processing, setProcessing] = useState(false)

  /* ── load ── */
  const loadPurchases = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch purchases with related data
      const { data, error } = await supabaseAdmin
        .from('event_ticket_purchases')
        .select(`
          *,
          event:event_id ( id, title, starts_at, city, cover_url ),
          ticket_type:ticket_type_id ( id, name, description, price )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch buyer profiles separately (avoids RLS join issues)
      const userIds = [...new Set((data || []).map((p) => p.user_id).filter(Boolean))]
      let profileMap = {}

      if (userIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', userIds)

        // Also get emails from auth
        const emailMap = {}
        for (const uid of userIds) {
          try {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(uid)
            if (authUser?.user?.email) emailMap[uid] = authUser.user.email
          } catch {}
        }

        ;(profiles || []).forEach((p) => {
          profileMap[p.id] = { ...p, email: emailMap[p.id] || '' }
        })
      }

      const enriched = (data || []).map((p) => ({
        ...p,
        buyer: profileMap[p.user_id] || null,
      }))

      setPurchases(enriched)

      // Compute stats
      const pending = enriched.filter((p) => p.status === 'pending').length
      const confirmed = enriched.filter((p) => p.status === 'confirmed').length
      const revenue = enriched
        .filter((p) => p.status === 'confirmed')
        .reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0)

      setStats({ total: enriched.length, pending, confirmed, revenue })
    } catch (err) {
      console.error('Error loading ticket purchases:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  /* ── filter ── */
  useEffect(() => {
    let result = [...purchases]

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (p) =>
          p.order_id?.toLowerCase().includes(q) ||
          p.event?.title?.toLowerCase().includes(q) ||
          p.buyer?.display_name?.toLowerCase().includes(q) ||
          p.buyer?.email?.toLowerCase().includes(q) ||
          p.payment_reference?.toLowerCase().includes(q) ||
          p.ticket_type?.name?.toLowerCase().includes(q)
      )
    }

    if (statusFilter !== 'all') {
      result = result.filter((p) => p.status === statusFilter)
    }

    if (methodFilter !== 'all') {
      result = result.filter((p) => p.payment_method === methodFilter)
    }

    if (dateFilter !== 'all') {
      const now = new Date()
      const cutoff = new Date()
      if (dateFilter === 'today') cutoff.setHours(0, 0, 0, 0)
      else if (dateFilter === 'week') cutoff.setDate(now.getDate() - 7)
      else if (dateFilter === 'month') cutoff.setDate(now.getDate() - 30)
      result = result.filter((p) => new Date(p.created_at) >= cutoff)
    }

    setFiltered(result)
  }, [purchases, search, statusFilter, methodFilter, dateFilter])

  /* ── actions ── */
  async function handleConfirmPayment(purchase) {
    setProcessing(true)
    try {
      const { data: adminData } = await supabaseAdmin.auth.getUser()
      const adminId = adminData?.user?.id

      const { error } = await supabaseAdmin
        .from('event_ticket_purchases')
        .update({
          status: 'confirmed',
          confirmed_at: new Date().toISOString(),
          confirmed_by: adminId || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id)

      if (error) throw error

      await logAction('confirm_ticket_payment', 'event_ticket_purchases', purchase.id, {
        order_id: purchase.order_id,
        event: purchase.event?.title,
        buyer: purchase.buyer?.display_name,
        amount: purchase.total_amount,
      })

      await loadPurchases()
      setSelectedPurchase(null)
      setConfirmModal(null)
    } catch (err) {
      console.error('Error confirming payment:', err)
      alert('Error confirming payment: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleCancelPayment(purchase) {
    setProcessing(true)
    try {
      const { error } = await supabaseAdmin
        .from('event_ticket_purchases')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id)

      if (error) throw error

      await logAction('cancel_ticket_payment', 'event_ticket_purchases', purchase.id, {
        order_id: purchase.order_id,
        reason: 'Admin rejected',
      })

      await loadPurchases()
      setSelectedPurchase(null)
      setConfirmModal(null)
    } catch (err) {
      console.error('Error cancelling payment:', err)
      alert('Error cancelling payment: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleRefund(purchase) {
    setProcessing(true)
    try {
      const { error } = await supabaseAdmin
        .from('event_ticket_purchases')
        .update({
          status: 'refunded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id)

      if (error) throw error

      await logAction('refund_ticket_payment', 'event_ticket_purchases', purchase.id, {
        order_id: purchase.order_id,
        amount: purchase.total_amount,
      })

      await loadPurchases()
      setSelectedPurchase(null)
      setConfirmModal(null)
    } catch (err) {
      console.error('Error refunding payment:', err)
      alert('Error processing refund: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  /* prompt wrappers */
  function promptConfirm(purchase) {
    setConfirmModal({
      title: 'Confirm Payment',
      message: `Confirm payment of ${priceFmt.format(purchase.total_amount || 0)} from ${
        purchase.buyer?.display_name || 'buyer'
      } for "${purchase.event?.title}"? This will activate their ticket and cannot be easily undone.`,
      confirmText: 'Confirm Payment',
      destructive: false,
      onConfirm: () => handleConfirmPayment(purchase),
    })
  }

  function promptCancel(purchase) {
    setConfirmModal({
      title: 'Reject Payment',
      message: `Reject and cancel this purchase (Order ${purchase.order_id})? The ticket will not be activated.`,
      confirmText: 'Reject',
      destructive: true,
      onConfirm: () => handleCancelPayment(purchase),
    })
  }

  function promptRefund(purchase) {
    setConfirmModal({
      title: 'Mark as Refunded',
      message: `Mark order ${purchase.order_id} as refunded? Make sure you have returned the funds to the buyer before confirming.`,
      confirmText: 'Mark Refunded',
      destructive: true,
      onConfirm: () => handleRefund(purchase),
    })
  }

  /* ── pending count badge ── */
  const pendingCount = purchases.filter((p) => p.status === 'pending').length

  /* ── render ── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white">Ticket Payments</h1>
            {pendingCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-xs font-extrabold animate-pulse">
                {pendingCount} pending
              </span>
            )}
          </div>
          <p className="text-gray-400 mt-1">
            Review and verify ticket purchases from event attendees
          </p>
        </div>
        <button
          onClick={loadPurchases}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
        >
          {loading ? (
            <SpinnerIcon className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshIcon className="w-4 h-4" />
          )}
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Purchases"
          value={stats.total}
          icon={<TicketIcon className="w-5 h-5" />}
          color="text-blue-400"
          bg="bg-blue-500/10"
        />
        <StatCard
          label="Pending Review"
          value={stats.pending}
          icon={<ClockIcon className="w-5 h-5" />}
          color="text-amber-400"
          bg="bg-amber-500/10"
          pulse={stats.pending > 0}
        />
        <StatCard
          label="Confirmed"
          value={stats.confirmed}
          icon={<CheckCircleIcon className="w-5 h-5" />}
          color="text-green-400"
          bg="bg-green-500/10"
        />
        <StatCard
          label="Total Revenue"
          value={priceFmt.format(stats.revenue)}
          icon={<DollarIcon className="w-5 h-5" />}
          color="text-violet-400"
          bg="bg-violet-500/10"
          isText
        />
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Search
            </label>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Order ID, event, buyer, reference..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
            </select>
          </div>

          {/* Method */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Payment Method
            </label>
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="crypto">Crypto</option>
              <option value="momo">Mobile Money</option>
              <option value="western_union">Western Union</option>
              <option value="bank">Bank Transfer</option>
              <option value="free">Free / RSVP</option>
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">
              Date Range
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
            </select>
          </div>
        </div>

        {/* Active filter summary + clear */}
        {(search || statusFilter !== 'all' || methodFilter !== 'all' || dateFilter !== 'all') && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Showing{' '}
              <span className="font-bold text-white">{filtered.length}</span> of{' '}
              {purchases.length} purchases
            </p>
            <button
              onClick={() => {
                setSearch('')
                setStatusFilter('all')
                setMethodFilter('all')
                setDateFilter('all')
              }}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-gray-500">
              <SpinnerIcon className="w-8 h-8 animate-spin" />
              <p className="text-sm">Loading ticket purchases…</p>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <TicketIcon className="w-12 h-12 opacity-30" />
            <p className="text-sm font-medium">No ticket purchases found</p>
            {(search || statusFilter !== 'all') && (
              <p className="text-xs">Try adjusting your filters</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  {[
                    'Order',
                    'Event',
                    'Buyer',
                    'Ticket',
                    'Qty',
                    'Amount',
                    'Method',
                    'Status',
                    'Submitted',
                    'Actions',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {filtered.map((purchase) => (
                  <PurchaseRow
                    key={purchase.id}
                    purchase={purchase}
                    onView={() => setSelectedPurchase(purchase)}
                    onConfirm={() => promptConfirm(purchase)}
                    onCancel={() => promptCancel(purchase)}
                    processing={processing}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Table footer */}
        {!loading && filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-700 flex items-center justify-between">
            <p className="text-xs text-gray-500">
              {filtered.length} purchase{filtered.length !== 1 ? 's' : ''}
              {statusFilter !== 'all' ? ` · ${STATUS_CONFIG[statusFilter]?.label}` : ''}
            </p>
            <p className="text-xs text-gray-500">
              Confirmed revenue:{' '}
              <span className="text-green-400 font-bold">
                {priceFmt.format(
                  filtered
                    .filter((p) => p.status === 'confirmed')
                    .reduce((s, p) => s + (Number(p.total_amount) || 0), 0)
                )}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedPurchase && (
        <PurchaseDetailModal
          purchase={selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          onConfirm={promptConfirm}
          onCancel={promptCancel}
          onRefund={promptRefund}
          processing={processing}
        />
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <ConfirmModal
          title={confirmModal.title}
          message={confirmModal.message}
          confirmText={confirmModal.confirmText}
          destructive={confirmModal.destructive}
          onConfirm={confirmModal.onConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  )
}

/* ================================================================
   STAT CARD
   ================================================================ */
function StatCard({ label, value, icon, color, bg, isText = false, pulse = false }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            {label}
          </p>
          <p
            className={`mt-1.5 font-extrabold text-white ${
              isText ? 'text-lg' : 'text-2xl'
            } ${pulse ? 'text-amber-400' : ''}`}
          >
            {value}
          </p>
        </div>
        <div className={`p-2.5 rounded-xl ${bg}`}>
          <span className={color}>{icon}</span>
        </div>
      </div>
    </div>
  )
}

/* ================================================================
   PURCHASE ROW
   ================================================================ */
function PurchaseRow({ purchase, onView, onConfirm, onCancel, processing }) {
  const method = purchase.payment_method
  return (
    <tr className="hover:bg-gray-700/30 transition-colors group">
      {/* Order */}
      <td className="px-4 py-3">
        <span className="font-mono text-xs text-gray-300 group-hover:text-white transition-colors">
          {purchase.order_id}
        </span>
      </td>

      {/* Event */}
      <td className="px-4 py-3 max-w-[180px]">
        <p className="text-sm font-medium text-gray-200 truncate">
          {purchase.event?.title || '—'}
        </p>
        {purchase.event?.city && (
          <p className="text-xs text-gray-500 truncate">{purchase.event.city}</p>
        )}
      </td>

      {/* Buyer */}
      <td className="px-4 py-3 max-w-[160px]">
        <p className="text-sm text-gray-200 truncate">
          {purchase.buyer?.display_name || '—'}
        </p>
        {purchase.buyer?.email && (
          <p className="text-xs text-gray-500 truncate">{purchase.buyer.email}</p>
        )}
      </td>

      {/* Ticket type */}
      <td className="px-4 py-3">
        <span className="text-sm text-gray-300">
          {purchase.ticket_type?.name || '—'}
        </span>
      </td>

      {/* Qty */}
      <td className="px-4 py-3">
        <span className="text-sm font-semibold text-gray-200">
          {purchase.quantity}
        </span>
      </td>

      {/* Amount */}
      <td className="px-4 py-3">
        <span className="text-sm font-bold text-white">
          {purchase.payment_method === 'free'
            ? 'Free'
            : priceFmt.format(purchase.total_amount || 0)}
        </span>
      </td>

      {/* Method */}
      <td className="px-4 py-3">
        <span className={`text-xs font-semibold ${METHOD_COLORS[method] || 'text-gray-400'}`}>
          {METHOD_LABELS[method] || method || '—'}
        </span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={purchase.status} />
      </td>

      {/* Submitted */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-xs text-gray-400">{timeAgo(purchase.created_at)}</p>
        <p className="text-[10px] text-gray-600">{fmtDate(purchase.created_at)}</p>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onView}
            className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
          >
            View
          </button>
          {purchase.status === 'pending' && (
            <>
              <button
                onClick={onConfirm}
                disabled={processing}
                className="px-3 py-1.5 text-xs font-bold bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-500/30 rounded-lg transition-colors disabled:opacity-40"
              >
                ✓
              </button>
              <button
                onClick={onCancel}
                disabled={processing}
                className="px-3 py-1.5 text-xs font-bold bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 rounded-lg transition-colors disabled:opacity-40"
              >
                ✕
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

export default TicketPayments

/* ================================================================
   ICONS
   ================================================================ */
function TicketIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 9a3 3 0 010-6h20a3 3 0 010 6" />
      <path d="M2 15a3 3 0 000 6h20a3 3 0 000-6" />
      <line x1="2" y1="9" x2="2" y2="15" />
      <line x1="22" y1="9" x2="22" y2="15" />
    </svg>
  )
}
function CheckCircleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}
function ClockIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  )
}
function DollarIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
    </svg>
  )
}
function SearchIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function RefreshIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  )
}
function XIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}
function CheckIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  )
}
function CopyIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
    </svg>
  )
}
function ExternalLinkIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}
function SpinnerIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10"
        stroke="currentColor" strokeWidth={4} />
      <path className="opacity-75" fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
function RefundIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
    </svg>
  )
}