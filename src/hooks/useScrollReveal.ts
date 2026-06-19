'use client';
import { useInView } from 'react-intersection-observer';

export function useScrollReveal(opts: { threshold?: number; rootMargin?: string; once?: boolean; delay?: number } = {}) {
  const { threshold = 0.12, rootMargin = '0px 0px -60px 0px', once = true, delay = 0 } = opts;
  const { ref, inView } = useInView({ threshold, rootMargin, triggerOnce: once, delay });
  return { ref, inView };
}
