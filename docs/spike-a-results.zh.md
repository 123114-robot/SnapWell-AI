# Spike A 技术验证报告：YOLOv8n × ONNX Runtime Web 浏览器内推理

**日期：** 2026-08-07（准备周，8月4日–9日）
**负责人：** Kai Ma
**风险等级：** 最高（项目红线 #1：8月9日前必须跑通，否则触发架构降级方案）
**结论：✅ 通过 —— Edge AI 浏览器内推理架构成立**

## 1. 验证目标

验证 SnapWell AI 的核心架构假设：将官方预训练 YOLOv8-nano 导出为 ONNX 后，
能否在**手机浏览器内**通过 ONNX Runtime Web (wasm 后端) 完成本地推理，
且延迟在可接受范围内（红线：远超 2 秒则触发降级方案——降低输入分辨率至 320
或改用 TensorFlow.js）。

该验证同时支撑隐私设计承诺（privacy by design）：照片不上传服务器，
全部推理在用户设备本地完成。

## 2. 实验环境

| 项目 | 版本/配置 |
|---|---|
| 导出环境 | macOS (Apple M3 Pro), conda env `csit998`, Python 3.11.15 |
| ultralytics | 8.4.115 |
| PyTorch | 2.13.0 |
| onnxruntime (Python 验证用) | 1.28.0 |
| onnxruntime-web | 1.28.0（`ort.wasm.bundle.min.mjs` 变体）|
| 前端构建 | Vite 8.2.1 + vanilla JS, Node 26.7.0 |
| 模型 | yolov8n.pt → yolov8n.onnx (opset 12, 640×640, onnxslim 简化, 12.3 MB) |

## 3. 方法概要

1. `yolo export model=yolov8n.pt format=onnx opset=12 imgsz=640 simplify=True`
2. 前端：canvas letterbox 预处理（等比缩放+灰边填充至 640×640）→
   Float32 CHW 归一化 → `session.run()` → JS 解码 `[1,84,8400]` 输出 →
   自实现贪心 NMS（IoU 0.45，置信度阈值 0.25）→ 坐标映射回原图绘框
3. 计时：预处理 / 推理 / 后处理分段，`performance.now()`
4. 设备端测试通过局域网访问 dev server（`vite --host`）

## 4. 实测结果

| 设备 | 浏览器 | 模型加载（冷/局域网*） | 预处理 | 推理 | 后处理 | 总计 |
|---|---|---|---|---|---|---|
| MacBook Pro (M3 Pro) | Chrome | 58 ms（缓存） | 10 ms | 215 ms | 3 ms | 228 ms |
| iPhone 16 Pro | Safari | ~250 ms | 71 ms | 219 ms | 4 ms | 296 ms |
| 中端 Android | Chrome | **待测** | — | — | — | — |

\* 局域网内加载，不代表公网 CDN 冷启动体验，见发现 5。

**核心结论：iPhone 16 Pro 端到端 296 ms，距 2 秒红线有约 7 倍余量。**

## 5. 关键发现（A3 素材）

1. **YOLOv8 ONNX 导出不含 NMS。** 输出为 8400 个原始候选框
   （84 = 4 坐标 + 80 类分数），NMS 须在 JavaScript 端自实现。
   属于文档不显眼但必踩的工程细节。
2. **ONNX Runtime Web 与 Vite 开发服务器存在已知集成摩擦。**
   ORT 默认通过运行时动态 `import()` 加载 wasm 加载器（.mjs），
   与 Vite dev server 的模块转换管道冲突（`/public` 文件禁止被 import）。
   依次排除三种方案后，最终采用官方 **bundle 变体**
   （`ort.wasm.bundle.min.mjs`，加载器内联，wasm 走普通 fetch）
   + `resolve.alias` + `wasmPaths` 指定单文件。此方案 dev/build 均可用。
3. **附带优化：** bundle/wasm 方案只需基础版
   `ort-wasm-simd-threaded.wasm`（13 MB），相比默认 jsep 变体（26 MB）
   首屏下载减半（放弃了 WebGPU 加速可能性，当前延迟余量下可接受）。
4. **预训练模型的类别局限得到实证。** COCO 80 类中食物仅约 10 类；
   Mac 测试中一张苹果图被误识为 orange 64%（红黄色圆形水果混淆），
   iPhone 拍摄屏幕上的苹果则正确识别 apple 67%。
   该结果直接支撑 proposal 中"自建食材数据集微调"的必要性论证
   （Sprint 2 工作），也说明 Spike A 验证的是**架构与延迟**而非精度。
5. **部署后首次加载是真实体验瓶颈。** 本次 ~250 ms 加载为局域网数字；
   生产环境用户需从 CDN 下载 13 MB wasm + 12 MB 模型，
   4G 下预计 5–15 秒。候选优化（Sprint 4）：INT8 量化
   （12 MB → 约 3 MB）、加载进度 UI、Service Worker 缓存。

## 6. 遗留事项

- [ ] 中端 Android（近 2–3 年机型）+ Chrome 实测——当前表中最大缺口，
      wasm 性能下限的真正考验
- [ ] 同设备连续推理 2–3 次记录预热效应（wasm JIT，第二次通常更快）
- [ ] iPhone 上 Chrome 复测一行数据
- [ ] 公网部署（Vercel）后补一次真实冷启动加载耗时