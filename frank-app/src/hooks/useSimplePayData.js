import { useState, useEffect } from 'react'
import { simplePayApi } from '../lib/simplePayApi'
export function useSimplePayData(connected) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  useEffect(() => {
    if (!connected) { setData(null); setError(null); setLoading(false); return }
    setLoading(true)
    Promise.all([simplePayApi.employees(), simplePayApi.payRuns()])
      .then(([employees, payRuns]) => { if (employees || payRuns) setData({ employees, payRuns }); else setError('SimplePay not connected — check API key') })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [connected])
  return { data, loading, error }
}