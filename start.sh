#!/bin/bash

# PDF网页处理应用启动脚本

echo "启动 PDF 处理应用..."
echo ""

# 检查Python
if ! command -v python3 &> /dev/null; then
    echo "错误: 未找到 python3，请先安装 Python 3"
    exit 1
fi

# 检查Node.js
if ! command -v npm &> /dev/null; then
    echo "错误: 未找到 npm，请先安装 Node.js"
    exit 1
fi

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# 启动后端
echo "启动后端服务..."
cd "$SCRIPT_DIR/backend"
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

# 等待后端启动
sleep 2

# 启动前端
echo "启动前端服务..."
cd "$SCRIPT_DIR/frontend"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "================================"
echo "服务已启动："
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8000"
echo "================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获退出信号
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# 等待
wait
