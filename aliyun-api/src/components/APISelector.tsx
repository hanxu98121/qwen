'use client'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Cloud, Zap } from 'lucide-react'

export type APIProvider = 'qwen' | 'doubao'

interface APISelectorProps {
  value: APIProvider
  onChange: (value: APIProvider) => void
  disabled?: boolean
}

export default function APISelector({ value, onChange, disabled = false }: APISelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-2 block">API 提供商</label>
        <Select value={value} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="选择API提供商" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="qwen">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4" />
                <span>阿里云通义千问 (Qwen)</span>
                <Badge variant="secondary" className="text-xs">推荐</Badge>
              </div>
            </SelectItem>
            <SelectItem value="doubao">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>字节跳动豆包 (Doubao)</span>
                <Badge variant="outline" className="text-xs">实时</Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* API 说明 */}
      <div className="space-y-2">
        {value === 'qwen' && (
          <Alert>
            <Cloud className="h-4 w-4" />
            <AlertDescription>
              <strong>阿里云通义千问：</strong>
              <ul className="mt-1 text-xs space-y-1">
                <li>• 支持多种音频格式，文件上传和URL方式</li>
                <li>• 高精度语音识别，支持多语言</li>
                <li>• 提供上下文增强和逆文本规范化</li>
                <li>• 支持流式和批量转录模式</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {value === 'doubao' && (
          <Alert>
            <Zap className="h-4 w-4" />
            <AlertDescription>
              <strong>字节跳动豆包：</strong>
              <ul className="mt-1 text-xs space-y-1">
                <li>• 基于WebSocket的实时流式识别</li>
                <li>• 低延迟，适合实时语音转写</li>
                <li>• 支持标点符号和格式化输出</li>
                <li>• 需要app_key和access_key认证</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  )
}