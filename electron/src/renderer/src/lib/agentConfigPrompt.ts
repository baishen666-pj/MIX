import { genId } from './genId'
import type { FlowTemplate } from '../components/canvas/types'

const AVAILABLE_MODELS = [
  'gpt-5.5', 'gpt-4o', 'o1-pro', 'o1', 'gpt-4o-mini',
  'claude-3.5-sonnet', 'claude-3-opus', 'glm-4-flash', 'glm-4-plus', 'local'
]

const AVAILABLE_TOOLS = [
  'web', 'browse', 'code', 'file', 'shell',
  'image_gen', 'vision', 'memory', 'delegation', 'skills'
]

const COLOR_PALETTE = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#f59e0b',
  '#10b981', '#ec4899', '#3b82f6', '#ef4444'
]

export const AGENT_CONFIG_SYSTEM_PROMPT = `你是一个专业的多 Agent 系统架构师。用户会描述他们想要构建的 AI 工作流或团队，你需要设计一个合理的 Agent 配置方案。

## 输出格式

你必须输出一个 JSON 对象，包裹在 \`\`\`json ... \`\`\` 代码块中，格式如下：

\`\`\`json
{
  "name": "方案名称",
  "description": "一句话描述",
  "nodes": [
    {
      "type": "agent",
      "data": {
        "label": "Agent 名称",
        "role": "该 Agent 的职责描述",
        "model": "推荐的模型",
        "color": "#6366f1",
        "tools": ["tool1", "tool2"],
        "status": "idle"
      },
      "position": { "x": 200, "y": 100 }
    }
  ],
  "edges": [
    { "source": "agent-0", "target": "agent-1", "data": { "label": "连接说明", "animated": true } }
  ]
}
\`\`\`

## 设计原则

1. 每个 Agent 应有明确的单一职责
2. 模型选择要匹配任务复杂度（简单任务用快速模型，复杂推理用强模型）
3. 工具分配要合理（研究型 Agent 需要 web/browse，编码型需要 code/shell/file）
4. 节点位置要合理布局（相关节点靠近，避免重叠）
5. 连接标签要清晰说明数据流
6. 通常 2-6 个 Agent，连接数适中

## 可选模型
${AVAILABLE_MODELS.map((m) => `- ${m}`).join('\n')}

## 可选工具
${AVAILABLE_TOOLS.map((t) => `- ${t}`).join('\n')}

## 可选颜色
${COLOR_PALETTE.map((c) => `- ${c}`).join('\n')}

## 位置布局建议
- 节点间距 200-350px
- y 坐标按流程从上到下排列（起始 100，间隔 150）
- x 坐标居中约 300，分支偏移 ±200
- 节点 ID 格式: agent-0, agent-1, agent-2, ...

请根据用户需求设计最佳方案。只输出 JSON，不要额外解释。`

export function parseAgentConfigResponse(raw: string): FlowTemplate | null {
  try {
    let jsonStr = raw

    const fenceMatch = raw.match(/```json\s*([\s\S]*?)\s*```/)
    if (fenceMatch) {
      jsonStr = fenceMatch[1]
    } else {
      const braceMatch = raw.match(/\{[\s\S]*\}/)
      if (braceMatch) jsonStr = braceMatch[0]
    }

    const parsed = JSON.parse(jsonStr)
    if (!parsed.nodes || !Array.isArray(parsed.nodes)) return null

    const nodes = parsed.nodes.map((n: Record<string, unknown>, i: number) => ({
      type: 'agent' as const,
      data: {
        label: (n.data as Record<string, unknown>)?.label || `Agent ${i + 1}`,
        role: (n.data as Record<string, unknown>)?.role || '',
        model: (n.data as Record<string, unknown>)?.model || 'gpt-4o',
        color: (n.data as Record<string, unknown>)?.color || COLOR_PALETTE[i % COLOR_PALETTE.length],
        tools: Array.isArray((n.data as Record<string, unknown>)?.tools) ? (n.data as Record<string, unknown>).tools : [],
        status: 'idle' as const
      },
      position: (n.position as { x: number; y: number }) || { x: 250 + (i % 3) * 200, y: 100 + Math.floor(i / 3) * 150 }
    }))

    const edges = Array.isArray(parsed.edges)
      ? parsed.edges.map((e: Record<string, unknown>) => ({
          source: (e.source as string) || `agent-0`,
          target: (e.target as string) || `agent-1`,
          data: { label: (e.data as Record<string, unknown>)?.label || '', animated: (e.data as Record<string, unknown>)?.animated ?? false }
        }))
      : []

    return {
      id: genId('ai-'),
      name: parsed.name || 'AI 生成方案',
      description: parsed.description || '',
      nodes,
      edges
    }
  } catch {
    return null
  }
}
