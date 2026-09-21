import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined
const HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined

let ready = false

/** PostHog is only switched on when a key is configured (production builds). */
export function initAnalytics() {
  if (!KEY || ready) return
  posthog.init(KEY, {
    api_host: HOST || 'https://us.i.posthog.com',
    // the proxy only forwards ingestion; links in the toolbar go to the real app
    ui_host: 'https://us.posthog.com',
    defaults: '2026-05-30',
    person_profiles: 'identified_only',
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    disable_session_recording: false,
    session_recording: {
      maskAllInputs: false,
    },
  })
  // every event from this site carries the app name, so it can be filtered apart from other products
  posthog.register({ app: 'stock-ledger-lab' })
  ready = true
}

export function track(event: string, props?: Record<string, unknown>) {
  if (!ready) return
  posthog.capture(event, props)
}
