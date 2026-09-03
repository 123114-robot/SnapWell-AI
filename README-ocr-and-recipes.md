# OCR channel and recipe data update

This branch does two things: it makes the app read packaged food labels, and it
connects the recipe screens to the real AUSNUT data that was already in the
repository but was not being used.

Everything still runs on the phone. No photo is uploaded.

---

## 1. Reading package labels

Fresh food is found by the camera model. Packaged food (tins, sauces, pasta,
frozen bags) has no camera model, so the app now reads the words printed on the
label instead.

The OCR code from Spike B was moved out of the old `web/` demo and into the
real app. There is a new screen at `/scan-package`, and four ways to reach it:
the home page, the camera page, the confirm-ingredients page, and a link that
appears if a scan finds nothing.

**Files:** `app/src/ai/ocr.js`, `app/src/screens/ScanPackage.jsx`

## 2. The app finds the text by itself

At first the user had to drag a box around the words. That was slow and felt
wrong, so the app now does it automatically.

It works in two steps:

1. **Find the words.** The photo is shrunk down and scanned quickly. This step
   is not trying to read correctly, only to work out *where* the writing is.
2. **Read the words.** Each area found is cut out of the full-size photo and
   read properly.

If step 1 already read something clearly, step 2 is skipped to save time. A
clear label takes about one second. A hard one takes about three.

Dragging a box by hand is still there, but only as a backup if the automatic
scan gets it wrong.

## 3. Turning words into ingredients

Reading the words is not enough. `BOLOGNESE` has to become "pasta sauce".

A new matching step compares the recognised words against the 49 ingredient
names in the data files and shows the results as buttons. The user taps one to
add it. They no longer have to type the name themselves.

The matching allows for OCR mistakes. A jar photographed as `IN OLIVE UIL`
still matches olive oil, because the neighbouring word makes it clear.

It also fixes an old problem: the ingredient name used to be free text, so a
user could type anything and the nutrition lookup would fail later. Now every
ingredient must come from the known list.

**Files:** `app/src/ai/ingredientMatch.js`

## 4. Real recipes and real nutrition

The recipe screens used to show six recipes written directly into the code,
with photos from the internet and nutrition numbers that were made up.

They now use the real data: **100 recipes** and **AUSNUT nutrition for all 49
ingredients**. Supermarket links and the data credit also come from the data
files instead of being hard-coded.

**About the nutrition page:** the recipe data lists which ingredients a dish
uses, but not how much of each. That means a total for the whole dish cannot be
worked out. Rather than invent numbers, the page now shows the real AUSNUT
figures for each ingredient per 100 g, with the official food name and ID next
to it, and says plainly why there is no total.

Cooking time and calories per recipe are gone from the cards for the same
reason: that information is not in the data.

**Preferences now do something.** They used to be collected and ignored.
Vegetarian, low-calorie and high-protein come straight from the recipe tags.
Vegan, gluten-free, dairy-free and the allergy options are worked out from the
ingredients each recipe uses. Health goals move matching recipes up the list
rather than hiding others, because a dish you can cook tonight should not
disappear.

**Files:** `app/src/data/foodData.js`, and the four recipe screens

## 5. Data files

Jars often print only `BOLOGNESE`, not "bolognese sauce". The keyword list only
had the two-word version, so nothing matched.

Five single-word keywords were added to pasta sauce: bolognese, napoletana,
napolitana, arrabbiata, sugo.

This is worth knowing for later: adding a **keyword** to an existing ingredient
is a one-minute job. Adding a whole new **ingredient** is much slower, because
it needs an AUSNUT food ID and eight nutrition values looked up by hand.

## 6. Interface fixes

- **The extra results screen is gone.** After a photo, the app went to
  "Detected ingredients" and then to an almost identical "Confirm ingredients".
  Now it goes straight to the confirm screen.
- **Text is no longer centred.** The starter template's stylesheet was still in
  place and was centring all 13 screens, boxing them at desktop width, and
  turning text boxes dark on phones set to dark mode.
- **Ingredient names read properly.** `Olive_oil` now shows as "Olive oil".
- **Photos can come from the library.** The file picker was locked to the
  camera, so the photo library could not be used. That lock is removed.

---

## Known limitations

**OCR is unreliable on colourful packaging.** A flat white sticker with black
print, such as a Coles beef mince tray, reads perfectly in about a third of a
second. A frozen pea bag with dark green writing on light green, or a sauce jar
with white writing on a coloured banner, often fails to find the product name
at all.

The cause is the OCR engine itself. Tesseract was built for scanned documents,
not for writing printed over pictures and colours. Font style was tested and
ruled out. Fixing this properly needs a different recogniser, not more
adjustment of the current one.

**Only 49 ingredients are known.** A product can be read correctly and still
not match, simply because it is not in the list. Frozen peas is one example.
These two failures look the same to the user but need different fixes.

**No quantities.** Until the recipe data records how much of each ingredient a
serving uses, no per-dish nutrition total can be shown.

## Running it

```bash
npm install --prefix app
npm run dev --prefix app
```

Open the address it prints. Use the `app` folder, not `web` — `web` is the old
Spike A and B demo.

To test on a phone, open the Network address printed by Vite while the phone is
on the same Wi-Fi.

---
---

# OCR 通道与食谱数据更新（中文）

这个分支做了两件事：让 app 能读包装食品的标签，以及把食谱页面接到仓库里早就
准备好、但一直没用起来的真实 AUSNUT 数据上。

所有处理仍然在手机本地完成，照片不会上传。

---

## 1. 读包装标签

生鲜由摄像头模型识别。包装食品（罐头、酱料、意面、冷冻袋）没有对应的模型，
所以现在改成读标签上印的字。

Spike B 的 OCR 代码从旧的 `web/` demo 搬进了正式的 app。新增了 `/scan-package`
页面，有四个入口：首页、拍照页、确认食材页，以及扫描没结果时出现的链接。

**文件：** `app/src/ai/ocr.js`、`app/src/screens/ScanPackage.jsx`

## 2. app 自己找文字

一开始需要用户手动拖框把文字圈出来。这样又慢又别扭，所以现在改成自动完成。

分两步：

1. **找文字。** 把照片缩小后快速扫一遍。这一步不追求读对，只是要弄清楚字在
   **哪里**。
2. **读文字。** 把找到的每一块从原始大图上裁下来，仔细读一遍。

如果第一步已经读得很清楚，就跳过第二步以节省时间。清晰的标签大约一秒，困难的
大约三秒。

手动框选还在，但只作为自动识别出错时的备用手段。

## 3. 把文字变成食材

光读出字还不够，`BOLOGNESE` 得变成"意面酱"才有用。

新增的匹配步骤会把识别出的词跟数据文件里的 49 个食材名对照，然后把结果做成
按钮。用户点一下就加进清单，不用再自己打字。

匹配能容忍 OCR 的错误。瓶子被读成 `IN OLIVE UIL` 仍然能匹配到橄榄油，因为旁边
那个词把意思定住了。

它还顺带修掉一个老问题：以前食材名是自由输入，用户打什么都能存进去，后面查
营养时就对不上了。现在每个食材都必须来自已知的清单。

**文件：** `app/src/ai/ingredientMatch.js`

## 4. 真实食谱和真实营养

食谱页面原来显示的是直接写在代码里的六道菜，配着网上的图片和编造的营养数字。

现在用的是真实数据：**100 道食谱**和**全部 49 个食材的 AUSNUT 营养值**。超市
链接和数据出处也改成从数据文件读取，不再写死在代码里。

**关于营养页：** 食谱数据只列出用了哪些食材，没有说各用多少。也就是说整道菜的
合计根本算不出来。与其编个数字，页面改成显示每个食材每 100 克的 AUSNUT 真实
数值，旁边标出官方食物名称和编号，并且直接写明为什么没有合计。

食谱卡片上的烹饪时间和热量也因为同样的原因去掉了：数据里没有这些信息。

**偏好现在真的起作用了。** 以前是收集了但完全不用。素食、低卡、高蛋白直接取自
食谱标签；纯素、无麸质、无乳制品以及各项过敏，则根据每道菜用到的食材推算出来。
健康目标只是把符合的食谱往前排，不会把别的藏起来，因为今晚就能做的菜不该消失。

**文件：** `app/src/data/foodData.js`，以及四个食谱页面

## 5. 数据文件

瓶子上常常只印 `BOLOGNESE`，而不是 "bolognese sauce"。关键词表里只有双词形式，
所以什么都匹配不上。

给意面酱加了五个单词形式的关键词：bolognese、napoletana、napolitana、
arrabbiata、sugo。

有一点以后会用到：给已有食材**加关键词**是一分钟的事；**加一个全新食材**要慢
得多，因为需要人工去查 AUSNUT 的食物编号和八项营养值。

## 6. 界面修复

- **删掉了多余的结果页。** 拍完照原本先进"Detected ingredients"，再进几乎一模
  一样的"Confirm ingredients"。现在直接进确认页。
- **文字不再居中。** 项目里还留着 Vite 起始模板的样式表，它把 13 个页面全部居中、
  按桌面宽度框住，还会让手机在深色模式下把输入框变黑。
- **食材名显示正常了。** `Olive_oil` 现在显示成 "Olive oil"。
- **可以从相册选照片了。** 文件选择器原来被锁定在摄像头，用不了相册。锁已解除。

---

## 已知限制

**彩色包装上的 OCR 不可靠。** 白底黑字的平面贴纸，比如 Coles 的牛肉糜托盘，能在
零点三秒左右完美读出。但深绿字压浅绿底的冷冻豌豆袋、白字压彩色横幅的酱料瓶，
经常连商品名都定位不到。

原因出在 OCR 引擎本身。Tesseract 是为扫描文档设计的，不适合读印在图片和色块上的
字。字体因素已经测试并排除。要真正解决需要换一个识别器，而不是继续调整现在这个。

**只认识 49 个食材。** 一件商品可能被正确读出来，却仍然匹配不上，只是因为清单里
没有它，比如冷冻豌豆。这两种失败在用户看来一模一样，但需要完全不同的解决办法。

**没有份量数据。** 除非食谱数据补上每份用多少，否则整道菜的营养合计无法显示。

## 运行方式

```bash
npm install --prefix app
npm run dev --prefix app
```

打开它打印出的地址。注意是 `app` 目录，不是 `web`，`web` 是 Spike A 和 B 的旧
demo。

要在手机上测试，让手机连同一个 Wi-Fi，然后打开 Vite 打印的 Network 地址。
