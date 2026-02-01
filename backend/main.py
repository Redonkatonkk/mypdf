"""
PDF网页处理应用 - FastAPI后端入口
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from api import upload, forms

app = FastAPI(
    title="PDF处理应用",
    description="支持PDF上传、编辑、表单处理的Web应用",
    version="1.0.0"
)

# CORS配置 - 允许所有来源（nginx 反向代理处理请求）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # 使用 * 时不能启用 credentials
    allow_methods=["*"],
    allow_headers=["*"],
)

# 确保上传目录存在
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# 静态文件服务（用于访问上传的文件）
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# 注册路由
app.include_router(upload.router, prefix="/api", tags=["上传"])
app.include_router(forms.router, prefix="/api", tags=["表单"])


@app.get("/")
async def root():
    return {"message": "PDF处理应用API服务运行中"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
