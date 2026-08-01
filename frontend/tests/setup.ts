import { vi } from 'vitest'
Object.defineProperty(window, 'matchMedia', { value: vi.fn(() => ({ matches: false, addListener: vi.fn(), removeListener: vi.fn() })) })
