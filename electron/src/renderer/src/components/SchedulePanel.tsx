import { genId } from '../lib/genId'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/app'
import type { ScheduleTask } from '../../../shared/types'
import { ConfirmDialog } from './ConfirmDialog'
import { useConfirm } from '../hooks/useConfirm'

const INTERVAL_PRESETS = [
  { label: '30秒', seconds: 30 },
  { label: '1分钟', seconds: 60 },
  { label: '5分钟', seconds: 300 },
  { label: '15分钟', seconds: 900 },
  { label: '30分钟', seconds: 1800 },
  { label: '1小时', seconds: 3600 },
  { label: '6小时', seconds: 21600 },
  { label: '12小时', seconds: 43200 },
  { label: '24小时', seconds: 86400 },
]

interface TaskForm {
  name: string
  prompt: string
  intervalSeconds: number
}

const EMPTY_FORM: TaskForm = { name: '', prompt: '', intervalSeconds: 300 }

export function SchedulePanel() {
  const scheduledTasks = useAppStore((s) => s.scheduledTasks)
  const addScheduledTask = useAppStore((s) => s.addScheduledTask)
  const updateScheduledTask = useAppStore((s) => s.updateScheduledTask)
  const deleteScheduledTask = useAppStore((s) => s.deleteScheduledTask)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<TaskForm>(EMPTY_FORM)
  const [showForm, setShowForm] = useState(false)
  const [customInterval, setCustomInterval] = useState(false)
  const [customSeconds, setCustomSeconds] = useState(60)
  const timersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map())
  const [, setTick] = useState(0)
  const { confirmState, requestConfirm, handleCancel } = useConfirm()

  // Tick every 10s to update countdowns
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 10000)
    return () => clearInterval(id)
  }, [])

  const activeCount = scheduledTasks.filter((t) => t.enabled).length

  // Scheduler tick loop
  useEffect(() => {
    const activeTimers = timersRef.current

    for (const task of scheduledTasks) {
      if (!task.enabled) {
        const existing = activeTimers.get(task.id)
        if (existing) {
          clearInterval(existing)
          activeTimers.delete(task.id)
        }
        continue
      }

      if (activeTimers.has(task.id)) continue

      const now = Date.now()
      const nextRun = task.nextRunAt ?? (task.createdAt + task.intervalSeconds * 1000)
      const delay = Math.max(0, nextRun - now)

      const runTask = () => {
        executeScheduledTask(task)
      }

      const timeout = setTimeout(() => {
        runTask()
        const interval = setInterval(runTask, task.intervalSeconds * 1000)
        activeTimers.set(task.id, interval)
      }, delay)

      activeTimers.set(task.id, timeout as unknown as ReturnType<typeof setInterval>)
    }

    // Cleanup removed tasks
    for (const [id] of activeTimers) {
      if (!scheduledTasks.find((t) => t.id === id)) {
        const timer = activeTimers.get(id)
        if (timer) { clearInterval(timer); activeTimers.delete(id) }
      }
    }

    return () => {
      for (const [, timer] of activeTimers) clearInterval(timer)
      activeTimers.clear()
    }
  }, [scheduledTasks])

  const executeScheduledTask = useCallback((task: ScheduleTask) => {
    const store = useAppStore.getState()
    store.tickScheduledTask(task.id)
    store.notify('定时任务触发', `「${task.name}」已自动执行`)

    if (!window.mixDesktop) return

    const soul = store.soulPrompt
    const apiMsgs = [{ role: 'user', content: task.prompt }]
    const messages = soul ? [{ role: 'system', content: soul }, ...apiMsgs] : apiMsgs

    window.mixDesktop.chatSend({ messages }).catch(() => {
      store.addMessage({
        id: genId('error-'), role: 'error',
        content: `定时任务「${task.name}」执行失败`,
        timestamp: Date.now()
      })
      store.notify('定时任务失败', `「${task.name}」执行出错`)
    })

    store.addMessage({
      id: genId('system-'), role: 'system',
      content: `⏰ 定时任务「${task.name}」已触发`,
      timestamp: Date.now()
    })
  }, [])

  const handleCreate = () => {
    if (!form.name.trim() || !form.prompt.trim()) return
    const now = Date.now()
    const interval = customInterval ? customSeconds : form.intervalSeconds
    const task: ScheduleTask = {
      id: `task-${now}`,
      name: form.name.trim(),
      prompt: form.prompt.trim(),
      intervalSeconds: interval,
      enabled: true,
      lastRunAt: null,
      nextRunAt: now + interval * 1000,
      runCount: 0,
      createdAt: now
    }
    addScheduledTask(task)
    setForm(EMPTY_FORM)
    setShowForm(false)
    setCustomInterval(false)
  }

  const handleUpdate = () => {
    if (!editingId || !form.name.trim() || !form.prompt.trim()) return
    const interval = customInterval ? customSeconds : form.intervalSeconds
    updateScheduledTask(editingId, {
      name: form.name.trim(),
      prompt: form.prompt.trim(),
      intervalSeconds: interval,
      nextRunAt: Date.now() + interval * 1000
    })
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(false)
    setCustomInterval(false)
  }

  const startEdit = (task: ScheduleTask) => {
    setEditingId(task.id)
    setForm({ name: task.name, prompt: task.prompt, intervalSeconds: task.intervalSeconds })
    setShowForm(true)
    const isPreset = INTERVAL_PRESETS.some((p) => p.seconds === task.intervalSeconds)
    setCustomInterval(!isPreset)
    if (!isPreset) setCustomSeconds(task.intervalSeconds)
  }

  const cancelForm = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setShowForm(false)
    setCustomInterval(false)
  }

  const toggleEnabled = (task: ScheduleTask) => {
    const enabled = !task.enabled
    updateScheduledTask(task.id, {
      enabled,
      nextRunAt: enabled ? Date.now() + task.intervalSeconds * 1000 : null
    })
  }

  const runNow = (task: ScheduleTask) => {
    executeScheduledTask({ ...task })
  }

  const formatTime = (ts: number | null) => {
    if (!ts) return '—'
    return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const formatInterval = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
    if (seconds < 86400) return `${(seconds / 3600).toFixed(seconds % 3600 === 0 ? 0 : 1)}小时`
    return `${(seconds / 86400).toFixed(seconds % 86400 === 0 ? 0 : 1)}天`
  }

  const getNextCountdown = (task: ScheduleTask) => {
    if (!task.enabled || !task.nextRunAt) return ''
    const remaining = Math.max(0, task.nextRunAt - Date.now())
    if (remaining === 0) return '即将执行'
    return formatInterval(Math.ceil(remaining / 1000))
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border-subtle px-4 py-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-content-heading">定时任务</h2>
          {activeCount > 0 && (
            <span className="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-medium text-success">
              {activeCount} 运行中
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM) }}
          className="rounded bg-accent px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
        >
          + 新建任务
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        {showForm && <TaskFormUI form={form} setForm={setForm} customInterval={customInterval} setCustomInterval={setCustomInterval} customSeconds={customSeconds} setCustomSeconds={setCustomSeconds} onSave={editingId ? handleUpdate : handleCreate} onCancel={cancelForm} isEdit={!!editingId} />}

        {scheduledTasks.length === 0 && !showForm && (
          <EmptyScheduleState />
        )}

        {scheduledTasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            countdown={getNextCountdown(task)}
            onToggle={() => toggleEnabled(task)}
            onEdit={() => startEdit(task)}
            onDelete={() => { requestConfirm('删除定时任务', `确定删除任务「${task.name}」？`).then((ok) => { if (ok) deleteScheduledTask(task.id) }) }}
            onRunNow={() => runNow(task)}
            formatTime={formatTime}
            formatInterval={formatInterval}
          />
        ))}
      </div>

      {scheduledTasks.length > 0 && (
        <div className="border-t border-border-subtle px-4 py-2">
          <p className="text-center text-[10px] text-content-subtle">
            共 {scheduledTasks.length} 个任务 · {activeCount} 个运行中 · 按 Ctrl+7 切换到此视图
          </p>
        </div>
      )}
      <ConfirmDialog {...confirmState} onCancel={handleCancel} />
    </div>
  )
}

function TaskFormUI({ form, setForm, customInterval, setCustomInterval, customSeconds, setCustomSeconds, onSave, onCancel, isEdit }: {
  form: TaskForm
  setForm: (f: TaskForm) => void
  customInterval: boolean
  setCustomInterval: (v: boolean) => void
  customSeconds: number
  setCustomSeconds: (v: number) => void
  onSave: () => void
  onCancel: () => void
  isEdit: boolean
}) {
  return (
    <div className="border-b border-border-subtle bg-surface-elevated/50 p-4">
      <h3 className="mb-3 text-xs font-medium text-content-muted">{isEdit ? '编辑任务' : '新建定时任务'}</h3>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">任务名称</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例：每日摘要"
            className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-secondary placeholder-content-subtle outline-none focus:border-accent"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">发送内容</label>
          <textarea
            value={form.prompt}
            onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            placeholder="定时发送给 AI 的消息内容..."
            rows={3}
            className="w-full rounded-lg border border-border-default bg-surface-overlay px-3 py-2 text-sm text-content-secondary placeholder-content-subtle outline-none focus:border-accent resize-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-content-subtle">执行间隔</label>
          <div className="flex flex-wrap gap-1.5">
            {INTERVAL_PRESETS.map((p) => (
              <button
                key={p.seconds}
                onClick={() => { setForm({ ...form, intervalSeconds: p.seconds }); setCustomInterval(false) }}
                className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                  !customInterval && form.intervalSeconds === p.seconds
                    ? 'border-accent bg-accent/20 text-accent-text'
                    : 'border-border-default text-content-subtle hover:border-border-subtle hover:text-content-heading'
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setCustomInterval(true)}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                customInterval
                  ? 'border-accent bg-accent/20 text-accent-text'
                  : 'border-border-default text-content-subtle hover:border-border-subtle hover:text-content-heading'
              }`}
            >
              自定义
            </button>
          </div>
          {customInterval && (
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={10}
                max={86400}
                value={customSeconds}
                onChange={(e) => setCustomSeconds(Math.max(10, parseInt(e.target.value) || 10))}
                className="w-24 rounded-lg border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-content-secondary outline-none focus:border-accent"
              />
              <span className="text-xs text-content-subtle">秒（10-86400）</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-xs text-content-subtle hover:bg-surface-overlay hover:text-content-heading">取消</button>
          <button
            onClick={onSave}
            disabled={!form.name.trim() || !form.prompt.trim()}
            className="rounded-lg bg-accent px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-40"
          >
            {isEdit ? '保存' : '创建'}
          </button>
        </div>
      </div>
    </div>
  )
}

function TaskCard({ task, countdown, onToggle, onEdit, onDelete, onRunNow, formatTime, formatInterval }: {
  task: ScheduleTask
  countdown: string
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onRunNow: () => void
  formatTime: (ts: number | null) => string
  formatInterval: (s: number) => string
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`group border-b border-border-subtle/50 px-4 py-3 transition-colors ${
        task.enabled ? 'bg-surface-elevated/30' : 'bg-surface-base/50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggle}
              className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                task.enabled
                  ? 'border-success bg-success-bg text-success'
                  : 'border-border-default text-content-subtle hover:border-border-subtle'
              }`}
              title={task.enabled ? '暂停' : '启用'}
            >
              {task.enabled && <span className="text-[10px]">✓</span>}
            </button>
            <span className={`text-sm font-medium ${task.enabled ? 'text-content-secondary' : 'text-content-subtle'}`}>
              {task.name}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-content-subtle">{task.prompt}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-content-subtle">
            <span>间隔 {formatInterval(task.intervalSeconds)}</span>
            {task.runCount > 0 && <span>已执行 {task.runCount} 次</span>}
            {task.lastRunAt && <span>上次 {formatTime(task.lastRunAt)}</span>}
            {task.enabled && countdown && (
              <span className="text-accent-text">下次 {countdown}</span>
            )}
          </div>
        </div>

        <div className={`flex shrink-0 gap-1 ${hovered ? 'opacity-100' : 'opacity-0'} transition-opacity`}>
          <button
            onClick={onRunNow}
            className="rounded p-1.5 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-success"
            title="立即执行"
          >
            ▶
          </button>
          <button
            onClick={onEdit}
            className="rounded p-1.5 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-content-heading"
            title="编辑"
          >
            ✎
          </button>
          <button
            onClick={onDelete}
            className="rounded p-1.5 text-[10px] text-content-subtle hover:bg-surface-overlay hover:text-danger"
            title="删除"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}

function EmptyScheduleState() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mb-3 text-4xl">⏰</div>
        <p className="text-sm font-medium text-content-muted">定时任务管理</p>
        <p className="mt-2 text-xs text-content-subtle">创建定时任务，自动向 AI 发送消息</p>
        <div className="mt-4 space-y-1 text-[10px] text-content-subtle">
          <p>支持间隔 30秒 ~ 24小时</p>
          <p>可随时暂停、编辑或手动触发</p>
          <p>任务触发时会自动发送到当前聊天</p>
        </div>
      </div>
    </div>
  )
}
