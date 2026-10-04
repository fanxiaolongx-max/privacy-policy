# 埃及口语课堂内容与验证

课堂源：`backend/builtin-tools/tool-mtakhxqm/`。运行时用户工具与学习状态未改写；此次为源码与内置音频包更新，未部署到线上实例。

## 教学范围

采用开罗常见口语；不把它等同于埃及所有地区的唯一读法。主入口为字母与拼读、词汇记忆、生活会话、字母抽查。家庭、购物、数字、对话与复习放在生活会话内；词卡筛选默认折叠。

`letter-drill-data.js` 保存显式词内读音、整词转写、逐字映射和 TTS 专用拼写。现有 126 个单词、220 个词内考点，另有 99 个基础音节题。新增 20 个简单口语词（例如 أين 的日常对应 فين、بكرة、شوية、تمام、فول），词汇记忆模块复用同一份新增词数据。校正包括爷爷 جِدّ /ɡidː/、干净 نِضِيف /nidˤiːf/、眼镜 نَضَّارَة；修正了咖啡、狗等题把相邻辅音错误算进目标读音的问题。无声 tanwin 支架 alif 不作为考点。

游戏选项采用宽式 IPA：ʔ、ħ、x、ɡ、ʃ、ʕ、ɣ、咽化 ˤ 和长度 ː。短 e/o 转写的常见语音变体统一到宽式 /i,u/，防止它们与 /i,u/ 成为错误的互斥选项；长 /eː,oː/ 与 /iː,uː/ 仍严格区分。带符号阿文是教学辅助，不能仅由字形机械推导埃及读音；末尾写 ي/ا 不一定读长元音。

参考：[Lingualism 埃及读写规则](https://resources.lingualism.com/egyptian-arabic/egyptian-arabic-orthography/)、[音位转写](https://resources.lingualism.com/egyptian-arabic/egyptian-arabic-script-and-phonemic-transcription-guide/)、[家庭词汇](https://resources.lingualism.com/egyptian-arabic/family/)、[Lisaan Masry](https://www.lisaanmasry.org/grammar/pronunciation.html)。内置声音为 ar-EG-SalmaNeural 合成音，不是母语教师逐条录音。

## 字母抽查

28 字母可单选、多选或全选；每轮 20 题、每 5 题加速。首、中、尾字形随机组合；字母只用底色高亮，没有易误认成发音符号的下划线。2–3 个选项只显示 IPA，按 IPA 去重。

运行与暂停均保留完整单词。点击单词朗读并切换拆字；“听整词”只朗读，“拆字母”切换展开。拆开的每个字母可点读，使用该词内的读音，长音载体与前一字母共享元音。暂停禁止计时和作答，但点读仍可用。

整词与可独立合成的目标音使用不同音频键。基础 CV/CVV 与收尾辅音使用前导 /a/ 承载音，界面说明前导音不是答案。孤立 TTS 不能可靠区分 /eː,oː/ 或无喉塞起始的纯元音，因此相应字母回到所在真实单词中点读，明确显示“词内读音”。不生成一段声音来冒充两个不同 IPA。

答对后等配音结束再推进；配音未能播放则保留题目。拆字或主动点读会取消自动推进，方便复习。答错和超时显示正确 IPA，手动继续。错题隔题重现，结算支持错题专项；切换模块或页面进入后台均暂停，点读不会叠加声音。

## 音频维护与审计

`generate-classroom-audio.cjs` 的发音计划使用精确键，去标点别名不能覆盖精确键；哈希包含音色、语速和修订版本。缓存需核对生成元数据、文件哈希及解码结果；生成使用临时文件、三次重试、首尾静音裁剪、有限幅度的音量归一化。全部成功后才更新映射。基础课堂音节也优先使用修正后的目标音；原始资源保留。

- `audio/drill-manifest.json`：兼容现有页面的路径映射。
- `audio/drill-audit.json`：375 个精确键、372 个当前配音文件的输入、预期 IPA、承载音及 SHA256。全部通过解码、引用、音量与活动声段检查。
- `audio/library-audit.json`：原库 1261 个 MP3 全部可解码、无损坏、无全静音，记录 10 个低 RMS 旧文件；当前归档共 1645 个 MP3。低 RMS 不能单独证明读音错误。
- `audio/audio.bundle.zip`：发布资源；MP3 是忽略的解压文件。

生成与打包：

```bash
node backend/builtin-tools/tool-mtakhxqm/generate-classroom-audio.cjs
node backend/builtin-tools/tool-mtakhxqm/generate-classroom-audio.cjs --audit
node backend/builtin-tools/tool-mtakhxqm/pack-audio.mjs
```

解压校验归档 CRC、映射所需文件和文件内容，修复缺失或陈旧音频；不再用“文件数足够”作为资源完整性的依据。

语言数据核对、ASR 抽样与声学检测都不能代替母语者逐条试听。需要重点试听的仍包括非重读词尾、长 /eː,oː/、喉塞和叠音；ذَوْق 与 فَوْق 的 /oːʔ/ 输入列入明确的待听审清单。未宣称全库已经真人发音认证。

## 验证

- `node --check`：页面内联脚本、classroom.js、letter-drill-data.js、letter-drill.js、generate-classroom-audio.cjs、unpack-audio.mjs、pack-audio.mjs。
- `node --test tests/arabic-vocabulary-quality.test.js tests/arabic-letter-drill.test.js tests/arabic-audio-build.test.js`：29 项通过。覆盖 IPA、字形与目标范围、词内点读、暂停与计分、音频结束后推进、复习取消推进、当前发音哈希、压缩包覆盖、精确键优先、环境变量、陈旧文件修复、CRC 拒绝与重复解压。
- 连写高亮：整词保留在一个文本节点中，由 DOM Range 测量目标字母及附加符号，再绘制独立底色；字体加载和窗口缩放后重新定位，不插入连接符或改写单词。新增完整文本与目标范围回归测试。
- 浏览器检查：كِتَاب 的 تَ 高亮保持连写；运行和暂停拆字／点读、二选一与三选一、正确及错误反馈、复位控件、390px 窄屏无横向溢出、深色与浅色主题。
- 未运行 Electron 打包；未逐条人工听审全部合成音频；本次连写修复未在实体 iPhone Safari 上验证。

更新已安装的课堂应使用平台现有内置工具同步流程，保留用户工具修改冲突提示和备份，不手工覆盖运行时目录。
