import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from '@tanstack/react-router'
import type { Session } from '@supabase/supabase-js'
import './index.css'
import { supabase } from '@/lib/supabase'
import { LoginForm } from '@/components/LoginForm'
import { router } from '@/router'

// This is the app entry module: it mounts the tree and defines AuthGate inline.
// React Fast Refresh of the entry file is meaningless, so the "move component to a
// separate file" advice doesn't apply here.
// eslint-disable-next-line react-refresh/only-export-components
function AuthGate() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-neutral-500">
        Loading...
      </div>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return <RouterProvider router={router} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
)
