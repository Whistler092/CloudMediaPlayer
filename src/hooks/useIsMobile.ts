import { useEffect, useState } from 'react'

/** Matches sidebar / queue drawer breakpoint in CSS */
export const MOBILE_MAX_WIDTH_MQ = '(max-width: 767px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(MOBILE_MAX_WIDTH_MQ).matches : false,
  )
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MAX_WIDTH_MQ)
    const on = () => setIsMobile(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return isMobile
}
