import { useState, useEffect } from 'react'
import { simplePayApi } from '../lib/simplePayApi'

export function useSimplePayData() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    Promise.all([
      simplePayApi.employees(),
      simplePayApi.payRuns(),
    ])
      .then(([employees, payRuns]) => {
        if (employees || payRuns) setData({ employees, payRuns })
        else setError('SimplePay not connected — check API key')
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}
