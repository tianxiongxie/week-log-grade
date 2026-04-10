// sidePanel.js
(async () => {
  const scoreEl = document.getElementById('ai-score');
  const commentEl = document.getElementById('ai-comment');
  const genBtn = document.getElementById('gen-btn');
  const applyBtn = document.getElementById('apply-btn');

  // 从 content script 获取当前页面周志内容（通过 runtime.sendMessage）
  async function fetchCurrentLog() {
    try {
      const tab = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab[0]) throw new Error("未找到活动标签页");

      const result = await chrome.tabs.sendMessage(tab[0].id, { action: "get_log_content" });
      return result;
    } catch (err) {
      console.error("[SidePanel] 获取周志失败:", err);
      alert("❌ 无法获取当前周志内容，请确保您已打开校友邦周志页面");
      throw err;
    }
  }

  // 调用本地代理生成评语（复用原逻辑）
  async function generateGrade(logData) {
    const { title, student, project, body } = logData;

    scoreEl.innerText = "...";
    commentEl.value = "AI 正在思考...";
    genBtn.disabled = true;
    commentEl.disabled = true;
    applyBtn.disabled = true;

    try {
      const resp = await fetch("http://localhost:8000/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, student, project, body })
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text}`);
      }

      const result = await resp.json();

      scoreEl.innerText = result.score || "--";
      commentEl.value = result.comment || "AI未能生成评语";
      commentEl.disabled = false;
      applyBtn.disabled = false;

      console.log("[SidePanel] AI返回:", result);
    } catch (err) {
      console.error("AI 评分失败:", err);
      scoreEl.innerText = "❌";
      commentEl.value = `请求失败：${err.message}\n请检查本地代理是否运行中（http://localhost:8000）`;
      commentEl.disabled = false;
      applyBtn.disabled = true;
    } finally {
      genBtn.disabled = false;
    }
  }

  // 向 content script 请求最新周志内容，并生成评语
  genBtn.addEventListener('click', async () => {
    try {
      const logData = await fetchCurrentLog();
      await generateGrade(logData);
    } catch (err) {
      // 错误已在 generateGrade 中处理
    }
  });

  // 采纳AI建议：发送消息给 content script 执行填充
  applyBtn.addEventListener('click', async () => {
    const score = scoreEl.innerText;
    const comment = commentEl.value;

    try {
      const tab = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab[0]) return;

      await chrome.tabs.sendMessage(tab[0].id, {
        action: "apply_ai_suggestion",
        data: { score, comment }
      });
      alert(`✅ 已填入：分数 ${score}，评语 ${comment.length} 字`);
    } catch (err) {
      console.error("采纳失败:", err);
      alert("❌ 填充失败：" + err.message);
    }
  });

  // 初始化：可选提示
  commentEl.placeholder = "点击“生成评语”按钮获取AI建议";
})();