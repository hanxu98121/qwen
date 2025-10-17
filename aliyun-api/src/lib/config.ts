// 环境变量配置
export interface APIConfig {
  doubaoAppKey: string
  doubaoAccessKey: string
  qwenApiKey?: string
}

// 从环境变量读取配置
export function getAPIConfig(): APIConfig {
  return {
    doubaoAppKey: process.env.DOUBAO_APP_KEY || '',
    doubaoAccessKey: process.env.DOUBAO_ACCESS_KEY || '',
    qwenApiKey: process.env.QWEN_API_KEY || ''
  }
}

// 验证豆包API配置
export function validateDoubaoConfig(config: Pick<APIConfig, 'doubaoAppKey' | 'doubaoAccessKey'>): {
  isValid: boolean
  error?: string
} {
  if (!config.doubaoAppKey) {
    return { isValid: false, error: '豆包App Key未配置' }
  }

  if (!config.doubaoAccessKey) {
    return { isValid: false, error: '豆包Access Key未配置' }
  }

  return { isValid: true }
}

// 获取默认豆包配置（用于前端预填）
export function getDefaultDoubaoConfig(): {
  appKey: string
  accessKey: string
} {
  const config = getAPIConfig()
  return {
    appKey: config.doubaoAppKey || '',
    accessKey: config.doubaoAccessKey || ''
  }
}