import { useState, useEffect } from 'react'
import { simplePayApi } from '../lib/simplePayApi'
export function useSimplePayData(connected) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!connected) { setData(null); setError(null); setLoading(false); return }
    let cancelled = false
    setLoading(true); setError(null)
    Promise.all([simplePayApi.employees(), simplePayApi.payRuns()])
      .then(([employees, payRuns]) => {
        if (cancelled) return
        const failure = employees?.error || payRuns?.error
        if (failure) { setData(null); setError(failure) } else setData({ employees, payRuns })
      })
      .catch(err => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [connected])
  return { data, loading, error }
}