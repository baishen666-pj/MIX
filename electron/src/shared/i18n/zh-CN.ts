import type { LocaleMessages } from './types'

export const zhCN: LocaleMessages = {
  app: {
    title: 'AI GUI',
    subtitle: '多Agent桌面工作台'
  },
  sidebar: {
    chat: '聊天',
    canvas: 'Agent 画布',
    memory: '记忆',
    tools: '工具',
    settings: '设置',
    computerUse: '桌面控制',
    im: 'IM'
  },
  chat: {
    placeholder: '输入消息，/ 查看命令...',
    send: '发送',
    newChat: '新对话',
    thinking: '思考中...'
  },
  settings: {
    title: '设置',
    language: '语言',
    connection: '连接配置',
    model: '模型配置',
    local: '本地模式',
    remote: '远程模式',
    save: '保存'
  },
  provider: {
    deepseek: 'DeepSeek',
    discoverModels: '发现模型',
    discovering: '发现中...',
    discoverFailed: '无结果',
    discoverDone: '已发现',
    switchModel: '切换模型',
    switchProvider: '切换服务商',
    subscription: {
      login: '登录',
      logging: '等待登录...',
      logout: '退出登录',
      loggedIn: '已登录',
      loginFailed: '登录失败，请重试',
      description: '使用你的订阅直接登录，无需 API Key'
    },
    hermes: {
      gatewayRunning: '网关运行中',
      gatewayStopped: '网关已停止',
      gatewayStarting: '正在启动...',
      gatewayStopping: '正在停止...',
      startGateway: '启动网关',
      stopGateway: '停止网关',
      readApiKey: '从配置读取密钥',
      apiKeyRead: '密钥已读取',
      apiKeyNotFound: '未找到密钥',
      cliNotAvailable: 'Hermes CLI 未找到',
      localAgent: '本地 Agent · OpenAI 兼容'
    }
  },
  common: {
    loading: '加载中...',
    error: '出错了',
    retry: '重试',
    cancel: '取消'
  }
}
