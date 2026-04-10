from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import httpx
import os
import json
import re

app = FastAPI(title="AI周志评分本地代理", docs_url="/docs", redoc_url="/redoc")

# ✅ 允许校友邦域名（关键！）
origins = [
    "https://www.xybsyw.com",
    "http://www.xybsyw.com",
    "https://xybsyw.com",
    "http://xybsyw.com",
    "http://localhost:*",  # 本地调试用
    "chrome-extension://*", # Chrome 插件用
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ 从环境变量读取 API Key（安全）
DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
if not DASHSCOPE_API_KEY:
    print("=" * 50)
    print("⚠️  警告：未设置环境变量 DASHSCOPE_API_KEY")
    print("请在终端中执行以下命令设置（替换为你的真实API Key）：")
    print("  Linux/macOS: export DASHSCOPE_API_KEY='your_key_here'")
    print("  Windows: set DASHSCOPE_API_KEY=your_key_here")
    print("=" * 50)
    exit(1)

@app.post("/grade")
async def grade_log(payload: dict):
    """
    输入: { "title": "...", "student": "...", "project": "...", "body": "..." }
    输出: { "score": 85, "comment": "..." }
    """
    title = payload.get("title", "实习周志")
    student = payload.get("student", "学生")
    project = payload.get("project", "未知项目")
    body = payload.get("body", "")

    prompt = f"""你是一名高校软件工程专业实习指导教师，请根据以下学生周志进行客观评分（0-100分）并撰写专业评语（不少于30字）：

【标题】{title}
【学生】{student}
【项目】{project}
【正文】{body}

评分维度：
- 内容详实性（30分）：是否描述具体任务、问题、解决步骤
- 技术/业务深度（30分）：是否体现方法论应用、量化思维、系统化沉淀
- 反思总结（20分）：是否有复盘、改进计划、知识迁移
- 表达规范（20分）：逻辑清晰、术语准确、无错别字

请严格按以下JSON格式返回，不要任何额外字符：
{{"score": 85, "comment": "该同学本周系统化沉淀24周方法论，构建能力雷达图实现成长可视化，体现较强结构化思维。建议后续补充具体落地效果数据..."}}"""

    # --- Debug: Print the request being sent ---
    print(f"[DEBUG] Sending request to DashScope:")
    print(f"  Headers: {{'Authorization': 'Bearer [REDACTED]', 'Content-Type': 'application/json'}}")
    print(f"  Payload: {{'model': 'qwen3-max-2026-01-23', 'input': ..., 'parameters': ...}}")
    print(f"  Prompt length: {len(prompt)} chars")
    # --- End Debug ---

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                "https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation", # ✅ 正确的官方 URL
                headers={
                    "Authorization": f"Bearer {DASHSCOPE_API_KEY}", # ✅ 正确的 Authorization 格式
                    "Content-Type": "application/json"
                },
                json={ # ✅ 使用 json 参数构建请求体
                    "model": "qwen3-max-2026-01-23", # ✅ 确保模型名正确
                    "input": {
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt # ✅ 使用构造好的 prompt
                            }
                        ]
                    },
                    "parameters": {
                        "max_tokens": 512,
                        "temperature": 0.4,
                        "top_p": 0.8
                    }
                }
            )
            print(f"[DEBUG] DashScope Response Status: {resp.status_code}") # Debug line
            print(f"[DEBUG] DashScope Response Body: {resp.text}")         # Debug line
            resp.raise_for_status() # ✅ 这会抛出 httpx.HTTPStatusError 对于 4xx/5xx
            data = resp.json()

            # --- Debug: Print raw response ---
            print(f"[DEBUG] Raw DashScope Response Data: {data}")
            # --- End Debug ---

            raw_text = data["output"]["choices"][0]["message"]["content"]

            # 容错解析 JSON
            try:
                result = json.loads(raw_text.strip().strip('`').replace('json', ''))
            except Exception as parse_err:
                print(f"[DEBUG] JSON Parse Error: {parse_err}, Raw Text: {raw_text}")
                match = re.search(r'\{[^}]*\}', raw_text)
                if match:
                    try:
                        result = json.loads(match.group())
                    except Exception as match_parse_err:
                        print(f"[DEBUG] Match JSON Parse Error: {match_parse_err}")
                        raise ValueError("LLM 返回非 JSON 格式")
                else:
                    raise ValueError("LLM 返回非 JSON 格式")

            score = int(result.get("score", 50))
            comment = str(result.get("comment", "AI生成评语")).strip()[:500]

            return {
                "score": max(0, min(100, score)),
                "comment": comment if len(comment) >= 30 else comment + "（AI生成，建议人工补充）"
            }

        except httpx.HTTPStatusError as e:
            print(f"[ERROR] HTTP Error from DashScope: {e.response.status_code}, Body: {e.response.text}")
            # 返回更具体的错误信息给前端
            raise HTTPException(status_code=e.response.status_code, detail=f"DashScope API Error: {e.response.text}")
        except Exception as e:
            print(f"[ERROR] General Error during DashScope call: {str(e)}") # 记录错误日志
            raise HTTPException(500, f"调用失败: {str(e)[:200]}")

@app.get("/")
async def health_check():
    return {"status": "running", "service": "AI周志评分代理"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 