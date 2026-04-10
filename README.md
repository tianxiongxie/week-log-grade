## 千问大模型校友邦周志批阅

### 创建环境
conda create -y -n weekLogGrade python=3.11

### 激活环境
call conda activate weekLogGrade

### 安装依赖
pip install fastapi uvicorn httpx python-dotenv

### 设置环境变量
set DASHSCOPE_API_KEY=your_api_key_here

### 启动应用
python proxy.py

