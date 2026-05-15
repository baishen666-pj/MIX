import { describe, it, expect, vi } from 'vitest'

const { mockAppendSwitch } = vi.hoisted(() => ({
  mockAppendSwitch: vi.fn()
}))

vi.mock('electron', () => ({
  app: {
    commandLine: {
      appendSwitch: mockAppendSwitch
    }
  }
}))

import { enableGpuFlags } from '../gpu'

describe('enableGpuFlags', () => {
  it('appends all required GPU flags', () => {
    enableGpuFlags()
    expect(mockAppendSwitch).toHaveBeenCalledTimes(4)
  })

  it('enables ignore-gpu-blocklist', () => {
    enableGpuFlags()
    expect(mockAppendSwitch).toHaveBeenCalledWith('ignore-gpu-blocklist', 'true')
  })

  it('enables webgl', () => {
    enableGpuFlags()
    expect(mockAppendSwitch).toHaveBeenCalledWith('enable-webgl', 'true')
  })

  it('enables gpu rasterization', () => {
    enableGpuFlags()
    expect(mockAppendSwitch).toHaveBeenCalledWith('enable-gpu-rasterization', 'true')
  })

  it('disables background timer throttling', () => {
    enableGpuFlags()
    expect(mockAppendSwitch).toHaveBeenCalledWith('disable-background-timer-throttling')
  })
})
