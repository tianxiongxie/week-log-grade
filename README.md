@echo off

set ENV_NAME=weekLogGrade

echo 🚀 创建环境
conda create -y -n %ENV_NAME% python=3.11

echo 🔄 激活环境
call conda activate %ENV_NAME%

echo 📦 安装依赖
pip install fastapi uvicorn httpx python-dotenv

echo 🔑 设置环境变量
set DASHSCOPE_API_KEY=your_api_key_here

echo ▶️ 启动应用
python proxy.py

pause
