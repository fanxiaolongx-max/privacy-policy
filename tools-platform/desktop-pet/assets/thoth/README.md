# 托特桌宠素材

由用户提供的四张青绿陶瓷鸟人 JPG，经内置 imagegen 编辑为透明 PNG。
资源保存在项目内，不依赖远程图片地址。

| 文件 | 原图 | 使用状态 |
| --- | --- | --- |
| `idle.png` | 照片 1：站立 | 待机 |
| `wave.png` | 照片 2：挥手 | 开心互动、摸头、聊天头像 |
| `walk.png` | 照片 3：迈步 | 拖动、重力下落 |
| `think.png` | 照片 4：托腮 | 工作、键盘反馈、问答思考 |

保留原有 IPC 与保存的状态名，使旧设置继续有效。四张图是静态姿态，呼吸、按压、键盘反馈与下落动画仍由现有桌宠代码驱动。

编辑提示词（四次调用仅替换姿态为 standing / waving / walking / chin-resting thoughtful）：

> Use case: background-extraction. Edit target: the attached image. Create a clean transparent PNG cutout for a desktop pet. Remove ONLY the white background, including any white background enclosed between the limbs. Preserve this exact turquoise ceramic bird-headed Egyptian character, its [pose] pose, glossy jade glaze, gold flecks, navy outlines, white highlights and eye whites. Do not redraw, change pose, add objects, text or shadows. Keep the entire figure including all feet, generous small transparent margin, centered on a portrait transparent canvas. The background must have real alpha transparency, not painted white or a checkerboard.
