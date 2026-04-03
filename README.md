# Rust KDA / Rust 玩家画像查询站

[中文](./README.md) | [English](./README.en.md)

Rust KDA 是一个围绕 **Rust 玩家公开数据查询** 构建的前后端项目，聚合：

- `Steam Web API`：玩家资料、Rust 总时长、部分官方统计
- `SCMM`：Rust 皮肤价格与库存估值
- `Steam 库存页面`：补齐部分公开库存物品名称
- `BattleMetrics`：服务器时长候选与会话记录

当前项目定位是：

- `Web 单站点部署`
- `带入口密码`
- `后端代理第三方接口`
- `适合个人部署到自己的域名`

## 一、项目边界

### 当前已实现

- 玩家基础资料查询
- Rust KDA / 统计画像展示
- 公开库存聚合与估值
- 官方商城目录交叉命中
- BattleMetrics 候选选择后加载服务器时长
- 入口密码 + Session 鉴权
- 基础限流

### 当前限制

- `BattleMetrics` 查询依赖第三方风控状态
- 服务器时长不保证对任意服务器出口稳定可用
- Rust 绑定包 / 商城包并不总能通过公开库存 100% 精确反推
- 部分数据依赖账号隐私设置是否公开

## 二、技术结构

### 后端

- `Flask`
- `Flask-CORS`
- `Gunicorn`

主文件：

- `rust_query_server_v2.py`

### 前端

- `React 18`
- `Vite`

主文件：

- `rust_query_app_v2.jsx`
- `src/App.jsx`
- `src/main.jsx`

### 测试

- `pytest`

测试文件：

- `tests/test_server.py`

## 三、项目结构

```text
rust-kda/
├── rust_query_server_v2.py      # Flask 后端
├── rust_query_app_v2.jsx        # 主前端组件
├── src/
│   ├── App.jsx                  # 前端入口组件
│   └── main.jsx                 # 前端挂载入口
├── tests/
│   └── test_server.py           # 后端测试
├── index.html                   # Vite HTML 入口
├── vite.config.js               # 前端构建与代理配置
├── package.json                 # 前端依赖与脚本
├── requirements.txt            # 后端依赖
├── pytest.ini                  # pytest 配置
└── .env.example                # 环境变量模板
```

## 四、快速开始

### 1. 安装前端依赖

```bash
npm install
```

### 2. 安装后端依赖

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

然后填写你自己的配置：

```bash
STEAM_API_KEY="your-steam-key"
BATTLEMETRICS_TOKEN="your-battlemetrics-token"
APP_ACCESS_PASSWORD="change-me-access-password"
APP_SESSION_SECRET="change-me-to-a-long-random-secret"
ALLOWED_ORIGINS="https://your-domain.example"
```

### 4. 启动后端

```bash
.venv/bin/python rust_query_server_v2.py
```

默认端口：

- `http://127.0.0.1:5050`

### 5. 启动前端

```bash
npm run dev
```

默认地址：

- `http://127.0.0.1:5173`

## 五、生产部署

推荐部署形态：

- `Nginx` 提供静态前端
- `Gunicorn` 运行 Flask
- 仅反代 `/api/*`
- 使用 HTTPS

生产环境建议：

- `SESSION_COOKIE_SECURE=true`
- `FLASK_DEBUG=false`
- `ALLOWED_ORIGINS` 只填正式域名
- 入口密码不要使用公开 README 里的示例值
- Steam / BattleMetrics token 只保存在服务器 `.env`

## 六、开发与验证

前端构建：

```bash
npm run build
```

后端测试：

```bash
.venv/bin/pytest -q
```

## 七、安全说明

以下内容属于敏感信息或运行时数据，不应提交到公开仓库：

- `.env`
- Steam API Key
- BattleMetrics Token
- 入口密码
- Session Secret
- 服务器部署日志
- 调试抓取输出

本仓库已经默认忽略：

- `.env`
- `output/`
- `.playwright-cli/`
- `.venv/`
- `node_modules/`

## 八、已知问题

- BattleMetrics 可能会对部分服务器出口 IP 返回 Cloudflare challenge
- 出现这种情况时，网页上的服务器时长会不可用
- 这不是前端显示问题，而是第三方接口访问被拦截

## 九、许可证

当前项目基于 [MIT License](./LICENSE) 发布。
