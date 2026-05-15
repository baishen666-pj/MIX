import { useState, useCallback } from 'react'
import { getExportContent, getExportFileName, type ExportFormat } from '../lib/export'
import type { ChatMessage } from '../../../shared/types'

interface UseExportChatProps {
  messages: ChatMessage[]
  sessionId: string | null
  notify: (title: string, body: string) => void
}

export function useExportChat({ messages, sessionId, notify }: UseExportChatProps) {
  const [exportOpen, setExportOpen] = useState(false)
  const [exportFormat, setExportFormat] = useState<ExportFormat>('markdown')

  const handleExport = useCallback(async () => {
    const title = sessionId ? `对话 ${new Date().toLocaleDateString('zh-CN')}` : 'AI GUI 对话'
    const content = getExportContent(messages, title, exportFormat)
    const fileName = getExportFileName(title, exportFormat)

    if (window.mixDesktop?.saveExport) {
      const saved = await window.mixDesktop.saveExport({ content, fileName })
      if (saved) {
        notify('导出成功', `已保存为 ${fileName}`)
        setExportOpen(false)
      }
    } else {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = fileName; a.click()
      URL.revokeObjectURL(url)
      setExportOpen(false)
    }
  }, [messages, sessionId, exportFormat, notify])

  return { exportOpen, setExportOpen, exportFormat, setExportFormat, handleExport }
}
