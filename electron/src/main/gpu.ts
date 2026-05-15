import { app } from 'electron'

export function enableGpuFlags(): void {
  app.commandLine.appendSwitch('ignore-gpu-blocklist', 'true')
  app.commandLine.appendSwitch('enable-webgl', 'true')
  app.commandLine.appendSwitch('enable-gpu-rasterization', 'true')
  app.commandLine.appendSwitch('disable-background-timer-throttling')
}
