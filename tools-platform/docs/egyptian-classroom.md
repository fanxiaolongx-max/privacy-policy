# 埃及口语课堂内容与验证

课堂源：`backend/builtin-tools/tool-mtakhxqm/`。运行时用户工具与学习状态未改写。

## 教学范围

采用开罗常见口语；不把它等同于埃及所有地区的唯一读法。主入口为字母与拼读、词汇记忆、生活会话、字母抽查。原家庭、购物、数字和对话合并为生活会话内的主题；重复静态词表合并进词卡，筛选默认折叠。标准语仅保留在明确标记的对照说明中。

校正包括：ج 的 g、日常 ق 的喉塞音、ث / ذ / ظ 依词变化；بيت 等词的 ē / ō；埃及日常 عيش、لبن、فرخة、جبنة；去掉埃及词库中的 كيفك 等沙姆说法和 هذا / ليس 等标准语专用词条；修复谐音栏误填释义。静符是不带元音的辅音，叠音是辅音延长；日常词不机械增加标准语格尾。普通埃及聊天通常不写短音符，教材带符号作为辅助，整词转写优先。

参考：[Lisaan Masry 发音](https://www.lisaanmasry.org/grammar/pronunciation.html)、[读写说明](https://www.lisaanmasry.org/help/online/en/arabic.html)。汉语谐音只能近似提示，不能准确表达咽音、重辅音和喉塞音。内置配音为 ar-EG-SalmaNeural 合成音，不是母语教师逐条录音。

## 字母抽查

28 字母可单选、多选或全选。每轮 20 题、每 5 题加速；题型含位置字形、短音、静符、真实词中的长音、叠音与固定表达的 -an。随机字形组仅考高亮项，真实词内高亮保持连续连写。2 或 3 个读音选项按读音去重。答对计分并自动继续；答错或超时显示正确读音，听音复习后继续。错题隔题重现，结算支持错题专项。切换模块、后台隐藏均暂停，重听不会叠加音频。

题库及选项生成独立在 `letter-drill.js`；不创建新的业务数据库或学习状态存储。

## 音频维护

`node backend/builtin-tools/tool-mtakhxqm/generate-classroom-audio.cjs` 生成课堂专用音频映射。字形与 TTS 专用发音拼写分别保留；已有资产按内容哈希复用。成功后更新总音频文件数，确保旧安装解压时能发现新增音频。

随后运行 `node backend/builtin-tools/tool-mtakhxqm/pack-audio.mjs` 更新版本控制中的音频归档。MP3 为忽略的解压资源；发布依靠 `audio.bundle.zip`，不是依赖开发机上的松散音频文件。

## 验证

- `node --check`：页面提取的内联脚本、classroom.js、letter-drill.js、generate-classroom-audio.cjs。
- `node --test tests/arabic-vocabulary-quality.test.js tests/arabic-letter-drill.test.js`：词汇、音标标签、28 字母覆盖、单字母选项去重、连写边界、加速下限、音频归档覆盖、四模块目标。
- 浏览器验证：空选择、单选二选一、错误反馈、暂停继续、20 题结算、错题入口、词库、390px 窄屏（无横向溢出）、深色主题。
- 未运行 Electron 打包；未逐条人工听审全部合成音频。

更新已安装的课堂应使用平台现有的内置工具同步流程，保留用户工具修改冲突提示和备份，不手工覆盖运行时目录。
