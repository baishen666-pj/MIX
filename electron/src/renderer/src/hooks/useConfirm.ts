import { useState, useRef } from 'react'

interface ConfirmState {
  open: boolean
  title: string
  message: string
  onConfirm: (() => void) | null
}

const INITIAL_STATE: ConfirmState = { open: false, title: '', message: '', onConfirm: null }

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<ConfirmState>(INITIAL_STATE)
  const resolveRef = useRef<(value: boolean) => void>(() => {})

  const requestConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
      setConfirmState({
        open: true,
        title,
        message,
        onConfirm: () => {
          resolve(true)
          setConfirmState(INITIAL_STATE)
        }
      })
    })
  }

  const handleCancel = () => {
    resolveRef.current(false)
    setConfirmState(INITIAL_STATE)
  }

  return { confirmState, requestConfirm, handleCancel }
}
