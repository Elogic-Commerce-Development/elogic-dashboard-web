import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { Session } from '@supabase/supabase-js'
import './index.css'
import { supabase } from '@/lib/supabase'
import { LoginForm } from '@/components/LoginForm'
import { AppShell } from '@/components/AppShell'

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
        Loading…
      </div>
    )
  }

  if (!session) {
    return <LoginForm />
  }

  return <AppShell email={session.user.email ?? ''} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
)
