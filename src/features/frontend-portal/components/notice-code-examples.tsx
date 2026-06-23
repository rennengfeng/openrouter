/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CodeBlock, CodeBlockCopyButton } from '@/components/ai-elements/code-block'

type Language = 'curl' | 'python' | 'typescript'

interface SDKExample {
  name: string
  nameKey: string
  color: string
  descKey: string
  examples: Record<Language, string>
}

const EXAMPLES: SDKExample[] = [
  {
    name: 'OpenAI',
    nameKey: 'portal.notice.sdk.openai',
    color: '#059669',
    descKey: 'portal.notice.sdk.openai.desc',
    examples: {
      curl: `curl "https://api.xendalink.com/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Hello!"}]}'`,
      python: `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_API_KEY",
    base_url="https://api.xendalink.com/v1"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role":"user","content":"Hello!"}]
)
print(response.choices[0].message.content)`,
      typescript: `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "YOUR_API_KEY",
  baseURL: "https://api.xendalink.com/v1"
});

const res = await client.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello!" }]
});
console.log(res.choices[0].message.content);`,
    },
  },
  {
    name: 'Anthropic',
    nameKey: 'portal.notice.sdk.anthropic',
    color: '#7c3aed',
    descKey: 'portal.notice.sdk.anthropic.desc',
    examples: {
      curl: `curl "https://api.xendalink.com/v1/messages" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "x-api-key: YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-opus-4-8","max_tokens":1024,"messages":[{"role":"user","content":"Hello!"}]}'`,
      python: `from anthropic import Anthropic

client = Anthropic(
    api_key="YOUR_API_KEY",
    base_url="https://api.xendalink.com/v1"
)

msg = client.messages.create(
    model="claude-opus-4-8",
    max_tokens=1024,
    messages=[{"role":"user","content":"Hello!"}]
)
print(msg.content[0].text)`,
      typescript: `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: "YOUR_API_KEY",
  baseURL: "https://api.xendalink.com/v1"
});

const msg = await client.messages.create({
  model: "claude-opus-4-8",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }]
});
console.log(msg.content[0].text);`,
    },
  },
  {
    name: 'Gemini',
    nameKey: 'portal.notice.sdk.gemini',
    color: '#ea580c',
    descKey: 'portal.notice.sdk.gemini.desc',
    examples: {
      curl: `curl "https://api.xendalink.com/v1beta/models/gemini-2.0-flash:generateContent?key=YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"contents":[{"parts":[{"text":"Hello!"}]}]}'`,
      python: `import google.generativeai as genai

genai.configure(api_key="YOUR_API_KEY")
# base_url: https://api.xendalink.com/v1beta

model = genai.GenerativeModel("gemini-2.0-flash")
response = model.generate_content("Hello!")
print(response.text)`,
      typescript: `import { GoogleGenerativeAI } from "@google/generative-ai";

// base_url: https://api.xendalink.com/v1beta
const genAI = new GoogleGenerativeAI("YOUR_API_KEY");
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash"
});

const result = await model.generateContent("Hello!");
console.log(result.response.text());`,
    },
  },
]

function SDKCard({ sdk }: { sdk: SDKExample }) {
  const [lang, setLang] = useState<Language>('curl')
  const { t } = useTranslation()

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 font-semibold" style={{ color: sdk.color }}>
        {t(sdk.nameKey, sdk.name)}
      </div>
      <div className="mb-3 text-xs text-gray-500">
        {t(sdk.descKey, '')}
      </div>
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setLang('curl')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
            lang === 'curl'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          cURL
        </button>
        <button
          type="button"
          onClick={() => setLang('python')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
            lang === 'python'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          Python
        </button>
        <button
          type="button"
          onClick={() => setLang('typescript')}
          className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition ${
            lang === 'typescript'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
          }`}
        >
          TypeScript
        </button>
      </div>
      <div className="relative">
        <CodeBlock
          code={sdk.examples[lang]}
          language={lang === 'curl' ? 'bash' : lang === 'typescript' ? 'typescript' : 'python'}
          className="text-xs"
        >
          <CodeBlockCopyButton size="sm" />
        </CodeBlock>
      </div>
    </div>
  )
}

export function NoticeCodeExamples() {
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 my-4">
      <div className="mb-2 text-base font-bold text-gray-900">
        💻 {t('portal.notice.codeExamples.title', '快速接入代码示例')}
      </div>
      <div className="mb-4 text-xs text-gray-600">
        {t('portal.notice.codeExamples.subtitle', '本站完美兼容 OpenAI SDK，选择你的语言查看代码。')}
      </div>
      <div className="flex flex-col gap-4">
        {EXAMPLES.map((sdk) => (
          <SDKCard key={sdk.name} sdk={sdk} />
        ))}
      </div>
    </div>
  )
}
