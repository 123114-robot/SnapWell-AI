# SnapWell AI 标注规范 v1.0
# SnapWell AI Annotation Guide v1.0

项目：`snapwell-ingredients`（Roboflow / Object Detection / 39 类）
标注工具：Roboflow Annotate，每人按 job 分派
更新日期：2026-08-24

Project: `snapwell-ingredients` (Roboflow / Object Detection / 39 classes)
Tool: Roboflow Annotate, jobs assigned per person
Last updated: 2026-08-24

---

## 零、开工前必读
## 0. Read Before You Start

**禁止使用 Auto Label、Label Assist、Smart Polygon、Box Prompting。** 这些功能会消耗 workspace 的月度 credits（50/月，全组共用），且我们已实测预训练模型在澳洲超市货架场景下失效。全部手工画框。

**Do NOT use Auto Label, Label Assist, Smart Polygon, or Box Prompting.** These consume the workspace's monthly credits (50/month, shared across the team), and we have already verified that pre-trained models fail on Australian supermarket shelf scenes. All boxes must be drawn manually.

**不要在 Roboflow 训练模型，不要下载权重，不要开 Augmentation。** 训练在本地进行，数据增强由 ultralytics 在训练时处理。

**Do not train models in Roboflow, do not download weights, do not enable Augmentation.** Training happens locally; augmentation is handled by ultralytics at training time.

---

## 一、通用规则（39 类全部适用）
## 1. General Rules (apply to all 39 classes)

### 1.1 只标你 job 对应的那一个类

图片里出现的其他食材一律不画框。例如香蕉图里出现橙子，不要框橙子。这不是遗漏，是规定——每张图只服务于它所属的那一个类。

### 1.1 Label only the class your job is named after

Ignore every other food item in the frame. If a banana photo also contains oranges, do not box the oranges. This is not an oversight — each image serves only its own class.

### 1.2 框要贴紧可见轮廓

框住物体实际看得见的部分，被遮挡的部分不要往外推测延伸。包装商品框整个包装（含标签），不要只框包装内的食物。

### 1.2 Boxes must hug the visible extent

Box what is actually visible. Do not extrapolate beyond occlusions. For packaged goods, box the entire package including its label — not just the food inside it.

### 1.3 画几个框：先确定「标注单位」

**关键：先想清楚这一类的标注单位是什么，再数数量。**

| 标注单位 | 典型类 | 说明 |
|---|---|---|
| 包装 / 袋 / 盒 / 串 | rice, pasta, bread, milk, butter, cheese, yoghurt, grape | 一袋米 = 一个框，不是数米粒；一串葡萄 = 一个框，不是数葡萄粒 |
| 单个个体 | apple, orange, lemon, mango, avocado, potato, onion, tomato, egg | 一个果实 = 一个框 |

确定单位后按数量分档：

| 目标数量 | 规则 |
|---|---|
| ≤ 20 | 全部画框 |
| 21–40 | 只框前排完整可见的，后排层叠、侧面斜视、只露一角的跳过 |
| > 40 | **整张图移出数据集**，不要部分标注（见 1.4） |

**绝对禁止一个大框套住整排货架。** 这正是我们放弃自动预标注的原因（通用模型只输出整体框），人工标注不能重复同样的错误。

### 1.3 How many boxes: first decide the "annotation unit"

**Key: work out what the unit is for your class before you start counting.**

| Unit | Typical classes | Note |
|---|---|---|
| Package / bag / box / bunch | rice, pasta, bread, milk, butter, cheese, yoghurt, grape | One bag of rice = one box, not one per grain; one bunch of grapes = one box, not one per berry |
| Individual item | apple, orange, lemon, mango, avocado, potato, onion, tomato, egg | One fruit = one box |

Once the unit is fixed, apply the count tiers:

| Target count | Rule |
|---|---|
| ≤ 20 | Box all of them |
| 21–40 | Box only fully visible front-row items; skip anything stacked behind, edge-on, or showing a corner |
| > 40 | **Remove the whole image from the dataset** — do not partially label it (see 1.4) |

**Never draw one large box around an entire shelf display.** This is exactly why we abandoned auto-labelling (the pre-trained model only produced whole-region boxes) — manual annotation must not repeat that mistake.

### 1.4 为什么超过 40 个要整张移出，而不是标一部分

YOLO 训练时把没有框的区域当作背景。一张图里有 100 个牛油果，你只标 15 个，剩下 85 个就在教模型「牛油果 = 背景」，这比不要这张图糟糕得多。所以极端密集的图只有两条路：全标，或整张移出。

移出方式：在 job 里选中该图 → 从 job 中移除，图片回到 Unassigned，不要 Delete。这样后期能统计剔除数量，写进 A3 的数据集方法章节。

### 1.4 Why images past 40 are removed entirely, not partially labelled

YOLO treats unboxed regions as background. If an image holds 100 avocados and you box 15, the remaining 85 actively teach the model that avocado is background — worse than not having the image at all. So extremely dense images have only two options: label everything, or remove the image.

How to remove: select the image in the job → remove it from the job. It returns to Unassigned. Do not Delete. This keeps a count we can report in the A3 dataset methodology section.

### 1.5 纹理类图片：画一个近似全图的框

有些图整幅画面都是同一种食材，没有可分离的个体边界——例如米粒微距（`rice_coles_011/012/013`）、面粉、糖、燕麦的特写。这类图画**一个覆盖绝大部分画面的框**即可，不要试图数颗粒，也不要移出。

判断标准：如果你无法指出「第一个物体在哪里结束、第二个从哪里开始」，那它就是纹理，画一个整体框。

### 1.5 Texture images: draw one near-full-frame box

Some images are entirely one ingredient with no separable object boundaries — macro shots of rice grains (`rice_coles_011/012/013`), flour, sugar, oats. For these, draw **a single box covering most of the frame**. Do not count grains, and do not remove the image.

The test: if you cannot say where one object ends and the next begins, it is a texture — draw one box over the whole thing.

### 1.6 跳过条件（满足任意一条就不画框）

- 可见面积低于约 40%（被其他物体、价签、手遮挡）
- 框的短边低于 40 像素（远景小物体）
- 模糊到无法辨认是什么

### 1.6 Skip conditions (any one is enough to skip)

- Less than roughly 40% visible (blocked by other items, price tags, hands)
- Box's shorter side under 40 pixels (distant small objects)
- Too blurry to identify

### 1.7 整张图零个框是合法的

如果一张图里没有任何符合标准的目标，直接标记完成，不要硬画。零框图片是有价值的负样本，能降低模型误检率。

### 1.7 Zero boxes on an image is valid

If nothing in an image meets the criteria, just mark it done. Do not force a box. Zero-box images are useful negative samples that reduce false positives.

### 1.8 近似品绝不改标（重要）

视觉相似但营养成分不同的东西，**不画框、不改成别的类、直接留空**：

| 类 | 不要标的东西 |
|---|---|
| milk | 豆奶、燕麦奶、杏仁奶、椰奶、奶昔、淡奶油 |
| butter | 人造黄油、植物基涂抹酱（如 Flora ProActiv）、酥油 |
| cheese | 不透明盒装奶油奶酪抹酱、加工芝士酱 |
| yoghurt | 酸奶饮料、乳酸菌饮品、乳制甜点 |
| bread | 蛋糕、甜甜圈、披萨底、饼干 |

其他类遇到类似情况同理处理。判断标准是：营养数据是否不同。不同就不标。

### 1.8 Never relabel look-alikes (important)

Items that look similar but differ nutritionally get **no box, no substitute class — leave them blank**:

| Class | Do NOT label |
|---|---|
| milk | Soy, oat, almond, coconut milk; milkshakes; cream |
| butter | Margarine, plant-based spreads (e.g. Flora ProActiv), ghee |
| cheese | Opaque-tub cream cheese spreads, processed cheese sauce |
| yoghurt | Yoghurt drinks, probiotic drinks, dairy desserts |
| bread | Cake, donuts, pizza bases, biscuits |

Apply the same logic to other classes. The test is whether the nutritional data differs. If it does, don't label it.

### 1.9 遇到拿不准的情况

**把整个类的缩略图网格截图，连同这份规范一起发给 AI 提问。** 不要凭个人理解硬标——六个人各自理解不一致，合并后的数据集会有系统性噪声，而且在 mAP 上看不出来是标注问题还是模型问题。

### 1.9 When you're unsure

**Screenshot the full thumbnail grid for your class and ask the AI, attaching this guide.** Do not guess. Six people guessing differently produces systematic noise in the merged dataset — and you cannot tell from mAP whether the problem is the labels or the model.

---

## 二、示例：如何应用上述规则
## 2. Worked Examples

以下三个类演示规则怎么落地。其他类照此类推，不确定就截图问 AI。

The three classes below show how the rules play out. Extend the same reasoning to other classes; screenshot and ask when unsure.

### 例 1：grape（葡萄）— 框「串」不框「粒」

一串葡萄画一个框，不要逐颗画。碗里的散粒整体一个框。袋装/盒装框整个包装。只有单颗特写（比如手持一颗、切开的横截面）才框单颗。货架上密集陈列的，只框前排完整可见的包装袋。

### Example 1: grape — box the bunch, not the berry

One box per bunch. Loose berries in a bowl get one box for the whole cluster. Bagged or boxed grapes: box the package. Only box an individual berry when it's a close-up of one (held in hand, cut cross-section). On dense shelves, box only fully visible front-row packages.

### 例 2：banana（香蕉）— 框「把」不框「根」

连在一起的一把香蕉 = 一个框。分离的单根各画一框。**剥开的、切块的照常框** —— 这些是用户真实会拍到的状态，属于有效训练样本。整箱陈列的只框前排完整可见的把。

### Example 2: banana — box the hand, not the finger

Bananas attached together = one box per hand. Detached singles get one box each. **Peeled and sliced bananas do get boxed** — these are realistic user-photo states and valid training samples. For crates and shelf displays, box only fully visible front-row hands.

### 例 3：butter（黄油）— 近似品留空的实例

Devondale Extra Soft、Western Star Spreadable 是乳制品，正常画框。**Flora ProActiv 是植物基涂抹酱，全部不画框**，整张图留空即可（这些图作为负样本保留在数据集里）。挖出来摊在盘子上的黄油照常框。货架堆叠的按密度规则处理。

### Example 3: butter — look-alikes in practice

Devondale Extra Soft and Western Star Spreadable are dairy — box them normally. **Flora ProActiv is a plant-based spread — draw no boxes at all**, leave the image blank (these stay in the dataset as negative samples). Butter scooped onto a plate is boxed normally. Stacked shelf displays follow the density rule.

---

## 三、进度与提交
## 3. Progress and Submission

标注量参考：每人约 180–200 张，按 2 分钟/张估算约 6–7 小时。建议分 3–4 次完成，不要一口气标完（疲劳会显著降低框的质量）。

Workload: roughly 180–200 images each, about 6–7 hours at 2 minutes per image. Spread it over 3–4 sessions — fatigue noticeably degrades box quality.

一个 job 全部标完后点 **Submit for Review**，不要自行 Approve。

When a job is fully labelled, click **Submit for Review**. Do not approve your own work.
