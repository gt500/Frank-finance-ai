import { useState, useEffect } from 'react'
import { wonderlandApi } from '../lib/wonderlandApi'

export function useWonderlandData() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    const { from, to } = yearRange()

    Promise.all([
      wonderlandApi.summary(),
      wonderlandApi.outstanding(),
      wonderlandApi.children('Active'),
      wonderlandApi.payments(from, to),
    ])
      .then(([summary, outstanding, children, payments]) => {
        setData({ summary, outstanding, children, payments })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading, error }
}

function yearRange(date = new Date()) {
  return {
    from: `${date.getFullYear()}-01-01`,
    to:   `${date.getFullYear()}-12-31`,
  }
}
