#!/bin/bash
set -e

# 读取当前版本
VERSION=$(cat VERSION.txt)
echo "当前版本: $VERSION"

# 解析并递增 patch 版本
IFS='.' read -r MAJOR MINOR PATCH <<< "$VERSION"
PATCH=$((PATCH + 1))
NEW_VERSION="$MAJOR.$MINOR.$PATCH"
echo "新版本: $NEW_VERSION"

# 更新 VERSION.txt
echo "$NEW_VERSION" > VERSION.txt

# 构建镜像
echo "构建 Docker 镜像..."
docker build -t redonkatonk/mypdf:$NEW_VERSION -t redonkatonk/mypdf:latest .

# 推送镜像
echo "推送到 Docker Hub..."
docker push redonkatonk/mypdf:$NEW_VERSION
docker push redonkatonk/mypdf:latest

# Git 提交
git add VERSION.txt
git commit -m "Release v$NEW_VERSION"
git tag "v$NEW_VERSION"

echo "✅ 发布完成: v$NEW_VERSION"
