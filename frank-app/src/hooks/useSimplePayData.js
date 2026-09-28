import { useState, useEffect } from 'react'
import { simplePayApi } from '../lib/simplePayApi'

export function useSimplePayData(apiKey) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!apiKey) { setData(null); setError(null); setLoading(false); return }

    setLoading(true)
    Promise.all([
      simplePayApi.employees(apiKey),
      simplePayApi.payRuns(apiKey),
    ])
      .then(([employees, payRuns]) => {
        if (employees || payRuns) setData({ employees, payRuns })
        else setError('SimplePay not connected — check API key')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [apiKey])

  return { data, loading, error }
}
