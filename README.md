## 加载chrome插件
管理扩展程序->加载未打包的扩展程序->选择week-log-grade文件夹

在week-log-grade文件夹运行终端
### 创建环境
conda create -y -n weekLogGrade python=3.11

### 激活环境
conda activate weekLogGrade

### 安装依赖
pip install fastapi uvicorn httpx python-dotenv

### 设置环境变量
set DASHSCOPE_API_KEY=your_api_key_here

### 启动应用
python proxy.py --model qwen-plus  
--model 可选参数，默认模型：qwen3-max-2026-01-23
