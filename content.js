// =============== 配置区 ===============
const PROXY_URL = "http://localhost:8000/grade";

// =============== 工具函数 (抓取逻辑) ===============
function cleanText(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function extractLogContent() {
  const containers = [
    document.querySelector('div[class*="article_info"]'),
    document.querySelector('div[data-v*="weekly-log"]'),
    document.querySelector('div[data-v*="log-content"]'),
    document.querySelector('.log-content'),
    document.querySelector('.content-box'),
    document.querySelector('.drawer-body') // 增加容器匹配
  ].filter(Boolean);

  for (const container of containers) {
    const ps = Array.from(container.querySelectorAll('p, div:not([class*="title"])'));
    const text = ps.map(p => cleanText(p.innerText)).filter(t => t).join('\n');
    if (text && text.length > 20) return text; // 简单校验长度
  }
  return "";
}

function extractTitle() {
  const content = extractLogContent();
  const titleMatch = content.match(/^本周工作内容：(.+)/i);
  if (titleMatch) return titleMatch[1].split(/[●•]/)[0].trim();
  const drawerTitle = document.querySelector('.el-drawer__title')?.innerText;
  return cleanText(drawerTitle) || "实习周志";
}

function extractStudentInfo() {
  return (
    cleanText(document.querySelector('[class*="user-name"]')?.innerText) ||
    cleanText(document.querySelector('.student-name')?.innerText) ||
    "学生"
  );
}

// =============== 面板管理 ===============
function toggleAIPanel() {
  let panel = document.getElementById('ai-assist-panel');
  if (panel) {
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  } else {
    injectAIPanel();
  }
}

function injectAIPanel() {
  if (document.getElementById('ai-assist-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'ai-assist-panel';
  panel.style.cssText = `
    position: fixed; top: 80px; left: 20px; z-index: 999999;
    background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    padding: 20px; width: 380px; font-family: sans-serif;
    border: 1px solid #eee;
  `;

  panel.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
      <h3 style="margin:0; color:#1a73e8; font-size:18px;">🤖 AI 助审助手</h3>
      <button id="close-btn" style="background:none; border:none; font-size:24px; cursor:pointer; color:#999;">×</button>
    </div>
    
    <div style="margin-bottom:10px;"><strong>建议分数：</strong><span id="ai-score" style="font-size:20px; color:#f5222d; font-weight:bold;">--</span></div>
    <div style="margin-bottom:8px;"><strong>AI 评语：</strong></div>
    <textarea id="ai-comment" rows="6" style="width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; resize:none; font-size:14px; box-sizing:border-box;" placeholder="点击生成按钮获取内容..."></textarea>
    
    <div style="margin-top:15px; display:flex; gap:10px;">
      <button id="gen-btn" style="flex:1; background:#34c759; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;">生成评语</button>
      <button id="apply-btn" style="flex:1; background:#4285f4; color:white; border:none; padding:10px; border-radius:6px; cursor:pointer; font-weight:bold;" disabled>采纳建议</button>
    </div>
    <div style="margin-top:10px; font-size:11px; color:#999; text-align:center;">请确保周志详情页已打开</div>
  `;

  document.body.appendChild(panel);

  // 绑定事件
  panel.querySelector('#close-btn').onclick = () => panel.style.display = 'none';
  
  panel.querySelector('#gen-btn').onclick = async () => {
    // 每次点击生成时重新抓取页面内容
    const content = extractLogContent();
    const student = extractStudentInfo();
    const title = extractTitle();

    if (!content) {
      alert("未检测到周志内容，请先打开右侧周志详情弹窗！");
      return;
    }

    await handleGenerate(content, title, student);
  };

  panel.querySelector('#apply-btn').onclick = applyAI;
}

// =============== API 调用 ===============
async function handleGenerate(content, title, student) {
  const panel = document.getElementById('ai-assist-panel');
  const scoreEl = panel.querySelector('#ai-score');
  const commentEl = panel.querySelector('#ai-comment');
  const genBtn = panel.querySelector('#gen-btn');
  const applyBtn = panel.querySelector('#apply-btn');

  // 状态更新
  scoreEl.innerText = "...";
  commentEl.value = "AI 正在深度解析周志内容，请稍候...";
  genBtn.disabled = true;
  genBtn.style.opacity = "0.7";

  try {
    const resp = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        title, 
        student, 
        project: "校友邦实习项目", 
        body: content 
      })
    });

    if (!resp.ok) throw new Error(`服务器响应失败: ${resp.status}`);

    const result = await resp.json();
    scoreEl.innerText = result.score || "85";
    commentEl.value = result.comment || "";
    applyBtn.disabled = false;
  } catch (err) {
    console.error(err);
    commentEl.value = "生成失败，请确认本地代理服务已启动: " + err.message;
  } finally {
    genBtn.disabled = false;
    genBtn.style.opacity = "1";
  }
}

// =============== 填充逻辑 ===============
function applyAI() {
  const panel = document.getElementById('ai-assist-panel');
  const score = panel.querySelector('#ai-score').innerText;
  const comment = panel.querySelector('#ai-comment').value;

  // 这里的选择器保持您原有的鲁棒性逻辑
  const scoreInput = Array.from(document.querySelectorAll('input')).find(el => 
    el.placeholder?.includes('分数') || el.closest('.field_r')?.textContent?.includes('分数')
  );

  const commentInput = Array.from(document.querySelectorAll('textarea')).find(el => 
    el.placeholder?.includes('评语') || el.closest('.field_r')?.textContent?.includes('评语')
  );

  if (scoreInput) {
    scoreInput.value = score;
    scoreInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (commentInput) {
    commentInput.value = comment;
    commentInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  if (!scoreInput && !commentInput) {
    alert("未找到填充目标，请确保审批界面已完全展开");
  }
}

// =============== 监听来自 Background 的点击指令 ===============
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggle_panel") {
    toggleAIPanel();
  }
});