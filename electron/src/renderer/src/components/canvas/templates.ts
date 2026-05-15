import type { FlowTemplate } from './types'

export const TEMPLATES: FlowTemplate[] = [
  {
    id: 'sequential',
    name: 'Sequential Pipeline',
    description: 'Agent 按顺序执行：研究 → 写作 → 审核',
    nodes: [
      { type: 'agent', data: { label: 'Researcher', role: '信息收集与分析', model: 'gpt-4', status: 'idle', color: '#6366f1', tools: ['web', 'browse'] }, position: { x: 0, y: 0 } },
      { type: 'agent', data: { label: 'Writer', role: '内容创作', model: 'gpt-4', status: 'idle', color: '#8b5cf6', tools: ['code'] }, position: { x: 0, y: 150 } },
      { type: 'agent', data: { label: 'Reviewer', role: '质量审核', model: 'gpt-4', status: 'idle', color: '#a78bfa', tools: [] }, position: { x: 0, y: 300 } }
    ],
    edges: [
      { source: 'agent-0', target: 'agent-1', data: { label: '研究结果', animated: true } },
      { source: 'agent-1', target: 'agent-2', data: { label: '草稿', animated: true } }
    ]
  },
  {
    id: 'parallel',
    name: 'Parallel Fan-out',
    description: '多 Agent 并行分析，结果汇聚',
    nodes: [
      { type: 'agent', data: { label: 'Coordinator', role: '任务分发与汇总', model: 'gpt-4', status: 'idle', color: '#f59e0b', tools: ['delegation'] }, position: { x: 200, y: 0 } },
      { type: 'agent', data: { label: 'Analyst A', role: '技术分析', model: 'gpt-4', status: 'idle', color: '#10b981', tools: ['code', 'web'] }, position: { x: 0, y: 180 } },
      { type: 'agent', data: { label: 'Analyst B', role: '市场分析', model: 'gpt-4', status: 'idle', color: '#3b82f6', tools: ['web', 'browse'] }, position: { x: 200, y: 180 } },
      { type: 'agent', data: { label: 'Analyst C', role: '用户体验分析', model: 'gpt-4', status: 'idle', color: '#ec4899', tools: ['browse'] }, position: { x: 400, y: 180 } }
    ],
    edges: [
      { source: 'agent-0', target: 'agent-1', data: { animated: true } },
      { source: 'agent-0', target: 'agent-2', data: { animated: true } },
      { source: 'agent-0', target: 'agent-3', data: { animated: true } },
      { source: 'agent-1', target: 'agent-0', data: { label: '反馈' } },
      { source: 'agent-2', target: 'agent-0', data: { label: '反馈' } },
      { source: 'agent-3', target: 'agent-0', data: { label: '反馈' } }
    ]
  },
  {
    id: 'debate',
    name: 'Debate / Adversarial',
    description: '多 Agent 辩论式协作，互相挑战观点',
    nodes: [
      { type: 'agent', data: { label: 'Moderator', role: '主持人', model: 'gpt-4', status: 'idle', color: '#f59e0b', tools: [] }, position: { x: 200, y: 0 } },
      { type: 'agent', data: { label: 'Proposer', role: '方案提出者', model: 'gpt-4', status: 'idle', color: '#10b981', tools: ['web', 'code'] }, position: { x: 0, y: 180 } },
      { type: 'agent', data: { label: 'Opponent', role: '质疑者', model: 'gpt-4', status: 'idle', color: '#ef4444', tools: ['web'] }, position: { x: 400, y: 180 } }
    ],
    edges: [
      { source: 'agent-0', target: 'agent-1', data: { label: '议题' } },
      { source: 'agent-0', target: 'agent-2', data: { label: '议题' } },
      { source: 'agent-1', target: 'agent-2', data: { label: '论点', animated: true } },
      { source: 'agent-2', target: 'agent-1', data: { label: '反驳', animated: true } },
      { source: 'agent-1', target: 'agent-0', data: { label: '结论' } },
      { source: 'agent-2', target: 'agent-0', data: { label: '结论' } }
    ]
  },
  {
    id: 'supervisor',
    name: 'Hierarchical Supervisor',
    description: '中心协调者分解任务，子 Agent 执行',
    nodes: [
      { type: 'agent', data: { label: 'Supervisor', role: '任务规划与协调', model: 'gpt-4', status: 'idle', color: '#f59e0b', tools: ['delegation'] }, position: { x: 200, y: 0 } },
      { type: 'agent', data: { label: 'Researcher', role: '信息搜索', model: 'gpt-4', status: 'idle', color: '#6366f1', tools: ['web', 'browse'] }, position: { x: 0, y: 200 } },
      { type: 'agent', data: { label: 'Coder', role: '代码实现', model: 'gpt-4', status: 'idle', color: '#10b981', tools: ['code', 'file', 'shell'] }, position: { x: 200, y: 200 } },
      { type: 'agent', data: { label: 'Tester', role: '测试验证', model: 'gpt-4', status: 'idle', color: '#ec4899', tools: ['shell', 'code'] }, position: { x: 400, y: 200 } }
    ],
    edges: [
      { source: 'agent-0', target: 'agent-1', data: { label: '研究任务' } },
      { source: 'agent-0', target: 'agent-2', data: { label: '编码任务' } },
      { source: 'agent-0', target: 'agent-3', data: { label: '测试任务' } },
      { source: 'agent-1', target: 'agent-2', data: { label: '参考资料' } },
      { source: 'agent-2', target: 'agent-3', data: { label: '代码交付' } },
      { source: 'agent-3', target: 'agent-0', data: { label: '测试报告', animated: true } }
    ]
  }
]
